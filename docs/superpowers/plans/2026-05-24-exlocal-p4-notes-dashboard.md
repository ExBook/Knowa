# ExLocal P4: Notes + Dashboard

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per-question rich text notes with TipTap, data dashboard with stat cards, daily accuracy trend chart, tag distribution pie chart, tag breakdown table, timeline view, and clear records functionality.

**Architecture:** Note repo/service/store mirror the question layer. Stats computed from quiz records in real-time. Recharts charts via @mantine/charts in dashboard tabs.

**Tech Stack:** Existing stack + @mantine/charts (already installed in P1).

---

## File Structure (new/modified)

```
src/
  repo/
    noteRepo.ts                 # Note CRUD with upsert
  services/
    statsService.ts             # Stats computation (tag, daily aggregation)
  stores/
    noteStore.ts                # Zustand note store
  ui/
    components/
      QuizQuestion.tsx          # Modify: add NotePanel sub-component
    pages/
      QuizPage.tsx              # Modify: load notes on start
      DashboardPage.tsx         # New: stats page with 3 tabs
      BankDetailPage.tsx        # Modify: add clear records button
  App.tsx                       # Add /bank/:id/stats route
tests/
  repo/
    noteRepo.test.ts
  services/
    statsService.test.ts
```

---

### Task 26: Note Repo

**Files:**
- Create: `src/repo/noteRepo.ts`
- Create: `tests/repo/noteRepo.test.ts`

- [ ] **Step 1: Write test**

```typescript
// tests/repo/noteRepo.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { noteRepo } from '../../src/repo/noteRepo';
import { db } from '../../src/repo/db';

const emptyDoc = { type: 'doc', content: [{ type: 'paragraph', content: [] }] };

describe('noteRepo', () => {
  beforeAll(async () => {
    await db.delete();
    await db.open();
  });

  it('creates a note', async () => {
    const note = await noteRepo.save('q1', 'b1', emptyDoc);
    expect(note.id).toBeDefined();
    expect(note.questionId).toBe('q1');
    expect(note.bankId).toBe('b1');
  });

  it('saving twice updates existing note (upsert)', async () => {
    await noteRepo.save('q2', 'b1', emptyDoc);
    const updated = await noteRepo.save('q2', 'b1', {
      type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hello' }] }],
    });
    expect(updated.id).toBeDefined();
    const docs = JSON.stringify(updated.content);
    expect(docs).toContain('hello');
  });

  it('finds note by questionId', async () => {
    await noteRepo.save('q3', 'b1', emptyDoc);
    const found = await noteRepo.findByQuestionId('q3');
    expect(found).toBeDefined();
    expect(found!.questionId).toBe('q3');
  });

  it('finds notes by bankId', async () => {
    await noteRepo.save('q4', 'b2', emptyDoc);
    await noteRepo.save('q5', 'b2', emptyDoc);
    const notes = await noteRepo.findByBankId('b2');
    expect(notes.length).toBeGreaterThanOrEqual(2);
  });

  it('deletes a note', async () => {
    await noteRepo.save('q6', 'b1', emptyDoc);
    await noteRepo.delete('q6');
    const found = await noteRepo.findByQuestionId('q6');
    expect(found).toBeUndefined();
  });
});
```

- [ ] **Step 2: Implement `noteRepo`**

```typescript
// src/repo/noteRepo.ts
import { nanoid } from 'nanoid';
import { db } from './db';
import type { Note } from '../shared/types';

export const noteRepo = {
  async save(questionId: string, bankId: string, content: object): Promise<Note> {
    const existing = await db.notes.where('questionId').equals(questionId).first();
    if (existing) {
      const updated: Note = { ...existing, content, updatedAt: Date.now() };
      await db.notes.put(updated);
      return updated;
    }
    const note: Note = { id: nanoid(), questionId, bankId, content, updatedAt: Date.now() };
    await db.notes.put(note);
    return note;
  },

  async findByQuestionId(questionId: string): Promise<Note | undefined> {
    return db.notes.where('questionId').equals(questionId).first();
  },

  async findByBankId(bankId: string): Promise<Note[]> {
    return db.notes.where('bankId').equals(bankId).toArray();
  },

  async delete(questionId: string): Promise<void> {
    await db.notes.where('questionId').equals(questionId).delete();
  },

  async deleteByBankId(bankId: string): Promise<void> {
    await db.notes.where('bankId').equals(bankId).delete();
  },
};
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run tests/repo/noteRepo.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/repo/noteRepo.ts tests/repo/noteRepo.test.ts
git commit -m "feat(p4): add note repo with upsert on save"
```

