# Knowa Design and Architecture

Version: 0.1.0

Knowa is a local-first question-bank application for building, practicing, reviewing, annotating, and exporting personal study materials. It ships as a web app and as a Tauri desktop app. The product promise is simple: users own their question banks, records, notes, images, and backups.

## Product Scope

Knowa supports the complete lifecycle of a personal question bank:

- Create and manage multiple banks.
- Add single-choice, multiple-choice, and true/false questions.
- Import questions from Markdown or `.exbank` packages.
- Export banks, selected questions, favorites, wrong questions, notes, and full backups.
- Practice by order or shuffle, by chapter, section, or knowledge point.
- Use practice mode with immediate feedback or exam mode with unified submission.
- Review every completed question group and redo selected groups.
- Star questions, collect wrong questions, write notes, and export noted questions.
- Render rich text, inline code, code blocks, inline math, block math, and images.
- Package the same frontend as a Tauri desktop app.

## Audience

The core user is a student, teacher, researcher, or exam candidate who wants full control over local study material. The interface favors dense, calm workflows instead of marketing-style screens. The tone is warm academic: steady, readable, and focused.

## Design System

The visual direction is Warm Academia.

Core principles:

- Use a stable sidebar and fixed page headers for repeated study workflows.
- Keep content left aligned, especially questions and options.
- Use subdued surfaces and quiet borders; reserve strong colors for correctness, destructive actions, and primary actions.
- Prefer compact controls over decorative cards in operational screens.
- Keep dialogs app-styled; never use browser `alert`, `confirm`, or `prompt`.
- Use icons for compact repeated actions.

Themes:

- `warm`: warm paper background, indigo accent, amber detail.
- `sage`: pale green desk tone, green accent, warm brown detail.
- `porcelain`: clean white-blue tone, blue accent.
- `midnight`: dark blue reading theme.
- `graphite`: dark neutral focus theme.
- `plum`: dark purple-grey theme.

Theme state is stored in `localStorage` through `appSettings`. The settings page and sidebar theme popover subscribe to the same settings-change event so both entry points stay synchronized.

Typography:

- App UI uses the global body stack from `src/global.css`.
- Quiz reading uses a separate configurable font style:
  - `academic`: Lora plus Chinese serif fallbacks.
  - `system`: system sans-serif stack.
- Quiz font size is configurable in settings and from the quiz page.

Logo:

- Product name: Knowa.
- Slogan: `搭建你的个人题库`.
- The mark is a flat rounded study-book icon. The same source is used for in-app branding, favicon, and Tauri app icons.

## Application Architecture

The frontend is structured as:

```text
UI layer -> Service layer -> Repo layer -> IndexedDB
```

Rules:

- UI components call services or stores.
- Services own business logic and import/export transformations.
- Repos own Dexie queries and persistence details.
- Stores provide screen-level state and orchestration.

Main directories:

- `src/ui/pages`: route-level screens.
- `src/ui/components`: reusable visual and interaction components.
- `src/services`: business logic, import/export, backup, settings, PDF generation.
- `src/repo`: Dexie-backed data access.
- `src/stores`: Zustand stores.
- `src/shared/types.ts`: shared domain model.
- `src-tauri`: desktop shell, permissions, icons, and Tauri config.
- `website`: standalone public website for Cloudflare Pages, including home, tutorial, online demo, and changelog pages.
- `docs`: stable project documentation.

Route map:

| Route | Page | Purpose |
| --- | --- | --- |
| `/` | `BankListPage` | Bank list, global question search, bank creation, import entry. |
| `/bank/:bankId` | `BankDetailPage` | Bank dashboard, bank-scoped search, question list, import/export, record clearing. |
| `/bank/:bankId/question/new` | `QuestionEditPage` | Create a question in a bank. |
| `/bank/:bankId/question/:questionId/edit` | `QuestionEditPage` | Edit an existing question. |
| `/bank/:bankId/quiz` | `QuizPage` | Configure, take, submit, and review quizzes. |
| `/starred` | `StarredPage` | Search, group, export, preview, and redo starred questions. |
| `/wrong` | `WrongQuestionsPage` | Search, group, export, preview, and redo wrong questions. |
| `/records` | `RecordsPage` | Review historical quiz sessions and redo question groups. |
| `/notes` | `NotesPage` | Review, edit, select, and export questions with notes. |
| `/settings` | `SettingsPage` | Theme, quiz font, behavior settings, backup directory, full import/export. |

Core service responsibilities:

