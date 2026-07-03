// 熵增（热力学第二定律）· 可玩模拟 + 演示台课程
// 一盒会自己变乱的气体。惊讶时刻：「时间反演」——所有速度取反，
// 气体真的会一路退回有序的开局（微观定律可逆！）；
// 但加上十亿分之一的扰动，就再也回不去了——熵增是概率，不是禁令。

const N = 240
const R = 2 // 粒子半径（仅渲染用，运动为自由飞行）
const GRID_X = 12
const GRID_Y = 8

export const stageConfig = {
  steps: [
    {
      title: '有序的开局',
      text: '所有气体被压在盒子左侧——这是一个极其"有序"的状态。现在隔板抽走了。没有任何力驱赶它们，纯粹的乱撞，就足以让秩序瓦解。',
      scenario: 'release',
      annotations: {}
    },
    {
      title: '熵在上升',
      text: '把盒子划成小格，数每格里的粒子：分布越均匀，熵 S 越高。看左下角的曲线——S 一路爬升，然后停在平台上。它几乎从不下降，这就是时间之箭的方向。',
      scenario: 'keep',
      annotations: { grid: true, curve: true }
    },
    {
      title: '时间反演',
      text: '按下「时间反演」：每个粒子的速度瞬间取反。奇迹发生了——气体一路退回左侧的有序开局。牛顿定律根本不在乎时间的方向，微观世界是可逆的。',
      scenario: 'keep',
      annotations: { curve: true }
    },
    {
      title: '为什么回不去',
      text: '再试「带微扰反演」：反演时给每个速度加上亿分之一的误差。这次它回不去了。熵增不是定律的禁止，而是概率的碾压——乱的路径太多，有序的那条，一步走偏就再也找不到。',
      scenario: 'keep',
      annotations: { grid: true, curve: true }
    }
  ],
  params: [
    { type: 'button', key: 'reverse', label: '时间反演 ⏪' },
    { type: 'button', key: 'reverseNoisy', label: '带微扰反演 ⏪' }
  ]
}

