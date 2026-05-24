# ExLocal P1: Infrastructure + Bank CRUD

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the full project scaffold (Vite + React + Tauri + Mantine), implement the layered architecture, IndexedDB Repo layer, and Bank CRUD with a working Bank List page.

**Architecture:** Three-layer (UI → Service → Repo), Zustand stores bridge UI and Service, Dexie.js for IndexedDB, Mantine for theming and components.

**Tech Stack:** React 18, TypeScript, Vite, Tauri v2, Mantine v7, Zustand, Dexie.js, React Router v6, Vitest

---

## File Structure

```
ExLocal/
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── vitest.config.ts
├── src/
│   ├── main.tsx                          # Entry point
│   ├── App.tsx                           # Router setup
│   ├── theme.ts                          # Mantine theme + CSS vars
│   ├── global.css                        # Global styles, fonts, noise
│   ├── shared/
│   │   └── types.ts                      # Bank, Question, Option types
│   ├── repo/
│   │   ├── db.ts                         # Dexie instance + schema
│   │   └── bankRepo.ts                   # Bank CRUD interface + impl
│   ├── services/
│   │   └── bankService.ts                # Bank business logic
│   ├── stores/
│   │   ├── bankStore.ts                  # Zustand bank store
│   │   └── uiStore.ts                    # Zustand UI store (theme)
│   └── ui/
│       ├── components/
│       │   ├── AppLayout.tsx              # Sidebar + main layout
│       │   ├── Sidebar.tsx                # Navigation sidebar
│       │   └── EmptyState.tsx             # Reusable empty state
│       └── pages/
│           └── BankListPage.tsx           # Bank list + create/import
├── tests/
│   └── repo/
│       └── bankRepo.test.ts              # Bank CRUD unit tests
└── src-tauri/
    ├── Cargo.toml
    ├── tauri.conf.json
    ├── build.rs
    ├── icons/
    └── src/
        └── main.rs                       # Tauri entry (file dialog stubs)
```

---

### Task 1: Scaffold Vite + React + TypeScript project

**Files:**
- Create: `package.json`, `index.html`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `src/main.tsx`, `src/App.tsx`
- Create: `vitest.config.ts`

- [ ] **Step 1: Create Vite project**

```bash
cd /Users/mwj/vibe-code/ExBook/ExLocal
npm create vite@latest . -- --template react-ts
```

Expected: project scaffolded, `package.json` created.

- [ ] **Step 2: Install all dependencies**

```bash
npm install
npm install @mantine/core @mantine/hooks @mantine/tiptap @mantine/charts @mantine/notifications react-router-dom zustand dexie react-icons recharts dayjs
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

Expected: all packages installed, `package.json` updated.

- [ ] **Step 3: Update `index.html` to set language and include fonts**

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ExLocal</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Geist:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [],
  },
});
```

- [ ] **Step 5: Verify dev server starts**

```bash
npm run dev
```

Expected: Vite dev server starts, blank page renders.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(p1): scaffold vite + react + ts project with all dependencies"
```

---

### Task 2: Define shared types

**Files:**
- Create: `src/shared/types.ts`

- [ ] **Step 1: Write types**

```typescript
// src/shared/types.ts

export type QuestionType = 'single' | 'multiple' | 'truefalse';

export interface Bank {
  id: string;
  name: string;
  description: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  questionCount: number;
}

export interface Option {
  index: number;
  content: object; // TipTap JSON
}

export interface Question {
  id: string;
  bankId: string;
  type: QuestionType;
  body: object; // TipTap JSON
  options: Option[];
  answer: number[];
  explanation: object; // TipTap JSON
  tags: string[];
  order: number;
  createdAt: number;
}

export interface QuizRecord {
  id: string;
  questionId: string;
  bankId: string;
  selectedAnswer: number[];
  isCorrect: boolean;
  timestamp: number;
  duration: number;
  mode: 'practice' | 'exam';
}

export interface Note {
  id: string;
  questionId: string;
  bankId: string;
  content: object; // TipTap JSON
  updatedAt: number;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat(p1): add shared type definitions"
```

---

### Task 3: Dexie database setup and schema

**Files:**
- Create: `src/repo/db.ts`

- [ ] **Step 1: Define Dexie database**

```typescript
// src/repo/db.ts
import Dexie, { type Table } from 'dexie';
import type { Bank, Question, QuizRecord, Note } from '../shared/types';

export class ExLocalDB extends Dexie {
  banks!: Table<Bank, string>;
  questions!: Table<Question, string>;
  quizRecords!: Table<QuizRecord, string>;
  notes!: Table<Note, string>;

