import { nanoid } from 'nanoid';
import type { QuizRecord } from '../shared/types';
import { db } from './db';

type CreateInput = Omit<QuizRecord, 'id' | 'timestamp'>;

export interface QuizStats {
  totalAnswered: number;
  correctCount: number;
  accuracy: number;
  totalDuration: number;
}

export const quizRecordRepo = {
  async create(input: CreateInput): Promise<QuizRecord> {
    const record: QuizRecord = { id: nanoid(), ...input, timestamp: Date.now() };
    await db.quizRecords.put(record);
    return record;
  },

  async bulkCreate(inputs: CreateInput[]): Promise<QuizRecord[]> {
    const now = Date.now();
    const records: QuizRecord[] = inputs.map((input) => ({
      id: nanoid(),
      ...input,
      timestamp: now,
    }));

    await db.quizRecords.bulkPut(records);
    return records;
  },

  async findByBankId(bankId: string): Promise<QuizRecord[]> {
    return db.quizRecords.where('bankId').equals(bankId).sortBy('timestamp');
  },

  async findByQuestionId(questionId: string): Promise<QuizRecord[]> {
    return db.quizRecords.where('questionId').equals(questionId).sortBy('timestamp');
  },

  async findAll(): Promise<QuizRecord[]> {
    return db.quizRecords.orderBy('timestamp').reverse().toArray();
  },

  async getStats(bankId: string): Promise<QuizStats> {
    const records = await db.quizRecords.where('bankId').equals(bankId).toArray();
    const correctCount = records.filter((record) => record.isCorrect).length;

    return {
      totalAnswered: records.length,
      correctCount,
      accuracy: records.length > 0 ? correctCount / records.length : 0,
      totalDuration: records.reduce((total, record) => total + record.duration, 0),
    };
  },

  async deleteByBankId(bankId: string): Promise<void> {
    await db.quizRecords.where('bankId').equals(bankId).delete();
  },
};
