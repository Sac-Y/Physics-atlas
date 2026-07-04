// 模拟宿主：档案卡打开时挂载对应模拟、关闭时销毁。
// 每个模拟一个模块（动态 import，按需加载），统一接口：
//   createSim(canvas, statsEl) → { start(), destroy() }
// 模拟自带 rAF 循环（卡片关闭即销毁，不与主场景循环耦合）。

import { simHint as localizedSimHint } from '../i18n.js'

const REGISTRY = {
  'gravity-orbit': () => import('./gravityOrbit.js'),
  'maxwell-field': () => import('./maxwellField.js'),
  'entropy-arrow': () => import('./entropyBox.js'),
  'double-slit': () => import('./doubleSlit.js'),
  'light-cone': () => import('./lightClock.js'),
  'induction-field': () => import('./faradayCoil.js'),
  'newton-motion': () => import('./newtonMotion.js')
}

export function hasSim(simId) {
  return Boolean(REGISTRY[simId])
}

export function simHint(simId) {
  return localizedSimHint(simId)
}

export async function loadSimModule(simId) {
  const loader = REGISTRY[simId]
  if (!loader) return null
  try {
    return await loader()
  } catch (error) {
    console.error('模拟加载失败:', simId, error)
    return null
  }
}

export async function mountSim(simId, canvas, statsEl) {
  const mod = await loadSimModule(simId)
  if (!mod) return null
  const sim = mod.createSim(canvas, statsEl)
  sim.start()
  return sim
}
