import * as THREE from 'three'
import {
  CSS2DRenderer,
  CSS2DObject
} from 'three/examples/jsm/renderers/CSS2DRenderer.js'

// 星名标签：随缩放逐层浮现——先超巨星，再亮星，最后微光星。
// 纯 DOM/CSS，与 HUD 同一套字体语言。

function smoothstep(a, b, x) {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1)
  return t * t * (3 - 2 * t)
}

// [完全可见半径, 完全隐藏半径]
const TIER_RANGE = {
  high: [1600, 2400],
  mid: [700, 1050],
  low: [300, 480],
  dust: [150, 260]
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
    el.textContent = s.name.zh
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

  // 贪心标签避让：高优先级先占位，与已占位文字碰撞的低优先级隐去
  function resolveOverlaps() {
    const placed = []
    byPriority.forEach((item) => {
      if (!item.visible) return
      const r = item.el.getBoundingClientRect()
      // 文字实际占据盒底部（上方是 padding 偏移量）
      const text = { left: r.left - 4, right: r.right + 4, top: r.bottom - 22, bottom: r.bottom + 2 }
      const hit = placed.some((p) => collide(p, text))
      item.suppressed = hit
      if (!hit) placed.push(text)
    })
  }

  // 悬停聚焦：脉络内的星名无视层级强制显示，其余标签沉暗
  let focusIds = null
  function setFocus(ids) {
    focusIds = ids
  }

  function update(radius, cameraMoving = false) {
    frameCount += 1
    // 相机运动中冻结避让状态：移动中的快照会误判重叠、把标签成片误杀。
    // 停稳后再重算（rect 读取有布局开销，降频即可，CSS 过渡兜底）。
    if (!cameraMoving && frameCount % 12 === 0) resolveOverlaps()

    items.forEach((item) => {
      const focused = focusIds?.has(item.id) ?? false
      const [near, far] = TIER_RANGE[item.tier]
      let opacity = (1 - smoothstep(near, far, radius)) * 0.9
      if (focusIds) opacity = focused ? 0.95 : opacity * 0.15
      const visible = opacity > 0.02
      if (visible !== item.visible) {
        item.el.style.visibility = visible ? 'visible' : 'hidden'
        // CSS2DRenderer 跳过 object.visible=false 的对象——隐藏标签零成本，
        // 扩容到近千标签时这是关键护栏（每帧只更新在视野内的少数）
        item.obj.visible = visible
        item.visible = visible
      }
      if (visible) {
        const next = item.suppressed && !focused ? '0' : opacity.toFixed(2)
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