---

### Task 27: Stats Service

**Files:**
- Create: `src/services/statsService.ts`
- Create: `tests/services/statsService.test.ts`

- [ ] **Step 1: Write test**

```typescript
// tests/services/statsService.test.ts
import { describe, it, expect } from 'vitest';
import { computeTagStats, computeDailyStats, formatDuration } from '../../src/services/statsService';
import type { Question, QuizRecord } from '../../src/shared/types';

const emptyDoc = { type: 'doc', content: [{ type: 'paragraph', content: [] }] };

describe('statsService', () => {
  const questions: Question[] = [
    { id: 'q1', bankId: 'b1', type: 'single', body: emptyDoc, options: [], answer: [0], explanation: emptyDoc, tags: ['二叉树', '遍历'], order: 1, createdAt: 0 },
    { id: 'q2', bankId: 'b1', type: 'single', body: emptyDoc, options: [], answer: [0], explanation: emptyDoc, tags: ['二叉树'], order: 2, createdAt: 0 },
    { id: 'q3', bankId: 'b1', type: 'single', body: emptyDoc, options: [], answer: [0], explanation: emptyDoc, tags: ['图论'], order: 3, createdAt: 0 },
  ];

  const records: QuizRecord[] = [
    { id: 'r1', questionId: 'q1', bankId: 'b1', selectedAnswer: [0], isCorrect: true, timestamp: 1000, duration: 30, mode: 'practice' },
    { id: 'r2', questionId: 'q2', bankId: 'b1', selectedAnswer: [1], isCorrect: false, timestamp: 2000, duration: 45, mode: 'practice' },
    { id: 'r3', questionId: 'q3', bankId: 'b1', selectedAnswer: [0], isCorrect: true, timestamp: 3000, duration: 20, mode: 'practice' },
  ];

  it('computeTagStats groups by tag', () => {
    const stats = computeTagStats(questions, records);
    const bt = stats.find((s) => s.tag === '二叉树');
    expect(bt).toBeDefined();
    expect(bt!.questionCount).toBe(2);
    expect(bt!.answeredCount).toBe(2);
    expect(bt!.correctCount).toBe(1);
    expect(bt!.accuracy).toBe(0.5);
  });

  it('computeDailyStats groups by day', () => {
    const stats = computeDailyStats(records);
    expect(stats.length).toBeGreaterThanOrEqual(1);
    expect(stats[0].totalAnswered).toBe(3);
    expect(stats[0].correctCount).toBe(2);
  });

  it('formatDuration formats seconds to readable', () => {
    expect(formatDuration(30)).toBe('30s');
    expect(formatDuration(90)).toBe('1分30秒');
    expect(formatDuration(3661)).toBe('1小时1分1秒');
  });
});
```

- [ ] **Step 2: Implement `statsService`**

```typescript
// src/services/statsService.ts
import type { Question, QuizRecord } from '../shared/types';

export interface TagStat {
  tag: string;
  questionCount: number;
  answeredCount: number;
  correctCount: number;
  accuracy: number;
  avgDuration: number;
}

export interface DailyStat {
  date: string;
  totalAnswered: number;
  correctCount: number;
  accuracy: number;
}

export function computeTagStats(questions: Question[], records: QuizRecord[]): TagStat[] {
  // Build latest record per question
  const latestRecord: Record<string, QuizRecord> = {};
  for (const r of records) {
    if (!latestRecord[r.questionId] || r.timestamp > latestRecord[r.questionId].timestamp) {
      latestRecord[r.questionId] = r;
    }
  }

  // Aggregate by tag
  const tagMap = new Map<string, { questions: Set<string>; answered: QuizRecord[] }>();
  for (const q of questions) {
    for (const tag of q.tags) {
      if (!tagMap.has(tag)) {
        tagMap.set(tag, { questions: new Set(), answered: [] });
      }
      tagMap.get(tag)!.questions.add(q.id);
      const lr = latestRecord[q.id];
      if (lr) tagMap.get(tag)!.answered.push(lr);
    }
  }

  return Array.from(tagMap.entries())
    .map(([tag, data]) => ({
      tag,
      questionCount: data.questions.size,
      answeredCount: data.answered.length,
      correctCount: data.answered.filter((r) => r.isCorrect).length,
      accuracy: data.answered.length > 0
        ? data.answered.filter((r) => r.isCorrect).length / data.answered.length
        : 0,
      avgDuration: data.answered.length > 0
        ? Math.round(data.answered.reduce((s, r) => s + r.duration, 0) / data.answered.length)
        : 0,
    }))
    .sort((a, b) => b.questionCount - a.questionCount);
}

export function computeDailyStats(records: QuizRecord[]): DailyStat[] {
  const dayMap = new Map<string, QuizRecord[]>();
  for (const r of records) {
    const day = new Date(r.timestamp).toISOString().slice(0, 10);
    if (!dayMap.has(day)) dayMap.set(day, []);
    dayMap.get(day)!.push(r);
  }

  return Array.from(dayMap.entries())
    .map(([date, recs]) => ({
      date,
      totalAnswered: recs.length,
      correctCount: recs.filter((r) => r.isCorrect).length,
      accuracy: recs.filter((r) => r.isCorrect).length / recs.length,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}小时`);
  if (m > 0) parts.push(`${m}分`);
  if (s > 0 || parts.length === 0) parts.push(`${s}s`);
  return parts.join('');
}
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run tests/services/statsService.test.ts
```

Expected: all 3 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/services/statsService.ts tests/services/statsService.test.ts
git commit -m "feat(p4): add stats service with tag and daily aggregation"
```

