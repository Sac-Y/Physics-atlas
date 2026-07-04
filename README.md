# 物理学星图 · Physics Star Atlas

**[中文](#中文) · [English](#english)**

**在线体验 / Live demo → [physics-atlas-sigma.vercel.app](https://physics-atlas-sigma.vercel.app/)**

---

## 中文

把四百年物理学史做成一片可漫游的知识星系——每一个理论是一颗星，星与星之间连的是"谁站在谁肩膀上"的传承。缩放漫游整片星空，点开任一颗星，里面是一个能玩的实时教学模拟。

对标 James Webb 深空照片的星云质感、《星际穿越》的克制发光、Chrome 实验 "100,000 Stars" 的星系漫游体验。灵感来自刘慈欣《诗云》——诗人换成理论，师承换成学术脉络。

### 特性

- **可漫游星系**：760 个天体（160 颗有完整档案的理论星 + 600 颗次级成果"微尘星"），六大学科各成一片配色星云，330 条传承光丝织成师承网络。
- **四层缩放**：远景看学科版图 → 飞近浮现星名与传承光丝 → 点开是理论档案卡。全程指数阻尼，无跳变。
- **可玩教学模拟**：7 个"深空实验室"演示台，各含分步课程与一个设计好的"惊讶时刻"——万有引力（甩行星入椭圆轨道）、牛顿运动定律、麦克斯韦电磁场、熵增（时间反演）、杨氏双缝（一次一个光子）、狭义相对论光钟、法拉第电磁感应。
- **三套透镜**：星系 / 时间轴（按年份铺开）/ 尺度（粒子→宇宙），切换时全场粒子 GPU 插值流动重排，配俯视轴标注。
- **悬停脉络 / 流派聚焦**：悬停任一颗星点亮它的传承血脉；点击学科图例聚焦整个流派。
- **搜索 + 导览航线**：定律/人名模糊搜索直飞；三条讲故事航线（「光是什么」「从落体到黑洞」「从确定到随机」）。

### 技术栈

- **Three.js**（vanilla）+ 自定义 GLSL 着色器：星云、instanced 恒星、流光连线、UnrealBloom 后处理
- **Vite** 构建 · **KaTeX** 方程排版
- 迷你模拟用 2D Canvas，每个一个模块，统一 `init/step/render/destroy` 生命周期

### 本地运行

```bash
npm install
npm run dev        # 开发服务器 http://localhost:5173
npm run build      # 生产构建到 dist/
```

数据管线（改学科锚点或星表后需重跑）：

```bash
npm run layout     # 离线计算三套布局坐标写回数据
npm run validate   # 校验星表/边/坐标完整性
```

### 项目结构

```
src/
  scene/      星空渲染：星云 / 恒星 / 连线 / 标签 / 相机 / 透镜轴
  sims/       7 个教学模拟 + 演示台宿主
  ui/         档案卡 / 演示台 / 搜索 / 导览
  interact/   悬停聚焦与流派聚焦状态机
  data/       stars / edges / dust / routes（静态 JSON）+ 学科定义
tools/        layout.mjs（离线布局）· validate.mjs（数据校验）
```

---

## English

Four centuries of physics history rendered as a navigable galaxy of knowledge — every theory is a star, and the lines between them trace who stood on whose shoulders. Zoom and roam the star field, open any star, and find a playable real-time teaching simulation inside.

Aesthetic references: the nebula texture of James Webb deep-field images, the restrained glow of *Interstellar*, and the galactic roaming of Chrome's "100,000 Stars" experiment. Inspired by Liu Cixin's *Cloud of Poems* — poets swapped for theories, lineage for academic descent.

### Features

- **Navigable galaxy** — 760 objects (160 fully-documented theory stars + 600 secondary "dust stars"), six disciplines each forming a color-coded nebula, woven together by 330 lineage filaments.
- **Four-level zoom** — overview of the discipline map → fly in to reveal star names and lineage threads → open a star's archive card. Exponentially damped throughout, no jumps.
- **Playable teaching sims** — 7 "deep-space lab" demo stages, each a step-by-step lesson with one designed "aha moment": Universal Gravitation (fling a planet into an elliptical orbit), Newton's Laws of Motion, Maxwell's electromagnetic field, Entropy (time reversal), Young's double slit (one photon at a time), Special Relativity light clock, Faraday induction.
- **Three lenses** — Galaxy / Timeline (laid out by year) / Scale (particle → universe); switching flows the whole field to a new layout via GPU interpolation, with a top-down axis annotation.
- **Hover lineage / branch focus** — hover any star to light up its lineage; click a discipline in the legend to focus the whole branch.
- **Search + guided tours** — fuzzy search by law or person name flies you there; three narrated tours ("What is light", "From falling bodies to black holes", "From certainty to randomness").

### Tech stack

- **Three.js** (vanilla) + custom GLSL shaders: nebulae, instanced stars, flowing lineage lines, UnrealBloom post-processing
- **Vite** build · **KaTeX** equation typesetting
- Mini-sims are 2D Canvas, one module each, with a uniform `init/step/render/destroy` lifecycle

### Run locally

```bash
npm install
npm run dev        # dev server at http://localhost:5173
npm run build      # production build to dist/
```

Data pipeline (re-run after editing discipline anchors or the star table):

```bash
npm run layout     # compute the three layout coordinate sets offline
npm run validate   # validate the star table / edges / coordinates
```

### Project structure

```
src/
  scene/      star-field rendering: nebulae / stars / edges / labels / camera / lens axes
  sims/       7 teaching sims + demo-stage host
  ui/         archive card / demo stage / search / tours
  interact/   hover-focus and branch-focus state machines
  data/       stars / edges / dust / routes (static JSON) + discipline definitions
tools/        layout.mjs (offline layout) · validate.mjs (data validation)
```
