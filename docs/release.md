# Knowa 发布流程

当前版本：0.1.0

## 分支约定

- `dev-codex`：Codex 开发分支。
- `main`：发布分支。

发布工作流只从 `main` 运行。开发过程中不要把本地工具配置、临时设计草稿或 Agent 私有规范提交到发布分支。

## 版本号来源

发布前保持以下位置一致：

- `package.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`
- GitHub Release tag，例如 `v0.1.0`
- README、官网和更新日志中展示的版本号

## 本地验证

发布前运行：

```bash
npm run lint
npx vitest run
npm run build
npm run site:build
npm run desktop:build
```

`desktop:build` 只打包当前操作系统。跨平台安装包由 GitHub Actions 生成。

## GitHub Actions

工作流文件：`.github/workflows/release.yml`

触发方式：

- 手动运行。
- 推送到 `main`。

质量检查任务：

- `npm ci`
- `npm run lint`
- `npx vitest run`
- `npm run build`
- `npm run site:build`

桌面端打包任务：

| 平台 | 策略 |
| --- | --- |
| macOS | 在 `macos-14` 生成 Universal 包，目标为 `universal-apple-darwin`。 |
| Windows x64 | 稳定目标。 |
| Linux x64 | 稳定目标。 |
| Windows ARM64 | 实验目标，允许失败。 |
| Linux ARM64 | 实验目标，允许失败。 |

macOS 不再单独使用 `macos-13` 构建 Intel 包，避免 GitHub Hosted Runner 长时间排队导致整个 Release 被取消。

## Release 说明

每次发布必须使用中文 Release 说明，至少包含：

- 版本号和发布日期。
- 本次发布重点。
- 下载建议。
- 数据与备份说明。
- 已知限制。
- 后续计划。

`v0.1.0` 的说明保存在 [`docs/releases/v0.1.0.md`](releases/v0.1.0.md)。后续版本建议继续在 `docs/releases/` 下新增同名文档，并同步到 GitHub Release。

## 桌面端打包要求

Tauri 配置：

- Product name: `Knowa`
- Identifier: `com.exbook.exlocal`
- Version: `0.1.0`
- Category: `Education`
- Icons: 由 `public/brand/exlocal-icon.svg` 生成到 `src-tauri/icons`
- File associations: `.exlocal` 和 `.exbank`

桌面端体验要求：

- 启动时 HTML 首屏必须有轻量品牌启动画面，避免 WebView 初始化时白屏。
- macOS 点击关闭按钮应隐藏窗口；从 Dock 重新打开时恢复主窗口。
- 设置页应显示平台默认本地备份目录，并允许用户选择自己的目录。
- `.exlocal` 完整备份必须包含题库、题目、设置、做题记录、笔记和图片。

## 官网发布

官网位于 `website/`，适合部署到 Cloudflare Pages。

推荐设置：

- Framework preset: None 或 Vite
- Build command: `npm run site:build`
- Build output directory: `website/dist`
- Node version: `22`

官网至少包含：

- 主页：产品定位、功能介绍、真实产品图、下载按钮、在线体验入口。
- 教程页：逐步介绍题库创建、录题、导入、刷题、复盘、导出和桌面端备份。
- 在线体验：`demo.html` 只作为入口与手机端拦截页；桌面端直接进入 `/app/` 下的 Knowa 网页版真实应用，并自动准备示例题库。手机端禁用交互并提示下载桌面端或使用大屏设备。
- 更新日志页：版本时间线和每次发布内容。

## 发布前检查清单

- README 是中文，并包含 Logo、徽章、产品图、下载和在线体验入口。
- GitHub Release 正文为中文详细说明。
- 官网四个页面都能构建并在桌面与手机宽度下正常阅读。
- 在线体验在桌面端进入真实 App 网页版，在手机端不加载交互题库，并给出明确提示。
- macOS workflow 使用 Universal 构建，不依赖单独的 Intel Runner。
- 桌面端启动时不出现空白首屏。
- macOS 关闭按钮行为符合常见桌面应用预期。