---

### Task 28: Note Store

**Files:**
- Create: `src/stores/noteStore.ts`

- [ ] **Step 1: Implement `noteStore`**

```typescript
// src/stores/noteStore.ts
import { create } from 'zustand';
import { noteRepo } from '../repo/noteRepo';
import type { Note } from '../shared/types';

interface NoteState {
  notesByQuestion: Record<string, Note>;
  loading: boolean;

  loadNotes: (bankId: string) => Promise<void>;
  saveNote: (questionId: string, bankId: string, content: object) => Promise<void>;
  getNote: (questionId: string) => Note | undefined;
}

export const useNoteStore = create<NoteState>((set, get) => ({
  notesByQuestion: {},
  loading: false,

  loadNotes: async (bankId) => {
    set({ loading: true });
    const notes = await noteRepo.findByBankId(bankId);
    const byQuestion: Record<string, Note> = {};
    for (const n of notes) {
      byQuestion[n.questionId] = n;
    }
    set({ notesByQuestion: byQuestion, loading: false });
  },

  saveNote: async (questionId, bankId, content) => {
    const note = await noteRepo.save(questionId, bankId, content);
    set((s) => ({
      notesByQuestion: { ...s.notesByQuestion, [questionId]: note },
    }));
  },

  getNote: (questionId) => {
    return get().notesByQuestion[questionId];
  },
}));
```

- [ ] **Step 2: Commit**

```bash
git add src/stores/noteStore.ts
git commit -m "feat(p4): add zustand note store"
```

---

### Task 29: Integrate Note Panel into Quiz

**Files:**
- Modify: `src/ui/components/QuizQuestion.tsx` (add NotePanel)
- Modify: `src/ui/pages/QuizPage.tsx` (load notes on start — already added in P3 Task 24)

- [ ] **Step 1: Add NotePanel to `QuizQuestion.tsx`**

Add the following imports and component inside `QuizQuestion.tsx`:

```typescript
// Add imports:
import { useState, useEffect } from 'react';
import { useNoteStore } from '../../stores/noteStore';
import { RichTextEditor } from './RichTextEditor';
```

Add this sub-component (in the same file, before the `QuizQuestion` export):

```typescript
function NotePanel({ questionId, bankId }: { questionId: string; bankId: string }) {
  const { getNote, saveNote } = useNoteStore();
  const existing = getNote(questionId);
  const [content, setContent] = useState<object>(
    existing?.content || { type: 'doc', content: [{ type: 'paragraph', content: [] }] }
  );
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (existing) setContent(existing.content);
  }, [existing?.updatedAt]);

  const handleSave = async () => {
    await saveNote(questionId, bankId, content);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <Box mt="md">
      <Group justify="space-between" mb="xs">
        <Text size="sm" fw={500}>我的笔记</Text>
        <Button size="xs" variant="light" onClick={handleSave}>
          {saved ? '已保存' : '保存笔记'}
        </Button>
      </Group>
      <RichTextEditor content={content} onChange={setContent} placeholder="记录你的解题思路..." minHeight={120} />
    </Box>
  );
}
```

Then in the `QuizQuestion` return block, after the `{showResult && (... explanation box ...)}` section, add:

```typescript
      {showResult && (
        <NotePanel questionId={question.id} bankId={question.bankId} />
      )}
```

- [ ] **Step 2: Manual test**

```bash
npm run dev
```

