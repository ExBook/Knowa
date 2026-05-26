import { nanoid } from 'nanoid';
import { db } from './db';
import type { Question } from '../shared/types';

type CreateInput = Omit<Question, 'id' | 'createdAt' | 'order'>;
type UpdateInput = Partial<
  Pick<Question, 'type' | 'body' | 'options' | 'answer' | 'explanation' | 'tags' | 'chapter' | 'section' | 'knowledgePoint' | 'starred'>
>;

async function updateQuestionCount(bankId: string, delta: number): Promise<void> {
  const bank = await db.banks.get(bankId);
  if (!bank) {
    throw new Error(`Bank not found: ${bankId}`);
  }

  await db.banks.update(bankId, {
    questionCount: Math.max(0, bank.questionCount + delta),
    updatedAt: Date.now(),
  });
}

export const questionRepo = {
  async create(input: CreateInput): Promise<Question> {
    const now = Date.now();
    const question = await db.transaction('rw', db.questions, db.banks, async () => {
      const count = await db.questions.where('bankId').equals(input.bankId).count();
      const created: Question = {
        id: nanoid(),
        ...input,
        order: count + 1,
        createdAt: now,
      };

      await db.questions.put(created);
      await updateQuestionCount(input.bankId, 1);
      return created;
    });

    return question;
  },

  async bulkCreate(inputs: CreateInput[]): Promise<Question[]> {
    if (inputs.length === 0) {
      return [];
    }

    const bankId = inputs[0].bankId;
    if (inputs.some((input) => input.bankId !== bankId)) {
      throw new Error('Bulk create only supports questions from the same bank');
    }

    const now = Date.now();
    return db.transaction('rw', db.questions, db.banks, async () => {
      const count = await db.questions.where('bankId').equals(bankId).count();
      const questions: Question[] = inputs.map((input, index) => ({
        id: nanoid(),
        ...input,
        order: count + index + 1,
        createdAt: now,
      }));

      await db.questions.bulkPut(questions);
      await updateQuestionCount(bankId, questions.length);
      return questions;
    });
  },

  async findById(id: string): Promise<Question | undefined> {
    return db.questions.get(id);
  },

  async findByBankId(bankId: string): Promise<Question[]> {
    return db.questions.where('bankId').equals(bankId).sortBy('order');
  },

  async findAll(): Promise<Question[]> {
    return db.questions.toArray();
  },

  async findStarred(): Promise<Question[]> {
    const questions = await db.questions.toArray();
    return questions.filter((question) => question.starred).sort((a, b) => b.createdAt - a.createdAt);
  },

  async update(id: string, input: UpdateInput): Promise<Question> {
    const question = await db.questions.get(id);
    if (!question) {
      throw new Error(`Question not found: ${id}`);
    }

    const updated: Question = { ...question, ...input };
    await db.questions.put(updated);
    return updated;
  },

  async delete(id: string, bankId: string): Promise<void> {
    await db.transaction('rw', db.questions, db.quizRecords, db.notes, db.banks, async () => {
      await db.questions.delete(id);
      await db.quizRecords.where('questionId').equals(id).delete();
      await db.notes.where('questionId').equals(id).delete();

      const remaining = await db.questions.where('bankId').equals(bankId).sortBy('order');
      await Promise.all(
        remaining.map((question, index) =>
          question.order === index + 1 ? undefined : db.questions.update(question.id, { order: index + 1 }),
        ),
      );

      await updateQuestionCount(bankId, -1);
    });
  },

  async deleteByBankId(bankId: string): Promise<void> {
    await db.questions.where('bankId').equals(bankId).delete();
  },
};
