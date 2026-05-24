# ExLocal P3: Quiz Mode

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete quiz flow — practice mode (per-question scoring + instant feedback) and exam mode (batch submit), sequential/shuffle ordering, timer, progress tracking, post-submit review.

**Architecture:** QuizStore driving state, QuizPage composing question display + option interaction, quiz records written immediately to IndexedDB in practice mode, batched in exam mode.

**Tech Stack:** Existing stack, no new dependencies.

---

## File Structure (new/modified)

```
src/
  repo/
    quizRecordRepo.ts           # QuizRecord CRUD + stats
  services/
    quizService.ts              # Grading, shuffle
  stores/
    quizStore.ts                # Zustand quiz session state
  ui/
    components/
      QuizQuestion.tsx          # Question display + options + TipTap renderer
      QuizProgress.tsx          # Progress bar + timer
      QuizResult.tsx            # Post-submit result overview
    pages/
      QuizPage.tsx              # Quiz mode container with setup modal
  App.tsx                       # Add /bank/:id/quiz route
tests/
  repo/
    quizRecordRepo.test.ts
  services/
    quizService.test.ts
```

---

### Task 20: Quiz Record Repo

**Files:**
- Create: `src/repo/quizRecordRepo.ts`
- Create: `tests/repo/quizRecordRepo.test.ts`

- [ ] **Step 1: Write test**

```typescript
// tests/repo/quizRecordRepo.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { quizRecordRepo } from '../../src/repo/quizRecordRepo';
import { bankRepo } from '../../src/repo/bankRepo';
import { questionRepo } from '../../src/repo/questionRepo';
import { db } from '../../src/repo/db';

const emptyDoc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }] };

describe('quizRecordRepo', () => {
  beforeAll(async () => {
    await db.delete();
    await db.open();
  });

  it('creates a record', async () => {
    const bank = await bankRepo.create({ name: 't', description: '', tags: [] });
    const q = await questionRepo.create({ bankId: bank.id, type: 'single', body: emptyDoc, options: [{ index: 0, content: emptyDoc }], answer: [0], explanation: emptyDoc, tags: [] });
    const r = await quizRecordRepo.create({ questionId: q.id, bankId: bank.id, selectedAnswer: [0], isCorrect: true, duration: 30, mode: 'practice' });
    expect(r.id).toBeDefined();
    expect(r.isCorrect).toBe(true);
  });

  it('finds records by bankId', async () => {
    const bank = await bankRepo.create({ name: 't2', description: '', tags: [] });
    const q = await questionRepo.create({ bankId: bank.id, type: 'single', body: emptyDoc, options: [{ index: 0, content: emptyDoc }], answer: [0], explanation: emptyDoc, tags: [] });
    await quizRecordRepo.create({ questionId: q.id, bankId: bank.id, selectedAnswer: [0], isCorrect: true, duration: 10, mode: 'practice' });
    const records = await quizRecordRepo.findByBankId(bank.id);
    expect(records.length).toBeGreaterThanOrEqual(1);
  });

  it('finds records by questionId', async () => {
    const bank = await bankRepo.create({ name: 't3', description: '', tags: [] });
    const q = await questionRepo.create({ bankId: bank.id, type: 'truefalse', body: emptyDoc, options: [{ index: 0, content: emptyDoc }], answer: [0], explanation: emptyDoc, tags: [] });
    await quizRecordRepo.create({ questionId: q.id, bankId: bank.id, selectedAnswer: [0], isCorrect: true, duration: 5, mode: 'exam' });
    const records = await quizRecordRepo.findByQuestionId(q.id);
    expect(records.length).toBe(1);
  });

  it('getStats returns correct aggregation', async () => {
    const bank = await bankRepo.create({ name: 't4', description: '', tags: [] });
    const q1 = await questionRepo.create({ bankId: bank.id, type: 'single', body: emptyDoc, options: [{ index: 0, content: emptyDoc }], answer: [0], explanation: emptyDoc, tags: [] });
    const q2 = await questionRepo.create({ bankId: bank.id, type: 'single', body: emptyDoc, options: [{ index: 0, content: emptyDoc }], answer: [0], explanation: emptyDoc, tags: [] });
    await quizRecordRepo.create({ questionId: q1.id, bankId: bank.id, selectedAnswer: [0], isCorrect: true, duration: 10, mode: 'practice' });
    await quizRecordRepo.create({ questionId: q2.id, bankId: bank.id, selectedAnswer: [1], isCorrect: false, duration: 20, mode: 'practice' });
    const stats = await quizRecordRepo.getStats(bank.id);
    expect(stats.totalAnswered).toBe(2);
    expect(stats.correctCount).toBe(1);
    expect(stats.accuracy).toBe(0.5);
    expect(stats.totalDuration).toBe(30);
  });
});
```

