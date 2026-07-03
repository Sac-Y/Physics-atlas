// 三套风格方案：同一场景、不同视觉基调。供用户比选后再深化其一。
// 原则：只调"灰度结构与克制程度"，不动学科语义色相。
export const PRESETS = {
  deepfield: {
    label: '深空摄影',
    // James Webb 深空：暖尘埃、丰富层次、体积感星云
    background: '#050308',
    exposure: 1.02,
    bloom: { strength: 0.72, radius: 0.85, threshold: 0.12 },
    nebula: {
      intensity: 1.0,
      saturation: 0.82,
      dustTint: '#c98a4b', // 暖棕尘埃基调，压在学科色之下
      dustAmount: 0.38,
      coreGlow: 0.55
    },
    stars: { spike: 0.85, halo: 1.0, coreHeat: 0.75 },
    backdrop: { density: 1.0, warmth: 0.6, band: 0.85 }
  },

  interstellar: {
    label: '星际穿越',
    // 选定方案：克制发光、低饱和冷灰蓝、稀薄气体丝、锐利星芒。
    // 深黑里有细节，亮点因克制而刺眼。
    background: '#03040a',
    exposure: 0.94,
    bloom: { strength: 0.48, radius: 0.55, threshold: 0.24 },
    nebula: {
      intensity: 0.46,
      saturation: 0.4,
      dustTint: '#6b7a99',
      dustAmount: 0.5,
      coreGlow: 0.26
    },
    stars: { spike: 1.35, halo: 0.7, coreHeat: 0.95 },
    backdrop: { density: 0.95, warmth: 0.25, band: 0.55 }
  }
}

export const DEFAULT_PRESET = 'interstellar'
