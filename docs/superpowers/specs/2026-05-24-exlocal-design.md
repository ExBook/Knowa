# ExLocal Design Spec

## 1. Overview

ExLocal is a local-first multiple-choice quiz application in the ExBook family. Users create and manage question banks, practice with multiple modes, take notes per question, view analytics dashboards, and export selected content to PDF.

**Philosophy**: "Warm Academia" — a focused, paper-inspired study experience, not gamified nor overly utilitarian.

### Family Context

| Project | Role |
|---------|------|
| ExBookie | LaTeX exam workbook document class (6 layouts) |
| ExPress | LaTeX book typesetting document class |
| TransBook | LaTeX English translation workbook |
| **ExLocal** | **Local-first quiz app (this project)** |

### Product Evolution

- Phase 1: Pure frontend SPA in a browser
- Phase 2: Tauri-wrapped cross-platform desktop app
- Phase 3: Full-stack with backend server

---

## 2. Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Framework | React 18 + TypeScript | Ecosystem, Tauri compatibility |
| Build | Vite | Fast HMR, Tauri plugin support |
| UI Library | Mantine v7 | Rich text (TipTap), charts (Recharts) built-in |
| State | Zustand | Lightweight, no Provider nesting |
| Storage | IndexedDB (Dexie.js) | Local-first, structured queries |
| Desktop Shell | Tauri v2 | File system access, native packaging |
| Rich Text | TipTap (via @tiptap/react) | JSON-based content model |
| PDF (precise) | pdfmake | Programmatic layout control |
| PDF (quick) | html2canvas + jsPDF | WYSIWYG snap export |
| Testing | Vitest | Unit tests for Service/Repo layers |
| Charts | Recharts (bundled with Mantine) | Dashboard visualizations |

---

## 3. Architecture

### 3.1 Layered Architecture

```
src/
  ui/               # React components & pages (view only)
    components/     # Shared UI components
    pages/          # Route pages
  services/         # Business logic (no storage details)
  repo/             # Data repository interface + IndexedDB impl
  stores/           # Zustand stores
  shared/           # Types, constants, utilities
src-tauri/          # Tauri Rust shell (file system ops, native features)
```

**Rule**: UI calls Service, Service calls Repo. Repo is an interface — IndexedDB now, API later. UI layer never touches storage directly.

### 3.2 Routes

| Route | Page | Purpose |
|-------|------|---------|
| `/` | BankList | All banks overview, create/import |
| `/bank/:id` | BankDetail | Question list, dashboard entry, edit/delete |
| `/bank/:id/quiz` | QuizMode | Question display, option interaction, progress |
| `/bank/:id/stats` | Dashboard | Stats charts (accuracy, progress, time) |
| `/bank/:id/export` | PDFExport | Select questions + content to export |

### 3.3 Stores

| Store | Key State | Operations |
|-------|-----------|------------|
| `bankStore` | `banks[]`, `currentBank` | CRUD, import(file), export() |
| `quizStore` | `questions[]`, `currentIndex`, `answers{}`, `startTime`, `mode` | start(bankId, mode, shuffle), answer(idx), next(), prev(), submit() |
| `statsStore` | `records[]`, `computedStats` | loadByBank(bankId), compute() |
| `uiStore` | `theme`, `sidebarOpen` | toggle |

---

## 4. Data Model

### 4.1 Types

```typescript
type QuestionType = 'single' | 'multiple' | 'truefalse';

interface Bank {
  id: string;
  name: string;
  description: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  questionCount: number;
}

interface Question {
  id: string;
  bankId: string;
  type: QuestionType;
  body: object;           // TipTap JSON
  options: Option[];
  answer: number[];       // correct answer indices; truefalse: [0]=true, [1]=false
  explanation: object;    // TipTap JSON
  tags: string[];
  order: number;
  createdAt: number;
}

interface Option {
  index: number;          // A=0, B=1, ...
  content: object;        // TipTap JSON
}

interface QuizRecord {
  id: string;
  questionId: string;
  bankId: string;
  selectedAnswer: number[];
  isCorrect: boolean;
  timestamp: number;
  duration: number;       // seconds spent on this question
  mode: 'practice' | 'exam';
}

interface Note {
  id: string;
  questionId: string;
  bankId: string;
  content: object;        // TipTap JSON (rich text)
  updatedAt: number;
}
```

