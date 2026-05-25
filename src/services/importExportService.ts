import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { nanoid } from 'nanoid';
import { bankRepo } from '../repo/bankRepo';
import { db } from '../repo/db';
import { questionRepo } from '../repo/questionRepo';
import type { Bank, Note, Question, QuizRecord } from '../shared/types';

interface BankExportData {
  version: 1;
  bank: { name: string; description: string; tags: string[] };
  questions: Array<{
    id: string;
    type: Question['type'];
    body: object;
    options: Question['options'];
    answer: number[];
    explanation: object;
    order: number;
    tags: string[];
  }>;
}

interface RecordsExportData {
  records?: QuizRecord[];
  notes?: Note[];
}

interface ImportResult {
  bank: Bank;
  questionCount: number;
}

type JsonNode = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: JsonNode[];
  [key: string]: unknown;
};

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

function extractImages(questions: Question[]): {
  images: Record<string, string>;
  questions: BankExportData['questions'];
} {
  const images: Record<string, string> = {};
  let index = 0;

  function nextName(dataUrl: string): string {
    const ext = imageExtension(dataUrl);
    index += 1;
    return `img_${index}.${ext}`;
  }

  const exportedQuestions = questions.map((question) => ({
    id: question.id,
    type: question.type,
    body: cloneWithImageExport(question.body, images, nextName),
    options: question.options.map((option) => ({
      ...option,
      content: cloneWithImageExport(option.content, images, nextName),
    })),
    answer: question.answer,
    explanation: cloneWithImageExport(question.explanation, images, nextName),
    order: question.order,
    tags: question.tags,
  }));

  return { images, questions: exportedQuestions };
}

async function readBankArchive(file: File): Promise<{
  bankData: BankExportData;
  recordsData: RecordsExportData | null;
  imageMap: Record<string, string>;
}> {
  const zip = await JSZip.loadAsync(file);
  const bankJsonFile = zip.file('bank.json');
  if (!bankJsonFile) {
    throw new Error('Invalid .exbank: missing bank.json');
  }

  const bankData = JSON.parse(await bankJsonFile.async('string')) as BankExportData;
  if (bankData.version !== 1 || !bankData.bank || !Array.isArray(bankData.questions)) {
    throw new Error('Invalid .exbank: unsupported bank data');
  }

  const recordsFile = zip.file('records.json');
  const recordsData = recordsFile ? (JSON.parse(await recordsFile.async('string')) as RecordsExportData) : null;
  const imageMap: Record<string, string> = {};
  const imagePaths = Object.keys(zip.files).filter((path) => path.startsWith('images/') && !path.endsWith('/'));

  for (const path of imagePaths) {
    const filename = path.replace('images/', '');
    const data = await zip.file(path)!.async('base64');
    imageMap[filename] = `data:${mimeFromFilename(filename)};base64,${data}`;
  }

  return { bankData, recordsData, imageMap };
}

async function importIntoBank(bankId: string, bankData: BankExportData, recordsData: RecordsExportData | null, imageMap: Record<string, string>): Promise<number> {
  const questions = bankData.questions.map((question) => ({
    bankId,
    type: question.type,
    body: replaceImageRefs(question.body, imageMap),
    options: question.options.map((option) => ({ ...option, content: replaceImageRefs(option.content, imageMap) })),
    answer: question.answer,
    explanation: replaceImageRefs(question.explanation, imageMap),
    tags: question.tags,
  }));

  const createdQuestions = await questionRepo.bulkCreate(questions);

  if (recordsData) {
    const questionIdMap = new Map(bankData.questions.map((question, index) => [question.id, createdQuestions[index]?.id]));
    const records = recordsData.records
      ?.map((record) => {
        const questionId = questionIdMap.get(record.questionId);
        return questionId ? { ...record, id: nanoid(), bankId, questionId } : null;
      })
      .filter((record): record is QuizRecord => record !== null);
    const notes = recordsData.notes
      ?.map((note) => {
        const questionId = questionIdMap.get(note.questionId);
        return questionId ? { ...note, id: nanoid(), bankId, questionId } : null;
      })
      .filter((note): note is Note => note !== null);

    if (records?.length) {
      await db.quizRecords.bulkPut(records);
    }
    if (notes?.length) {
      await db.notes.bulkPut(notes);
    }
  }

  return createdQuestions.length;
}

export async function exportBank(bankId: string, includeRecords: boolean): Promise<Blob> {
  const bank = await bankRepo.findById(bankId);
  if (!bank) {
    throw new Error('Bank not found');
  }

  const sourceQuestions = await questionRepo.findByBankId(bankId);
  const { images, questions } = extractImages(sourceQuestions);
  const bankData: BankExportData = {
    version: 1,
    bank: { name: bank.name, description: bank.description, tags: bank.tags },
    questions,
  };

  const zip = new JSZip();
  zip.file('bank.json', JSON.stringify(bankData, null, 2));

  if (includeRecords) {
    const records = await db.quizRecords.where('bankId').equals(bankId).toArray();
    const notes = await db.notes.where('bankId').equals(bankId).toArray();
    zip.file('records.json', JSON.stringify({ records, notes }, null, 2));
  }

  const imageFolder = zip.folder('images');
  for (const [filename, dataUrl] of Object.entries(images)) {
    imageFolder?.file(filename, dataUrl.split(',')[1] ?? '', { base64: true });
  }

  return zip.generateAsync({ type: 'blob' });
}

export async function exportBankToFile(bankId: string, includeRecords: boolean): Promise<void> {
  const bank = await bankRepo.findById(bankId);
  if (!bank) {
    throw new Error('Bank not found');
  }

  const blob = await exportBank(bankId, includeRecords);
  const suffix = includeRecords ? 'full' : 'share';
  saveAs(blob, `${bank.name}-${suffix}.exbank`);
}

export async function importExbank(file: File): Promise<ImportResult> {
  const { bankData, recordsData, imageMap } = await readBankArchive(file);
  const bank = await bankRepo.create({
    name: bankData.bank.name,
    description: bankData.bank.description,
    tags: bankData.bank.tags,
  });
  const questionCount = await importIntoBank(bank.id, bankData, recordsData, imageMap);
  return { bank, questionCount };
}

export async function importExbankIntoBank(file: File, bankId: string): Promise<ImportResult> {
  const bank = await bankRepo.findById(bankId);
  if (!bank) {
    throw new Error('Bank not found');
  }

  const { bankData, recordsData, imageMap } = await readBankArchive(file);
  const questionCount = await importIntoBank(bank.id, bankData, recordsData, imageMap);
  return { bank, questionCount };
}

export function detectDropType(files: File[]): 'exbank' | 'markdown' | 'unknown' {
  const names = files.map((file) => file.name.toLowerCase());
  if (names.some((name) => name.endsWith('.exbank'))) {
    return 'exbank';
  }
  if (names.some((name) => name.endsWith('.md'))) {
    return 'markdown';
  }
  return 'unknown';
}

export function buildImageMap(files: File[]): Record<string, string> {
  const imageMap: Record<string, string> = {};
  for (const file of files) {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext && ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) {
      imageMap[file.name] = `[pending:${file.name}]`;
    }
  }
  return imageMap;
}
