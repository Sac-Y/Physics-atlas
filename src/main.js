import { createStage } from './scene/renderer.js'
import { createBackgroundStars } from './scene/backgroundStars.js'
import { createDiscStars } from './scene/discStars.js'
import { createNebulae } from './scene/nebulae.js'
import { createTheoryStars } from './scene/stars.js'
import { createLineage } from './scene/edges.js'
import { createLabels } from './scene/labels.js'
import { createLensAxes } from './scene/lensAxis.js'
import { createCameraRig } from './scene/cameraRig.js'
import { BRANCHES } from './data/branches.js'
import { createHoverFocus } from './interact/hover.js'
import { createStarCard } from './ui/starCard.js'
import { createDemoStage } from './ui/demoStage.js'
import { createTourPlayer } from './ui/tourPlayer.js'
import { createSearchBox } from './ui/searchBox.js'
import { createDustLayer } from './scene/dustLayer.js'
import starsData from './data/stars.json'
import edgesData from './data/edges.json'
import dustData from './data/dust.json'
import routesData from './data/routes.json'
import { PRESETS, DEFAULT_PRESET } from './style/presets.js'
import {
  LANGUAGES,
  applyInitialLanguage,
  branchName,
  dustName,
  onLanguageChange,
  presetLabel,
  setLanguage,
  t
} from './i18n.js'
import * as THREE from 'three'

applyInitialLanguage()

const app = document.getElementById('app')
const stage = createStage(app)

const backdrop = createBackgroundStars()
const disc = createDiscStars()
const nebulae = createNebulae()
const theoryStars = createTheoryStars(
  starsData.map((s) => ({ ...s, pos: s.pos.galaxy }))
)
const lineage = createLineage(starsData, edgesData)
const dustLayer = createDustLayer(dustData)
const lensAxis = createLensAxes()

// 标签：正式星 + 微尘星（influence 0 → dust 层，极近距离才浮现）
const labelSource = [
  ...starsData,
  ...dustData.map((d) => ({ ...d, name: { zh: d.name }, influence: 0, dust: true }))
]
const labels = createLabels(labelSource, document.body)

// 学科图例：标题下方一排色点 + 中文名，从 BRANCHES 生成（模式同 lensSwitcher）
// 可交互：hover 临时聚焦该流派、点击钉住、再点/点空处/切透镜解除
const branchLegend = document.getElementById('branchLegend')
const legendItems = new Map()
Object.entries(BRANCHES).forEach(([key, b]) => {
  const item = document.createElement('div')
  item.className = 'legend-item'
  item.dataset.key = key
  const dot = document.createElement('span')
  dot.className = 'legend-dot'
  dot.style.background = b.color
  dot.style.boxShadow = `0 0 8px ${b.color}`
  const name = document.createElement('span')
  name.className = 'legend-name'
  name.textContent = branchName(key)
  item.append(dot, name)
  branchLegend.appendChild(item)
  legendItems.set(key, item)
})

function setLegendActive(key) {
  legendItems.forEach((el, k) => el.classList.toggle('active', k === key))
}
// hover 临时聚焦；点击切换钉住（再点同项解除）。回调在 hover 就绪后才触发。
branchLegend.addEventListener('pointerover', (e) => {
  const item = e.target.closest('.legend-item')
  if (item) hover.setBranchHover(item.dataset.key)
})
branchLegend.addEventListener('pointerout', (e) => {
  const item = e.target.closest('.legend-item')
  // 移出图例项（而非移入同项子元素）才清临时聚焦
  if (item && !item.contains(e.relatedTarget)) hover.setBranchHover(null)
})
branchLegend.addEventListener('click', (e) => {
  const item = e.target.closest('.legend-item')
  if (!item) return
  const key = item.dataset.key
  const next = hover.pinnedBranch === key ? null : key
  hover.pinBranch(next)
  setLegendActive(next)
})

