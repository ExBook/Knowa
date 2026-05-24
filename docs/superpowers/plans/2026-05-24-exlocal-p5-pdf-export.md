# ExLocal P5: PDF Export

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PDF export with selection UI (question range, content toggles, layout choice), pdfmake for precise layout (questions + answers + notes + stats), html2canvas + jsPDF for quick WYSIWYG print.

**Architecture:** PDF export service handles pdfmake doc generation and html2canvas capture. ExportPage provides selection UI and preview. Reuses existing data from repos.

**Tech Stack:** pdfmake, html2canvas, jspdf

---

## File Structure (new/modified)

```
src/
  services/
    pdfExportService.ts         # pdfmake doc builder + html2canvas capture
  ui/
    pages/
      ExportPage.tsx            # Export selection UI with preview
  App.tsx                       # Add /bank/:id/export route
```

---

### Task 32: Install PDF dependencies

**Files:**
- Modify: none (dep install)

- [ ] **Step 1: Install packages**

```bash
npm install pdfmake html2canvas jspdf
npm install -D @types/pdfmake
```

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(p5): add pdfmake, html2canvas, jspdf dependencies"
```

---

### Task 33: PDF Export Service

**Files:**
- Create: `src/services/pdfExportService.ts`

- [ ] **Step 1: Implement `pdfExportService`**

```typescript
// src/services/pdfExportService.ts
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import type { Question, QuizRecord, Note } from '../shared/types';

// Register built-in Roboto (from pdfmake vfs)
(pdfMake as any).vfs = pdfFonts.vfs;

// Register CJK font for Chinese text support.
// NotoSansSC-Regular is fetched at runtime and cached.
// Fallback: if fetch fails, pdfmake uses Roboto (no Chinese rendering).
let cjkFontReady = false;

export async function initCJKFont(): Promise<void> {
  if (cjkFontReady) return;
  try {
    const resp = await fetch(
      'https://cdn.jsdelivr.net/npm/@canvas-fonts/notosanssc@1.0.0/files/notosanssc-regular.otf'
    );
    if (resp.ok) {
      const buf = await resp.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buf).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      (pdfMake as any).vfs['NotoSansSC-Regular.otf'] = base64;
      // Register in pdfmake font catalog
      (pdfMake as any).fonts = {
        ...((pdfMake as any).fonts || {}),
        NotoSansSC: {
          normal: 'NotoSansSC-Regular.otf',
          bold: 'NotoSansSC-Regular.otf', // no bold variant; uses faux-bold
        },
      };
      cjkFontReady = true;
    }
  } catch {
    console.warn('CJK font download failed, PDF Chinese text may not render');
  }
}

// Type label in Chinese — safe to use after initCJKFont
function typeLabel(type: Question['type']): string {
  if (type === 'single') return '单选题';
  if (type === 'multiple') return '多选题';
  return '判断题';
}
```

Then update the default style to use NotoSansSC as primary with Roboto fallback:

```typescript
// In generatePrecisePDF, update the pdfMake.createPdf call:
const doc = pdfMake.createPdf({
  pageSize: 'A4',
  pageMargins: [40, 40, 40, 40],
  content,
  styles: {
    title: { fontSize: 18, bold: true },
    subtitle: { fontSize: 10, color: '#7a7568' },
    statText: { fontSize: 10, alignment: 'center' },
    statsBox: { fillColor: '#f3efe8', fillOpacity: 1 },
  },
  defaultStyle: {
    font: 'NotoSansSC',  // Chinese-supporting font
    fontSize: 11,
    color: '#2c2416',
    lineHeight: 1.5,
  },
});
```

In `ExportPage.tsx`, call `initCJKFont()` before `generatePrecisePDF`:

```typescript
import { generatePrecisePDF, generateQuickPDF, initCJKFont } from '../../services/pdfExportService';

// In handleExport, before generatePrecisePDF:
if (layout === 'precise') {
  await initCJKFont();
  const blob = await generatePrecisePDF(data, opts);
  saveAs(blob, `${bank.name}.pdf`);
}

interface QuestionData {
  question: Question;
  latestRecord?: QuizRecord;
  note?: Note;
}

function tipTapToText(doc: any): string {
  if (!doc?.content) return '';
  return doc.content
    .map((node: any) => {
      if (node.type === 'paragraph') {
        return node.content?.map((n: any) => n.text || '').join('') || '';
      }
      if (node.type === 'codeBlock') {
        return node.content?.[0]?.text || '';
      }
      if (node.type === 'image') {
        return `[图片: ${node.attrs?.alt || node.attrs?.src || ''}]`;
      }
      return '';
    })
    .filter(Boolean)
    .join('\n');
}

function typeLabel(type: Question['type']): string {
  if (type === 'single') return '单选题';
  if (type === 'multiple') return '多选题';
  return '判断题';
}