Test: practice mode → submit answer → note panel appears below explanation → type rich text → click save → see "已保存" feedback → reload page → note persists.

- [ ] **Step 3: Commit**

```bash
git add src/ui/components/QuizQuestion.tsx
git commit -m "feat(p4): add per-question note panel in quiz mode"
```

---

### Task 30: Dashboard Page

**Files:**
- Create: `src/ui/pages/DashboardPage.tsx`
- Modify: `src/App.tsx` (add route `/bank/:id/stats`)

- [ ] **Step 1: Create `DashboardPage`**

```typescript
// src/ui/pages/DashboardPage.tsx
import { Box, Title, Group, Text, Button, Tabs, ActionIcon, SimpleGrid } from '@mantine/core';
import { IconArrowLeft, IconTrash } from '@tabler/icons-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { LineChart, PieChart } from '@mantine/charts';
import { useQuestionStore } from '../../stores/questionStore';
import { useBankStore } from '../../stores/bankStore';
import { quizRecordRepo, type QuizStats } from '../../repo/quizRecordRepo';
import { computeTagStats, computeDailyStats, formatDuration, type TagStat, type DailyStat } from '../../services/statsService';

function StatCard({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <Box style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-light)',
      borderRadius: 'var(--radius-md)',
      padding: '20px 24px',
    }}>
      <Text fz="1.5rem" fw={700} c={color} style={{ fontFamily: 'var(--font-display)' }}>{value}</Text>
      <Text size="sm" c="dimmed" mt={4}>{label}</Text>
    </Box>
  );
}

export function DashboardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { questions, loadQuestions } = useQuestionStore();
  const { banks } = useBankStore();
  const bank = banks.find((b) => b.id === id);

  const [stats, setStats] = useState<QuizStats>({ totalAnswered: 0, correctCount: 0, accuracy: 0, totalDuration: 0 });
  const [tagStats, setTagStats] = useState<TagStat[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);

  useEffect(() => { if (id) loadQuestions(id); }, [id]);

  useEffect(() => {
    if (!id) return;
    quizRecordRepo.getStats(id).then(setStats);
    quizRecordRepo.findByBankId(id).then((records) => {
      setTagStats(computeTagStats(questions, records));
      setDailyStats(computeDailyStats(records));
    });
  }, [id, questions]);

  const handleClearRecords = async () => {
    if (!id) return;
    if (confirm('确定清空该题库的所有做题记录吗？此操作不可撤销。')) {
      await quizRecordRepo.deleteByBankId(id);
      setStats({ totalAnswered: 0, correctCount: 0, accuracy: 0, totalDuration: 0 });
      setTagStats([]);
      setDailyStats([]);
    }
  };

  const pieData = tagStats.map((t) => ({
    name: t.tag,
    value: t.questionCount,
    color: ['#3b4b6b', '#5b8c5a', '#c4823d', '#c46b5d', '#8ba4cc', '#7dae7b', '#d49e5a', '#d48b7d'][tagStats.indexOf(t) % 8],
  }));

  const lineData = dailyStats.map((d) => ({
    date: d.date.slice(5),
    total: d.totalAnswered,
    correct: d.correctCount,
    accuracy: Math.round(d.accuracy * 100),
  }));

  return (
    <Box>
      <Box style={{ borderBottom: '1px solid var(--border-light)', padding: '12px 24px', background: 'var(--bg-surface)' }}>
        <Group justify="space-between">
          <Group gap="sm">
            <ActionIcon variant="subtle" onClick={() => navigate(`/bank/${id}`)}>
              <IconArrowLeft size={18} />
            </ActionIcon>
            <Box>
              <Title order={2}>{bank?.name || ''} · 数据看板</Title>
            </Box>
          </Group>
          <Button variant="light" color="red" size="xs" leftSection={<IconTrash size={14} />} onClick={handleClearRecords}>
            清空做题记录
          </Button>
        </Group>
      </Box>

      <Tabs defaultValue="overview" p="md">
        <Tabs.List>
          <Tabs.Tab value="overview">概览</Tabs.Tab>
          <Tabs.Tab value="byTag">按标签</Tabs.Tab>
          <Tabs.Tab value="timeline">时间轴</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="overview" pt="md">
          <SimpleGrid cols={4} mb="xl">
            <StatCard value={String(questions.length)} label="总题数" />
            <StatCard value={String(stats.totalAnswered)} label="已作答" />
            <StatCard
              value={`${Math.round(stats.accuracy * 100)}%`}
              label="正确率"
              color={stats.accuracy >= 0.6 ? 'var(--success)' : 'var(--error)'}
            />
            <StatCard value={formatDuration(stats.totalDuration)} label="总用时" />
          </SimpleGrid>

          <Group grow align="start" gap="md">
            <Box style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: 24 }}>
              <Text fw={500} mb="md">每日正确率趋势</Text>
              {lineData.length > 0 ? (
                <LineChart h={280} data={lineData} dataKey="date"
                  series={[{ name: 'accuracy', label: '正确率 %', color: 'slate.6' }]}
                  curveType="monotone" gridAxis="xy" withTooltip />
              ) : (
                <Text c="dimmed" ta="center" py="xl">暂无数据</Text>
              )}
            </Box>
            <Box style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: 24 }}>
              <Text fw={500} mb="md">标签分布</Text>
              {pieData.length > 0 ? (
                <PieChart h={280} data={pieData} withLabels labelsType="percent" withTooltip />
              ) : (
                <Text c="dimmed" ta="center" py="xl">暂无数据</Text>
              )}
            </Box>
          </Group>
        </Tabs.Panel>

        <Tabs.Panel value="byTag" pt="md">
          <Box>
            <Group p="sm" style={{ borderBottom: '1px solid var(--border-light)' }} fw={600} c="dimmed" fz="xs">
              <Text style={{ flex: 1 }}>标签</Text>
              <Text style={{ width: 60, textAlign: 'right' }}>题数</Text>
              <Text style={{ width: 60, textAlign: 'right' }}>已做</Text>
              <Text style={{ width: 60, textAlign: 'right' }}>正确率</Text>
              <Text style={{ width: 80, textAlign: 'right' }}>平均用时</Text>
            </Group>
            {tagStats.map((t) => (
              <Group key={t.tag} p="sm" style={{ borderBottom: '1px solid var(--border-light)' }}>
                <Text style={{ flex: 1 }} fw={500}>{t.tag}</Text>
                <Text style={{ width: 60, textAlign: 'right' }}>{t.questionCount}</Text>
                <Text style={{ width: 60, textAlign: 'right' }}>{t.answeredCount}</Text>
                <Text style={{ width: 60, textAlign: 'right' }} c={t.accuracy >= 0.6 ? 'green' : 'red'} fw={500}>
                  {Math.round(t.accuracy * 100)}%
                </Text>
                <Text style={{ width: 80, textAlign: 'right' }} size="xs" c="dimmed">{formatDuration(t.avgDuration)}</Text>
              </Group>
            ))}
            {tagStats.length === 0 && <Text c="dimmed" ta="center" py="xl">暂无数据</Text>}
          </Box>
        </Tabs.Panel>

        <Tabs.Panel value="timeline" pt="md">
          {lineData.length > 0 ? (
            <Box>
              <LineChart h={350} data={lineData} dataKey="date"
                series={[
                  { name: 'total', label: '答题数', color: 'slate.6' },
                  { name: 'accuracy', label: '正确率 %', color: 'green.6' },
                ]}
                curveType="monotone" gridAxis="xy" withTooltip />
            </Box>
          ) : (
            <Text c="dimmed" ta="center" py="xl">暂无数据</Text>
          )}
        </Tabs.Panel>
      </Tabs>
    </Box>
  );
}
```

