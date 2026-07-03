# 物理学星图 · 项目规则

在本目录下工作时，此文件与仓库根 `Fable 5/CLAUDE.md` 的调度规则叠加生效。

---

## 项目视觉基准（最高优先级）

本项目「物理学星图」的**视觉与体验基准、反面清单、审美纪律**放在 [`VISION.md`](VISION.md)，优先级高于一切工程决策。
**做任何前端 / 视觉 / 模拟页工作前必读**；视觉验收时逐条对照该文件的反面清单与审美纪律给结论。

@VISION.md

---

## 运行与数据管线

- **dev 服务器**：走仓库根 `.claude/launch.json` 的 `dev` 配置（等价 `npm --prefix physics-star-atlas run dev`，端口 5173）
- **数据**：改布局锚点（`src/data/branches.js`）或星表后，在本目录内跑 `npm run layout && npm run validate`
- **进度 / 教训**：`tasks/todo.md`、`tasks/lessons.md`
