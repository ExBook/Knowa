import { nanoid } from 'nanoid';
import type { Note } from '../shared/types';
import { db } from './db';

export const noteRepo = {
  async save(questionId: string, bankId: string, content: object): Promise<Note> {
    const existing = await db.notes.where('questionId').equals(questionId).first();
    const now = Date.now();

    if (existing) {
      const updated: Note = { ...existing, bankId, content, updatedAt: now };
      await db.notes.put(updated);
      return updated;
    }

    const note: Note = {
      id: nanoid(),
      questionId,
      bankId,
      content,
      updatedAt: now,
    };

    await db.notes.put(note);
    return note;
  },

  async findByQuestionId(questionId: string): Promise<Note | undefined> {
    return db.notes.where('questionId').equals(questionId).first();
  },

  async findByBankId(bankId: string): Promise<Note[]> {
    return db.notes.where('bankId').equals(bankId).toArray();
  },

  async findAll(): Promise<Note[]> {
    return db.notes.orderBy('updatedAt').reverse().toArray();
  },

  async delete(questionId: string): Promise<void> {
    await db.notes.where('questionId').equals(questionId).delete();
  },

  async deleteByBankId(bankId: string): Promise<void> {
    await db.notes.where('bankId').equals(bankId).delete();
  },
};
