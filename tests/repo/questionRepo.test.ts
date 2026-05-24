import { describe, it, expect, beforeAll } from 'vitest';
import { questionRepo } from '../../src/repo/questionRepo';
import { bankRepo } from '../../src/repo/bankRepo';
import { db } from '../../src/repo/db';

const emptyBody = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'test' }] }] };

async function createTestBank() {
  return bankRepo.create({ name: 'Test Bank', description: '', tags: [] });
}

describe('questionRepo', () => {
  beforeAll(async () => {
    await db.delete();
    await db.open();
  });

  it('creates a question', async () => {
    const bank = await createTestBank();
    const q = await questionRepo.create({
      bankId: bank.id, type: 'single', body: emptyBody,
      options: [{ index: 0, content: emptyBody }, { index: 1, content: emptyBody }],
      answer: [0], explanation: emptyBody, tags: ['test'],
    });
    expect(q.id).toBeDefined();
    expect(q.order).toBe(1);
    expect(q.type).toBe('single');
  });

  it('finds questions by bankId', async () => {
    const bank = await createTestBank();
    await questionRepo.create({ bankId: bank.id, type: 'single', body: emptyBody, options: [{ index: 0, content: emptyBody }], answer: [0], explanation: emptyBody, tags: [] });
    await questionRepo.create({ bankId: bank.id, type: 'truefalse', body: emptyBody, options: [{ index: 0, content: emptyBody }], answer: [0], explanation: emptyBody, tags: [] });
    const questions = await questionRepo.findByBankId(bank.id);
    expect(questions).toHaveLength(2);
  });

  it('updates a question', async () => {
    const bank = await createTestBank();
    const q = await questionRepo.create({ bankId: bank.id, type: 'single', body: emptyBody, options: [{ index: 0, content: emptyBody }], answer: [0], explanation: emptyBody, tags: [] });
    const updated = await questionRepo.update(q.id, { type: 'multiple', answer: [0, 1] });
    expect(updated.type).toBe('multiple');
  });

  it('deletes a question and reorders remaining', async () => {
    const bank = await createTestBank();
    const q1 = await questionRepo.create({ bankId: bank.id, type: 'single', body: emptyBody, options: [{ index: 0, content: emptyBody }], answer: [0], explanation: emptyBody, tags: [] });
    const q2 = await questionRepo.create({ bankId: bank.id, type: 'single', body: emptyBody, options: [{ index: 0, content: emptyBody }], answer: [0], explanation: emptyBody, tags: [] });
    await questionRepo.delete(q1.id, bank.id);
    const remaining = await questionRepo.findByBankId(bank.id);
    expect(remaining[0].order).toBe(1);
  });

  it('bulk creates questions with correct ordering', async () => {
    const bank = await createTestBank();
    const inputs = [
      { bankId: bank.id, type: 'single' as const, body: emptyBody, options: [{ index: 0, content: emptyBody }], answer: [0], explanation: emptyBody, tags: [] },
      { bankId: bank.id, type: 'truefalse' as const, body: emptyBody, options: [{ index: 0, content: emptyBody }], answer: [0], explanation: emptyBody, tags: [] },
    ];
    const questions = await questionRepo.bulkCreate(inputs);
    expect(questions).toHaveLength(2);
    expect(questions[0].order).toBe(1);
    expect(questions[1].order).toBe(2);
  });
});
