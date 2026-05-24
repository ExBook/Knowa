import { beforeEach, describe, expect, it } from 'vitest';
import { bankRepo } from '../../src/repo/bankRepo';
import { db } from '../../src/repo/db';
import type { Bank } from '../../src/shared/types';

const mockBank: Omit<Bank, 'id' | 'createdAt' | 'updatedAt' | 'questionCount'> = {
  name: '数据结构与算法',
  description: '考研408数据结构',
  tags: ['二叉树', '图论'],
};

describe('bankRepo', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('creates a bank', async () => {
    const bank = await bankRepo.create(mockBank);

    expect(bank.id).toBeDefined();
    expect(bank.name).toBe('数据结构与算法');
    expect(bank.questionCount).toBe(0);
  });

  it('finds a bank by id', async () => {
    const created = await bankRepo.create({ ...mockBank, name: '操作系统' });
    const found = await bankRepo.findById(created.id);

    expect(found).toBeDefined();
    expect(found?.name).toBe('操作系统');
  });

  it('lists all banks sorted by updatedAt descending', async () => {
    const older = await bankRepo.create({ ...mockBank, name: '旧题库' });
    await db.banks.update(older.id, { updatedAt: 1 });
    const newer = await bankRepo.create({ ...mockBank, name: '新题库' });

    const banks = await bankRepo.findAll();

    expect(banks).toHaveLength(2);
    expect(banks[0].id).toBe(newer.id);
    expect(banks[0].updatedAt).toBeGreaterThanOrEqual(banks[1].updatedAt);
  });

  it('updates a bank', async () => {
    const created = await bankRepo.create({ ...mockBank, name: '计算机网络' });
    const updated = await bankRepo.update(created.id, { name: '计算机网络（修订版）' });

    expect(updated.name).toBe('计算机网络（修订版）');
    expect(updated.updatedAt).toBeGreaterThanOrEqual(created.updatedAt);
  });

  it('deletes a bank and related records', async () => {
    const created = await bankRepo.create({ ...mockBank, name: '临时题库' });
    await db.questions.put({
      id: 'q1',
      bankId: created.id,
      type: 'single',
      body: {},
      options: [],
      answer: [0],
      explanation: {},
      tags: [],
      order: 1,
      createdAt: Date.now(),
    });
    await db.quizRecords.put({
      id: 'r1',
      bankId: created.id,
      questionId: 'q1',
      selectedAnswer: [0],
      isCorrect: true,
      timestamp: Date.now(),
      duration: 12,
      mode: 'practice',
    });
    await db.notes.put({
      id: 'n1',
      bankId: created.id,
      questionId: 'q1',
      content: {},
      updatedAt: Date.now(),
    });

    await bankRepo.delete(created.id);

    await expect(db.banks.get(created.id)).resolves.toBeUndefined();
    await expect(db.questions.where('bankId').equals(created.id).count()).resolves.toBe(0);
    await expect(db.quizRecords.where('bankId').equals(created.id).count()).resolves.toBe(0);
    await expect(db.notes.where('bankId').equals(created.id).count()).resolves.toBe(0);
  });
});
