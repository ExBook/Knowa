import Dexie, { type Table } from 'dexie';
import type { Bank, Note, Question, QuizRecord } from '../shared/types';

export class ExLocalDB extends Dexie {
  banks!: Table<Bank, string>;
  questions!: Table<Question, string>;
  quizRecords!: Table<QuizRecord, string>;
  notes!: Table<Note, string>;

  constructor() {
    super('exlocal');
    this.version(1).stores({
      banks: 'id, updatedAt',
      questions: 'id, bankId, order',
      quizRecords: 'id, questionId, bankId, timestamp',
      notes: 'id, questionId, bankId',
    });

    this.version(2).stores({
      banks: 'id, updatedAt',
      questions: 'id, bankId, order',
      quizRecords: 'id, questionId, bankId, timestamp',
      notes: 'id, questionId, bankId, updatedAt',
    });
  }
}

export const db = new ExLocalDB();
