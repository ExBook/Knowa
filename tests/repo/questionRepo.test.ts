import { beforeEach, describe, expect, it } from 'vitest';
import { bankRepo } from '../../src/repo/bankRepo';
import { db } from '../../src/repo/db';
import { questionRepo } from '../../src/repo/questionRepo';

const emptyBody = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'test' }] }] };

async function createTestBank() {
  return bankRepo.create({ name: 'Test Bank', description: '', tags: [] });
}

describe('questionRepo', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('creates a question and increments bank count', async () => {
    const bank = await createTestBank();
    const q = await questionRepo.create({
      bankId: bank.id,
      type: 'single',
      body: emptyBody,
      options: [
        { index: 0, content: emptyBody },
        { index: 1, content: emptyBody },
      ],
      answer: [0],
      explanation: emptyBody,
      tags: ['test'],
    });

    expect(q.id).toBeDefined();
    expect(q.order).toBe(1);
    expect(q.type).toBe('single');
    await expect(db.banks.get(bank.id)).resolves.toMatchObject({ questionCount: 1 });
  });

  it('finds questions by bankId sorted by order', async () => {
    const bank = await createTestBank();
    await questionRepo.create({
      bankId: bank.id,
      type: 'single',
      body: emptyBody,
      options: [{ index: 0, content: emptyBody }],
      answer: [0],
      explanation: emptyBody,
      tags: [],
    });
    await questionRepo.create({
      bankId: bank.id,
      type: 'truefalse',
      body: emptyBody,
      options: [{ index: 0, content: emptyBody }],
      answer: [0],
      explanation: emptyBody,
      tags: [],
    });

    const questions = await questionRepo.findByBankId(bank.id);

    expect(questions).toHaveLength(2);
    expect(questions.map((q) => q.order)).toEqual([1, 2]);
  });

  it('updates a question', async () => {
    const bank = await createTestBank();
    const q = await questionRepo.create({
      bankId: bank.id,
      type: 'single',
      body: emptyBody,
      options: [{ index: 0, content: emptyBody }],
      answer: [0],
      explanation: emptyBody,
      tags: [],
    });

    const updated = await questionRepo.update(q.id, { type: 'multiple', answer: [0, 1] });

    expect(updated.type).toBe('multiple');
    expect(updated.answer).toEqual([0, 1]);
  });

  it('deletes a question and reorders remaining', async () => {
    const bank = await createTestBank();
    const q1 = await questionRepo.create({
      bankId: bank.id,
      type: 'single',
      body: emptyBody,
      options: [{ index: 0, content: emptyBody }],
      answer: [0],
      explanation: emptyBody,
      tags: [],
    });
    await questionRepo.create({
      bankId: bank.id,
      type: 'single',
      body: emptyBody,
      options: [{ index: 0, content: emptyBody }],
      answer: [0],
      explanation: emptyBody,
      tags: [],
    });

    await questionRepo.delete(q1.id, bank.id);
    const remaining = await questionRepo.findByBankId(bank.id);

    expect(remaining).toHaveLength(1);
    expect(remaining[0].order).toBe(1);
    await expect(db.banks.get(bank.id)).resolves.toMatchObject({ questionCount: 1 });
  });

  it('bulk creates questions with correct ordering and count', async () => {
    const bank = await createTestBank();
    const inputs = [
      {
        bankId: bank.id,
        type: 'single' as const,
        body: emptyBody,
        options: [{ index: 0, content: emptyBody }],
        answer: [0],
        explanation: emptyBody,
        tags: [],
      },
      {
        bankId: bank.id,
        type: 'truefalse' as const,
        body: emptyBody,
        options: [{ index: 0, content: emptyBody }],
        answer: [0],
        explanation: emptyBody,
        tags: [],
      },
    ];

    const questions = await questionRepo.bulkCreate(inputs);

    expect(questions).toHaveLength(2);
    expect(questions.map((q) => q.order)).toEqual([1, 2]);
    await expect(db.banks.get(bank.id)).resolves.toMatchObject({ questionCount: 2 });
  });
});
