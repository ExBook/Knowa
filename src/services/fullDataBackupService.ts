import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { db } from '../repo/db';
import type { Bank, Note, Question, QuizRecord } from '../shared/types';
import { defaultAppSettings, getAppSettings, saveAppSettings, type AppSettings } from './appSettings';

interface FullDataBackup {
  version: 1;
  exportedAt: string;
  appSettings: AppSettings;
  banks: Bank[];
  questions: Question[];
  quizRecords: QuizRecord[];
  notes: Note[];
}

type JsonNode = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: JsonNode[];
  [key: string]: unknown;
};

function assertArray(value: unknown, label: string): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`备份文件缺少 ${label} 数据`);
  }
}

function parseBackup(raw: string): FullDataBackup {
  const data = JSON.parse(raw) as Partial<FullDataBackup>;
  if (data.version !== 1) {
    throw new Error('备份文件版本不受支持');
  }

  assertArray(data.banks, '题库');
  assertArray(data.questions, '题目');
  assertArray(data.quizRecords, '做题记录');
  assertArray(data.notes, '笔记');

  return {
    version: 1,
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : new Date().toISOString(),
    appSettings: { ...defaultAppSettings, ...(data.appSettings ?? {}) },
    banks: data.banks as Bank[],
    questions: data.questions as Question[],
    quizRecords: data.quizRecords as QuizRecord[],
    notes: data.notes as Note[],
  };
}

function backupFilename(): string {
  const date = new Date().toISOString().slice(0, 10);
  return `exlocal-backup-${date}.exlocal`;
}

function imageExtension(dataUrl: string): string {
  const ext = dataUrl.match(/^data:image\/([^;]+)/)?.[1] ?? 'png';
  if (ext === 'svg+xml') {
    return 'svg';
  }
  if (ext === 'jpeg') {
    return 'jpg';
  }
  return ext;
}

function mimeFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? 'png';
  if (ext === 'svg') {
    return 'image/svg+xml';
  }
  if (ext === 'jpg') {
    return 'image/jpeg';
  }
  return `image/${ext}`;
}

function cloneWithImageExport(doc: object, images: Record<string, string>, nextName: (dataUrl: string) => string): object {
  function walk(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map(walk);
    }

    if (!value || typeof value !== 'object') {
      return value;
    }

    const node = value as JsonNode;
    const cloned: JsonNode = { ...node };
    if (node.attrs) {
      cloned.attrs = { ...node.attrs };
    }

    if (node.type === 'image' && typeof cloned.attrs?.src === 'string' && cloned.attrs.src.startsWith('data:')) {
      const filename = nextName(cloned.attrs.src);
      images[filename] = cloned.attrs.src;
      cloned.attrs.src = filename;
    }

    if (node.content) {
      cloned.content = node.content.map((child) => walk(child) as JsonNode);
    }

    return cloned;
  }

  return walk(doc) as object;
}

function replaceImageRefs(doc: object, imageMap: Record<string, string>): object {
  function walk(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map(walk);
    }

    if (!value || typeof value !== 'object') {
      return value;
    }

    const node = value as JsonNode;
    const cloned: JsonNode = { ...node };
    if (node.attrs) {
      cloned.attrs = { ...node.attrs };
    }

    if (
      node.type === 'image' &&
      typeof cloned.attrs?.src === 'string' &&
      !cloned.attrs.src.startsWith('data:') &&
      imageMap[cloned.attrs.src]
    ) {
      cloned.attrs.src = imageMap[cloned.attrs.src];
    }

    if (node.content) {
      cloned.content = node.content.map((child) => walk(child) as JsonNode);
    }

    return cloned;
  }

  return walk(doc) as object;
}

function extractBackupImages(questions: Question[], notes: Note[]): {
  images: Record<string, string>;
  questions: Question[];
  notes: Note[];
} {
  const images: Record<string, string> = {};
  let index = 0;
  const nextName = (dataUrl: string) => {
    index += 1;
    return `img_${index}.${imageExtension(dataUrl)}`;
  };

  return {
    images,
    questions: questions.map((question) => ({
      ...question,
      body: cloneWithImageExport(question.body, images, nextName),
      options: question.options.map((option) => ({ ...option, content: cloneWithImageExport(option.content, images, nextName) })),
      explanation: cloneWithImageExport(question.explanation, images, nextName),
    })),
    notes: notes.map((note) => ({ ...note, content: cloneWithImageExport(note.content, images, nextName) })),
  };
}

async function parseZipBackup(file: File): Promise<FullDataBackup> {
  const zip = await JSZip.loadAsync(file);
  const backupJson = zip.file('backup.json');
  if (!backupJson) {
    throw new Error('备份包缺少 backup.json');
  }

  const backup = parseBackup(await backupJson.async('string'));
  const imageMap: Record<string, string> = {};
  const imagePaths = Object.keys(zip.files).filter((path) => path.startsWith('images/') && !path.endsWith('/'));
  for (const path of imagePaths) {
    const filename = path.replace('images/', '');
    const data = await zip.file(path)!.async('base64');
    imageMap[filename] = `data:${mimeFromFilename(filename)};base64,${data}`;
  }

  return {
    ...backup,
    questions: backup.questions.map((question) => ({
      ...question,
      body: replaceImageRefs(question.body, imageMap),
      options: question.options.map((option) => ({ ...option, content: replaceImageRefs(option.content, imageMap) })),
      explanation: replaceImageRefs(question.explanation, imageMap),
    })),
    notes: backup.notes.map((note) => ({ ...note, content: replaceImageRefs(note.content, imageMap) })),
  };
}

export async function exportFullDataToFile(): Promise<void> {
  const banks = await db.banks.toArray();
  const questions = await db.questions.toArray();
  const quizRecords = await db.quizRecords.toArray();
  const notes = await db.notes.toArray();
  const extracted = extractBackupImages(questions, notes);
  const backup: FullDataBackup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    appSettings: getAppSettings(),
    banks,
    questions: extracted.questions,
    quizRecords,
    notes: extracted.notes,
  };

  const zip = new JSZip();
  zip.file('backup.json', JSON.stringify(backup, null, 2));
  const imageFolder = zip.folder('images');
  for (const [filename, dataUrl] of Object.entries(extracted.images)) {
    imageFolder?.file(filename, dataUrl.split(',')[1] ?? '', { base64: true });
  }

  saveAs(await zip.generateAsync({ type: 'blob' }), backupFilename());
}

export async function importFullDataFromFile(file: File): Promise<{
  bankCount: number;
  questionCount: number;
  recordCount: number;
  noteCount: number;
}> {
  const backup = file.name.toLowerCase().endsWith('.json') ? parseBackup(await file.text()) : await parseZipBackup(file);

  await db.transaction('rw', db.banks, db.questions, db.quizRecords, db.notes, async () => {
    await db.banks.bulkPut(backup.banks);
    await db.questions.bulkPut(backup.questions);
    await db.quizRecords.bulkPut(backup.quizRecords);
    await db.notes.bulkPut(backup.notes);

    await Promise.all(
      backup.banks.map(async (bank) => {
        const questionCount = await db.questions.where('bankId').equals(bank.id).count();
        await db.banks.update(bank.id, { questionCount, updatedAt: Math.max(bank.updatedAt, Date.now()) });
      }),
    );
  });

  saveAppSettings(backup.appSettings);

  return {
    bankCount: backup.banks.length,
    questionCount: backup.questions.length,
    recordCount: backup.quizRecords.length,
    noteCount: backup.notes.length,
  };
}