- [ ] **Step 2: Add route to `App.tsx`**

```typescript
import { DashboardPage } from './ui/pages/DashboardPage';
// Add inside <Routes>:
<Route path="/bank/:id/stats" element={<DashboardPage />} />
```

- [ ] **Step 3: Manual test**

```bash
npm run dev
```

Test: do quiz → navigate to dashboard → verify stats, charts, tag table, timeline, clear records.

- [ ] **Step 4: Commit**

```bash
git add src/ui/pages/DashboardPage.tsx src/App.tsx
git commit -m "feat(p4): add dashboard page with stats, charts, and clear records"
```

---

### Task 31: Verify P4 complete

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

- [ ] **Step 3: Manual smoke test checklist**
  - [ ] Note appears in quiz mode after answer submission
  - [ ] Save note → reload → note persists
  - [ ] Note content supports rich text (bold, code, image)
  - [ ] Dashboard overview: stat cards display correct numbers
  - [ ] Line chart renders daily accuracy trend
  - [ ] Pie chart renders tag distribution
  - [ ] By-tag table shows correct breakdown
  - [ ] Timeline view shows daily activity
  - [ ] "Clear records" resets all quiz data for the bank
  - [ ] Empty states show when no data exists

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(p4): p4 complete - notes and data dashboard"
```
