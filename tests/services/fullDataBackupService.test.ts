import JSZip from 'jszip';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bankRepo } from '../../src/repo/bankRepo';
import { db } from '../../src/repo/db';
import { noteRepo } from '../../src/repo/noteRepo';
import { questionRepo } from '../../src/repo/questionRepo';
import { quizRecordRepo } from '../../src/repo/quizRecordRepo';
import { createFullDataBackupBlob, exportFullDataToFile, importFullDataFromFile } from '../../src/services/fullDataBackupService';

const { saveAsMock } = vi.hoisted(() => ({
  saveAsMock: vi.fn(),
}));

vi.mock('file-saver', () => ({
  saveAs: saveAsMock,
}));

const textDoc = (text: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
const imageDoc = (src: string) => ({ type: 'doc', content: [{ type: 'image', attrs: { src, alt: 'diagram' } }] });

describe('fullDataBackupService', () => {
  beforeEach(async () => {
    saveAsMock.mockClear();
    await db.delete();
    await db.open();
  });

  it('exports and imports a dedicated backup package with embedded images', async () => {
    const imageDataUrl = 'data:image/png;base64,aGVsbG8=';
    const noteImageDataUrl = 'data:image/jpeg;base64,d29ybGQ=';
    const bank = await bankRepo.create({ name: 'Backup Bank', description: 'with assets', tags: ['backup'], color: '#eef4ff' });
    const question = await questionRepo.create({
      bankId: bank.id,
      type: 'single',
      body: imageDoc(imageDataUrl),
      options: [
        { index: 0, content: textDoc('A') },
        { index: 1, content: textDoc('B') },
      ],
      answer: [0],
      explanation: textDoc('Because'),
      tags: ['asset'],
    });
    await noteRepo.save(question.id, bank.id, imageDoc(noteImageDataUrl));
    await quizRecordRepo.create({
      questionId: question.id,
      bankId: bank.id,
      selectedAnswer: [0],
      isCorrect: true,
      duration: 12,
      mode: 'practice',
    });

    await exportFullDataToFile();

    expect(saveAsMock).toHaveBeenCalledTimes(1);
    const [blob, filename] = saveAsMock.mock.calls[0] as [Blob, string];
    expect(filename).toMatch(/\.exlocal$/);
    const zip = await JSZip.loadAsync(blob);
    const backupJson = zip.file('backup.json');
    expect(backupJson).toBeTruthy();
    expect(zip.file('images/img_1.png')).toBeTruthy();
    expect(zip.file('images/img_2.jpg')).toBeTruthy();

    const backup = JSON.parse(await backupJson!.async('string')) as {
      banks: Array<{ color?: string }>;
      questions: Array<{ body: { content: Array<{ attrs: { src: string } }> } }>;
      notes: Array<{ content: { content: Array<{ attrs: { src: string } }> } }>;
      quizRecords: unknown[];
    };
    expect(backup.banks[0].color).toBe('#eef4ff');
    expect(backup.questions[0].body.content[0].attrs.src).toBe('img_1.png');
    expect(backup.notes[0].content.content[0].attrs.src).toBe('img_2.jpg');
    expect(backup.quizRecords).toHaveLength(1);

    await db.delete();
    await db.open();
    const result = await importFullDataFromFile(new File([blob], 'restore.exlocal'));

    expect(result).toMatchObject({ bankCount: 1, questionCount: 1, recordCount: 1, noteCount: 1 });
    const restoredQuestion = await db.questions.get(question.id);
    const restoredNote = await db.notes.where('questionId').equals(question.id).first();
    expect(restoredQuestion?.body.content[0].attrs.src).toBe(imageDataUrl);
    expect(restoredNote?.content.content[0].attrs.src).toBe(noteImageDataUrl);
  });

  it('exports non-base64 SVG data URL images into the backup package', async () => {
    const svgDataUrl = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg"><text>diagram</text></svg>';
    const bank = await bankRepo.create({ name: 'SVG Backup Bank', description: '', tags: [] });
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

    const blob = await createFullDataBackupBlob();
    const zip = await JSZip.loadAsync(blob);

    expect(await zip.file('images/img_1.svg')?.async('string')).toContain('<svg');
  });
});
