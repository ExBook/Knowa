import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { db } from '../repo/db';
import { bankRepo } from '../repo/bankRepo';
import { questionRepo } from '../repo/questionRepo';
import type { Bank, Question } from '../shared/types';

interface BankExportData {
  version: 1;
  bank: { name: string; description: string; tags: string[] };
  questions: Array<{
    id: string; type: Question['type']; body: object;
    options: Array<{ index: number; content: object }>;
    answer: number[]; explanation: object; order: number; tags: string[];
  }>;
}

// ========== Export ==========

export async function exportBank(bankId: string, includeRecords: boolean): Promise<Blob> {
  const bank = await bankRepo.findById(bankId);
  if (!bank) throw new Error('Bank not found');

  const questions = await questionRepo.findByBankId(bankId);
  const records = includeRecords ? await db.quizRecords.where('bankId').equals(bankId).toArray() : [];
  const notes = includeRecords ? await db.notes.where('bankId').equals(bankId).toArray() : [];

  const bankData: BankExportData = {
    version: 1,
    bank: { name: bank.name, description: bank.description, tags: bank.tags },
    questions: questions.map((q) => ({
      id: q.id, type: q.type, body: q.body, options: q.options,
      answer: q.answer, explanation: q.explanation, order: q.order, tags: q.tags,
    })),
  };

  const zip = new JSZip();
  zip.file('bank.json', JSON.stringify(bankData, null, 2));

  if (includeRecords) {
    zip.file('records.json', JSON.stringify({ records, notes }, null, 2));
  }

  const images = extractImages(questions);
  const imgFolder = zip.folder('images');
  for (const [filename, dataUrl] of Object.entries(images)) {
    if (imgFolder) {
      const base64 = dataUrl.split(',')[1];
      imgFolder.file(filename, base64, { base64: true });
    }
  }

  return zip.generateAsync({ type: 'blob' });
}

export async function exportBankToFile(bankId: string, includeRecords: boolean): Promise<void> {
  const bank = await bankRepo.findById(bankId);
  if (!bank) throw new Error('Bank not found');
  const blob = await exportBank(bankId, includeRecords);
  const suffix = includeRecords ? 'full' : 'share';
  saveAs(blob, `${bank.name}-${suffix}.exbank`);
}

// ========== Import ==========

export async function importExbank(file: File): Promise<{ bank: Bank; questionCount: number }> {
  const zip = await JSZip.loadAsync(file);

  const bankJsonFile = zip.file('bank.json');
  if (!bankJsonFile) throw new Error('Invalid .exbank: missing bank.json');
  const bankData: BankExportData = JSON.parse(await bankJsonFile.async('string'));

  const bank = await bankRepo.create({
    name: bankData.bank.name,
    description: bankData.bank.description,
    tags: bankData.bank.tags,
  });

  const imgFolder = zip.folder('images');
  const imageMap: Record<string, string> = {};
  if (imgFolder) {
    const imgFiles = Object.keys(zip.files).filter((f) => f.startsWith('images/') && !f.endsWith('/'));
    for (const path of imgFiles) {
      const filename = path.replace('images/', '');
      const data = await zip.file(path)!.async('base64');
      imageMap[filename] = `data:image/${filename.split('.').pop()};base64,${data}`;
    }
  }

  const questions = bankData.questions.map((q) => ({
    ...q,
    bankId: bank.id,
    body: replaceImageRefs(q.body, imageMap),
    options: q.options.map((o) => ({ ...o, content: replaceImageRefs(o.content, imageMap) })),
    explanation: replaceImageRefs(q.explanation, imageMap),
  }));

  await questionRepo.bulkCreate(questions);

  const recordsFile = zip.file('records.json');
  if (recordsFile) {
    const recordsData = JSON.parse(await recordsFile.async('string'));
    if (recordsData.records?.length) await db.quizRecords.bulkPut(recordsData.records);
    if (recordsData.notes?.length) await db.notes.bulkPut(recordsData.notes);
  }

  return { bank, questionCount: questions.length };
}

function extractImages(questions: Question[]): Record<string, string> {
  const images: Record<string, string> = {};
  let idx = 0;

  function walk(node: any) {
    if (!node) return;
    if (node.type === 'image' && node.attrs?.src?.startsWith('data:')) {
      const ext = node.attrs.src.match(/data:image\/(\w+)/)?.[1] || 'png';
      images[`img_${idx++}.${ext}`] = node.attrs.src;
    }
    if (node.content && Array.isArray(node.content)) node.content.forEach(walk);
  }

  for (const q of questions) {
    walk(q.body);
    for (const o of q.options) walk(o.content);
    walk(q.explanation);
  }

  return images;
}

function replaceImageRefs(doc: object, imageMap: Record<string, string>): object {
  function walk(node: any): any {
    if (!node) return node;
    if (node.type === 'image' && node.attrs?.src && !node.attrs.src.startsWith('data:') && imageMap[node.attrs.src]) {
      return { ...node, attrs: { ...node.attrs, src: imageMap[node.attrs.src] } };
    }
    if (node.content && Array.isArray(node.content)) {
      node.content = node.content.map(walk);
    }
    return node;
  }
  return walk(doc);
}

export function detectDropType(files: File[]): 'exbank' | 'markdown' | 'unknown' {
  const names = files.map((f) => f.name.toLowerCase());
  if (names.some((n) => n.endsWith('.exbank'))) return 'exbank';
  if (names.some((n) => n.endsWith('.md'))) return 'markdown';
  return 'unknown';
}

export function buildImageMap(files: File[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const file of files) {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext || '')) {
      map[file.name] = `[pending:${file.name}]`;
    }
  }
  return map;
}
