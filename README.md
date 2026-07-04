# 物理学星图 · Physics Star Atlas

把四百年物理学史做成一片可漫游的知识星系——每一个理论是一颗星，星与星之间连的是"谁站在谁肩膀上"的传承。缩放漫游整片星空，点开任一颗星，里面是一个能玩的实时教学模拟。

**在线体验 → [physics-atlas-sigma.vercel.app](https://physics-atlas-sigma.vercel.app/)**

## 特性

- **可漫游星系**：760 个天体（160 颗有完整档案的理论星 + 600 颗次级成果"微尘星"），六大学科各成一片配色星云，330 条传承光丝织成师承网络。
- **四层缩放**：远景看学科版图 → 飞近浮现星名与传承光丝 → 点开是理论档案卡。全程指数阻尼，无跳变。
- **可玩教学模拟**：7 个"深空实验室"演示台，各含分步课程与一个设计好的"惊讶时刻"——万有引力（甩行星入椭圆轨道）、牛顿运动定律、麦克斯韦电磁场、熵增（时间反演）、杨氏双缝（一次一个光子）、狭义相对论光钟、法拉第电磁感应。
- **三套透镜**：星系 / 时间轴（按年份铺开）/ 尺度（粒子→宇宙），切换时全场粒子 GPU 插值流动重排，配俯视轴标注。
- **悬停脉络 / 流派聚焦**：悬停任一颗星点亮它的传承血脉；点击学科图例聚焦整个流派。
- **搜索 + 导览航线**：定律/人名模糊搜索直飞；三条讲故事航线（「光是什么」「从落体到黑洞」「从确定到随机」）。

## 技术栈

纯前端、零后端，所有内容是静态数据。

- **Three.js**（vanilla）+ 自定义 GLSL 着色器：星云、instanced 恒星、流光连线、UnrealBloom 后处理
- **Vite** 构建 · **KaTeX** 方程排版
- 迷你模拟用 2D Canvas，每个一个模块，统一 `init/step/render/destroy` 生命周期

## 本地运行

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

## 项目结构

```
src/
  scene/      星空渲染：星云 / 恒星 / 连线 / 标签 / 相机 / 透镜轴
  sims/       7 个教学模拟 + 演示台宿主
  ui/         档案卡 / 演示台 / 搜索 / 导览
  interact/   悬停聚焦与流派聚焦状态机
  data/       stars / edges / dust / routes（静态 JSON）+ 学科定义
tools/        layout.mjs（离线布局）· validate.mjs（数据校验）
```

## 部署

部署在 Vercel（[physics-atlas-sigma.vercel.app](https://physics-atlas-sigma.vercel.app/)）。
更新上线：`npm run build` 后用 `vercel --prod` 部署；若在 Vercel 后台连接了本 GitHub 仓库的 Git 集成，则推送到 `main` 会自动构建上线。