export async function generatePrecisePDF(questions: QuestionData[], options: ExportOptions): Promise<Blob> {
  const content: any[] = [];

  content.push({
    text: options.bankName,
    style: 'title',
    margin: [0, 0, 0, 4],
  });
  content.push({
    text: `导出日期: ${new Date().toLocaleDateString('zh-CN')} | ${questions.length} 题`,
    style: 'subtitle',
    margin: [0, 0, 0, 20],
  });

  if (options.includeStats && questions.length > 0) {
    const answered = questions.filter((q) => q.latestRecord).length;
    const correct = questions.filter((q) => q.latestRecord?.isCorrect).length;
    content.push({
      style: 'statsBox',
      table: {
        widths: ['*', '*', '*'],
        body: [[
          { text: `总题数: ${questions.length}`, style: 'statText' },
          { text: `已作答: ${answered}`, style: 'statText' },
          { text: `正确率: ${answered > 0 ? Math.round(correct / answered * 100) : 0}%`, style: 'statText' },
        ]],
      },
      margin: [0, 0, 0, 20],
    });
  }

  for (let i = 0; i < questions.length; i++) {
    const { question, latestRecord, note } = questions[i];
    const qNum = i + 1;

    content.push({
      text: [
        { text: `${qNum}. `, bold: true },
        { text: `[${typeLabel(question.type)}] `, fontSize: 9, color: '#7a7568' },
        { text: question.tags.join(', '), fontSize: 9, color: '#a8a294' },
      ],
      margin: [0, 10, 0, 6],
    });

    content.push({ text: tipTapToText(question.body), margin: [0, 0, 0, 6] });

    if (question.type !== 'truefalse') {
      for (const opt of question.options) {
        const isAnswer = question.answer.includes(opt.index);
        content.push({
          text: [
            { text: `${String.fromCharCode(65 + opt.index)}. `, bold: isAnswer },
            { text: tipTapToText(opt.content) },
            isAnswer && options.includeAnswers ? { text: ' ✓', color: '#5b8c5a', bold: true } : {},
          ],
          margin: [14, 2, 0, 2],
        });
      }
    } else {
      const answer = question.answer[0] === 0;
      content.push({
        text: `答案: ${answer ? '正确 (T)' : '错误 (F)'}${options.includeAnswers ? '' : ' (已隐藏)'}`,
        margin: [14, 2, 0, 2],
      });
    }

    if (options.includeExplanations && question.explanation) {
      const expText = tipTapToText(question.explanation);
      if (expText.trim()) {
        content.push({
          text: [
            { text: '解析: ', bold: true, fontSize: 10 },
            { text: expText, fontSize: 10 },
          ],
          margin: [14, 6, 0, 4],
          color: '#3b4b6b',
        });
      }
    }

    if (options.includeNotes && note?.content) {
      const noteText = tipTapToText(note.content);
      if (noteText.trim()) {
        content.push({
          text: [
            { text: '笔记: ', bold: true, fontSize: 10 },
            { text: noteText, fontSize: 10 },
          ],
          margin: [14, 4, 0, 4],
          color: '#c4823d',
        });
      }
    }

    if (i < questions.length - 1) {
      content.push({
        canvas: [{ type: 'line', x1: 0, y1: 4, x2: 515, y2: 4, lineWidth: 0.5, lineColor: '#e5e0d5' }],
        margin: [0, 8, 0, 0],
      });
    }
  }

  return new Promise((resolve) => {
    const doc = pdfMake.createPdf({
      pageSize: 'A4',
      pageMargins: [40, 40, 40, 40],
      content,
      styles: {
        title: { fontSize: 18, bold: true, font: 'Roboto' },
        subtitle: { fontSize: 10, color: '#7a7568' },
        statText: { fontSize: 10, alignment: 'center' },
        statsBox: { fillColor: '#f3efe8', fillOpacity: 1 },
      },
      defaultStyle: {
        font: 'Roboto',
        fontSize: 11,
        color: '#2c2416',
        lineHeight: 1.5,
      },
    });

    doc.getBlob((blob: Blob) => resolve(blob));
  });
}

export async function generateQuickPDF(element: HTMLElement, filename: string): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [canvas.width / 2, canvas.height / 2],
  });

  pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2);
  pdf.save(`${filename}.pdf`);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/services/pdfExportService.ts
