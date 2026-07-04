import * as THREE from 'three'
import {
  CSS2DRenderer,
  CSS2DObject
} from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { dustName, onLanguageChange, starName } from '../i18n.js'

// 星名标签：随缩放逐层浮现——先超巨星，再亮星，最后微光星。
// 纯 DOM/CSS，与 HUD 同一套字体语言。

function smoothstep(a, b, x) {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1)
  return t * t * (3 - 2 * t)
}

// [完全可见半径, 完全隐藏半径]
// dust/low 收紧：微尘标签只在极近景浮现，避免近景一次冒出上百个同级标签互相叠压。
const TIER_RANGE = {
  high: [1600, 2400],
  mid: [700, 1050],
  low: [260, 430],
  dust: [110, 195]
}

export function createLabels(stars, container) {
  const renderer = new CSS2DRenderer()
  renderer.setSize(window.innerWidth, window.innerHeight)
  Object.assign(renderer.domElement.style, {
    position: 'fixed',
    inset: '0',
    pointerEvents: 'none',
    zIndex: '5'
  })
  container.appendChild(renderer.domElement)

  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight)
  })

  const group = new THREE.Group()
  const highPerBranch = new Map()
  const items = stars.map((s) => {
    const tier =
      s.influence >= 4
        ? 'high'
        : s.influence === 3
          ? 'mid'
          : s.influence >= 1
            ? 'low'
            : 'dust'
    const el = document.createElement('div')
    el.className = `star-label star-label--${tier}`
    el.textContent = s.dust ? dustName(s) : starName(s)
    // 同支大星先做基础错位，减少需要避让的碰撞对
    if (tier === 'high') {
      const k = highPerBranch.get(s.branch) ?? 0
      highPerBranch.set(s.branch, k + 1)
      el.style.paddingTop = `${34 + k * 17}px`
    }
    const obj = new CSS2DObject(el)
    obj.position.set(s.pos.galaxy[0], s.pos.galaxy[1], s.pos.galaxy[2])
    group.add(obj)
    return {
      el,
      obj,
      src: s,
      id: s.id,
      tier,
      influence: s.influence,
      visible: true,
      suppressed: false,
      lastOpacity: ''
    }
  })

  // 优先级：影响力高者优先占位
  const byPriority = [...items].sort((a, b) => b.influence - a.influence)

  let frameCount = 0

  function collide(a, b) {
    return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
  }

  // 贪心标签避让：高优先级先占位，与已占位文字碰撞的低优先级隐去。
  // 关键修复：
  //  1) 用本帧的 opacity 判定 shown（不再信上一帧缓存的 item.visible）——刚浮现的标签
  //     当帧即参与占位检测，杜绝"显示了但没人管"的漏网叠压。
  //  2) 每个候选都先把 suppressed 复位，避免陈旧 suppress 状态残留。
  //  3) 超密区兜底：低层（low/dust）占位数封顶，按优先级只保留前 N 个，其余隐去，
  //     防止近景同级微尘标签铺满屏幕。
  const LOW_TIER_CAP = 22 // low+dust 在屏内的最多同显数
  function resolveOverlaps(radius) {
    const placed = []
    let lowShown = 0
    byPriority.forEach((item) => {
      // 本帧该层的 LOD 基础可见性（与 update 同一口径），不含聚焦覆盖
      const [near, far] = TIER_RANGE[item.tier]
      const baseOpacity = (1 - smoothstep(near, far, radius)) * 0.9
      const focused = focusIds?.has(item.id) ?? false
      const shown = baseOpacity > 0.02 || focused
      item.suppressed = false
      if (!shown) return
      const r = item.el.getBoundingClientRect()
      if (r.width === 0) return // 尚未布局（刚从 hidden 切换）——下一帧再纳入
      // 文字实际占据盒底部（上方是 padding 偏移量）
      const text = { left: r.left - 4, right: r.right + 4, top: r.bottom - 22, bottom: r.bottom + 2 }
      const isLow = item.tier === 'low' || item.tier === 'dust'
      // 超密兜底：低层占位已达上限则直接压掉（单星聚焦不受限，流派聚焦仍受限）
      if (isLow && lowShown >= LOW_TIER_CAP && !(focused && forceFocusedLabels)) {
        item.suppressed = true
        return
      }
      const hit = placed.some((p) => collide(p, text))
      item.suppressed = hit
      if (!hit) {
        placed.push(text)
        if (isLow) lowShown += 1
      }
    })
  }

  // 悬停聚焦：单星脉络强制显示；流派聚焦只给代表节点提权，仍参与避让。
  let focusIds = null
  let forceFocusedLabels = true
  let unfocusedOpacityScale = 0.15
  function setFocus(ids, options = {}) {
    focusIds = ids
    forceFocusedLabels = options.forceFocusedLabels ?? true
    unfocusedOpacityScale = options.unfocusedOpacityScale ?? 0.15
    frameCount = 3 // 下一帧重算避让，避免焦点切换后短暂叠字
  }

  function update(radius, cameraMoving = false) {
    frameCount += 1
    // 相机运动中冻结避让状态：移动中的快照会误判重叠、把标签成片误杀。
    // 停稳后重算（rect 读取有布局开销，降频即可，CSS 过渡兜底）。节流收紧到 4 帧，
    // 让近景微尘标签浮现后尽快被纳入避让，避免长窗口叠压。
    if (!cameraMoving && frameCount % 4 === 0) resolveOverlaps(radius)

    items.forEach((item) => {
      const focused = focusIds?.has(item.id) ?? false
      const [near, far] = TIER_RANGE[item.tier]
      let opacity = (1 - smoothstep(near, far, radius)) * 0.9
      if (focusIds) opacity = focused ? 0.95 : opacity * unfocusedOpacityScale
      const visible = opacity > 0.02
      if (visible !== item.visible) {
        item.el.style.visibility = visible ? 'visible' : 'hidden'
        // CSS2DRenderer 跳过 object.visible=false 的对象——隐藏标签零成本，
        // 扩容到近千标签时这是关键护栏（每帧只更新在视野内的少数）
        item.obj.visible = visible
        item.visible = visible
      }
      if (visible) {
        const forceFocused = focused && forceFocusedLabels
        const next = item.suppressed && !forceFocused ? '0' : opacity.toFixed(2)
        if (next !== item.lastOpacity) {
          item.el.style.opacity = next
          item.lastOpacity = next
        }
      }
    })
  }

  function render(scene, camera) {
    renderer.render(scene, camera)
  }

  function renderLanguage() {
    items.forEach((item) => {
      item.el.textContent = item.src.dust ? dustName(item.src) : starName(item.src)
    })
    frameCount = 3
  }
  onLanguageChange(renderLanguage)

  // —— 透镜切换：标签跟随星飞行 ——
  function beginLens(lensKey) {
    items.forEach((item) => {
      item.from = item.obj.position.clone()
      item.to = new THREE.Vector3(...item.src.pos[lensKey])
    })
  }
  function setLensProgress(t) {
    const e = t * t * (3 - 2 * t)
    items.forEach((item) => {
      if (item.from && item.to) item.obj.position.lerpVectors(item.from, item.to, e)
    })
  }
  function commitLens() {
    items.forEach((item) => {
      if (item.to) item.obj.position.copy(item.to)
      item.from = null
      item.to = null
    })
  }

  return { group, update, render, setFocus, beginLens, setLensProgress, commitLens }
}
