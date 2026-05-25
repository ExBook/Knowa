import { beforeEach, describe, expect, it } from 'vitest';
import { bankRepo } from '../../src/repo/bankRepo';
import { db } from '../../src/repo/db';
import { questionRepo } from '../../src/repo/questionRepo';
import { quizRecordRepo } from '../../src/repo/quizRecordRepo';

const emptyDoc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }] };

describe('quizRecordRepo', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('creates a record', async () => {
    const bank = await bankRepo.create({ name: 't', description: '', tags: [] });
    const q = await questionRepo.create({
      bankId: bank.id,
      type: 'single',
      body: emptyDoc,
      options: [{ index: 0, content: emptyDoc }],
      answer: [0],
      explanation: emptyDoc,
      tags: [],
    });

    const record = await quizRecordRepo.create({
      questionId: q.id,
      bankId: bank.id,
      selectedAnswer: [0],
      isCorrect: true,
      duration: 30,
      mode: 'practice',
    });

    expect(record.id).toBeDefined();
    expect(record.isCorrect).toBe(true);
  });

  it('finds records by bankId', async () => {
    const bank = await bankRepo.create({ name: 't2', description: '', tags: [] });
    const q = await questionRepo.create({
      bankId: bank.id,
      type: 'single',
      body: emptyDoc,
      options: [{ index: 0, content: emptyDoc }],
      answer: [0],
      explanation: emptyDoc,
      tags: [],
    });
    await quizRecordRepo.create({
      questionId: q.id,
      bankId: bank.id,
      selectedAnswer: [0],
      isCorrect: true,
      duration: 10,
      mode: 'practice',
    });

    const records = await quizRecordRepo.findByBankId(bank.id);

    expect(records).toHaveLength(1);
  });

  it('finds records by questionId', async () => {
    const bank = await bankRepo.create({ name: 't3', description: '', tags: [] });
    const q = await questionRepo.create({
      bankId: bank.id,
      type: 'truefalse',
      body: emptyDoc,
      options: [{ index: 0, content: emptyDoc }],
      answer: [0],
      explanation: emptyDoc,
      tags: [],
    });
    await quizRecordRepo.create({
      questionId: q.id,
      bankId: bank.id,
      selectedAnswer: [0],
      isCorrect: true,
      duration: 5,
      mode: 'exam',
    });

    const records = await quizRecordRepo.findByQuestionId(q.id);

    expect(records).toHaveLength(1);
  });

  it('getStats returns correct aggregation', async () => {
    const bank = await bankRepo.create({ name: 't4', description: '', tags: [] });
    const q1 = await questionRepo.create({
      bankId: bank.id,
      type: 'single',
      body: emptyDoc,
      options: [{ index: 0, content: emptyDoc }],
      answer: [0],
      explanation: emptyDoc,
      tags: [],
    });
    const q2 = await questionRepo.create({
      bankId: bank.id,
      type: 'single',
      body: emptyDoc,
      options: [{ index: 0, content: emptyDoc }],
      answer: [0],
      explanation: emptyDoc,
      tags: [],
    });
    await quizRecordRepo.create({
      questionId: q1.id,
      bankId: bank.id,
      selectedAnswer: [0],
      isCorrect: true,
      duration: 10,
      mode: 'practice',
    });
    await quizRecordRepo.create({
      questionId: q2.id,
      bankId: bank.id,
      selectedAnswer: [1],
      isCorrect: false,
      duration: 20,
      mode: 'practice',
    });

    const stats = await quizRecordRepo.getStats(bank.id);

    expect(stats.totalAnswered).toBe(2);
    expect(stats.correctCount).toBe(1);
    expect(stats.accuracy).toBe(0.5);
    expect(stats.totalDuration).toBe(30);
  });
});