// 星系整体微倾：默认视角下呈对角线构图，而非水平摆盘
const galaxy = new THREE.Group()
galaxy.add(
  disc.object,
  nebulae.object,
  theoryStars.object,
  lineage.object,
  dustLayer.object,
  labels.group,
  lensAxis.group
)
galaxy.rotation.set(0.06, 0, -0.09)
stage.scene.add(backdrop.object, galaxy)

const rig = createCameraRig(stage.camera, stage.renderer.domElement)

const hover = createHoverFocus({
  stars: starsData,
  edges: edgesData,
  camera: stage.camera,
  galaxy,
  canvas: stage.renderer.domElement,
  lineage,
  theoryStars,
  labels,
  nebulae
})

// —— 档案卡：点击恒星 → 飞近 + 打开；演示台从卡上进入 ——
const card = createStarCard()
const demoStage = createDemoStage()
const starById = new Map(starsData.map((s) => [s.id, s]))

card.onClose((reason) => {
  hover.lock(null)
  if (reason !== 'dismiss') return
  resetAtlasView()
})
card.onStage((star) => {
  card.close()
  hover.lock(star.id)
  demoStage.open(star)
})
demoStage.onClose(() => hover.lock(null))

let downPos = null
stage.renderer.domElement.addEventListener('pointerdown', (e) => {
  downPos = { x: e.clientX, y: e.clientY }
})
stage.renderer.domElement.addEventListener('pointerup', (e) => {
  if (!downPos) return
  const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y)
  downPos = null
  if (moved > 6) return // 拖拽不算点击
  const id = hover.hoverId
  if (id) {
    hover.lock(id)
    rig.focusOn(hover.getWorldPos(id), 340)
    card.open(starById.get(id))
  } else {
    card.close('dismiss') // 点空处关卡
    if (hover.pinnedBranch) {
      // 点空处解除流派钉住
      hover.pinBranch(null)
      setLegendActive(null)
    }
  }
})

// —— 透镜：星系 / 时间轴 / 尺度 ——
// 三套坐标离线算好在数据里，切换 = 全场粒子 GPU 插值流动到新布局
const LENSES = ['galaxy', 'timeline', 'scale']
let lensCurrent = 'galaxy'
let lensAnim = null // { to, t }
let lensFade = 1 // 星云/盘面在非星系布局退场
let searchBox = null

function flatTargets(list, lens) {
  const arr = new Float32Array(list.length * 3)
  list.forEach((s, i) => {
    arr[i * 3] = s.pos[lens][0]
    arr[i * 3 + 1] = s.pos[lens][1]
    arr[i * 3 + 2] = s.pos[lens][2]
  })
  return arr
}

function lensViewpoint(lens) {
  // 目标布局的取景中心与距离。
  // 关键：时间轴按年份线性排布，阿基米德（-250）孤悬在 X≈-5920，其余 159 颗全挤在
  // X∈[0,1341]。若用原始 min/max 包围盒取景，中心会落到二者之间的空处、半径被撑到
  // 上限，切换后满屏漆黑。这里先剔除“远离主群的离群点”，再把剩下的星群完整框进画面。
  const inlierSpan = (i) => {
    const arr = starsData.map((s) => s.pos[lens][i]).sort((a, b) => a - b)
    const q10 = arr[Math.floor(arr.length * 0.1)]
    const q90 = arr[Math.ceil(arr.length * 0.9) - 1]
    const spread = Math.max(q90 - q10, 1)
    // 落在 [q10-2σ, q90+2σ] 之外的算离群点（阿基米德），其余全部保留
    const inliers = arr.filter((v) => v >= q10 - 2 * spread && v <= q90 + 2 * spread)
    const lo = inliers[0]
    const hi = inliers[inliers.length - 1]
    return { mid: (lo + hi) / 2, size: hi - lo }
  }
  const sx = inlierSpan(0)
  const sz = inlierSpan(2)
  // 取景中心：X/Z 用星群中点；顶视时纵向要额外装下 z=+475 的轴与刻度标签，
  // 故把中心沿 +z 略微下移，让「星场（z≥-340）+ 轴（z≈+475）」整体居中。
  const AXIS_REACH = 560 // 轴线 475 + 刻度短线 + 标签外扩余量
  const zLo = Math.min(sz.mid - sz.size / 2, -340)
  const zHi = Math.max(sz.mid + sz.size / 2, AXIS_REACH)
  const zMid = (zLo + zHi) / 2
  const zSpan = zHi - zLo
  const center = new THREE.Vector3(sx.mid, 0, zMid).applyEuler(galaxy.rotation)
  // 顶视微倾下：水平屏幕轴≈世界 X（不压缩），垂直屏幕轴≈世界 Z（几乎不压缩）。
  const tanV = Math.tan((stage.camera.fov * Math.PI) / 360)
  const tanH = tanV * stage.camera.aspect
  const rX = (sx.size * 0.5) / tanH
  const rZ = (zSpan * 0.5) / tanV
  // 1.18 留白，floor 保证不论视口宽窄都不顶边（尺度轴较窄时靠 floor 兜底）
  return {
    center,
    radius: THREE.MathUtils.clamp(Math.max(rX, rZ, 1150) * 1.18, 1150, 3400)
  }
}