- [ ] **Step 2: Implement `quizRecordRepo`**

```typescript
// src/repo/quizRecordRepo.ts
import { nanoid } from 'nanoid';
import { db } from './db';
import type { QuizRecord } from '../shared/types';

type CreateInput = Omit<QuizRecord, 'id' | 'timestamp'>;

export interface QuizStats {
  totalAnswered: number;
  correctCount: number;
  accuracy: number;
  totalDuration: number;
}

export const quizRecordRepo = {
  async create(input: CreateInput): Promise<QuizRecord> {
    const record: QuizRecord = { id: nanoid(), ...input, timestamp: Date.now() };
    await db.quizRecords.put(record);
    return record;
  },

  async bulkCreate(inputs: CreateInput[]): Promise<QuizRecord[]> {
    const records: QuizRecord[] = inputs.map((input) => ({
      id: nanoid(), ...input, timestamp: Date.now(),
    }));
    await db.quizRecords.bulkPut(records);
    return records;
  },

  async findByBankId(bankId: string): Promise<QuizRecord[]> {
    return db.quizRecords.where('bankId').equals(bankId).sortBy('timestamp');
  },

  async findByQuestionId(questionId: string): Promise<QuizRecord[]> {
    return db.quizRecords.where('questionId').equals(questionId).sortBy('timestamp');
  },

  async getStats(bankId: string): Promise<QuizStats> {
    const records = await db.quizRecords.where('bankId').equals(bankId).toArray();
    const correctCount = records.filter((r) => r.isCorrect).length;
    return {
      totalAnswered: records.length,
      correctCount,
      accuracy: records.length > 0 ? correctCount / records.length : 0,
      totalDuration: records.reduce((sum, r) => sum + r.duration, 0),
    };
  },

  async deleteByBankId(bankId: string): Promise<void> {
    await db.quizRecords.where('bankId').equals(bankId).delete();
  },
};
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run tests/repo/quizRecordRepo.test.ts
```

Expected: all 4 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/repo/quizRecordRepo.ts tests/repo/quizRecordRepo.test.ts
git commit -m "feat(p3): add quiz record repo with stats aggregation"
```

---

### Task 21: Quiz Service

**Files:**
- Create: `src/services/quizService.ts`
- Create: `tests/services/quizService.test.ts`

- [ ] **Step 1: Write test**

```typescript
// tests/services/quizService.test.ts
import { describe, it, expect } from 'vitest';
import { quizService } from '../../src/services/quizService';

describe('quizService', () => {
  it('gradeQuestion returns correct for single choice', () => {
    const q = { type: 'single' as const, answer: [0] };
    expect(quizService.gradeQuestion(q, [0])).toEqual({ isCorrect: true, partialCorrect: false });
    expect(quizService.gradeQuestion(q, [1])).toEqual({ isCorrect: false, partialCorrect: false });
  });

  it('gradeQuestion handles multiple choice with partial credit', () => {
    const q = { type: 'multiple' as const, answer: [0, 2] };
    expect(quizService.gradeQuestion(q, [0, 2])).toEqual({ isCorrect: true, partialCorrect: false });
    expect(quizService.gradeQuestion(q, [0])).toEqual({ isCorrect: false, partialCorrect: true });
    expect(quizService.gradeQuestion(q, [1])).toEqual({ isCorrect: false, partialCorrect: false });
  });

  it('shuffleArray preserves all elements', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const shuffled = quizService.shuffleArray([...arr]);
    expect(shuffled.sort()).toEqual(arr.sort());
  });
});
```

- [ ] **Step 2: Implement `quizService`**

```typescript
// src/services/quizService.ts
import { quizRecordRepo } from '../repo/quizRecordRepo';
import type { Question, QuizRecord } from '../shared/types';