### 4.2 IndexedDB Schema (Dexie.js)

| Store | Key | Indexes |
|-------|-----|---------|
| `banks` | `id` | `updatedAt` |
| `questions` | `id` | `bankId`, `order` |
| `quizRecords` | `id` | `questionId`, `bankId`, `timestamp` |
| `notes` | `id` | `questionId`, `bankId` |

---

## 5. Question Bank Exchange Format (`.exbank`)

### 5.1 Shared Export (questions only, no records)

```
bank.exbank (zip)
├── bank.json           # metadata + questions
├── images/             # image assets
│   ├── bt-preorder.png
│   └── ...
```

### 5.2 Full Export (with records, for cross-device migration)

```
bank.exbank (zip)
├── bank.json
├── records.json        # quiz records + notes
├── images/
│   └── ...
```

### 5.3 `bank.json` structure

```json
{
  "version": 1,
  "bank": {
    "name": "Data Structures",
    "description": "Postgraduate exam prep",
    "tags": ["binary-tree", "graph", "dp"]
  },
  "questions": [
    {
      "id": "uuid",
      "type": "single",
      "body": { /* TipTap JSON */ },
      "options": [
        { "index": 0, "content": { /* TipTap JSON */ } },
        { "index": 1, "content": { /* TipTap JSON */ } }
      ],
      "answer": [0],
      "explanation": { /* TipTap JSON */ },
      "order": 1,
      "tags": ["binary-tree", "traversal"]
    }
  ]
}
```

### 5.4 Image Handling

- Import: extract zip → store images as base64 in IndexedDB, update TipTap JSON image references
- Export: extract base64 from IndexedDB → write to `images/` dir → package zip
- Tauri handles zip I/O via Rust, cleaner than browser-only JSZip

### 5.5 Unified Import (Drag & Drop)

Users drag any of the following into a drop zone on the Bank List page. The system auto-detects the type and handles accordingly.

| Dropped Content | System Behavior |
|-----------------|-----------------|
| Single `.md` file | Parse Markdown; unmatched image refs marked as "pending upload" |
| `.md` + image files (multi-select) | Parse Markdown, match images by filename |
| Folder (`.md` + images) | Recursively scan, match images by filename |
| `.zip` (md + images) | Extract, parse, match |
| `.exbank` (zip) | Recognized as bank import, run merge logic |

**Image matching rule**: `![alt](graph.png)` in Markdown → match `graph.png` in dropped files/folders by filename. Auto-linked without manual upload.

**Browser limitation**: Folder drop requires `webkitGetAsEntry()` (Chromium-based browsers). Firefox/Safari fall back to multi-file drop only.

**Import preview**: After dropping, show parsed result (question count, matched images, unmatched references) before confirming import. Unmatched images are highlighted in red but do not block the import.

### 5.6 Import Merge Strategy

- Match questions by `id`
- Existing questions are not overwritten
- New questions with no existing record get empty record slots
- Conflicting records: keep the one with the latest timestamp
- User can continue practicing seamlessly after import

### 5.7 Clear Records

Each bank detail page provides a "Clear All Records" button that resets all quiz data for that bank. Requires confirmation.

---

## 6. Quiz Modes

### 6.1 Practice Mode (逐题判分)

- Show one question at a time
- User selects answer → clicks "Submit" → immediate feedback
- Show: correct/wrong, explanation, note panel
- Can navigate back/forward freely
- Answers are committed immediately to IndexedDB

### 6.2 Exam Mode (统一交卷)

- Show all questions (or paginated)
- No feedback until "Submit All" at the end
- Timer displayed
- Submit → batch grade → show results overview
- After submission: can review each question with answers and explanations

