# ExLocal P2: Question Management

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full question lifecycle — single question editor with TipTap rich text, Markdown batch import with code blocks and images, unified drag-and-drop import zone, `.exbank` export/import, question list page.

**Architecture:** New files for question repo/service/store, TipTap editor component, Markdown parser service, import/export service, BankDetailPage and QuestionEditorPage.

**Tech Stack:** @mantine/tiptap, @tiptap/react, @tiptap/starter-kit, @tiptap/extension-image, @tiptap/extension-code-block-lowlight, @tiptap/extension-underline, @tiptap/extension-placeholder, @tiptap/extension-table, lowlight, JSZip, file-saver

---

## File Structure (new/modified)

```
src/
  repo/
    questionRepo.ts              # Question CRUD
  services/
    questionService.ts           # Question business logic
    markdownParser.ts            # MD → Question[]
    importExportService.ts      # .exbank import/export + unified drop zone logic
  stores/
    questionStore.ts             # Zustand question store (for current bank)
  ui/
    components/
      RichTextEditor.tsx         # Reusable TipTap editor wrapper
      ImportDropZone.tsx         # Unified drag-and-drop import zone
    pages/
      BankDetailPage.tsx         # Question list + toolbar
      QuestionEditorPage.tsx     # Single question form editor
  App.tsx                       # Modify: add /bank/:id and /bank/:id/editor/:questionId routes
tests/
  repo/
    questionRepo.test.ts
  services/
    markdownParser.test.ts
```

---

### Task 11: Install TipTap and import/export dependencies

**Files:**
- Modify: none (dependency install only)

- [ ] **Step 1: Install packages**

```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-image @tiptap/extension-code-block-lowlight @tiptap/extension-underline @tiptap/extension-placeholder @tiptap/extension-table @tiptap/pm lowlight jszip file-saver
npm install -D @types/file-saver
```

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(p2): add tiptap, lowlight, jszip, file-saver dependencies"
```

---

### Task 12: Question Repo layer

**Files:**
- Create: `src/repo/questionRepo.ts`
- Create: `tests/repo/questionRepo.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/repo/questionRepo.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/repo/questionRepo.test.ts
```

Expected: FAIL — `questionRepo` not found.

- [ ] **Step 3: Implement `questionRepo`**

```typescript
// src/repo/questionRepo.ts
import { nanoid } from 'nanoid';
import { db } from './db';
import { bankRepo } from './bankRepo';
import type { Question } from '../shared/types';

type CreateInput = Omit<Question, 'id' | 'createdAt' | 'order'>;

export const questionRepo = {
  async create(input: CreateInput): Promise<Question> {
    const count = await db.questions.where('bankId').equals(input.bankId).count();
    const question: Question = {
      id: nanoid(),
      ...input,
      order: count + 1,
      createdAt: Date.now(),
    };
    await db.questions.put(question);
    await bankRepo.incrementQuestionCount(input.bankId, 1);
    return question;
  },

  async bulkCreate(inputs: CreateInput[]): Promise<Question[]> {
    if (inputs.length === 0) return [];
    const bankId = inputs[0].bankId;
    const count = await db.questions.where('bankId').equals(bankId).count();
    const questions: Question[] = inputs.map((input, i) => ({
      id: nanoid(),
      ...input,
      order: count + i + 1,
      createdAt: Date.now(),
    }));
    await db.transaction('rw', db.questions, db.banks, async () => {
      await db.questions.bulkPut(questions);
      await bankRepo.incrementQuestionCount(bankId, questions.length);
    });
    return questions;
  },

  async findById(id: string): Promise<Question | undefined> {
    return db.questions.get(id);
  },

  async findByBankId(bankId: string): Promise<Question[]> {
    return db.questions.where('bankId').equals(bankId).sortBy('order');
  },

  async update(id: string, input: Partial<Pick<Question, 'type' | 'body' | 'options' | 'answer' | 'explanation' | 'tags'>>): Promise<Question> {
    const q = await db.questions.get(id);
    if (!q) throw new Error('Question not found');
    const updated = { ...q, ...input };
    await db.questions.put(updated);
    return updated;
  },

  async delete(id: string, bankId: string): Promise<void> {
    await db.transaction('rw', db.questions, db.quizRecords, db.notes, db.banks, async () => {
      await db.questions.delete(id);
      await db.quizRecords.where('questionId').equals(id).delete();
      await db.notes.where('questionId').equals(id).delete();
      const remaining = await db.questions.where('bankId').equals(bankId).sortBy('order');
      for (let i = 0; i < remaining.length; i++) {
        if (remaining[i].order !== i + 1) {
          await db.questions.update(remaining[i].id, { order: i + 1 });
        }
      }
      await bankRepo.incrementQuestionCount(bankId, -1);
    });
  },

  async deleteByBankId(bankId: string): Promise<void> {
    await db.questions.where('bankId').equals(bankId).delete();
  },
};
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/repo/questionRepo.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/repo/questionRepo.ts tests/repo/questionRepo.test.ts
git commit -m "feat(p2): add question repo with crud, ordering, and bulk operations"
```

---

### Task 13: Question Service layer

**Files:**
- Create: `src/services/questionService.ts`

- [ ] **Step 1: Implement `questionService`**

```typescript
// src/services/questionService.ts
import { questionRepo } from '../repo/questionRepo';
import type { Question } from '../shared/types';

