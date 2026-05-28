import { nanoid } from 'nanoid';
import { db } from './db';
import type { Bank } from '../shared/types';

type CreateInput = Omit<Bank, 'id' | 'createdAt' | 'updatedAt' | 'questionCount'>;
type UpdateInput = Partial<Pick<Bank, 'name' | 'description' | 'tags' | 'color'>>;

export const bankRepo = {
  async create(input: CreateInput): Promise<Bank> {
    const now = Date.now();
    const bank: Bank = {
      id: nanoid(),
      ...input,
      questionCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    await db.banks.put(bank);
    return bank;
  },

  async findById(id: string): Promise<Bank | undefined> {
    return db.banks.get(id);
  },

  async findAll(): Promise<Bank[]> {
    return db.banks.orderBy('updatedAt').reverse().toArray();
  },

  async update(id: string, input: UpdateInput): Promise<Bank> {
    const bank = await db.banks.get(id);
    if (!bank) {
      throw new Error(`Bank not found: ${id}`);
    }

    const updated: Bank = { ...bank, ...input, updatedAt: Date.now() };
    await db.banks.put(updated);
    return updated;
  },

  async delete(id: string): Promise<void> {
    await db.transaction('rw', db.banks, db.questions, db.quizRecords, db.notes, async () => {
      await db.questions.where('bankId').equals(id).delete();
      await db.quizRecords.where('bankId').equals(id).delete();
      await db.notes.where('bankId').equals(id).delete();
      await db.banks.delete(id);
    });
  },

  async incrementQuestionCount(id: string, delta: number): Promise<void> {
    const bank = await db.banks.get(id);
    if (!bank) {
      throw new Error(`Bank not found: ${id}`);
    }

    await db.banks.update(id, {
      questionCount: Math.max(0, bank.questionCount + delta),
      updatedAt: Date.now(),
    });
  },
};