### 6.3 Shared Options

- **Order**: sequential (by `order` field) or shuffled (random)
- **Navigation**: previous/next buttons, progress bar with question numbers
- **Timer**: per-question (practice) or session (exam)
- **Post-submit review**: always available; answers, explanations, and notes visible

---

## 7. Rich Text Editor (TipTap)

### 7.1 Extensions

| Extension | Purpose |
|-----------|---------|
| StarterKit | Paragraph, bold, italic, lists, blockquote, horizontal rule |
| Image | Inline images (base64, stored in IndexedDB) |
| CodeBlockLowlight | Code blocks with syntax highlighting |
| Underline | Academic note-taking convention |
| Placeholder | Input hints |
| Table | Tabular content in questions |

### 7.2 Fields Using TipTap

- Question body, Option content, Explanation, Note content

All store TipTap JSON format. Same editor config for all fields.

---

## 8. Question Input Methods

### 8.1 Single Question Editor
Form-style editor: type selector, body (TipTap), options (dynamic add/remove), answer selector, explanation (TipTap), tags input.

### 8.2 Markdown Batch Import

Paste Markdown text or drag `.md` files into the import zone. Supports inline code blocks, images, and all three question types.

**Code blocks** use standard fenced code blocks with language hint — parsed into TipTap CodeBlock nodes:

```markdown
# Q1 [单选题] [标签: 数据结构]
以下代码的时间复杂度是？

\`\`\`c
int sum = 0;
for (int i = 0; i < n; i++) {
    sum += arr[i];
}
\`\`\`

- A. O(1)
- B. O(n)
- C. O(n²)
- D. O(log n)
> 答案: B
> 解析: 单层循环，线性时间复杂度。
```

**Images** use standard Markdown syntax `![alt](filename.png)`. When `.md` is dragged in together with image files or a folder, images are auto-matched by filename. When pasted as text only, unmatched images are flagged as "pending upload" but do not block import.

```markdown
# Q2 [单选题] [标签: 图论]
根据下图，该图的拓扑排序结果是？

![graph](topo-graph.png)

- A. 1→2→3→4
- B. 1→3→2→4
- C. 2→1→3→4
- D. 4→3→2→1
> 答案: B
```

Full format examples:

```markdown
# Q1 [单选题] [标签: 二叉树]
以下关于二叉树遍历的说法中，正确的是？
- A. 前序遍历的第一个节点一定是根节点
- B. 中序遍历的结果一定是升序排列
- C. 后序遍历的最后一个节点一定是叶子节点
- D. 层序遍历需要使用栈来实现
> 答案: A
> 解析: 前序为根→左→右，第一个必为根。

# Q2 [多选题] [标签: 排序]
以下哪些是稳定排序算法？
- A. 冒泡排序
- B. 快速排序
- C. 归并排序
- D. 选择排序
> 答案: A, C
> 解析: 冒泡和归并稳定，快排和选择不稳定。

# Q3 [判断题] [标签: 网络]
TCP 是面向连接的协议。
> 答案: T
> 解析: TCP 通过三次握手建立连接。
```

### 8.3 `.exbank` Import

Drag `.exbank` files into the import zone. See Section 5.5 for the unified drag-and-drop import flow. Merge by question ID.

---

## 9. Dashboard

### 9.1 Overview Tab

- Stat cards: total questions, completed, accuracy rate, total time spent
- Daily accuracy trend chart (Recharts line/bar)
- Tag distribution pie chart (Recharts pie)

### 9.2 By Tag Tab

- Per-tag breakdown table: question count, completed, accuracy, average time

### 9.3 Timeline Tab

- Daily activity: questions answered per day, accuracy per day

---

## 10. PDF Export

### 10.1 Export Selection UI

- Select question range (all / custom / by tag)
- Checkbox toggles: include questions, include correct answers, include explanations, include notes, include stats data
- Layout choice: precise (pdfmake) or quick print (html2canvas)