| Service | Responsibility |
| --- | --- |
| `appSettings` | Theme preset, quiz font style/size, wrong-question behavior, localStorage synchronization event. |
| `bankExportService` | `.exbank` creation and import/merge behavior. |
| `fullDataBackupService` | `.exlocal` full backup, image extraction/restoration, desktop backup write. |
| `markdownImportService` | Markdown question parsing and validation. |
| `pdfExportService` | Precise/quick PDF export data shaping and layout safeguards. |
| `quizService` | Answer judging, record creation, session grouping behavior. |
| `localDataDirectory` | Runtime detection, Tauri default backup directory, directory picker, desktop file write. |

State ownership:

- Long-lived data belongs to repos and Dexie.
- Cross-page user preferences belong to `appSettings`.
- Transient quiz setup/review state belongs to the quiz page/store.
- Dialog open/close state stays in the owning page component unless reused globally.

## Data Model

Core types live in `src/shared/types.ts`.

`Bank`

- `id`
- `name`
- `description`
- `tags`
- `color`
- `createdAt`
- `updatedAt`
- `questionCount`

`Question`

- `id`
- `bankId`
- `type`: `single`, `multiple`, or `truefalse`
- `body`: TipTap JSON document
- `options`: array of indexed rich-text options
- `answer`: option indices
- `explanation`: TipTap JSON document
- `tags`
- `chapter`
- `section`
- `knowledgePoint`
- `starred`
- `order`
- `createdAt`

`QuizRecord`

- `id`
- `questionId`
- `bankId`
- `sessionId`
- `selectedAnswer`
- `isCorrect`
- `timestamp`
- `duration`
- `mode`: `practice` or `exam`

`Note`

- `id`
- `questionId`
- `bankId`
- `content`: TipTap JSON document
- `updatedAt`

IndexedDB stores:

- `banks`
- `questions`
- `quizRecords`
- `notes`

## Rich Text Format

Knowa stores question bodies, options, explanations, and notes as TipTap JSON. Supported content includes:

- paragraph
- inline code
- code block
- inline math
- block math
- images with width and alignment metadata

Image nodes use `attrs.src`, `attrs.alt`, `attrs.width`, and `attrs.align`. In live editing, images may be stored as data URLs. During backup export, images are extracted into `images/` and document references are rewritten to filenames. During import, filenames are restored to data URLs.

## Question Management

Bank list:

- Shows bank cards with color, tags, question count, and progress.
- Supports global question search grouped by bank.
- Preview modals are read-only and include edit navigation.

Bank detail:

- Shows dashboard data for the bank.
- Supports searching within the bank.
- Supports adding/editing/deleting questions.
- Supports import/export actions.
- Supports clearing records for the current bank.

Question editor:

- Lets the user edit type, chapter, section, knowledge point, tags, body, options, answer, and explanation.
- Uses the shared rich text editor.
- Navigates back to the caller through `returnTo` when provided.

## Import and Export

Markdown import:

- Provides templates for single choice, multiple choice, and true/false.
- Shows live preview.
- Warns before closing with unsaved content.
- Renders math and code in preview.

`.exbank` import/export:

- Uses zip packages.
- Includes bank metadata, question JSON, optional records, notes, and images.
- List import creates a new bank.
- Detail import merges into the current bank.

Full backup:

- Uses `.exlocal`, a zip package containing `backup.json` and `images/`.
- Includes app settings, banks, questions, quiz records, notes, favorites, and images.
- Desktop mode can write backups directly into the configured local backup directory.
- Web mode uses download-based export.

PDF export:

- Precise export uses pdfmake.
- Quick print uses html2canvas + jsPDF.
- PDF output includes Knowa branding in header/footer.
- Long unbroken text is normalized with zero-width break hints to prevent pdfmake layout stalls.
- Images in PDF text output use human-readable placeholders instead of data URLs.

## Quiz Flow

Setup:

- Mode selector: practice or exam.
- Order selector: sequential or shuffled.
- Filters: chapter, section, knowledge point.
- Optional countdown. When time expires, the quiz is forcibly submitted.

Practice mode:

- User selects an answer and submits each question.
- Immediate correctness and explanation are shown.
- Notes can be written while reviewing.

Exam mode:

- User answers multiple questions.
- Submission is unified through the hand-in button.
- If unanswered questions exist, the app warns the user. Unanswered questions are scored as incorrect.

Review:

- Completion page shows circular numbered navigation.
- Correct and wrong states use green and red.
- Clicking a number opens the completed question review.
- Review preserves selected answer, correct answer, and explanation.
- A button returns to the completion page.

Navigation safety:

- Leaving an unfinished quiz through the sidebar or back action prompts the user.
- Unsubmitted quiz state is not written as a completed record.

## Favorites, Wrong Questions, Notes, and Records

Favorites:

- Shows starred questions grouped by bank or chapter.
- Supports search, preview, selection, export, and redo.
- Export defaults to all visible questions when nothing is selected; otherwise exports selected questions.

