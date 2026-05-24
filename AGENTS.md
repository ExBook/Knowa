# AGENTS.md — ExLocal

## 工作规则

- 修改代码前先创建开发分支，在 dev 分支上开发，测试确认无误后再合入 main
- 创建分支前与用户确认分支名
- 主要使用中文沟通，代码和文档使用英文
- 每次有意义的修改后主动 commit，不主动 push
- 严格按 Step 顺序执行，每步完成（测试通过/手动验证）后再进下一步，不跳步、不批量

## 项目概要

ExLocal 是一款纯前端的刷题应用（以选择题为主），属于 ExBook 家族。用户自建题库、导入他人题库、做题（练习/考试模式）、记笔记、查看数据看板、导出 PDF。

**Repo:** https://github.com/ExBook/ExLocal

## 技术栈

| 层 | 选型 |
|----|------|
| 框架 | React 18 + TypeScript + Vite |
| UI | Mantine v7（内置 TipTap 富文本编辑器、Recharts 图表） |
| 状态 | Zustand |
| 存储 | IndexedDB（Dexie.js） |
| 桌面 | Tauri v2 |
| PDF | pdfmake（精排版）+ html2canvas + jsPDF（快速打印） |
| 测试 | Vitest（Service + Repo 层），UI 层手动验收 |

## 架构：三层分层

```
UI 层（React 组件）→ Service 层（业务逻辑）→ Repo 层（数据访问接口）
```

- UI 层只调用 Service，不碰存储
- Service 层调用 Repo 接口，不依赖具体存储实现
- Repo 是接口，当前是 IndexedDB 实现，将来换成 API 实现时 UI 层不改

## 题型

- `single` — 单选题
- `multiple` — 多选题
- `truefalse` — 判断题

## 数据模型

```
Bank → Question[]（一对多）
Question → QuizRecord[]（一对多，每次作答一条记录）
Question → Note（一对一）
```

IndexedDB stores: `banks`, `questions`, `quizRecords`, `notes`

题库交换格式：`.exbank`（zip 压缩包，包含 `bank.json` + `images/` + 可选 `records.json`）

## 做题模式

- 练习模式：逐题提交，即时判分，显示解析
- 考试模式：统一交卷，批量判分，交卷后可回看
- 顺序/随机可选

## 设计系统：「温润学术」Warm Academia

- 亮色：暖奶油底色 (#faf7f2)，靛蓝强调 (#3b4b6b)，琥珀点缀 (#c4823d)
- 暗色「夜读」：深暖灰底色 (#161613)，浅靛蓝强调 (#8ba4cc)
- 字体：Lora（标题）+ Geist（正文），中文回退 Noto Serif SC
- Mockup 参考：`design-mockup/index.html`

## 文档

- 设计文档：`docs/superpowers/specs/2026-05-24-exlocal-design.md`
- 实施计划：`docs/superpowers/plans/`

### v1 分期（共 36 个 Task）

| 阶段 | 范围 | 计划文件 |
|------|------|----------|
| P1 | 基础设施 + 题库 CRUD（10 tasks） | `plans/2026-05-24-exlocal-p1-infrastructure.md` |
| P2 | 题目管理 + 导入导出（9 tasks） | `plans/2026-05-24-exlocal-p2-questions.md` |
| P3 | 做题模式（6 tasks） | `plans/2026-05-24-exlocal-p3-quiz.md` |
| P4 | 笔记 + 数据看板（6 tasks） | `plans/2026-05-24-exlocal-p4-notes-dashboard.md` |
| P5 | PDF 导出（3 tasks） | `plans/2026-05-24-exlocal-p5-pdf-export.md` |

## Git 分支

- `main` — 干净，当前只有设计文档
- `dev-claude` — Claude 实现分支
- `dev-codex` — Codex 实现分支