export function createSim(canvas, statsEl) {
  const dpr = Math.min(window.devicePixelRatio, 1.5)
  const W = canvas.clientWidth
  const H = canvas.clientHeight
  canvas.width = W * dpr
  canvas.height = H * dpr
  const ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)

  const M = 14 // 盒壁边距
  const box = { x0: M, y0: M, x1: W - M, y1: H - M }

  // 确定性初始化（可复现）
  let seed = 1865
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }

  const px = new Float64Array(N)
  const py = new Float64Array(N)
  const vx = new Float64Array(N)
  const vy = new Float64Array(N)
  let simClock = 0
  const curve = [] // {t, s}
  let curveAcc = 0
  let raf = 0
  let alive = true
  let annotations = {}

  function initOrdered() {
    simClock = 0
    curve.length = 0
    const stripW = (box.x1 - box.x0) * 0.2
    for (let i = 0; i < N; i += 1) {
      px[i] = box.x0 + R + rand() * (stripW - 2 * R)
      py[i] = box.y0 + R + rand() * (box.y1 - box.y0 - 2 * R)
      const ang = rand() * Math.PI * 2
      const speed = 55 + rand() * 65
      vx[i] = Math.cos(ang) * speed
      vy[i] = Math.sin(ang) * speed
    }
  }
  initOrdered()

  function reverse(noise) {
    for (let i = 0; i < N; i += 1) {
      vx[i] = -vx[i] * (1 + (rand() - 0.5) * noise)
      vy[i] = -vy[i] * (1 + (rand() - 0.5) * noise)
    }
  }

  function entropy() {
    const cells = new Float32Array(GRID_X * GRID_Y)
    const cw = (box.x1 - box.x0) / GRID_X
    const ch = (box.y1 - box.y0) / GRID_Y
    for (let i = 0; i < N; i += 1) {
      const gx = Math.min(GRID_X - 1, Math.max(0, Math.floor((px[i] - box.x0) / cw)))
      const gy = Math.min(GRID_Y - 1, Math.max(0, Math.floor((py[i] - box.y0) / ch)))
      cells[gy * GRID_X + gx] += 1
    }
    let s = 0
    for (const c of cells) {
      if (c > 0) {
        const p = c / N
        s -= p * Math.log(p)
      }
    }
    return { s: s / Math.log(GRID_X * GRID_Y), cells }
  }

  function step(dt) {
    simClock += dt
    for (let i = 0; i < N; i += 1) {
      px[i] += vx[i] * dt
      py[i] += vy[i] * dt
      // 壁面镜面反射（把越界量反射回来，保持可逆性尽量好）
      if (px[i] < box.x0 + R) { px[i] = 2 * (box.x0 + R) - px[i]; vx[i] = -vx[i] }
      if (px[i] > box.x1 - R) { px[i] = 2 * (box.x1 - R) - px[i]; vx[i] = -vx[i] }
      if (py[i] < box.y0 + R) { py[i] = 2 * (box.y0 + R) - py[i]; vy[i] = -vy[i] }
      if (py[i] > box.y1 - R) { py[i] = 2 * (box.y1 - R) - py[i]; vy[i] = -vy[i] }
    }
    curveAcc += dt
    if (curveAcc > 0.25) {
      curveAcc = 0
      curve.push({ t: simClock, s: entropy().s })
      if (curve.length > 240) curve.shift()
    }
  }

  function render() {
    ctx.clearRect(0, 0, W, H)
    const { s, cells } = entropy()

    // 密度网格
    if (annotations.grid) {
      const cw = (box.x1 - box.x0) / GRID_X
      const ch = (box.y1 - box.y0) / GRID_Y
      const expect = N / (GRID_X * GRID_Y)
      for (let gy = 0; gy < GRID_Y; gy += 1) {
        for (let gx = 0; gx < GRID_X; gx += 1) {
          const c = cells[gy * GRID_X + gx]
          const heat = Math.min(c / (expect * 2.4), 1)
          if (heat < 0.03) continue
          ctx.fillStyle = `rgba(255, 122, 77, ${heat * 0.16})`
          ctx.fillRect(box.x0 + gx * cw, box.y0 + gy * ch, cw, ch)
        }
      }
    }

    // 盒壁
    ctx.strokeStyle = 'rgba(150, 175, 255, 0.22)'
    ctx.lineWidth = 1
    ctx.strokeRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0)

    // 粒子
    ctx.fillStyle = 'rgba(255, 170, 120, 0.9)'
    for (let i = 0; i < N; i += 1) {
      ctx.beginPath()
      ctx.arc(px[i], py[i], R, 0, Math.PI * 2)
      ctx.fill()
    }

    // 熵曲线（左下角）：坐标轴常驻，历史够了才画曲线——文案指到这里时不能是空白
    if (annotations.curve) {
      const cw2 = Math.min(W * 0.34, 190)
      const ch2 = 44
      const x0 = box.x0 + 10
      const y0 = box.y1 - 12
      ctx.strokeStyle = 'rgba(150, 175, 255, 0.25)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x0, y0 - ch2)
      ctx.lineTo(x0, y0)
      ctx.lineTo(x0 + cw2, y0)
      ctx.stroke()
      ctx.fillStyle = 'rgba(150, 200, 255, 0.6)'
      ctx.font = '10px "SF Mono", Menlo, monospace'
      ctx.textAlign = 'left'
      ctx.fillText('S', x0 + 4, y0 - ch2 + 10)
      if (curve.length > 1) {
        const t0 = curve[0].t
        const t1 = curve[curve.length - 1].t
        ctx.strokeStyle = 'rgba(77, 230, 217, 0.85)'
        ctx.lineWidth = 1.4
        ctx.beginPath()
        curve.forEach((pt, i) => {
          const x = x0 + ((pt.t - t0) / Math.max(t1 - t0, 1)) * cw2
          const y = y0 - pt.s * ch2
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        })
        ctx.stroke()
      }
    }

    if (statsEl) {
      statsEl.textContent = `S = ${s.toFixed(3)}　t = ${simClock.toFixed(1)}s　N = ${N}`
    }
  }

  let lastT = 0
  function loop(now) {
    if (!alive) return
    raf = requestAnimationFrame(loop)
    const dt = Math.min((now - lastT) / 1000 || 0.016, 0.033)
    lastT = now
    step(dt)
    render()
  }

  return {
    start() {
      alive = true
      render()
      raf = requestAnimationFrame(loop)
    },
    destroy() {
      alive = false
      cancelAnimationFrame(raf)
    },
    setScenario(name) {
      if (name === 'release') initOrdered()
      // 'keep'：保持现场，由课程文案接管
      render()
    },
    setAnnotations(a) {
      annotations = a || {}
      render()
    },
    setParam(key) {
      if (key === 'reverse') reverse(0)
      if (key === 'reverseNoisy') reverse(1e-6)
      render()
    }
  }
}