export const quizService = {
  gradeQuestion(question: { type: Question['type']; answer: number[] }, selected: number[]): { isCorrect: boolean; partialCorrect: boolean } {
    const correct = question.answer.sort().join(',') === selected.sort().join(',');
    // Partial: not fully correct, but all selected choices are in the answer set (no wrong choices picked)
    const partial = !correct && selected.length > 0 && selected.every((a) => question.answer.includes(a));
    return { isCorrect: correct, partialCorrect: partial };
  },

  shuffleArray<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  },

  submitAnswer(input: Omit<QuizRecord, 'id' | 'timestamp'>): Promise<QuizRecord> {
    return quizRecordRepo.create(input);
  },

  submitBulk(inputs: Omit<QuizRecord, 'id' | 'timestamp'>[]): Promise<QuizRecord[]> {
    return quizRecordRepo.bulkCreate(inputs);
  },
};
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run tests/services/quizService.test.ts
```

Expected: all 3 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/services/quizService.ts tests/services/quizService.test.ts
git commit -m "feat(p3): add quiz service with grading and shuffle"
```

---

### Task 22: Zustand Quiz Store

**Files:**
- Create: `src/stores/quizStore.ts`

- [ ] **Step 1: Implement `quizStore`**

```typescript
// src/stores/quizStore.ts
import { create } from 'zustand';
import { questionRepo } from '../repo/questionRepo';
import { quizService } from '../services/quizService';
import type { Question, QuizRecord } from '../shared/types';

type QuizMode = 'practice' | 'exam';

interface AnswerEntry {
  selected: number[];
  isCorrect: boolean;
  duration: number;
  answered: boolean;
}

interface QuizState {
  mode: QuizMode;
  orderType: 'sequential' | 'shuffled';
  questions: Question[];
  currentIndex: number;
  answers: Record<string, AnswerEntry>;
  questionStartTime: number;
  sessionStartTime: number;
  finished: boolean;

  startQuiz: (bankId: string, mode: QuizMode, orderType: 'sequential' | 'shuffled') => Promise<void>;
  selectAnswer: (questionId: string, selected: number[]) => void;
  submitCurrentAnswer: () => Promise<void>;
  submitAllAnswers: () => Promise<void>;
  goToQuestion: (index: number) => void;
  nextQuestion: () => void;
  prevQuestion: () => void;
  getResults: () => { total: number; answered: number; correct: number; accuracy: number; totalDuration: number };
}

export const useQuizStore = create<QuizState>((set, get) => ({
  mode: 'practice',
  orderType: 'sequential',
  questions: [],
  currentIndex: 0,
  answers: {},
  questionStartTime: 0,
  sessionStartTime: 0,
  finished: false,

  startQuiz: async (bankId, mode, orderType) => {
    let questions = await questionRepo.findByBankId(bankId);
    if (orderType === 'shuffled') {
      questions = quizService.shuffleArray(questions);
    }
    set({
      mode, orderType, questions, currentIndex: 0, answers: {},
      questionStartTime: Date.now(), sessionStartTime: Date.now(), finished: false,
    });
  },

  selectAnswer: (questionId, selected) => {
    set((s) => ({
      answers: { ...s.answers, [questionId]: { ...s.answers[questionId], selected, answered: false } },
    }));
  },

  submitCurrentAnswer: async () => {
    const { questions, currentIndex, answers, mode, questionStartTime } = get();
    const q = questions[currentIndex];
    if (!q) return;
    const entry = answers[q.id];
    if (!entry || !entry.selected?.length) return;

    const duration = Math.round((Date.now() - questionStartTime) / 1000);
    const { isCorrect } = quizService.gradeQuestion(q, entry.selected);

    await quizService.submitAnswer({
      questionId: q.id, bankId: q.bankId, selectedAnswer: entry.selected,
      isCorrect, duration, mode,
    });

    set((s) => ({
      answers: { ...s.answers, [q.id]: { ...entry, isCorrect, duration, answered: true } },
      questionStartTime: Date.now(),
    }));
  },

  submitAllAnswers: async () => {
    const { questions, answers, mode } = get();
    const records: Omit<QuizRecord, 'id' | 'timestamp'>[] = [];
    const updated: Record<string, AnswerEntry> = {};

    for (const q of questions) {
      const entry = answers[q.id];
      if (entry && entry.selected?.length) {
        const { isCorrect } = quizService.gradeQuestion(q, entry.selected);
        records.push({ questionId: q.id, bankId: q.bankId, selectedAnswer: entry.selected, isCorrect, duration: 0, mode });
        updated[q.id] = { ...entry, isCorrect, duration: 0, answered: true };
      } else {
        updated[q.id] = entry || { selected: [], isCorrect: false, duration: 0, answered: false };
      }
    }

    if (records.length > 0) await quizService.submitBulk(records);
    set({ answers: updated, finished: true });
  },

  goToQuestion: (index) => set({ currentIndex: index }),
  nextQuestion: () => set((s) => ({ currentIndex: Math.min(s.currentIndex + 1, s.questions.length - 1) })),
  prevQuestion: () => set((s) => ({ currentIndex: Math.max(s.currentIndex - 1, 0) })),

  getResults: () => {
    const { answers, sessionStartTime } = get();
    const entries = Object.values(answers);
    const answeredEntries = entries.filter((e) => e.answered);
    return {
      total: entries.length,
      answered: answeredEntries.length,
      correct: answeredEntries.filter((e) => e.isCorrect).length,
      accuracy: answeredEntries.length > 0 ? answeredEntries.filter((e) => e.isCorrect).length / answeredEntries.length : 0,
      totalDuration: Math.round((Date.now() - sessionStartTime) / 1000),
    };
  },
}));
```