type CreateInput = Omit<Question, 'id' | 'createdAt' | 'order'>;

export const questionService = {
  async createQuestion(input: CreateInput): Promise<Question> {
    if (!input.body) throw new Error('题目内容不能为空');
    if (input.type !== 'truefalse' && (!input.options || input.options.length < 2)) {
      throw new Error('选项不能少于2个');
    }
    if (!input.answer || input.answer.length === 0) {
      throw new Error('必须设置正确答案');
    }
    return questionRepo.create(input);
  },

  async bulkCreate(inputs: CreateInput[]): Promise<Question[]> {
    for (const input of inputs) {
      if (!input.body) throw new Error(`题目 ${inputs.indexOf(input) + 1} 内容不能为空`);
    }
    return questionRepo.bulkCreate(inputs);
  },

  async getQuestions(bankId: string): Promise<Question[]> {
    return questionRepo.findByBankId(bankId);
  },

  async updateQuestion(id: string, input: Partial<Pick<Question, 'type' | 'body' | 'options' | 'answer' | 'explanation' | 'tags'>>): Promise<Question> {
    if (input.type !== undefined && input.type !== 'truefalse') {
      if (input.options && input.options.length < 2) throw new Error('选项不能少于2个');
    }
    return questionRepo.update(id, input);
  },

  async deleteQuestion(id: string, bankId: string): Promise<void> {
    await questionRepo.delete(id, bankId);
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add src/services/questionService.ts
git commit -m "feat(p2): add question service with validation"
```

---

### Task 14: Markdown Parser

**Files:**
- Create: `src/services/markdownParser.ts`
- Create: `tests/services/markdownParser.test.ts`

- [ ] **Step 1: Write test**

```typescript
// tests/services/markdownParser.test.ts
import { describe, it, expect } from 'vitest';
import { parseMarkdown } from '../../src/services/markdownParser';

describe('parseMarkdown', () => {
  it('parses a single-choice question', () => {
    const md = `# Q1 [单选题] [标签: 二叉树, 遍历]
以下关于二叉树遍历的说法中，正确的是？

- A. 前序遍历的第一个节点一定是根节点
- B. 中序遍历的结果一定是升序排列
- C. 后序遍历的最后一个节点一定是叶子节点

> 答案: A
> 解析: 前序为根→左→右。`;

    const result = parseMarkdown(md);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('single');
    expect(result[0].options).toHaveLength(3);
    expect(result[0].answer).toEqual([0]);
    expect(result[0].tags).toEqual(['二叉树', '遍历']);
    expect(result[0].body).toBeDefined();
  });

  it('parses a multi-choice question', () => {
    const md = `# Q1 [多选题] [标签: 排序]
以下哪些是稳定排序算法？

- A. 冒泡排序
- B. 快速排序
- C. 归并排序
- D. 选择排序

> 答案: A, C
> 解析: 冒泡和归并稳定。`;

    const result = parseMarkdown(md);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('multiple');
    expect(result[0].answer).toEqual([0, 2]);
  });

  it('parses a true/false question', () => {
    const md = `# Q1 [判断题] [标签: 网络]
TCP 是面向连接的协议。

> 答案: T
> 解析: TCP 通过三次握手建立连接。`;

    const result = parseMarkdown(md);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('truefalse');
    expect(result[0].answer).toEqual([0]);
  });

  it('parses question with code block', () => {
    const md = `# Q1 [单选题]
时间复杂度分析：

\`\`\`c
int sum = 0;
for (int i = 0; i < n; i++) {
    sum += arr[i];
}
\`\`\`

- A. O(1)
- B. O(n)

> 答案: B
> 解析: 线性时间复杂度。`;

    const result = parseMarkdown(md);
    expect(result).toHaveLength(1);
    const bodyStr = JSON.stringify(result[0].body);
    expect(bodyStr).toContain('codeBlock');
  });

  it('parses question with image', () => {
    const md = `# Q1 [单选题]
根据下图回答：

![graph](topo-graph.png)

- A. 选项A
- B. 选项B

> 答案: A`;

    const result = parseMarkdown(md);
    expect(result).toHaveLength(1);
    const bodyStr = JSON.stringify(result[0].body);
    expect(bodyStr).toContain('topo-graph.png');
  });

  it('parses multiple questions separated by ---', () => {
    const md = `# Q1 [单选题]
题目1

- A. 选项A
- B. 选项B

> 答案: A

---

# Q2 [判断题]
题目2

> 答案: F`;

    const result = parseMarkdown(md);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('single');
    expect(result[1].type).toBe('truefalse');
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
npx vitest run tests/services/markdownParser.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement `markdownParser`**

```typescript
// src/services/markdownParser.ts
import type { Question } from '../shared/types';

interface ParsedQuestion {
  type: Question['type'];
  body: object;
  options: { index: number; content: object }[];
  answer: number[];
  explanation: object;
  tags: string[];
}

function parseBody(content: string): object {
  const nodes: object[] = [];
  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('```')) {
      const lang = line.slice(3).trim() || null;
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      nodes.push({
        type: 'codeBlock',
        attrs: { language: lang },
        content: [{ type: 'text', text: codeLines.join('\n') }],
      });
      continue;
    }

    const imgMatch = line.match(/^!\[(.+)\]\((.+)\)$/);
    if (imgMatch) {
      nodes.push({
        type: 'image',
        attrs: { src: imgMatch[2], alt: imgMatch[1], title: null },
      });
      i++;
      continue;
    }

    if (line.trim()) {
      nodes.push({
        type: 'paragraph',
        content: [{ type: 'text', text: line }],
      });
    }
    i++;
  }

  return { type: 'doc', content: nodes.length > 0 ? nodes : [{ type: 'paragraph', content: [] }] };
}

function parseAnswer(answerStr: string, type: Question['type']): number[] {
  if (type === 'truefalse') {
    const t = answerStr.trim().toUpperCase();
    return t === 'T' || t === '对' || t === '是' ? [0] : [1];
  }

  return answerStr.split(/[,，、\s]+/).map((s) => {
    const letter = s.trim().toUpperCase();
    if (letter.length === 1 && letter >= 'A' && letter <= 'F') {
      return letter.charCodeAt(0) - 65;
    }
    return -1;
  }).filter((n) => n >= 0);
}

function parseQuestionBlock(block: string): ParsedQuestion | null {
  const lines = block.trim().split('\n');
  if (lines.length < 2) return null;

  const header = lines[0];
  const typeMatch = header.match(/\[(单选题|多选题|判断题)\]/);
  const tagsMatch = header.match(/\[标签:\s*(.+?)\]/);

  const typeMap: Record<string, Question['type']> = {
    '单选题': 'single', '多选题': 'multiple', '判断题': 'truefalse',
  };

  const type = typeMatch ? typeMap[typeMatch[1]] : 'single';
  const tags = tagsMatch ? tagsMatch[1].split(/[,，、]/).map((t) => t.trim()).filter(Boolean) : [];

  let answerLine = -1;
  let explanationContent = '';
  let answerIndices: number[] = [];
  const optionLines: string[] = [];
  const bodyLines: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('> 答案:')) {
      answerLine = i;
      answerIndices = parseAnswer(line.replace('> 答案:', '').trim(), type);
      continue;
    }
    if (line.startsWith('> 解析:')) {
      explanationContent = line.replace('> 解析:', '').trim();
      continue;
    }
    if (line.startsWith('>') && answerLine !== -1) {
      explanationContent += '\n' + line.replace('>', '').trim();
      continue;
    }

    if (answerLine === -1) {
      if (line.match(/^-\s*[A-F][.、]/)) {
        optionLines.push(line);
      } else if (line.trim()) {
        bodyLines.push(line);
      }
    }
  }

  const body = parseBody(bodyLines.join('\n'));
  const options = optionLines.map((opt, idx) => {
    const content = opt.replace(/^-\s*[A-F][.、]\s*/, '');
    return { index: idx, content: parseBody(content) };
  });
  const explanation = parseBody(explanationContent || '');

  return { type, body, options, answer: answerIndices, explanation, tags };
}

export function parseMarkdown(md: string): ParsedQuestion[] {
  const blocks = md.split(/\n---+\n/);
  return blocks.map(parseQuestionBlock).filter((q): q is ParsedQuestion => q !== null);
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/services/markdownParser.test.ts
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/markdownParser.ts tests/services/markdownParser.test.ts
git commit -m "feat(p2): add markdown parser with code blocks, images, and 3 question types"
```

---

### Task 15: Import/Export Service

**Files:**
- Create: `src/services/importExportService.ts`

- [ ] **Step 1: Implement `importExportService`**

```typescript
// src/services/importExportService.ts
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/services/importExportService.ts
git commit -m "feat(p2): add import/export service for .exbank files"
```

---

### Task 16: Zustand Question Store

**Files:**
- Create: `src/stores/questionStore.ts`

- [ ] **Step 1: Implement `questionStore`**

```typescript
// src/stores/questionStore.ts
import { create } from 'zustand';
import { questionService } from '../services/questionService';
import type { Question } from '../shared/types';

type CreateInput = Omit<Question, 'id' | 'createdAt' | 'order'>;

interface QuestionState {
  questions: Question[];
  currentBankId: string | null;
  loading: boolean;
  error: string | null;

  loadQuestions: (bankId: string) => Promise<void>;
  createQuestion: (input: CreateInput) => Promise<Question>;
  bulkCreateQuestions: (inputs: CreateInput[]) => Promise<Question[]>;
  updateQuestion: (id: string, input: Partial<Pick<Question, 'type' | 'body' | 'options' | 'answer' | 'explanation' | 'tags'>>) => Promise<void>;
  deleteQuestion: (id: string, bankId: string) => Promise<void>;
}

export const useQuestionStore = create<QuestionState>((set, get) => ({
  questions: [],
  currentBankId: null,
  loading: false,
  error: null,

  loadQuestions: async (bankId) => {
    set({ loading: true, error: null, currentBankId: bankId });
    try {
      const questions = await questionService.getQuestions(bankId);
      set({ questions, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  createQuestion: async (input) => {
    const q = await questionService.createQuestion(input);
    set((s) => ({ questions: [...s.questions, q] }));
    return q;
  },

  bulkCreateQuestions: async (inputs) => {
    const questions = await questionService.bulkCreate(inputs);
    set((s) => ({ questions: [...s.questions, ...questions] }));
    return questions;
  },

  updateQuestion: async (id, input) => {
    await questionService.updateQuestion(id, input);
    await get().loadQuestions(get().currentBankId!);
  },

  deleteQuestion: async (id, bankId) => {
    await questionService.deleteQuestion(id, bankId);
    set((s) => ({ questions: s.questions.filter((q) => q.id !== id) }));
  },
}));
```

- [ ] **Step 2: Commit**

```bash
git add src/stores/questionStore.ts
git commit -m "feat(p2): add zustand question store"
```

---

### Task 17: Reusable TipTap Rich Text Editor

**Files:**
- Create: `src/ui/components/RichTextEditor.tsx`

- [ ] **Step 1: Implement `RichTextEditor`**

```typescript
// src/ui/components/RichTextEditor.tsx
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { common, createLowlight } from 'lowlight';
import { RichTextEditor as MantineRichTextEditor, Link } from '@mantine/tiptap';
import { Box } from '@mantine/core';

const lowlight = createLowlight(common);

interface Props {
  content: object;
  onChange: (json: object) => void;
  placeholder?: string;
  minHeight?: number;
}

export function RichTextEditor({ content, onChange, placeholder = '输入内容...', minHeight = 200 }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Underline,
      Image,
      CodeBlockLowlight.configure({ lowlight }),
      Placeholder.configure({ placeholder }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Link,
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON());
    },
  });

  return (
    <Box style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
      <MantineRichTextEditor editor={editor}>
        <MantineRichTextEditor.Toolbar sticky>
          <MantineRichTextEditor.ControlsGroup>
            <MantineRichTextEditor.Bold />
            <MantineRichTextEditor.Italic />
            <MantineRichTextEditor.Underline />
            <MantineRichTextEditor.Strikethrough />
          </MantineRichTextEditor.ControlsGroup>
          <MantineRichTextEditor.ControlsGroup>
            <MantineRichTextEditor.H1 />
            <MantineRichTextEditor.H2 />
            <MantineRichTextEditor.H3 />
            <MantineRichTextEditor.H4 />
          </MantineRichTextEditor.ControlsGroup>
          <MantineRichTextEditor.ControlsGroup>
            <MantineRichTextEditor.Blockquote />
            <MantineRichTextEditor.CodeBlock />
            <MantineRichTextEditor.BulletList />
            <MantineRichTextEditor.OrderedList />
          </MantineRichTextEditor.ControlsGroup>
          <MantineRichTextEditor.ControlsGroup>
            <MantineRichTextEditor.Link />
            <MantineRichTextEditor.Unlink />
            <MantineRichTextEditor.Hr />
          </MantineRichTextEditor.ControlsGroup>
        </MantineRichTextEditor.Toolbar>
        <MantineRichTextEditor.Content style={{ minHeight }} />
      </MantineRichTextEditor>
    </Box>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/components/RichTextEditor.tsx
git commit -m "feat(p2): add reusable tiptap rich text editor component"
```

---

### Task 18: Import Drop Zone + Bank Detail Page + Question Editor Page

**Files:**
- Create: `src/ui/components/ImportDropZone.tsx`
- Create: `src/ui/pages/BankDetailPage.tsx`
- Create: `src/ui/pages/QuestionEditorPage.tsx`
- Modify: `src/App.tsx` (add routes `/bank/:id` and `/bank/:id/editor/:questionId`)

- [ ] **Step 1: Create `ImportDropZone`**

```typescript
// src/ui/components/ImportDropZone.tsx
import { Box, Text, Group } from '@mantine/core';
import { IconFileImport } from '@tabler/icons-react';
import { useState, useCallback } from 'react';

interface Props {
  onFiles: (files: File[]) => void;
  accept?: string;
  children?: React.ReactNode;
}

export function ImportDropZone({ onFiles, accept, children }: Props) {
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) onFiles(files);
  }, [onFiles]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) onFiles(files);
  };

  return (
    <Box
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      style={{
        border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-md)',
        padding: 40,
        textAlign: 'center',
        background: dragging ? 'var(--accent-light)' : 'var(--bg-muted)',
        transition: 'all 0.15s ease',
        cursor: 'pointer',
      }}
    >
      <input
        type="file"
        accept={accept}
        onChange={handleFileInput}
        style={{ display: 'none' }}
        id="import-file-input"
        multiple
      />
      <label htmlFor="import-file-input" style={{ cursor: 'pointer', display: 'block' }}>
        {children || (
          <Group justify="center" gap="xs">
            <IconFileImport size={20} />
            <Text size="sm" c="dimmed">点击选择文件，或拖拽文件/文件夹至此</Text>
          </Group>
        )}
      </label>
    </Box>
  );
}
```

- [ ] **Step 2: Create `BankDetailPage`**

```typescript
// src/ui/pages/BankDetailPage.tsx
import { Box, Title, Group, Button, Text, Card, Badge, Modal, Tabs, ActionIcon } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus, IconFileImport, IconEdit, IconTrash, IconDownload, IconArrowLeft, IconPlayerPlay, IconChartBar, IconFileTypePdf } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuestionStore } from '../../stores/questionStore';
import { useBankStore } from '../../stores/bankStore';
import { parseMarkdown } from '../../services/markdownParser';
import { exportBankToFile, importExbank, detectDropType } from '../../services/importExportService';
import { ImportDropZone } from '../components/ImportDropZone';
import { EmptyState } from '../components/EmptyState';
import type { Question } from '../../shared/types';