const lensSwitcher = document.getElementById('lensSwitcher')
LENSES.forEach((key) => {
  const btn = document.createElement('button')
  btn.textContent = t(`lens.${key}`)
  btn.dataset.key = key
  btn.classList.toggle('active', key === lensCurrent)
  btn.addEventListener('click', () => switchLens(key))
  lensSwitcher.appendChild(btn)
})

function setActiveLensButton(lens) {
  lensSwitcher.querySelectorAll('button').forEach((b) => {
    b.classList.toggle('active', b.dataset.key === lens)
  })
}

function switchLens(lens) {
  if (lens === lensCurrent || lensAnim) return
  lensAnim = { to: lens, t: 0 }
  card.close()
  demoStage.close()
  hover.lock(null)
  hover.setBranchHover(null)
  hover.pinBranch(null) // 切透镜解除流派钉住
  setLegendActive(null)
  hover.setEnabled(false)
  theoryStars.beginLens(flatTargets(starsData, lens))
  dustLayer.beginLens(flatTargets(dustData, lens))
  lineage.beginLens(lens)
  labels.beginLens(lens)
  const view = lensViewpoint(lens)
  if (lens === 'galaxy') {
    rig.resetOverview()
    // 斜视回到默认（从注视点指向相机）
    rig.steerTo(new THREE.Vector3(0.35, 0.52, 1).normalize())
  } else {
    rig.flyToView(view.center, view.radius)
    // 顶视微倾：俯瞰泳道，时间/尺度从左到右铺开
    rig.steerTo(new THREE.Vector3(0.05, 1, 0.42).normalize())
  }
  setActiveLensButton(lens)
}

function finishLensAnimation() {
  if (!lensAnim) return
  theoryStars.setLensProgress(1)
  dustLayer.setLensProgress(1)
  lineage.setLensProgress(1)
  labels.setLensProgress(1)
  theoryStars.commitLens()
  dustLayer.commitLens()
  lineage.commitLens()
  labels.commitLens()
  lensCurrent = lensAnim.to
  lensAnim = null
  hover.refreshPositions(lensCurrent)
  hover.setEnabled(true)
}

function resetAtlasView() {
  card.close()
  demoStage.close()
  tour.end()
  searchBox?.clear()
  hover.lock(null)
  finishLensAnimation()
  if (lensCurrent !== 'galaxy') switchLens('galaxy')
  else {
    setActiveLensButton('galaxy')
    hover.refreshPositions('galaxy')
    hover.setEnabled(true)
  }
  rig.resetOverview()
}

// —— 导览航线 ——
const tour = createTourPlayer({
  routes: routesData,
  rig,
  hover,
  canvas: stage.renderer.domElement,
  onStart() {
    card.close()
    demoStage.close()
    if (lensCurrent !== 'galaxy') switchLens('galaxy')
  }
})