git commit -m "feat(p5): add pdf export service with precise and quick modes"
```

---

### Task 34: Export Page

**Files:**
- Create: `src/ui/pages/ExportPage.tsx`
- Modify: `src/App.tsx` (add route `/bank/:id/export`)

- [ ] **Step 1: Create `ExportPage`**

```typescript
// src/ui/pages/ExportPage.tsx
import { Box, Title, Group, Button, Text, Checkbox, Radio, Stack, SimpleGrid, Accordion, ActionIcon, Divider } from '@mantine/core';
import { IconArrowLeft, IconDownload } from '@tabler/icons-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useQuestionStore } from '../../stores/questionStore';
import { useBankStore } from '../../stores/bankStore';
import { useNoteStore } from '../../stores/noteStore';
import { quizRecordRepo } from '../../repo/quizRecordRepo';
import { generatePrecisePDF, generateQuickPDF } from '../../services/pdfExportService';
import { saveAs } from 'file-saver';
import type { ExportOptions } from '../../services/pdfExportService';

function extractPlainText(doc: any): string {
  if (!doc?.content) return '(无内容)';
  return doc.content
    .map((node: any) => {
      if (node.type === 'paragraph') return node.content?.map((n: any) => n.text || '').join('') || '';
      if (node.type === 'codeBlock') return '[代码块]';
      if (node.type === 'image') return '[图片]';
      return '';
    })
    .filter(Boolean)
    .join(' ')
    .slice(0, 80) + (JSON.stringify(doc).length > 100 ? '...' : '');
}