  constructor() {
    super('exlocal');
    this.version(1).stores({
      banks: 'id, updatedAt',
      questions: 'id, bankId, order',
      quizRecords: 'id, questionId, bankId, timestamp',
      notes: 'id, questionId, bankId',
    });
  }
}

export const db = new ExLocalDB();
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/repo/db.ts
git commit -m "feat(p1): add Dexie database schema"
```

---

### Task 4: Bank Repo layer (CRUD operations)

**Files:**
- Create: `src/repo/bankRepo.ts`
- Create: `tests/repo/bankRepo.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/repo/bankRepo.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { bankRepo } from '../../src/repo/bankRepo';
import { db } from '../../src/repo/db';
import type { Bank } from '../../src/shared/types';

const mockBank: Omit<Bank, 'id' | 'createdAt' | 'updatedAt' | 'questionCount'> = {
  name: '数据结构与算法',
  description: '考研408数据结构',
  tags: ['二叉树', '图论'],
};

describe('bankRepo', () => {
  beforeAll(async () => {
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
    expect(found!.name).toBe('操作系统');
  });

  it('lists all banks sorted by updatedAt', async () => {
    const banks = await bankRepo.findAll();
    expect(banks.length).toBeGreaterThanOrEqual(2);
    expect(banks[0].updatedAt).toBeGreaterThanOrEqual(banks[1].updatedAt);
  });

  it('updates a bank', async () => {
    const created = await bankRepo.create({ ...mockBank, name: '计算机网络' });
    const updated = await bankRepo.update(created.id, { name: '计算机网络（修订版）' });
    expect(updated.name).toBe('计算机网络（修订版）');
  });

  it('deletes a bank and its questions', async () => {
    const created = await bankRepo.create({ ...mockBank, name: '临时题库' });
    await bankRepo.delete(created.id);
    const found = await bankRepo.findById(created.id);
    expect(found).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/repo/bankRepo.test.ts
```

Expected: FAIL — `bankRepo` not found.

- [ ] **Step 3: Implement `bankRepo`**

```typescript
// src/repo/bankRepo.ts
import { nanoid } from 'nanoid';
import { db } from './db';
import type { Bank } from '../shared/types';

type CreateInput = Omit<Bank, 'id' | 'createdAt' | 'updatedAt' | 'questionCount'>;
type UpdateInput = Partial<Pick<Bank, 'name' | 'description' | 'tags'>>;

export const bankRepo = {
  async create(input: CreateInput): Promise<Bank> {
    const now = Date.now();
    const bank: Bank = {
      id: nanoid(),
      ...input,
      questionCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    await db.banks.put(bank);
    return bank;
  },

  async findById(id: string): Promise<Bank | undefined> {
    return db.banks.get(id);
  },

  async findAll(): Promise<Bank[]> {
    return db.banks.orderBy('updatedAt').reverse().toArray();
  },

  async update(id: string, input: UpdateInput): Promise<Bank> {
    const bank = await db.banks.get(id);
    if (!bank) throw new Error(`Bank not found: ${id}`);
    const updated: Bank = { ...bank, ...input, updatedAt: Date.now() };
    await db.banks.put(updated);
    return updated;
  },

  async delete(id: string): Promise<void> {
    await db.transaction('rw', db.banks, db.questions, db.quizRecords, db.notes, async () => {
      await db.questions.where('bankId').equals(id).delete();
      await db.quizRecords.where('bankId').equals(id).delete();
      await db.notes.where('bankId').equals(id).delete();
      await db.banks.delete(id);
    });
  },

  async incrementQuestionCount(id: string, delta: number): Promise<void> {
    const bank = await db.banks.get(id);
    if (!bank) throw new Error(`Bank not found: ${id}`);
    await db.banks.update(id, {
      questionCount: bank.questionCount + delta,
      updatedAt: Date.now(),
    });
  },
};
```

- [ ] **Step 4: Install nanoid**

```bash
npm install nanoid
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run tests/repo/bankRepo.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/repo/bankRepo.ts tests/repo/bankRepo.test.ts
git commit -m "feat(p1): add bank repo with CRUD operations and tests"
```

---

### Task 5: Bank Service layer

**Files:**
- Create: `src/services/bankService.ts`

- [ ] **Step 1: Implement `bankService`**

```typescript
// src/services/bankService.ts
import { bankRepo } from '../repo/bankRepo';
import type { Bank } from '../shared/types';

type CreateInput = Omit<Bank, 'id' | 'createdAt' | 'updatedAt' | 'questionCount'>;
type UpdateInput = Partial<Pick<Bank, 'name' | 'description' | 'tags'>>;

export const bankService = {
  async createBank(input: CreateInput): Promise<Bank> {
    if (!input.name.trim()) throw new Error('题库名称不能为空');
    return bankRepo.create({ ...input, name: input.name.trim() });
  },

  async getBank(id: string): Promise<Bank> {
    const bank = await bankRepo.findById(id);
    if (!bank) throw new Error('题库不存在');
    return bank;
  },

  async listBanks(): Promise<Bank[]> {
    return bankRepo.findAll();
  },

  async updateBank(id: string, input: UpdateInput): Promise<Bank> {
    if (input.name !== undefined && !input.name.trim()) {
      throw new Error('题库名称不能为空');
    }
    return bankRepo.update(id, input.name !== undefined ? { ...input, name: input.name.trim() } : input);
  },

  async deleteBank(id: string): Promise<void> {
    await bankRepo.delete(id);
  },
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/services/bankService.ts
git commit -m "feat(p1): add bank service layer with validation"
```

---

### Task 6: Zustand stores

**Files:**
- Create: `src/stores/uiStore.ts`
- Create: `src/stores/bankStore.ts`

- [ ] **Step 1: Implement `uiStore`**

```typescript
// src/stores/uiStore.ts
import { create } from 'zustand';

type Theme = 'light' | 'dark';

interface UIState {
  theme: Theme;
  sidebarOpen: boolean;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
  toggleSidebar: () => void;
}

function getInitialTheme(): Theme {
  const saved = localStorage.getItem('exlocal-theme');
  if (saved === 'light' || saved === 'dark') return saved;
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}

export const useUIStore = create<UIState>((set) => ({
  theme: getInitialTheme(),
  sidebarOpen: true,

  toggleTheme: () =>
    set((s) => {
      const next = s.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('exlocal-theme', next);
      return { theme: next };
    }),

  setTheme: (theme) => set({ theme }),

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));
```

- [ ] **Step 2: Implement `bankStore`**

```typescript
// src/stores/bankStore.ts
import { create } from 'zustand';
import { bankService } from '../services/bankService';
import type { Bank } from '../shared/types';

type CreateInput = Omit<Bank, 'id' | 'createdAt' | 'updatedAt' | 'questionCount'>;
type UpdateInput = Partial<Pick<Bank, 'name' | 'description' | 'tags'>>;

interface BankState {
  banks: Bank[];
  loading: boolean;
  error: string | null;

  loadBanks: () => Promise<void>;
  createBank: (input: CreateInput) => Promise<Bank>;
  updateBank: (id: string, input: UpdateInput) => Promise<void>;
  deleteBank: (id: string) => Promise<void>;
}

export const useBankStore = create<BankState>((set, get) => ({
  banks: [],
  loading: false,
  error: null,

  loadBanks: async () => {
    set({ loading: true, error: null });
    try {
      const banks = await bankService.listBanks();
      set({ banks, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  createBank: async (input) => {
    const bank = await bankService.createBank(input);
    set((s) => ({ banks: [bank, ...s.banks] }));
    return bank;
  },

  updateBank: async (id, input) => {
    await bankService.updateBank(id, input);
    await get().loadBanks();
  },

  deleteBank: async (id) => {
    await bankService.deleteBank(id);
    set((s) => ({ banks: s.banks.filter((b) => b.id !== id) }));
  },
}));
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/stores/uiStore.ts src/stores/bankStore.ts
git commit -m "feat(p1): add zustand stores for ui and bank"
```

---

### Task 7: Mantine theme and global styles

**Files:**
- Create: `src/theme.ts`
- Create: `src/global.css`

- [ ] **Step 1: Create `src/global.css`**

```css
/* src/global.css */
:root {
  --bg-root: #faf7f2;
  --bg-surface: #ffffff;
  --bg-muted: #f3efe8;
  --bg-hover: #ede7dc;
  --text-primary: #2c2416;
  --text-secondary: #7a7568;
  --text-muted: #a8a294;
  --accent: #3b4b6b;
  --accent-light: #e8ecf3;
  --amber: #c4823d;
  --amber-light: #fdf0e2;
  --success: #5b8c5a;
  --success-light: #edf5ec;
  --error: #c46b5d;
  --error-light: #faf0ee;
  --border: #e5e0d5;
  --border-light: #f0ece3;
  --noise-opacity: 0.03;
  --font-display: 'Lora', 'Noto Serif SC', serif;
  --font-body: 'Geist', -apple-system, BlinkMacSystemFont, sans-serif;
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-xl: 24px;
}

[data-mantine-color-scheme="dark"] {
  --bg-root: #161613;
  --bg-surface: #1f1e1a;
  --bg-muted: #282620;
  --bg-hover: #302d26;
  --text-primary: #e8e4db;
  --text-secondary: #a8a294;
  --text-muted: #6b675c;
  --accent: #8ba4cc;
  --accent-light: #252d3a;
  --amber: #d49e5a;
  --amber-light: #3d3020;
  --success: #7dae7b;
  --success-light: #262f24;
  --error: #d48b7d;
  --error-light: #352422;
  --border: #302d26;
  --border-light: #282620;
  --noise-opacity: 0.04;
}

*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

html { font-size: 16px; }

body {
  font-family: var(--font-body);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body::before {
  content: '';
  position: fixed;
  inset: 0;
  opacity: var(--noise-opacity);
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E");
  pointer-events: none;
  z-index: 0;
}

h1, h2, h3, h4 { font-family: var(--font-display); }

::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }
```

- [ ] **Step 2: Create `src/theme.ts`**

```typescript
// src/theme.ts
import { createTheme } from '@mantine/core';

export const theme = createTheme({
  fontFamily: 'Geist, -apple-system, BlinkMacSystemFont, sans-serif',
  fontFamilyMonospace: 'SF Mono, Fira Code, monospace',
  headings: {
    fontFamily: "Lora, 'Noto Serif SC', serif",
  },
  primaryColor: 'slate',
  defaultRadius: 'sm',
  colors: {
    slate: [
      '#faf7f2', '#e8ecf3', '#d1d9e8', '#aab8d4',
      '#8ba4cc', '#6d8ab8', '#3b4b6b', '#2d3b56',
      '#1f2b43', '#141c2e',
    ],
  },
});
```

- [ ] **Step 3: Commit**

```bash
git add src/global.css src/theme.ts
git commit -m "feat(p1): add mantine theme and global css with light/dark"
```

---

### Task 8: Layout components + Router + Entry point

**Files:**
- Create: `src/ui/components/Sidebar.tsx`
- Create: `src/ui/components/AppLayout.tsx`
- Create: `src/ui/components/EmptyState.tsx`
- Create: `src/App.tsx`
- Modify: `src/main.tsx`

- [ ] **Step 1: Create `Sidebar.tsx`**

```typescript
// src/ui/components/Sidebar.tsx
import { NavLink } from 'react-router-dom';
import { Stack, Text, Box, useMantineColorScheme, ActionIcon } from '@mantine/core';
import { IconBooks, IconStar, IconSettings, IconSun, IconMoon } from '@tabler/icons-react';
import { useUIStore } from '../../stores/uiStore';

const navItems = [
  { to: '/', icon: IconBooks, label: '题库' },
  { to: '/starred', icon: IconStar, label: '收藏的题' },
  { to: '/settings', icon: IconSettings, label: '设置' },
];

export function Sidebar() {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();

  return (
    <Box
      style={{
        width: 260,
        height: '100vh',
        borderRight: '1px solid var(--border-light)',
        background: 'var(--bg-surface)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        zIndex: 1,
      }}
    >
      <Box p="md">
        <Text fw={700} style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>
          ExLocal
        </Text>
      </Box>

      <Stack gap={2} px="sm">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            label={label}
            leftSection={<Icon size={18} />}
            end={to === '/'}
          />
        ))}
      </Stack>

      <Box mt="auto" p="sm" style={{ borderTop: '1px solid var(--border-light)' }}>
        <ActionIcon variant="subtle" onClick={toggleColorScheme} size="lg">
          {colorScheme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
        </ActionIcon>
        <Text size="xs" c="dimmed">v0.1.0</Text>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Create `AppLayout.tsx`**

```typescript
// src/ui/components/AppLayout.tsx
import { Box } from '@mantine/core';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function AppLayout() {
  return (
    <Box style={{ display: 'flex', minHeight: '100vh', position: 'relative', zIndex: 1 }}>
      <Sidebar />
      <Box style={{ flex: 1 }}>
        <Outlet />
      </Box>
    </Box>
  );
}
```

- [ ] **Step 3: Create `EmptyState.tsx`**

```typescript
// src/ui/components/EmptyState.tsx
import { Box, Text, Stack } from '@mantine/core';

interface Props {
  icon?: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}

export function EmptyState({ icon = '📭', title, description, children }: Props) {
  return (
    <Box style={{ textAlign: 'center', padding: '60px 20px' }}>
      <Stack align="center" gap="md">
        <Text style={{ fontSize: '3rem', opacity: 0.5 }}>{icon}</Text>
        <Text fw={600} style={{ fontFamily: 'var(--font-display)' }}>{title}</Text>
        <Text size="sm" c="dimmed">{description}</Text>
        {children}
      </Stack>
    </Box>
  );
}
```

- [ ] **Step 4: Create `App.tsx`**

```typescript
// src/App.tsx
import { MantineProvider } from '@mantine/core';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { theme } from './theme';
import { AppLayout } from './ui/components/AppLayout';
import { BankListPage } from './ui/pages/BankListPage';
import '@mantine/core/styles.css';
import './global.css';

export default function App() {
  return (
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<BankListPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </MantineProvider>
  );
}
```

- [ ] **Step 5: Update `src/main.tsx`**

```typescript
// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 6: Create placeholder `BankListPage`**

```typescript
// src/ui/pages/BankListPage.tsx
import { Box, Title, Button, Group, Text } from '@mantine/core';
import { IconPlus, IconFileImport } from '@tabler/icons-react';
import { useEffect } from 'react';
import { useBankStore } from '../../stores/bankStore';
import { EmptyState } from '../components/EmptyState';

export function BankListPage() {
  const { banks, loading, loadBanks } = useBankStore();

  useEffect(() => {
    loadBanks();
  }, []);

  if (loading) return <Text>Loading...</Text>;

  return (
    <Box>
      <Box style={{ borderBottom: '1px solid var(--border-light)', padding: '16px 24px', background: 'var(--bg-surface)' }}>
        <Group justify="space-between" align="center">
          <Box>
            <Title order={2} style={{ margin: 0 }}>题库</Title>
            <Text size="xs" c="dimmed">{banks.length} 个题库</Text>
          </Box>
          <Group gap="sm">
            <Button variant="default" leftSection={<IconFileImport size={16} />}>导入题库</Button>
            <Button leftSection={<IconPlus size={16} />}>新建题库</Button>
          </Group>
        </Group>
      </Box>

      <Box p="xl">
        {banks.length === 0 ? (
          <EmptyState
            title="还没有题库"
            description="创建你的第一个题库，或导入别人的题库文件"
          >
            <Group>
              <Button leftSection={<IconPlus size={16} />}>新建题库</Button>
              <Button variant="default" leftSection={<IconFileImport size={16} />}>导入题库</Button>
            </Group>
          </EmptyState>
        ) : (
          <Box>
            {banks.map((bank) => (
              <Box key={bank.id} style={{ padding: 16, borderBottom: '1px solid var(--border-light)' }}>
                <Text fw={500}>{bank.name}</Text>
                <Text size="sm" c="dimmed">{bank.description}</Text>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
```

- [ ] **Step 7: Install icon package**

```bash
npm install @tabler/icons-react
```

- [ ] **Step 8: Verify dev server renders**

```bash
npm run dev
```

Expected: App renders with sidebar and empty bank list.

- [ ] **Step 9: Commit**

```bash
git add src/ui/components/Sidebar.tsx src/ui/components/AppLayout.tsx src/ui/components/EmptyState.tsx src/ui/pages/BankListPage.tsx src/App.tsx src/main.tsx
git commit -m "feat(p1): add layout components, router, and bank list page"
```

---

### Task 9: Bank Create/Edit Modal

**Files:**
- Modify: `src/ui/pages/BankListPage.tsx`

Replace `BankListPage.tsx` with the full version including create/edit/delete modal and card grid. See conversation for complete implementation.

- [ ] **Step 1: Implement full BankListPage with modal**

Refer to the conversation for the complete `BankListPage.tsx` implementation with create/edit modal and card grid.

- [ ] **Step 2: Verify dev server and test flow**

```bash
npm run dev
```

Manual test: create, edit, delete banks.

- [ ] **Step 3: Commit**

```bash
git add src/ui/pages/BankListPage.tsx
git commit -m "feat(p1): add bank create, edit, delete modal and card grid"
```

---

### Task 10: Verify P1 complete

- [ ] **Step 1: Run all tests**

```bash
npx vitest run
```

Expected: all repo tests PASS.

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual smoke test checklist**
  - [ ] App starts with sidebar + empty bank list
  - [ ] Create bank via modal → card appears
  - [ ] Edit bank → modal pre-filled → save
  - [ ] Delete bank → confirm → removed
  - [ ] Empty state shows when no banks
  - [ ] Dark mode toggle works (click moon icon in sidebar)
  - [ ] Theme persists after reload
  - [ ] Open DevTools → Application → IndexedDB → exlocal → verify data

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(p1): p1 complete - infrastructure, bank crud, layout, theme"
```
