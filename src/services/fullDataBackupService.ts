import { saveAs } from 'file-saver';
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
  return `exlocal-backup-${date}.exlocal.json`;
}

export async function exportFullDataToFile(): Promise<void> {
  const backup: FullDataBackup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    appSettings: getAppSettings(),
    banks: await db.banks.toArray(),
    questions: await db.questions.toArray(),
    quizRecords: await db.quizRecords.toArray(),
    notes: await db.notes.toArray(),
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' });
  saveAs(blob, backupFilename());
}

export async function importFullDataFromFile(file: File): Promise<{
  bankCount: number;
  questionCount: number;
  recordCount: number;
  noteCount: number;
}> {
  const backup = parseBackup(await file.text());

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