- [ ] **Step 2: Commit**

```bash
git add src/stores/quizStore.ts
git commit -m "feat(p3): add zustand quiz store with practice/exam modes"
```

---

### Task 23: Quiz UI Components

**Files:**
- Create: `src/ui/components/QuizProgress.tsx`
- Create: `src/ui/components/QuizQuestion.tsx`
- Create: `src/ui/components/QuizResult.tsx`

- [ ] **Step 1: `QuizProgress`**

```typescript
// src/ui/components/QuizProgress.tsx
import { Group, Progress, Text, Badge } from '@mantine/core';

interface Props {
  current: number;
  total: number;
  answeredCount: number;
  elapsed: number; // seconds
  mode: 'practice' | 'exam';
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function QuizProgress({ current, total, answeredCount, elapsed, mode }: Props) {
  const pct = ((current + 1) / total) * 100;
  return (
    <Group gap="md" style={{ width: '100%' }}>
      <Badge variant="light">{mode === 'practice' ? '练习模式' : '考试模式'}</Badge>
      <div style={{ flex: 1 }}>
        <Group justify="center" gap={4}>
          <Text size="sm" fw={500}>第 {current + 1} 题 / {total}</Text>
        </Group>
        <Progress value={pct} size="sm" mt={4} />
      </div>
      <Group gap={4}>
        <Text size="sm" c="dimmed">{formatTime(elapsed)}</Text>
        <Text size="xs" c="dimmed">{answeredCount}/{total} 已答</Text>
      </Group>
    </Group>
  );
}
```

- [ ] **Step 2: `QuizQuestion`** (with TipTap content renderer)

