# ExLocal Release Process

Version: 0.1.0

## Branches

- `dev-codex`: implementation branch.
- `main`: release branch.

The release workflow runs from `main`.

## Version Sources

Keep these versions aligned:

- `package.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`
- GitHub release tag, for example `v0.1.0`

## Local Verification

Run:

```bash
npm run lint
npx vitest run
npm run build
npm run site:build
npm run desktop:build
```

`desktop:build` packages the current operating system only. Cross-platform packages are produced by GitHub Actions.

## GitHub Actions Release

The workflow is `.github/workflows/release.yml`.

It runs on:

- Manual dispatch
- Push to `main`

The quality job runs:

- `npm ci`
- `npm run lint`
- `npx vitest run`
- `npm run build`
- `npm run site:build`

The release job uses the official Tauri GitHub Action to build and upload desktop artifacts.

Stable targets:

- macOS Apple Silicon
- macOS Intel
- Windows x64
- Linux x64

Experimental targets:

- Windows ARM64
- Linux ARM64

Experimental targets are allowed to fail so missing hosted runner support does not block the release.

## Desktop Packaging Notes

The Tauri app uses:

- Product name: `ExLocal`
- Identifier: `com.exbook.exlocal`
- Version: `0.1.0`
- Category: `Education`
- Icons generated from `public/brand/exlocal-icon.svg`
- File associations for `.exlocal` and `.exbank`

Desktop plugins:

- Dialog plugin for directory selection
- Custom Tauri command for writing `.exlocal` backups to the default or user-selected directory

## Cloudflare Pages Website

The website is in `website/`.

Recommended Cloudflare Pages settings:

- Framework preset: None or Vite
- Build command: `npm run site:build`
- Build output directory: `website/dist`
- Node version: `22`

After deployment:

1. Update the online demo link if the hosted app route differs.
2. Update download links if the release tag changes.
3. Keep tutorials in `website/index.html` and `docs/user-guide.md` aligned.

## Release Checklist

Before publishing:

- Confirm app logo renders in the web app, desktop icon, and website.
- Confirm the settings page shows desktop-specific backup directory text in Tauri.
- Confirm full backup includes images.
- Confirm Markdown import templates and live preview work.
- Confirm favorites, wrong questions, notes, and records export.
- Confirm PDF output renders Chinese text correctly.
- Confirm `README.md`, `docs/design.md`, and website copy match the current app behavior.
