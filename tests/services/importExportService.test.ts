import { beforeEach, describe, expect, it } from 'vitest';
import { bankRepo } from '../../src/repo/bankRepo';
import { db } from '../../src/repo/db';
import { questionRepo } from '../../src/repo/questionRepo';
import { exportBank, importExbank, importExbankIntoBank } from '../../src/services/importExportService';

const textDoc = (text: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });

async function createBankWithQuestion() {
  const bank = await bankRepo.create({ name: 'Export Bank', description: 'shareable', tags: ['tag'] });
  await questionRepo.create({
    bankId: bank.id,
    type: 'single',
    body: textDoc('Question'),
    options: [
      { index: 0, content: textDoc('A') },
      { index: 1, content: textDoc('B') },
    ],
    answer: [0],
    explanation: textDoc('Because'),
    tags: ['easy'],
  });
  return bank;
}

async function exportedFile(bankId: string) {
  const blob = await exportBank(bankId, false);
  return new File([blob], 'bank.exbank');
}

describe('importExportService', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('imports an exported bank as a new bank', async () => {
    const source = await createBankWithQuestion();
    const file = await exportedFile(source.id);

    const result = await importExbank(file);
    const importedQuestions = await questionRepo.findByBankId(result.bank.id);

    expect(result.bank.id).not.toBe(source.id);
    expect(result.bank.name).toBe('Export Bank');
    expect(result.questionCount).toBe(1);
    expect(importedQuestions).toHaveLength(1);
    expect(importedQuestions[0].body).toEqual(textDoc('Question'));
  });

  it('imports an exported bank into an existing bank', async () => {
    const source = await createBankWithQuestion();
    const target = await bankRepo.create({ name: 'Target Bank', description: '', tags: [] });
    const file = await exportedFile(source.id);

    const result = await importExbankIntoBank(file, target.id);
    const targetQuestions = await questionRepo.findByBankId(target.id);

    expect(result.bank.id).toBe(target.id);
    expect(result.questionCount).toBe(1);
    expect(targetQuestions).toHaveLength(1);
    await expect(db.banks.get(target.id)).resolves.toMatchObject({ questionCount: 1 });
  });
});