Wrong questions:

- Derived from quiz records.
- If `removeWrongWhenCorrect` is enabled, only questions whose latest record is wrong remain.
- Supports grouping, search, selection, export, redo, and favorite toggling.
- Export behavior matches favorites.

Notes:

- Shows questions with non-empty notes grouped by bank.
- Prioritizes note content but keeps question metadata visible.
- Supports search, selection, export, edit-note icon, and edit-question icon.
- Edit-note dialog shows question preview, correct answer, explanation, recent records, and a rich text editor.

Records:

- Groups quiz records by date and then by session.
- Shows per-session accuracy and supports redoing a session.
- Record preview is the only preview modal that includes answer history.

## Desktop Integration

Desktop packaging uses Tauri v2.

Current desktop features:

- Product icon generated from `public/brand/exlocal-icon.svg`.
- Tauri config in `src-tauri/tauri.conf.json`.
- Dialog plugin for selecting a local backup directory.
- A custom Tauri command for writing full `.exlocal` backups to the configured directory.
- Default backup directory resolved from Tauri `appLocalDataDir()/backups`.
- Web fallback remains download-based and IndexedDB-backed.
- File associations for `.exlocal` and `.exbank`.
- Bundle metadata identifies Knowa as an education app.
- Lightweight HTML startup screen renders before React hydrates to avoid a blank WebView.
- On macOS, clicking the window close button hides the window; reopening from Dock restores and focuses the main window.

Desktop storage model:

- Runtime data remains IndexedDB inside the WebView profile.
- `.exlocal` backup files are written to the configured backup directory for migration and recovery.
- Future work can move primary data persistence to SQLite or filesystem-backed repositories without changing UI screens because the repo/service boundary already exists.

Desktop-specific copy:

- Settings page labels the runtime as `桌面端` when Tauri APIs exist.
- Settings page labels browser builds as `Web 预览`.
- Desktop mode exposes `备份到本地目录`.
- Web mode keeps `导出为文件` as the migration path.

Desktop permissions:

- Dialog permission is required for native directory selection.
- Backup writing is handled by the `write_backup_file` command instead of browser download APIs.
- The command validates the backup filename and only accepts `.exlocal` output names.
- This avoids losing write capability after app restart when a user has selected a custom backup directory.

## Release Pipeline

The GitHub Actions release workflow builds:

- macOS Universal (`universal-apple-darwin`) on `macos-14`
- Windows x64
- Linux x64
- Experimental Windows ARM64 and Linux ARM64

The workflow uses the official Tauri GitHub Action, creates/updates the release, writes Chinese release notes, and uploads native installers/artifacts. macOS uses a Universal target so the release does not depend on a separate Intel hosted runner.

## Website

The public website is a standalone static site in `website/`.

It includes:

- `index.html`: product homepage with feature narrative, real product preview, platform download buttons, and online demo entry.
- `tutorial.html`: detailed usage tutorial covering installation, banks, rich text questions, Markdown import, quizzes, records, notes, export, and desktop backups.
- `demo.html`: online demo entry and mobile guard; desktop users are redirected into the real Knowa web app under `/app/`.
- `changelog.html`: version timeline and release content.

Website implementation rules:

- The site is independent of the app router.
- The hero uses an immersive product interface scene, not a generic marketing illustration.
- Download links point to GitHub Releases.
- The online demo includes single choice, multiple choice, true/false, inline code, code blocks, formula-like content, and image-like content.
- Mobile browsers must not load the interactive demo; they show guidance to use the desktop app or a larger screen.
- Website build output is `website/dist`.

## Testing Strategy

Automated tests cover:

- Repo behavior.
- Service behavior.
- Markdown parsing.
- Full data backup.
- App settings synchronization.
- PDF layout normalization.

Manual/browser QA covers:

- Rendered layout.
- Dialog behavior.
- Sidebar and sticky header behavior.
- Rich editor interactions.
- Quiz flow and countdown.
- Desktop-specific settings behavior.

Recommended pre-release commands:

```bash
npm run lint
npx vitest run
npm run build
npm run tauri build
```

## Extension Points

API-backed storage:

- Implement new repo classes matching the current repo contracts.
- Keep service and UI layers unchanged where possible.

SQLite desktop storage:

- Add a desktop repo implementation.
- Migrate IndexedDB data into SQLite on first launch.
- Keep `.exlocal` backup compatibility.

Mobile:

- Reuse the same UI and domain services.
- Revisit file picker, backup path, and mobile storage permissions.

Cloud sync:

- Treat `.exlocal` as the portable package format.
- Add a sync service above repos rather than embedding sync in UI components.