function extractText(body: object): string {
  try {
    const doc = body as any;
    if (doc.content?.[0]?.content?.[0]?.text) return doc.content[0].content[0].text;
  } catch {}
  return '(富文本内容)';
}

export function BankDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { banks } = useBankStore();
  const { questions, loading, loadQuestions, createQuestion, bulkCreateQuestions, deleteQuestion } = useQuestionStore();
  const bank = banks.find((b) => b.id === id);

  const [markdownText, setMarkdownText] = useState('');
  const [mdModalOpened, { open: openMdModal, close: closeMdModal }] = useDisclosure(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (id) loadQuestions(id);
  }, [id]);

  const handleFileDrop = async (files: File[]) => {
    const type = detectDropType(files);
    if (type === 'exbank') {
      setImporting(true);
      try {
        const result = await importExbank(files[0]);
        alert(`导入成功：${result.questionCount} 道题`);
        if (id) loadQuestions(id);
      } catch (e) {
        alert(`导入失败：${(e as Error).message}`);
      } finally {
        setImporting(false);
      }
      return;
    }
    const mdFile = files.find((f) => f.name.endsWith('.md'));
    if (mdFile) {
      const text = await mdFile.text();
      setMarkdownText(text);
      openMdModal();
    }
  };

  const handleMarkdownImport = async () => {
    if (!id) return;
    const parsed = parseMarkdown(markdownText);
    await bulkCreateQuestions(parsed.map((p) => ({ ...p, bankId: id })));
    closeMdModal();
    await loadQuestions(id);
  };

  const handleExport = async (includeRecords: boolean) => {
    if (!id) return;
    await exportBankToFile(id, includeRecords);
  };

  if (!bank) return <Text p="xl">题库不存在</Text>;

  return (
    <Box>
      <Box style={{ borderBottom: '1px solid var(--border-light)', padding: '12px 24px', background: 'var(--bg-surface)' }}>
        <Group justify="space-between">
          <Group gap="sm">
            <ActionIcon variant="subtle" onClick={() => navigate('/')}><IconArrowLeft size={18} /></ActionIcon>
            <Box>
              <Title order={2}>{bank.name}</Title>
              <Text size="xs" c="dimmed">{questions.length} 题 · {bank.description}</Text>
            </Box>
          </Group>
          <Group gap="sm">
            <Button variant="default" leftSection={<IconFileImport size={16} />} component="label" htmlFor="bank-drop-trigger">
              导入
              <input id="bank-drop-trigger" type="file" accept=".exbank,.md" multiple style={{ display: 'none' }}
                onChange={(e) => { const files = Array.from(e.target.files || []); if (files.length) handleFileDrop(files); }} />
            </Button>
            <Button variant="default" leftSection={<IconDownload size={16} />} onClick={() => handleExport(false)}>导出共享</Button>
            <Button variant="default" leftSection={<IconDownload size={16} />} onClick={() => handleExport(true)}>导出完整</Button>
            <Button variant="default" leftSection={<IconChartBar size={16} />} onClick={() => navigate(`/bank/${id}/stats`)}>数据看板</Button>
            <Button variant="default" leftSection={<IconFileTypePdf size={16} />} onClick={() => navigate(`/bank/${id}/export`)}>导出 PDF</Button>
            <Button leftSection={<IconPlayerPlay size={16} />} onClick={() => navigate(`/bank/${id}/quiz`)}>开始做题</Button>
          </Group>
        </Group>
      </Box>

      <Tabs defaultValue="list" p="md">
        <Tabs.List>
          <Tabs.Tab value="list">题目列表</Tabs.Tab>
          <Tabs.Tab value="import">导入</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="list" pt="md">
          <Group mb="md">
            <Button leftSection={<IconPlus size={16} />} onClick={() => navigate(`/bank/${id}/editor/new`)}>添加题目</Button>
            <Button variant="default" leftSection={<IconPlus size={16} />} onClick={openMdModal}>Markdown 批量导入</Button>
          </Group>

          {questions.length === 0 ? (
            <EmptyState title="还没有题目" description="添加第一道题目，或从 Markdown / .exbank 导入">
              <Group>
                <Button leftSection={<IconPlus size={16} />} onClick={() => navigate(`/bank/${id}/editor/new`)}>添加题目</Button>
              </Group>
            </EmptyState>
          ) : (
            <Box>
              {questions.map((q, idx) => (
                <Box key={q.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
                  <Group justify="space-between">
                    <Group gap="sm">
                      <Badge variant="light" size="sm">{idx + 1}</Badge>
                      <Text size="sm" style={{ maxWidth: 500 }} truncate>{extractText(q.body)}</Text>
                      <Badge size="xs" color="slate" variant="outline">
                        {q.type === 'single' ? '单选' : q.type === 'multiple' ? '多选' : '判断'}
                      </Badge>
                    </Group>
                    <Group gap={4}>
                      <ActionIcon variant="subtle" size="sm" onClick={() => navigate(`/bank/${id}/editor/${q.id}`)}>
                        <IconEdit size={14} />
                      </ActionIcon>
                      <ActionIcon variant="subtle" size="sm" color="red" onClick={() => deleteQuestion(q.id, id!)}>
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Group>
                  </Group>
                </Box>
              ))}
            </Box>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="import" pt="md">
          <ImportDropZone onFiles={handleFileDrop} accept=".exbank,.md,.zip">
            <Group justify="center" gap="xs">
              <IconFileImport size={20} />
              <Text size="sm" c="dimmed">拖入 .exbank、.md 或包含图片的文件夹</Text>
            </Group>
          </ImportDropZone>
        </Tabs.Panel>
      </Tabs>

      <Modal opened={mdModalOpened} onClose={closeMdModal} title="Markdown 批量导入" size="lg">
        <Text size="sm" c="dimmed" mb="md">已解析 {parseMarkdown(markdownText).length} 道题目</Text>
        <textarea
          value={markdownText}
          onChange={(e) => setMarkdownText(e.target.value)}
          rows={15}
          style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.85rem', padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
        />
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={closeMdModal}>取消</Button>
          <Button onClick={handleMarkdownImport} loading={importing}>导入</Button>
        </Group>
      </Modal>
    </Box>
  );
}
```

- [ ] **Step 3: Create `QuestionEditorPage`**

```typescript
// src/ui/pages/QuestionEditorPage.tsx
import { Box, Title, Group, Button, Select, TagsInput, ActionIcon, Stack, Text } from '@mantine/core';
import { IconArrowLeft, IconPlus, IconTrash } from '@tabler/icons-react';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuestionStore } from '../../stores/questionStore';
import { RichTextEditor } from '../components/RichTextEditor';
import type { Question } from '../../shared/types';

const emptyDoc = () => ({ type: 'doc', content: [{ type: 'paragraph', content: [] }] });

export function QuestionEditorPage() {
  const { id, questionId } = useParams<{ id: string; questionId: string }>();
  const navigate = useNavigate();
  const { questions, loadQuestions, createQuestion, updateQuestion } = useQuestionStore();

  const isNew = questionId === 'new';
  const existing = isNew ? null : questions.find((q) => q.id === questionId);

  const [type, setType] = useState<Question['type']>('single');
  const [body, setBody] = useState<object>(emptyDoc());
  const [options, setOptions] = useState<Array<{ index: number; content: object }>>([
    { index: 0, content: emptyDoc() },
    { index: 1, content: emptyDoc() },
  ]);
  const [answer, setAnswer] = useState<number[]>([]);
  const [explanation, setExplanation] = useState<object>(emptyDoc());
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (id) loadQuestions(id); }, [id]);

  useEffect(() => {
    if (existing) {
      setType(existing.type);
      setBody(existing.body);
      setOptions(existing.options);
      setAnswer(existing.answer);
      setExplanation(existing.explanation);
      setTags(existing.tags);
    }
  }, [existing]);

  const addOption = () => setOptions([...options, { index: options.length, content: emptyDoc() }]);

  const removeOption = (idx: number) => {
    setOptions(options.filter((_, i) => i !== idx).map((o, i) => ({ ...o, index: i })));
    setAnswer(answer.filter((a) => a !== idx).map((a) => a > idx ? a - 1 : a));
  };

  const toggleAnswer = (idx: number) => {
    if (type === 'single' || type === 'truefalse') {
      setAnswer([idx]);
    } else {
      setAnswer(answer.includes(idx) ? answer.filter((a) => a !== idx) : [...answer, idx].sort());
    }
  };

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const input = { bankId: id, type, body, options, answer, explanation, tags };
      if (isNew) {
        await createQuestion(input);
      } else {
        await updateQuestion(questionId!, input);
      }
      navigate(`/bank/${id}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Box style={{ borderBottom: '1px solid var(--border-light)', padding: '12px 24px', background: 'var(--bg-surface)' }}>
        <Group justify="space-between">
          <Group gap="sm">
            <ActionIcon variant="subtle" onClick={() => navigate(`/bank/${id}`)}><IconArrowLeft size={18} /></ActionIcon>
            <Title order={2}>{isNew ? '添加题目' : '编辑题目'}</Title>
          </Group>
          <Group gap="sm">
            <Button variant="default" onClick={() => navigate(`/bank/${id}`)}>取消</Button>
            <Button onClick={handleSave} loading={saving}>保存</Button>
          </Group>
        </Group>
      </Box>

      <Box p="md" maw={900}>
        <Stack gap="md">
          <Group>
            <Select
              label="题型"
              data={[
                { value: 'single', label: '单选题' },
                { value: 'multiple', label: '多选题' },
                { value: 'truefalse', label: '判断题' },
              ]}
              value={type}
              onChange={(v) => {
                setType(v as Question['type']);
                setAnswer([]);
                if (v === 'truefalse') {
                  setOptions([{ index: 0, content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '正确' }] }] } }]);
                }
              }}
            />
            <TagsInput label="标签" placeholder="添加标签" value={tags} onChange={setTags} style={{ flex: 1 }} />
          </Group>

          <Box>
            <Text size="sm" fw={500} mb={4}>题目内容</Text>
            <RichTextEditor content={body} onChange={setBody} placeholder="输入题目内容..." />
          </Box>

          {type !== 'truefalse' && (
            <Box>
              <Group justify="space-between" mb="sm">
                <Text size="sm" fw={500}>选项</Text>
                <Button variant="light" size="xs" leftSection={<IconPlus size={14} />} onClick={addOption}>添加选项</Button>
              </Group>
              <Stack gap="sm">
                {options.map((opt, idx) => (
                  <Group key={idx} gap="sm" wrap="nowrap" align="start">
                    <Button
                      variant={answer.includes(idx) ? 'filled' : 'default'}
                      size="sm"
                      style={{ width: 80, flexShrink: 0, marginTop: 4 }}
                      onClick={() => toggleAnswer(idx)}
                    >
                      {String.fromCharCode(65 + idx)}{answer.includes(idx) ? ' ✓' : ''}
                    </Button>
                    <Box style={{ flex: 1 }}>
                      <RichTextEditor
                        content={opt.content}
                        onChange={(json) => {
                          const updated = [...options];
                          updated[idx] = { ...opt, content: json };
                          setOptions(updated);
                        }}
                        placeholder={`选项 ${String.fromCharCode(65 + idx)} 内容...`}
                        minHeight={80}
                      />
                    </Box>
                    {options.length > 2 && (
                      <ActionIcon variant="subtle" color="red" size="sm" onClick={() => removeOption(idx)}>
                        <IconTrash size={14} />
                      </ActionIcon>
                    )}
                  </Group>
                ))}
              </Stack>
            </Box>
          )}

          {type === 'truefalse' && (
            <Group gap="sm">
              <Text size="sm" fw={500}>正确答案：</Text>
              <Button variant={answer.includes(0) ? 'filled' : 'default'} onClick={() => setAnswer([0])}>正确 (T)</Button>
              <Button variant={answer.includes(1) ? 'filled' : 'default'} onClick={() => setAnswer([1])}>错误 (F)</Button>
            </Group>
          )}

          <Box>
            <Text size="sm" fw={500} mb={4}>解析</Text>
            <RichTextEditor content={explanation} onChange={setExplanation} placeholder="输入解析（可选）..." minHeight={120} />
          </Box>
        </Stack>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 4: Update `App.tsx` to add routes**

```typescript
// src/App.tsx
// Add these imports:
import { BankDetailPage } from './ui/pages/BankDetailPage';
import { QuestionEditorPage } from './ui/pages/QuestionEditorPage';

// Add inside <Routes> after the existing BankListPage route:
<Route path="/bank/:id" element={<BankDetailPage />} />
<Route path="/bank/:id/editor/:questionId" element={<QuestionEditorPage />} />
```

- [ ] **Step 5: Manual test**

```bash
npm run dev
```

Test: create bank → open it → add questions (single/multi/truefalse) with rich text → edit → delete → import .exbank → Markdown import.

- [ ] **Step 6: Commit**

```bash
git add src/ui/components/ImportDropZone.tsx src/ui/pages/BankDetailPage.tsx src/ui/pages/QuestionEditorPage.tsx src/App.tsx
git commit -m "feat(p2): add bank detail page, question editor, and import/export ui"
```

---

### Task 19: Verify P2 complete

- [ ] **Step 1: Run all tests**

```bash
npx vitest run
```

Expected: all tests PASS (bankRepo + questionRepo + markdownParser).

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual smoke test checklist**
  - [ ] Bank detail page shows question list
  - [ ] Create single-choice question with rich text → saves
  - [ ] Create multi-choice question → multiple answers selectable
  - [ ] Create true/false question → T/F toggle works
  - [ ] Edit existing question → data pre-filled
  - [ ] Delete question → removed from list
  - [ ] Import .exbank file → questions appear
  - [ ] Markdown batch import → parsed and saved
  - [ ] Export shared (no records) → downloads .exbank
  - [ ] Export full (with records) → downloads .exbank

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(p2): p2 complete - question management, markdown import, exbank import/export"
```