export function ExportPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { questions, loadQuestions } = useQuestionStore();
  const { banks } = useBankStore();
  const { loadNotes, getNote } = useNoteStore();
  const bank = banks.find((b) => b.id === id);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [_selectAll, setSelectAll] = useState(true);
  const [includeAnswers, setIncludeAnswers] = useState(true);
  const [includeExplanations, setIncludeExplanations] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [includeStats, setIncludeStats] = useState(false);
  const [layout, setLayout] = useState<'precise' | 'quick'>('precise');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (id) { loadQuestions(id); loadNotes(id); }
  }, [id]);

  useEffect(() => {
    setSelectedIds(new Set(questions.map((q) => q.id)));
    setSelectAll(true);
  }, [questions]);

  const toggleSelectAll = () => {
    if (selectedIds.size === questions.length) {
      setSelectedIds(new Set());
      setSelectAll(false);
    } else {
      setSelectedIds(new Set(questions.map((q) => q.id)));
      setSelectAll(true);
    }
  };

  const toggleQuestion = (qId: string) => {
    const next = new Set(selectedIds);
    if (next.has(qId)) { next.delete(qId); setSelectAll(false); }
    else { next.add(qId); if (next.size === questions.length) setSelectAll(true); }
    setSelectedIds(next);
  };

  const handleExport = async () => {
    if (!id || !bank) return;
    setExporting(true);
    try {
      const selectedQuestions = questions.filter((q) => selectedIds.has(q.id));
      const records = await quizRecordRepo.findByBankId(id);

      const data = selectedQuestions.map((q) => ({
        question: q,
        latestRecord: records.filter((r) => r.questionId === q.id).sort((a, b) => b.timestamp - a.timestamp)[0],
        note: getNote(q.id),
      }));

      const opts: ExportOptions = {
        questionIds: [...selectedIds],
        includeAnswers, includeExplanations, includeNotes, includeStats,
        layout, bankName: bank.name,
      };

      if (layout === 'precise') {
        const blob = await generatePrecisePDF(data, opts);
        saveAs(blob, `${bank.name}.pdf`);
      } else {
        const el = document.getElementById('quick-pdf-preview');
        if (el) await generateQuickPDF(el, bank.name);
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <Box>
      <Box style={{ borderBottom: '1px solid var(--border-light)', padding: '12px 24px', background: 'var(--bg-surface)' }}>
        <Group justify="space-between">
          <Group gap="sm">
            <ActionIcon variant="subtle" onClick={() => navigate(`/bank/${id}`)}>
              <IconArrowLeft size={18} />
            </ActionIcon>
            <Box>
              <Title order={2}>导出 PDF</Title>
              <Text size="xs" c="dimmed">{bank?.name || ''} · {questions.length} 题</Text>
            </Box>
          </Group>
          <Button leftSection={<IconDownload size={16} />} onClick={handleExport} loading={exporting}>
            导出 PDF
          </Button>
        </Group>
      </Box>

      <Box p="md" maw={800} mx="auto">
        <SimpleGrid cols={2} spacing="lg">
          <Stack gap="lg">
            <Box>
              <Text fw={500} mb="sm">选择题目</Text>
              <Checkbox
                label={`全选 (${questions.length} 题)`}
                checked={selectedIds.size === questions.length}
                indeterminate={selectedIds.size > 0 && selectedIds.size < questions.length}
                onChange={toggleSelectAll}
                mb="sm"
              />
              <Accordion>
                <Accordion.Item value="list">
                  <Accordion.Control>
                    <Text size="sm">已选 {selectedIds.size}/{questions.length} 题</Text>
                  </Accordion.Control>
                  <Accordion.Panel>
                    <Box style={{ maxHeight: 300, overflow: 'auto' }}>
                      {questions.map((q, idx) => (
                        <Checkbox
                          key={q.id}
                          label={`${idx + 1}. ${q.type === 'single' ? '[单选]' : q.type === 'multiple' ? '[多选]' : '[判断]'} ${q.tags.join(', ')}`}
                          checked={selectedIds.has(q.id)}
                          onChange={() => toggleQuestion(q.id)}
                          mb={4}
                        />
                      ))}
                    </Box>
                  </Accordion.Panel>
                </Accordion.Item>
              </Accordion>
            </Box>

            <Divider />

            <Box>
              <Text fw={500} mb="sm">包含内容</Text>
              <Stack gap="sm">
                <Checkbox label="题目" checked disabled />
                <Checkbox label="正确答案" checked={includeAnswers} onChange={(e) => setIncludeAnswers(e.currentTarget.checked)} />
                <Checkbox label="解析" checked={includeExplanations} onChange={(e) => setIncludeExplanations(e.currentTarget.checked)} />
                <Checkbox label="我的笔记" checked={includeNotes} onChange={(e) => setIncludeNotes(e.currentTarget.checked)} />
                <Checkbox label="做题数据（正确率等）" checked={includeStats} onChange={(e) => setIncludeStats(e.currentTarget.checked)} />
              </Stack>
            </Box>

            <Divider />

            <Box>
              <Text fw={500} mb="sm">排版方式</Text>
              <Radio.Group value={layout} onChange={(v) => setLayout(v as 'precise' | 'quick')}>
                <Stack gap="sm">
                  <Radio value="precise" label="精排版 — 精确分页，适合打印 (pdfmake)" />
                  <Radio value="quick" label="快速打印 — 所见即所得 (html2canvas)" />
                </Stack>
              </Radio.Group>
            </Box>
          </Stack>

          <Box>
            <Text fw={500} mb="sm">预览</Text>
            <Box
              id="quick-pdf-preview"
              style={{
                background: 'white',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: 24,
                minHeight: 400,
                maxHeight: 600,
                overflow: 'auto',
                fontFamily: 'Geist, sans-serif',
                fontSize: 12,
                lineHeight: 1.8,
                color: '#2c2416',
              }}
            >
              <Title order={3} style={{ fontFamily: 'Lora, serif' }}>{bank?.name}</Title>
              <Text size="xs" c="dimmed" mb="md">已选 {selectedIds.size} 题</Text>
              {questions.filter((q) => selectedIds.has(q.id)).slice(0, 5).map((q, idx) => (
                <Box key={q.id} mb="md" pb="md" style={{ borderBottom: '1px solid #e5e0d5' }}>
                  <Text fw={700} size="sm">
                    {idx + 1}. [{q.type === 'single' ? '单选' : q.type === 'multiple' ? '多选' : '判断'}]
                  </Text>
                  <Text size="sm">{extractPlainText(q.body)}</Text>
                  {q.options.map((opt, oi) => (
                    <Text key={oi} size="xs" ml="md">
                      {String.fromCharCode(65 + oi)}. {extractPlainText(opt.content)}
                    </Text>
                  ))}
                </Box>
              ))}
              {selectedIds.size > 5 && (
                <Text size="xs" c="dimmed" ta="center">... 还有 {selectedIds.size - 5} 题</Text>
              )}
            </Box>
          </Box>
        </SimpleGrid>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Add route to `App.tsx`**

```typescript
import { ExportPage } from './ui/pages/ExportPage';
// Add inside <Routes>:
<Route path="/bank/:id/export" element={<ExportPage />} />
```

- [ ] **Step 3: Manual test**

```bash
npm run dev
```

Test: navigate to export page → select/deselect questions → toggle content options → choose layout → export → verify downloaded PDF.

- [ ] **Step 4: Commit**

```bash
git add src/ui/pages/ExportPage.tsx src/App.tsx
git commit -m "feat(p5): add pdf export page with selection and dual export modes"
```

---

### Task 35: Verify P5 and full v1 complete

- [ ] **Step 1: Run all tests**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Full v1 manual smoke test**
  - [ ] P1: Create bank, edit name/tags, delete bank, dark mode toggle
  - [ ] P2: Add question with rich text (single/multi/truefalse), import .exbank, import Markdown with code blocks, export .exbank
  - [ ] P3: Practice mode (answer → feedback → explanation), exam mode (answer all → submit → results), shuffle, review
  - [ ] P4: Add notes (rich text), dashboard stats/charts/tag breakdown/timeline, clear records
  - [ ] P5: Export selection UI, precise PDF download (pdfmake), quick PDF download (html2canvas)

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(p5): p5 complete - pdf export, full v1 functional"
```