// —— 搜索：输入定律名/人名 → 飞到那颗星并开卡 ——
searchBox = createSearchBox({
  stars: starsData,
  onSelect(star) {
    tour.end()
    demoStage.close()
    hover.lock(star.id)
    rig.focusOn(hover.getWorldPos(star.id), 340)
    card.open(star)
  }
})

document.getElementById('resetView').addEventListener('click', resetAtlasView)
window.addEventListener('keydown', (e) => {
  const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
  if (typing) return
  if (e.key === '0' || e.key === 'Home') {
    e.preventDefault()
    resetAtlasView()
  }
})

// 开发/验证用受控接口（仅开发环境，生产构建自动剔除）
if (import.meta.env.DEV) {
  window.__atlas = { rig, camera: stage.camera, hover, card, switchLens, resetAtlasView, tour }
}

// —— 风格方案切换 ——
const params = new URLSearchParams(location.search)
let activePreset = params.get('style') in PRESETS ? params.get('style') : DEFAULT_PRESET

const switcher = document.getElementById('styleSwitcher')
Object.entries(PRESETS).forEach(([key, preset]) => {
  const btn = document.createElement('button')
  btn.textContent = presetLabel(key)
  btn.dataset.key = key
  btn.addEventListener('click', () => applyPreset(key))
  switcher.appendChild(btn)
})

const languageSwitcher = document.getElementById('languageSwitcher')
Object.entries(LANGUAGES).forEach(([key, meta]) => {
  const btn = document.createElement('button')
  btn.textContent = meta.label
  btn.dataset.key = key
  btn.addEventListener('click', () => setLanguage(key))
  languageSwitcher.appendChild(btn)
})

function renderLanguageChrome() {
  document.getElementById('appTitle').textContent = t('app.title')
  document.getElementById('appSubtitle').textContent = t('app.subtitle')
  document.getElementById('branchLegend').setAttribute('aria-label', t('app.branchLegend'))
  document.getElementById('styleSwitcher').setAttribute('aria-label', t('app.styleSwitcher'))
  document.getElementById('lensSwitcher').setAttribute('aria-label', t('app.lensSwitcher'))
  document.getElementById('languageSwitcher').setAttribute('aria-label', t('app.languageSwitcher'))
  document.getElementById('hudHint').textContent = t('app.hint')
  const reset = document.getElementById('resetView')
  reset.setAttribute('aria-label', t('app.resetView'))
  reset.title = t('app.resetView')
  legendItems.forEach((el, key) => {
    el.querySelector('.legend-name').textContent = branchName(key)
  })
  lensSwitcher.querySelectorAll('button').forEach((btn) => {
    btn.textContent = t(`lens.${btn.dataset.key}`)
  })
  switcher.querySelectorAll('button').forEach((btn) => {
    btn.textContent = presetLabel(btn.dataset.key)
  })
  languageSwitcher.querySelectorAll('button').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.key === document.documentElement.lang.replace('zh-CN', 'zh'))
  })
}

function applyPreset(key) {
  activePreset = key
  const preset = PRESETS[key]
  stage.applyPreset(preset)
  backdrop.applyPreset(preset)
  nebulae.applyPreset(preset)
  theoryStars.applyPreset(preset)
  switcher.querySelectorAll('button').forEach((b) => {
    b.classList.toggle('active', b.dataset.key === key)
  })
  const url = new URL(location.href)
  url.searchParams.set('style', key)
  history.replaceState(null, '', url)
}
applyPreset(activePreset)
renderLanguageChrome()
onLanguageChange(renderLanguageChrome)

// —— 调试帧率（?debug）——
const fpsEl = document.getElementById('fps')
const debug = params.has('debug')
if (debug) fpsEl.style.display = 'block'
let frames = 0
let fpsTimer = 0

