import { beforeEach, describe, expect, it } from 'vitest';
import { bankRepo } from '../../src/repo/bankRepo';
import { db } from '../../src/repo/db';
import { questionService } from '../../src/services/questionService';

const emptyDoc = () => ({ type: 'doc', content: [{ type: 'paragraph', content: [] }] });
const textDoc = (text: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });

async function createTestBank() {
  return bankRepo.create({ name: 'Service Bank', description: '', tags: [] });
}

describe('questionService', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('rejects an empty rich text body', async () => {
    const bank = await createTestBank();

    await expect(
      questionService.createQuestion({
        bankId: bank.id,
        type: 'single',
        body: emptyDoc(),
        options: [
          { index: 0, content: textDoc('A') },
          { index: 1, content: textDoc('B') },
        ],
        answer: [0],
        explanation: emptyDoc(),
        tags: [],
      }),
    ).rejects.toThrow('题目内容不能为空');
  });

  it('rejects empty option content for choice questions', async () => {
    const bank = await createTestBank();

    await expect(
      questionService.createQuestion({
        bankId: bank.id,
        type: 'single',
        body: textDoc('Question'),
        options: [
          { index: 0, content: textDoc('A') },
          { index: 1, content: emptyDoc() },
        ],
        answer: [0],
        explanation: emptyDoc(),
        tags: [],
      }),
    ).rejects.toThrow('选项内容不能为空');
  });
});
