<p align="center">
  <img src="public/brand/exlocal-icon.svg" width="96" height="96" alt="ExLocal logo" />
</p>

<h1 align="center">ExLocal</h1>

<p align="center">
  搭建你的个人题库。Local-first question bank, quiz review, notes, records, and export.
</p>

<p align="center">
  <a href="https://github.com/ExBook/ExLocal/actions/workflows/release.yml"><img alt="Release Desktop Apps" src="https://github.com/ExBook/ExLocal/actions/workflows/release.yml/badge.svg" /></a>
  <img alt="Version" src="https://img.shields.io/badge/version-0.1.0-3b4b6b" />
  <img alt="Tauri" src="https://img.shields.io/badge/Tauri-v2-24c8db" />
  <img alt="React" src="https://img.shields.io/badge/React-18-61dafb" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-6-3178c6" />
  <img alt="Local first" src="https://img.shields.io/badge/local--first-IndexedDB-c4823d" />
</p>

## What Is ExLocal?

ExLocal is a local-first study app for people who want to own their question banks. It focuses on a calm academic workflow: create banks, add rich questions, import Markdown, practice by chapter or knowledge point, review records, write notes, and export professional PDF or portable backup packages.

The same React app runs in the browser and inside a Tauri v2 desktop shell.

## Highlights

- Bank cards with tags, custom soft colors, question counts, and progress bars.
- Rich question editor with inline code, code blocks, inline math, block math, images, alignment, and scaling.
- Markdown import with templates, live preview, format validation, math rendering, and unsaved-content protection.
- Practice mode with immediate feedback and exam mode with unified submission.
- Countdown quiz mode with forced submission when time expires.
- Completion review with numbered navigation, answer correctness colors, correct answers, and explanations.
- Favorites, wrong-question set, notes, and session-based quiz records.
- Selective export from banks, favorites, wrong questions, and notes.
- Full `.exlocal` backup packages containing banks, questions, records, notes, settings, and embedded images.
- Desktop backup directory selection with platform-aware defaults.
- PDF export with product branding and Chinese font support.

## Desktop Downloads

Release artifacts are published from the `main` branch by GitHub Actions:

- macOS Apple Silicon
- macOS Intel
- Windows x64
- Linux x64
- Experimental Windows ARM64 and Linux ARM64 runners are included when GitHub hosted runners are available.

Download from [GitHub Releases](https://github.com/ExBook/ExLocal/releases/tag/v0.1.0).

## Online Demo And Website

The official website lives in [`website`](website/). It is a static Vite site intended for Cloudflare Pages.

Useful commands:

```bash
npm run site:dev
npm run site:build
npm run site:preview
```

After deployment, point the online demo CTA to the hosted web app route.

## Tech Stack

| Layer | Choice |
| --- | --- |
| Frontend | React 18, TypeScript, Vite |
| UI | Mantine v7, TipTap, Recharts |
| State | Zustand |
| Storage | IndexedDB with Dexie |
| Desktop | Tauri v2 |
| Export | pdfmake, html2canvas, jsPDF, JSZip |
| Testing | Vitest, fake-indexeddb |

## Architecture

ExLocal uses a layered frontend architecture:

```text
React UI -> Services -> Repositories -> IndexedDB
```

UI components do not access Dexie directly. Services own import/export, quiz judging, settings, and data transformation. Repositories isolate storage details so a future SQLite or API backend can be added without rewriting route screens.

Read the full maintenance document in [`docs/design.md`](docs/design.md).

## Development

Install dependencies:

```bash
npm install
```

Run the web app:

```bash
npm run dev
```

Run the desktop app:

```bash
npm run desktop:dev
```

Build the web app:

```bash
npm run build
```

Build the desktop app for the current platform:

```bash
npm run desktop:build
```

## Verification

Run the standard checks before release:

```bash
npm run lint
npx vitest run
npm run build
npm run desktop:build
```

The GitHub Actions release workflow also runs lint, unit tests, web build, website build, and then native Tauri packaging.

## Data Ownership

Runtime data is stored locally in IndexedDB. Desktop builds additionally support writing `.exlocal` backup packages to a configured local directory. The backup format is a zip package containing `backup.json` plus `images/`, so it can move between devices without losing rich-text images.

## Documentation

- [Design and architecture](docs/design.md)
- [User guide](docs/user-guide.md)
- [Release process](docs/release.md)

## Status

ExLocal is currently at `0.1.0`. The app is ready for local-first study workflows, but the storage boundary is intentionally kept flexible for future SQLite, sync, and mobile work.
