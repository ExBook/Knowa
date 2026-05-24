import { nanoid } from 'nanoid';
import { db } from './db';
import { bankRepo } from './bankRepo';
import type { Question } from '../shared/types';

type CreateInput = Omit<Question, 'id' | 'createdAt' | 'order'>;

export const questionRepo = {
  async create(input: CreateInput): Promise<Question> {
    const count = await db.questions.where('bankId').equals(input.bankId).count();
    const question: Question = {
      id: nanoid(),
      ...input,
      order: count + 1,
      createdAt: Date.now(),
    };
    await db.questions.put(question);
    await bankRepo.syncQuestionCount(input.bankId);
    return question;
  },

  async bulkCreate(inputs: CreateInput[]): Promise<Question[]> {
    if (inputs.length === 0) return [];
    const bankId = inputs[0].bankId;
    const count = await db.questions.where('bankId').equals(bankId).count();
    const questions: Question[] = inputs.map((input, i) => ({
      id: nanoid(),
      ...input,
      order: count + i + 1,
      createdAt: Date.now(),
    }));
    await db.transaction('rw', db.questions, db.banks, async () => {
      await db.questions.bulkPut(questions);
      await bankRepo.syncQuestionCount(bankId);
    });
    return questions;
  },

  async findById(id: string): Promise<Question | undefined> {
    return db.questions.get(id);
  },

  async findByBankId(bankId: string): Promise<Question[]> {
    return db.questions.where('bankId').equals(bankId).sortBy('order');
  },

  async update(id: string, input: Partial<Pick<Question, 'type' | 'body' | 'options' | 'answer' | 'explanation' | 'tags'>>): Promise<Question> {
    const q = await db.questions.get(id);
    if (!q) throw new Error('Question not found');
    const updated = { ...q, ...input };
    await db.questions.put(updated);
    return updated;
  },

  async delete(id: string, bankId: string): Promise<void> {
    await db.transaction('rw', db.questions, db.quizRecords, db.notes, db.banks, async () => {
      await db.questions.delete(id);
      await db.quizRecords.where('questionId').equals(id).delete();
      await db.notes.where('questionId').equals(id).delete();
      const remaining = await db.questions.where('bankId').equals(bankId).sortBy('order');
      for (let i = 0; i < remaining.length; i++) {
        if (remaining[i].order !== i + 1) {
          await db.questions.update(remaining[i].id, { order: i + 1 });
        }
      }
      await bankRepo.syncQuestionCount(bankId);
    });
  },

  async deleteByBankId(bankId: string): Promise<void> {
    await db.questions.where('bankId').equals(bankId).delete();
  },
};
