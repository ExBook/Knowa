import { beforeEach, describe, expect, it } from 'vitest';
import { bankRepo } from '../../src/repo/bankRepo';
import { db } from '../../src/repo/db';
import { questionRepo } from '../../src/repo/questionRepo';
import { exportBank, importExbank, importExbankIntoBank } from '../../src/services/importExportService';

const textDoc = (text: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
const imageDoc = (src: string) => ({ type: 'doc', content: [{ type: 'image', attrs: { src, alt: 'diagram' } }] });

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

  it('exports non-base64 SVG data URL images into an exbank archive', async () => {
    const svgDataUrl = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg"><text>diagram</text></svg>';
    const bank = await bankRepo.create({ name: 'SVG Bank', description: '', tags: [] });
    await questionRepo.create({
      bankId: bank.id,
      type: 'single',
      body: imageDoc(svgDataUrl),
      options: [
        { index: 0, content: textDoc('A') },
        { index: 1, content: textDoc('B') },
      ],
      answer: [0],
      explanation: textDoc('Because'),
      tags: [],
    });

    const file = await exportedFile(bank.id);
    const result = await importExbank(file);
    const importedQuestions = await questionRepo.findByBankId(result.bank.id);

    expect(importedQuestions[0].body).toEqual(imageDoc('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjx0ZXh0PmRpYWdyYW08L3RleHQ+PC9zdmc+'));
  });
});