### 10.2 Precise Export (pdfmake)

- Programmatic PDF layout
- Custom headers/footers with bank name and date
- Accurate page breaks
- Mixed layout: question → answer → note per item

### 10.3 Quick Print (html2canvas + jsPDF)

- Screenshot current question list view → embed in PDF
- Fast WYSIWYG, less precise pagination

---

## 11. Design System

### 11.1 Direction: "Warm Academia" (温润学术)

Like studying in a library at golden hour — warm, focused, textured.
Dark mode: "Night Study" (夜读) — warm lamp light in a dark room, not cold terminal blue-black.

### 11.2 Color Palette (Light / Dark)

| Token | Light | Dark | Role |
|-------|-------|------|------|
| `--bg-root` | `#faf7f2` | `#161613` | Page background |
| `--bg-surface` | `#ffffff` | `#1f1e1a` | Cards, modals |
| `--bg-muted` | `#f3efe8` | `#282620` | Hover states, secondary surfaces |
| `--accent` | `#3b4b6b` | `#8ba4cc` | Primary actions, selection, brand |
| `--accent-light` | `#e8ecf3` | `#252d3a` | Active nav, option hover |
| `--amber` | `#c4823d` | `#d49e5a` | Export actions, highlights |
| `--text-primary` | `#2c2416` | `#e8e4db` | Body text |
| `--text-secondary` | `#7a7568` | `#a8a294` | Secondary text |
| `--text-muted` | `#a8a294` | `#6b675c` | Disabled/metadata text |
| `--success` | `#5b8c5a` | `#7dae7b` | Correct answer |
| `--error` | `#c46b5d` | `#d48b7d` | Wrong answer |
| `--border` | `#e5e0d5` | `#302d26` | Card borders, inputs |
| `--shadow-sm` | `0 1px 2px rgba(44,36,22,0.04)` | `0 1px 2px rgba(0,0,0,0.2)` | Subtle elevation |

Theme preference stored in `localStorage`, defaults to system preference via `prefers-color-scheme`.

### 11.3 Typography

| Role | Font | Weight |
|------|------|--------|
| Display / H1 | Lora | 600 |
| Headings H2-H4 | Lora | 500-600 |
| Body | Geist | 400-500 |
| Code | SF Mono / Fira Code | 400 |
| Chinese fallback | Noto Serif SC | — |

### 11.4 Visual Details

- Subtle paper-grain noise texture on page background
- Rounded corners: 6px (inputs/buttons), 10px (cards), 16px (modals)
- Warm-toned shadows (brown-based, not gray)
- 350ms fade+slide page transitions
- Smooth color transitions on interactive elements

---

## 12. Testing Strategy

- **Service layer**: Vitest unit tests for grading logic, stats computation, Markdown parsing, import/export
- **Repo layer**: Vitest unit tests with Dexie.js in-memory mode for CRUD operations
- **UI layer**: Manual acceptance testing per phase
- **Per-phase gate**: All service/repo tests pass + manual UI smoke test before moving to next phase

---

## 13. v1 Delivery Phases

| Phase | Scope | Deliverable |
|-------|-------|-------------|
| **P1** | Scaffold (Vite + React + Tauri + Mantine), routing, IndexedDB Repo layer, Bank CRUD | Create/edit/delete question banks |
| **P2** | Question management: rich text editor, single-question form, Markdown batch import, `.exbank` import/export | Full question bank lifecycle |
| **P3** | Quiz mode: practice + exam, sequential/shuffle, scoring, timing, progress tracking, review | Complete quiz flow |
| **P4** | Notes (TipTap) per question, dashboard (stats cards, charts, tag breakdown, timeline) | Notes + analytics |
| **P5** | PDF export: selection UI, pdfmake precise layout, html2canvas quick print | PDF export |

---

## 14. Design Mockup

Reference implementation at `design-mockup/index.html` — showcases color palette, typography, component library, and key page layouts (Bank List, Quiz Mode, Dashboard).
