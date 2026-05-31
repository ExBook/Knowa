# Knowa 官网

这是 Knowa 的静态产品官网，适合部署到 Cloudflare Pages。

## 页面结构

- `index.html`：主页，介绍产品定位、核心功能、下载入口和在线体验入口。
- `tutorial.html`：教程页，讲解安装、建题库、录题、导入、刷题、复盘、导出和桌面端备份。
- `demo.html`：在线体验入口和手机端拦截页；桌面端会进入 `/app/` 下的真实 Knowa 网页版，手机端禁用交互并提示用户前往桌面端。
- `changelog.html`：更新日志页，展示版本时间线和发布内容。

## 命令

```bash
npm run site:dev
npm run site:build
npm run site:preview
```

## Cloudflare Pages

- Build command: `npm run site:build`
- Output directory: `website/dist`
- Node version: `22`

## 发布前检查

- 首页下载按钮指向最新 GitHub Release。
- 在线体验入口在桌面端跳转到真实 App 网页版，在手机宽度下显示桌面端提示。
- 教程页内容与应用功能保持一致。
- 更新日志页同步最新版本说明。
