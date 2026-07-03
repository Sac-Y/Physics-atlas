// 六大学科分支：语义配色、星系布局锚点、星云形态参数。
// 锚点构图：从左（力学，历史源头）向右（宇宙学，前沿）的对角流，避免网格感。
// tools/layout.mjs 使用相同锚点（以本文件为准）。
// 锚点整体外扩 ~1.4×（X/Z）、1.2×（Y），为更大的星表撑开空间；
// 星云 scale 同步放大 ~1.3×，让云体覆盖变宽的星团、不留空洞。
export const BRANCHES = {
  mechanics: {
    zh: '经典力学',
    color: '#ffd27a',
    anchor: [-868, 12, -112],
    nebula: { scale: 1.5, elong: [0.9, 0.44], stretch: 1.7 }
  },
  em: {
    zh: '电磁学',
    color: '#8a7dff',
    anchor: [-336, 72, -588],
    nebula: { scale: 1.3, elong: [0.2, -0.98], stretch: 1.45 }
  },
  thermo: {
    zh: '热力学',
    color: '#ff7a4d',
    anchor: [-364, -84, 364],
    nebula: { scale: 1.0, elong: [0.7, 0.7], stretch: 1.3 }
  },
  relativity: {
    zh: '相对论',
    color: '#4de6d9',
    anchor: [322, 36, -364],
    nebula: { scale: 1.24, elong: [0.95, -0.3], stretch: 1.85 }
  },
  quantum: {
    zh: '量子',
    color: '#ff4dd2',
    anchor: [588, -48, 336],
    nebula: { scale: 1.66, elong: [0.55, 0.83], stretch: 1.5 }
  },
  cosmology: {
    zh: '宇宙学',
    color: '#3d5aff',
    anchor: [1148, 108, -252],
    nebula: { scale: 1.43, elong: [0.35, -0.94], stretch: 1.6 }
  }
}

export const BRANCH_KEYS = Object.keys(BRANCHES)
