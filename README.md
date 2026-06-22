# Trading Memo

Windows 桌面浮窗版 A 股学习笔记软件。使用 Electron 浮窗快速保存文字与图片，并在主窗口中完成分类、标签、搜索、筛选、导出和本地备份。

本软件仅用于学习笔记和个人经验记录，不提供投资建议，不推荐股票，不进行自动交易。

## 功能

- 可置顶、拖动、折叠的独立浮窗，默认全局快捷键 `Alt+J`；
- 本地文字和图片笔记，分类、标签及股票名称/代码字段；
- 今日记录、知识库详情、编辑、删除和组合搜索筛选；
- 浅色、深色、跟随系统主题，快捷键及默认分类设置；
- Markdown/JSON 本地导出，图片随笔记复制并使用相对路径；
- 文件夹式本地备份，以及恢复前安全备份和失败回滚；
- Windows x64 离线 NSIS 安装包。

## 明确不做

不包含 AI、行情、荐股、交易、券商同步、账号、社区、云同步、手机端、OCR、独立图片库、人工总结、遥测或自动更新。

## 开发与检查

```powershell
npm install
npm run dev
npm test
npm run typecheck
npm run build
```

浏览器预览使用 `npm run dev:web`。

## Windows 打包

`npm run package:win` 生成本地 Windows 包；`npm run dist:win` 先执行完整测试。产物位于 `release/`，不包含联网安装或自动更新。

## 本地数据

数据位于 `app.getPath("userData")/app-data/`，Windows 通常为 `%APPDATA%\trading-memo\app-data\`，准确路径以设置页为准：

- `notes.json`：笔记、分类、标签和附件记录；
- `settings.json`：主题、快捷键、默认分类和首次引导状态；
- `attachments/`：图片附件。

设置页可查看并打开数据目录，但不修改或同步路径。

## 导出、备份与恢复

Markdown 每条笔记一个文件，图片复制到导出包并使用相对路径。JSON 包含完整结构化数据、设置、附件相对路径和附件副本。

备份包含 `notes.json`、`settings.json` 与 `attachments/`。覆盖恢复前会确认、校验并自动创建安全备份，失败时回滚。所有流程均只操作本地文件。