// —— 主循环 ——
const clock = new THREE.Clock()
let simTime = 0
let introClock = 0 // 开场苏醒序列：背景星野 → 星云 → 恒星，错峰淡入
const prevCamPos = stage.camera.position.clone()

function introStage(from, dur) {
  const k = Math.min(Math.max((introClock - from) / dur, 0), 1)
  return k * k * (3 - 2 * k)
}

function smoothstepJs(a, b, x) {
  const k = Math.min(Math.max((x - a) / (b - a), 0), 1)
  return k * k * (3 - 2 * k)
}

function tick(dt) {
  simTime += dt
  const t = simTime

  rig.update(dt, t)
  const radius = rig.radius

  // 相机是否在明显运动（含缩放与拖拽，不含极慢自转）
  const camMoving =
    stage.camera.position.distanceToSquared(prevCamPos) >
    radius * radius * 4e-6
  prevCamPos.copy(stage.camera.position)

  // 悬停聚焦状态（返回星云沉暗系数）
  const focusDim = hover.update(dt)
  tour.update(dt)

  // 透镜切换动画：约 2.2 秒的全场流动
  if (lensAnim) {
    lensAnim.t = Math.min(1, lensAnim.t + dt / 2.2)
    const lt = lensAnim.t
    theoryStars.setLensProgress(lt)
    dustLayer.setLensProgress(lt)
    lineage.setLensProgress(lt)
    labels.setLensProgress(lt)
    if (lt >= 1) {
      theoryStars.commitLens()
      dustLayer.commitLens()
      lineage.commitLens()
      labels.commitLens()
      lensCurrent = lensAnim.to
      lensAnim = null
      hover.refreshPositions(lensCurrent)
      hover.setEnabled(true)
    }
  }
  // 星云与盘面只属于"星系"布局，其它透镜下退成微光
  const lensTargetKey = lensAnim ? lensAnim.to : lensCurrent
  lensFade += ((lensTargetKey === 'galaxy' ? 1 : 0.05) - lensFade) * Math.min(1, dt * 2.2)

  // 开场苏醒：6 秒内各层错峰淡入（重载后 introClock 已过则全为 1，无感）
  if (introClock < 7) {
    introClock += dt
    backdrop.setIntro(introStage(0.2, 2))
    theoryStars.setIntro(introStage(2.4, 2.4))
  }
  const introNeb = introStage(1.2, 2.6)
  const introDust = introStage(2.0, 2.6)

  // 近观时外围星云微退，让恒星与连线成为主角
  const closeness = 1 - rig.getZoom01()
  const nebulaFade = (1 - closeness * 0.45) * focusDim * lensFade * introNeb
  // 传承光丝：中景浮现（半径 2600 开始显影，1500 全亮）
  const lineReveal = 1 - smoothstepJs(1500, 2600, radius)

  backdrop.update(t)
  disc.update(t, lensFade * introDust)
  nebulae.update(t, nebulaFade)
  theoryStars.update(t)
  lineage.update(t, lineReveal)
  dustLayer.update(t, focusDim * introDust)
  lensAxis.update(lensCurrent, lensAnim, dt)
  labels.update(radius, camMoving || Boolean(lensAnim))

  stage.composer.render()
  labels.render(stage.scene, stage.camera)
}

function frame() {
  requestAnimationFrame(frame)
  const dt = Math.min(clock.getDelta(), 0.05)
  tick(dt)

  if (debug) {
    frames += 1
    fpsTimer += dt
    if (fpsTimer >= 0.5) {
      fpsEl.textContent = `${Math.round(frames / fpsTimer)} fps · ${activePreset}`
      frames = 0
      fpsTimer = 0
    }
  }
}
frame()

// 验证用：后台标签页 rAF 暂停时手动推进 n 帧
if (import.meta.env.DEV) {
  window.__atlas.step = (n = 1, dt = 1 / 60) => {
    for (let i = 0; i < n; i += 1) tick(dt)
    return Math.round(rig.radius)
  }
}