```typescript
// src/ui/components/QuizQuestion.tsx
import { Box, Text, Button, Group, Badge } from '@mantine/core';
import { IconCheck, IconX } from '@tabler/icons-react';
import type { Question } from '../../shared/types';

interface Props {
  question: Question;
  selectedAnswer: number[];
  onSelect: (indices: number[]) => void;
  showResult: boolean;
  mode: 'practice' | 'exam';
  readOnly?: boolean;
}

export function QuizQuestion({ question, selectedAnswer, onSelect, showResult, mode, readOnly }: Props) {
  const toggleOption = (idx: number) => {
    if (readOnly) return;
    if (question.type === 'single' || question.type === 'truefalse') {
      onSelect([idx]);
    } else {
      onSelect(
        selectedAnswer.includes(idx)
          ? selectedAnswer.filter((a) => a !== idx)
          : [...selectedAnswer, idx].sort()
      );
    }
  };

  return (
    <Box>
      <Group gap="xs" mb="md">
        <Badge variant="light" size="sm">
          {question.type === 'single' ? '单选题' : question.type === 'multiple' ? '多选题' : '判断题'}
        </Badge>
        {question.tags.map((t) => (
          <Badge key={t} variant="outline" size="sm">{t}</Badge>
        ))}
      </Group>

      <Box mb="lg" style={{ fontSize: '1.05rem', lineHeight: 1.8 }}>
        {renderTipTapContent(question.body)}
      </Box>

      <Box>
        {question.type === 'truefalse' ? (
          <Group gap="md">
            <Button
              variant={selectedAnswer.includes(0) ? 'filled' : 'outline'}
              color={showResult ? (question.answer.includes(0) ? 'green' : 'red') : 'slate'}
              onClick={() => toggleOption(0)}
              disabled={readOnly}
            >
              {showResult && question.answer.includes(0) && <IconCheck size={14} />}
              {showResult && selectedAnswer.includes(0) && !question.answer.includes(0) && <IconX size={14} />}
              {'  '}正确 (T)
            </Button>
            <Button
              variant={selectedAnswer.includes(1) ? 'filled' : 'outline'}
              color={showResult ? (question.answer.includes(1) ? 'green' : 'red') : 'slate'}
              onClick={() => toggleOption(1)}
              disabled={readOnly}
            >
              {showResult && question.answer.includes(1) && <IconCheck size={14} />}
              {showResult && selectedAnswer.includes(1) && !question.answer.includes(1) && <IconX size={14} />}
              {'  '}错误 (F)
            </Button>
          </Group>
        ) : (
          question.options.map((opt, idx) => {
            const isSelected = selectedAnswer.includes(idx);
            const isCorrectOption = question.answer.includes(idx);
            return (
              <Button
                key={idx}
                variant={isSelected ? 'filled' : 'outline'}
                color={showResult ? (isCorrectOption ? 'green' : isSelected ? 'red' : 'slate') : 'slate'}
                fullWidth
                size="lg"
                style={{
                  justifyContent: 'flex-start',
                  marginBottom: 8,
                  height: 'auto',
                  padding: '12px 16px',
                }}
                onClick={() => toggleOption(idx)}
                disabled={readOnly}
                leftSection={
                  <Badge
                    size="sm"
                    radius="xl"
                    variant={isSelected ? 'filled' : 'light'}
                    color={isSelected ? 'slate' : 'gray'}
                  >
                    {String.fromCharCode(65 + idx)}
                  </Badge>
                }
              >
                <Text size="sm" style={{ textAlign: 'left' }}>
                  {renderTipTapContent(opt.content)}
                </Text>
              </Button>
            );
          })
        )}
      </Box>

      {showResult && (
        <Box mt="lg" p="md" style={{
          background: 'var(--accent-light)',
          borderRadius: 'var(--radius-md)',
          borderLeft: '3px solid var(--accent)',
        }}>
          <Text size="sm" fw={500} mb={4}>解析：</Text>
          {renderTipTapContent(question.explanation)}
        </Box>
      )}
    </Box>
  );
}

function renderTipTapContent(doc: any): React.ReactNode {
  if (!doc || !doc.content) return null;
  return doc.content.map((node: any, i: number) => {
    if (node.type === 'paragraph') {
      const text = node.content?.map((n: any) => n.text).join('') || '';
      return <Text key={i} style={{ whiteSpace: 'pre-wrap' }}>{text}</Text>;
    }
    if (node.type === 'codeBlock') {
      const code = node.content?.[0]?.text || '';
      return (
        <Box key={i} component="pre" style={{
          background: 'var(--bg-muted)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px 16px',
          fontFamily: 'SF Mono, Fira Code, monospace',
          fontSize: '0.85rem',
          overflow: 'auto',
        }}>
          {code}
        </Box>
      );
    }
    if (node.type === 'image') {
      return <img key={i} src={node.attrs?.src} alt={node.attrs?.alt} style={{ maxWidth: '100%', borderRadius: 'var(--radius-sm)' }} />;
    }
    return null;
  });
}
```

