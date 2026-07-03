import * as THREE from 'three'

// 悬停聚焦："这颗星连着谁"的直接回答。
// 悬停任一理论星：它的全部传承线亮起、脉络内的星保持明亮并强制显示星名、
// 其余星空沉暗。移开即恢复。拾取用屏幕空间最近邻（102 颗星，逐帧全算也便宜）。

const ACQUIRE_PX = 30 // 捕获半径
const RELEASE_PX = 46 // 释放半径（迟滞，防边界抖动）

export function createHoverFocus({
  stars,
  edges,
  camera,
  galaxy,
  canvas,
  lineage,
  theoryStars,
  labels,
  nebulae
}) {
  // 邻接表：id -> 相邻星 id 集合（悬停用）；有向父子表（点击点亮整条血脉用）
  const neighbors = new Map(stars.map((s) => [s.id, new Set()]))
  const parents = new Map(stars.map((s) => [s.id, new Set()]))
  const children = new Map(stars.map((s) => [s.id, new Set()]))
  edges.forEach((e) => {
    neighbors.get(e.from).add(e.to)
    neighbors.get(e.to).add(e.from)
    children.get(e.from).add(e.to)
    parents.get(e.to).add(e.from)
  })
  const idToIndex = new Map(stars.map((s, i) => [s.id, i]))

  // 流派聚焦：每个分支预算好其星的 id 集合与 index 集合（点亮/沉暗一次到位）
  const branchIds = new Map()
  const branchIdx = new Map()
  stars.forEach((s, i) => {
    if (!branchIds.has(s.branch)) {
      branchIds.set(s.branch, new Set())
      branchIdx.set(s.branch, new Set())
    }
    branchIds.get(s.branch).add(s.id)
    branchIdx.get(s.branch).add(i)
  })

  // 整条血脉：全部祖先 + 全部后代（"从伽利略到黑洞"一次点亮）
  function computeLineage(id) {
    const set = new Set([id])
    const walk = (start, dir) => {
      const queue = [start]
      while (queue.length) {
        const cur = queue.pop()
        dir.get(cur).forEach((next) => {
          if (!set.has(next)) {
            set.add(next)
            queue.push(next)
          }
        })
      }
    }
    walk(id, parents)
    walk(id, children)
    return set
  }

  // 星的世界坐标（星系组带静态倾角，按当前透镜布局计算）
  galaxy.updateMatrixWorld(true)
  let worldPos = []
  function refreshPositions(lensKey = 'galaxy') {
    worldPos = stars.map((s) =>
      new THREE.Vector3(...s.pos[lensKey]).applyMatrix4(galaxy.matrixWorld)
    )
  }
  refreshPositions()

  let mouse = null
  let hoverId = null
  let lockedId = null // 档案卡打开时锁定聚焦星，悬停不再切换
  let enabled = true // 透镜切换动画期间禁用拾取
  const v = new THREE.Vector3()

  canvas.addEventListener('pointermove', (e) => {
    mouse = { x: e.clientX, y: e.clientY }
  })
  canvas.addEventListener('pointerleave', () => {
    mouse = null
  })

  function pick() {
    if (!mouse) return null
    const w = window.innerWidth
    const h = window.innerHeight
    let best = null
    let bestScore = Infinity
    for (let i = 0; i < stars.length; i += 1) {
      v.copy(worldPos[i]).project(camera)
      if (v.z > 1) continue
      const sx = ((v.x + 1) / 2) * w
      const sy = ((1 - v.y) / 2) * h
      const d = Math.hypot(sx - mouse.x, sy - mouse.y)
      // 影响力大的星有更大的"引力"，密集区优先选大星
      const score = d - stars[i].influence * 3
      if (score < bestScore) {
        bestScore = score
        best = { id: stars[i].id, d }
      }
    }
    if (!best) return null
    const limit = best.id === hoverId ? RELEASE_PX : ACQUIRE_PX
    return best.d <= limit ? best.id : null
  }

  // 流派聚焦状态：hover 临时态 + pin 钉住态。单星聚焦优先级高于流派聚焦。
  let branchHover = null
  let branchPin = null

  // 当前生效的聚焦签名，避免每帧重复 setFocus（rect/attr 更新有开销）
  let focusSig = ''

  function applyStar(id) {
    // 悬停 = 直接师承；锁定（点击开卡）= 整条血脉
    const full = lockedId === id ? computeLineage(id) : null
    const keepIds = full ?? new Set([id, ...neighbors.get(id)])
    const keepIdx = new Set([...keepIds].map((k) => idToIndex.get(k)))
    lineage.setFocus(id, full)
    theoryStars.setFocus(keepIdx)
    labels.setFocus(keepIds)
    nebulae?.setBranchFocus(null)
    canvas.style.cursor = 'pointer'
  }

  function applyBranch(key) {
    const ids = branchIds.get(key)
    const idx = branchIdx.get(key)
    theoryStars.setFocus(idx)
    labels.setFocus(ids)
    lineage.setFocusIds(ids) // 两端同流派的边点亮：展示流派内部师承网
    nebulae?.setBranchFocus(key)
    canvas.style.cursor = ''
  }

  function clearFocus() {
    lineage.setFocus(null)
    lineage.setFocusIds(null)
    theoryStars.setFocus(null)
    labels.setFocus(null)
    nebulae?.setBranchFocus(null)
    canvas.style.cursor = ''
  }

  // 每帧决定生效的聚焦：单星（hover/lock）> 流派（hover > pin）> 无。
  // 用签名去重，仅在生效聚焦变化时重新下发（setFocus 含 attr/rect 开销）。
  function applyEffective() {
    const starId = hoverId
    const branchKey = branchHover ?? branchPin
    const sig = starId
      ? `s:${starId}:${lockedId === starId ? 'L' : ''}`
      : branchKey
        ? `b:${branchKey}`
        : ''
    if (sig === focusSig) return
    focusSig = sig
    if (starId) applyStar(starId)
    else if (branchKey) applyBranch(branchKey)
    else clearFocus()
  }

  let dim = 1

  function update(dt) {
    const next = lockedId ?? (enabled ? pick() : null)
    hoverId = next
    applyEffective()
    // 聚焦时星云沉暗（平滑过渡），把舞台让给脉络；流派聚焦不沉暗（要看清整片流派）
    const focused = Boolean(hoverId)
    dim += ((focused ? 0.4 : 1) - dim) * Math.min(1, dt * 7)
    return dim
  }

  function lock(id) {
    lockedId = id
    applyEffective()
  }

  // —— 流派聚焦 API ——
  function setBranchHover(key) {
    branchHover = key
  }
  function pinBranch(key) {
    branchPin = key
  }

  return {
    update,
    lock,
    refreshPositions,
    setBranchHover,
    pinBranch,
    setEnabled(on) {
      enabled = on
    },
    get hoverId() { return hoverId },
    get pinnedBranch() { return branchPin },
    getWorldPos(id) {
      return worldPos[idToIndex.get(id)]
    }
  }
}