- [ ] **Step 3: `QuizResult`**

```typescript
// src/ui/components/QuizResult.tsx
import { Box, Text, Title, Group, Stack, Progress, Button } from '@mantine/core';

interface Props {
  total: number;
  answered: number;
  correct: number;
  accuracy: number;
  totalDuration: number;
  onReview: () => void;
  onBack: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}分${s}秒`;
}

export function QuizResult({ total, answered, correct, accuracy, totalDuration, onReview, onBack }: Props) {
  return (
    <Box ta="center" py="xl">
      <Title order={1} style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem' }} mb="lg">
        答题完成
      </Title>

      <Group justify="center" gap="xl" mb="xl">
        <Stack align="center" gap={4}>
          <Text size="2rem" fw={700} style={{ fontFamily: 'var(--font-display)' }}>{answered}/{total}</Text>
          <Text size="sm" c="dimmed">作答数</Text>
        </Stack>
        <Stack align="center" gap={4}>
          <Text size="2rem" fw={700} c={accuracy >= 0.6 ? 'green' : 'red'} style={{ fontFamily: 'var(--font-display)' }}>
            {Math.round(accuracy * 100)}%
          </Text>
          <Text size="sm" c="dimmed">正确率</Text>
        </Stack>
        <Stack align="center" gap={4}>
          <Text size="2rem" fw={700} style={{ fontFamily: 'var(--font-display)' }}>{formatTime(totalDuration)}</Text>
          <Text size="sm" c="dimmed">用时</Text>
        </Stack>
      </Group>

      <Progress value={accuracy * 100} size="lg" mb="xl" mx="auto" style={{ maxWidth: 400 }} color={accuracy >= 0.6 ? 'green' : 'red'} />

      <Group justify="center" gap="md">
        <Button variant="default" onClick={onBack}>返回题库</Button>
        <Button onClick={onReview}>回顾题目</Button>
      </Group>
    </Box>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/ui/components/QuizProgress.tsx src/ui/components/QuizQuestion.tsx src/ui/components/QuizResult.tsx
git commit -m "feat(p3): add quiz ui components - progress, question, result"
```

---

### Task 24: Quiz Page

**Files:**
- Create: `src/ui/pages/QuizPage.tsx`
- Modify: `src/App.tsx` (add route `/bank/:id/quiz`)

- [ ] **Step 1: Create `QuizPage`**

```typescript
// src/ui/pages/QuizPage.tsx
import { Box, Group, Button, Select, Modal, Stack } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { useQuizStore } from '../../stores/quizStore';
import { QuizProgress } from '../components/QuizProgress';
import { QuizQuestion } from '../components/QuizQuestion';
import { QuizResult } from '../components/QuizResult';

export function QuizPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const store = useQuizStore();
  const { questions, currentIndex, answers, mode, finished } = store;

  const [showSetup, { open: openSetup, close: closeSetup }] = useDisclosure(true);
  const [selMode, setSelMode] = useState<'practice' | 'exam'>('practice');
  const [selOrder, setSelOrder] = useState<'sequential' | 'shuffled'>('sequential');
  const [timer, setTimer] = useState(0);
  const [reviewMode, setReviewMode] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!finished && questions.length > 0) {
      timerRef.current = setInterval(() => setTimer((t) => t + 1), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [finished, questions.length]);

  const startQuiz = async () => {
    if (!id) return;
    await store.startQuiz(id, selMode, selOrder);
    // Note: note loading is deferred to P4 (Task 29). In P3, the note panel is not yet visible.
    setTimer(0);
    closeSetup();
  };

  const handleSubmitCurrent = async () => {
    await store.submitCurrentAnswer();
  };

  const handleSubmitAll = async () => {
    await store.submitAllAnswers();
    clearInterval(timerRef.current);
  };

  const results = store.getResults();
  const currentQuestion = questions[currentIndex];

  if (showSetup) {
    return (
      <Modal opened={showSetup} onClose={() => navigate(`/bank/${id}`)} title="开始做题" centered>
        <Stack gap="md">
          <Select
            label="模式"
            data={[
              { value: 'practice', label: '练习模式 - 逐题提交，即时反馈' },
              { value: 'exam', label: '考试模式 - 统一交卷' },
            ]}
            value={selMode}
            onChange={(v) => setSelMode(v as 'practice' | 'exam')}
          />
          <Select
            label="顺序"
            data={[
              { value: 'sequential', label: '按题目顺序' },
              { value: 'shuffled', label: '随机打乱' },
            ]}
            value={selOrder}
            onChange={(v) => setSelOrder(v as 'sequential' | 'shuffled')}
          />
          <Button onClick={startQuiz} fullWidth size="lg">开始</Button>
        </Stack>
      </Modal>
    );
  }

  if (finished && !reviewMode) {
    return (
      <Box>
        <QuizResult
          total={results.total}
          answered={results.answered}
          correct={results.correct}
          accuracy={results.accuracy}
          totalDuration={results.totalDuration}
          onReview={() => setReviewMode(true)}
          onBack={() => navigate(`/bank/${id}`)}
        />
      </Box>
    );
  }

  const answeredCount = Object.values(answers).filter((a) => a.answered || a.selected?.length).length;

  return (
    <Box>
      <Box style={{ borderBottom: '1px solid var(--border-light)', padding: '12px 24px', background: 'var(--bg-surface)' }}>
        <QuizProgress
          current={currentIndex}
          total={questions.length}
          answeredCount={answeredCount}
          elapsed={timer}
          mode={mode}
        />
      </Box>

      <Box p="md" style={{ display: 'flex', gap: 24, maxWidth: 1000, margin: '0 auto' }}>
        <Box style={{ flex: 1 }}>
          {currentQuestion && (
            <QuizQuestion
              question={currentQuestion}
              selectedAnswer={answers[currentQuestion.id]?.selected || []}
              onSelect={(indices) => store.selectAnswer(currentQuestion.id, indices)}
              showResult={answers[currentQuestion.id]?.answered || reviewMode}
              mode={mode}
              readOnly={reviewMode}
            />
          )}

          <Group justify="space-between" mt="xl">
            <Button variant="default" disabled={currentIndex === 0} onClick={() => store.prevQuestion()}>
              ← 上一题
            </Button>

            <Group gap={4}>
              {questions.map((_, idx) => (
                <Button
                  key={idx}
                  variant={idx === currentIndex ? 'filled' : answers[questions[idx]?.id]?.answered ? 'light' : 'outline'}
                  size="xs"
                  px={8}
                  onClick={() => store.goToQuestion(idx)}
                >
                  {idx + 1}
                </Button>
              ))}
            </Group>

            {mode === 'practice' && !reviewMode && (
              <Button onClick={handleSubmitCurrent} disabled={!answers[currentQuestion?.id]?.selected?.length}>
                提交答案
              </Button>
            )}

            {mode === 'exam' && !reviewMode && (
              <Button onClick={handleSubmitAll} disabled={answeredCount === 0}>
                交卷
              </Button>
            )}

            <Button variant="default" disabled={currentIndex === questions.length - 1} onClick={() => store.nextQuestion()}>
              下一题 →
            </Button>
          </Group>
        </Box>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Add route to `App.tsx`**

```typescript
import { QuizPage } from './ui/pages/QuizPage';
// Add inside <Routes>:
<Route path="/bank/:id/quiz" element={<QuizPage />} />
```

- [ ] **Step 3: Manual test**

```bash
npm run dev
```

Test: practice mode, exam mode, shuffle, navigate, review after submit.

- [ ] **Step 4: Commit**

```bash
git add src/ui/pages/QuizPage.tsx src/App.tsx
git commit -m "feat(p3): add quiz page with practice/exam modes, navigation, results"
```

---

### Task 25: Verify P3 complete

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
  - [ ] Practice mode: answer → submit → see correct/wrong + explanation
  - [ ] Exam mode: answer all → submit all → see results
  - [ ] Sequential and shuffled ordering
  - [ ] Timer runs correctly
  - [ ] Progress bar and question navigator dots
  - [ ] Post-submit review (browse all questions with answers visible)
  - [ ] Quiz records appear in IndexedDB (DevTools → Application → IndexedDB)
  - [ ] Navigate away and back, records persist

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(p3): p3 complete - quiz mode with practice, exam, shuffle, review"
```
