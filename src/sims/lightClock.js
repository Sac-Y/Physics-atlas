// 狭义相对论 · 光钟演示台
// 两台光钟：一台静止，一台随飞船移动。光速对谁都一样——
// 移动的钟里光走斜线更长，所以它的"滴答"更慢。时间膨胀不是错觉，是几何。

const C = 150 // 光速（画布 px/s）
const MIRROR_GAP = 120 // 镜面间距 h

export const stageConfig = {
  steps: [
    {
      title: '光速对谁都一样',
      text: '两台一模一样的光钟：光子在上下两面镜子间弹跳，弹一个来回记一次"滴答"。爱因斯坦的全部赌注只有一句话——不管你跑多快，量到的光速都相同。',
      scenario: 'rest',
      annotations: {}
    },
    {
      title: '移动的钟',
      text: '让右边的钟坐上飞船。在你看来，它的光子必须走斜线才能追上移动的镜子——路程变长了，而光速不许变。唯一的出路：它的每一次滴答，都比静止的钟更久。看两个计数器慢慢拉开。',
      scenario: 'moving',
      annotations: { path: true }
    },
    {
      title: 'γ 因子',
      text: '慢多少？γ = 1/√(1−v²/c²)。把速度推向光速：0.6c 时慢 25%，0.9c 时慢 2.3 倍，0.99c 时慢 7 倍——分母趋零，γ 冲向无穷。这就是为什么任何有质量的东西到不了光速。',
      scenario: 'moving',
      annotations: { path: true, gamma: true }
    },
    {
      title: '这不是错觉',
      text: 'GPS 卫星的钟每天要为相对论修正约 38 微秒，否则定位一天漂 10 公里；宇宙线里的 μ 子寿命只有 2.2 微秒，本该在高空死去，却因为时间膨胀活着到达地面。你每天都在用相对论。',
      scenario: 'moving',
      annotations: { path: true, gamma: true }
    }
  ],
  params: [
    { key: 'vc', label: 'v / c', min: 0, max: 0.95, step: 0.01, value: 0.6 }
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

  const topY = H / 2 - MIRROR_GAP / 2
  const botY = H / 2 + MIRROR_GAP / 2
  const restX = W * 0.2

  let scenario = 'rest'
  let annotations = {}
  let vc = 0.6
  let simClock = 0
  let shipX = W * 0.42 // 飞船钟当前位置
  let raf = 0
  let alive = true

  const gamma = () => 1 / Math.sqrt(1 - vc * vc)
  const T0 = (2 * MIRROR_GAP) / C // 静止钟周期

  function step(dt) {
    simClock += dt
    if (scenario === 'moving') {
      shipX += vc * C * dt
      const span = W * 0.5
      if (shipX > W * 0.44 + span) shipX -= span // 环回，视觉上持续航行
    }
  }

  // 三角波：0→1→0，相位 p ∈ [0,1)
  function bounce(p) {
    return p < 0.5 ? p * 2 : 2 - p * 2
  }

  function drawClock(x, phase, label, ticks, moving) {
    // 镜面
    ctx.strokeStyle = 'rgba(190, 205, 245, 0.7)'
    ctx.lineWidth = 3
    ;[topY, botY].forEach((y) => {
      ctx.beginPath()
      ctx.moveTo(x - 26, y)
      ctx.lineTo(x + 26, y)
      ctx.stroke()
    })
    // 光子
    const py = botY - bounce(phase) * MIRROR_GAP
    const glow = ctx.createRadialGradient(x, py, 0, x, py, 9)
    glow.addColorStop(0, 'rgba(190, 235, 255, 1)')
    glow.addColorStop(1, 'rgba(120, 200, 255, 0)')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(x, py, 9, 0, Math.PI * 2)
    ctx.fill()
    // 斜线路径（移动钟）
    if (moving && annotations.path && vc > 0.01) {
      const half = (T0 * gamma() * vc * C) / 2 // 半个滴答内平移距离
      ctx.setLineDash([3, 6])
      ctx.strokeStyle = 'rgba(150, 190, 255, 0.35)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x - half * 2, botY)
      ctx.lineTo(x - half, topY)
      ctx.lineTo(x, botY)
      ctx.lineTo(x + half, topY)
      ctx.stroke()
      ctx.setLineDash([])
    }
    // 标签与计数
    ctx.font = '11px "Songti SC", serif'
    ctx.fillStyle = 'rgba(225, 232, 250, 0.6)'
    ctx.textAlign = 'center'
    ctx.fillText(label, x, topY - 16)
    ctx.font = '20px "SF Mono", Menlo, monospace'
    ctx.fillStyle = 'rgba(225, 235, 255, 0.9)'
    ctx.fillText(String(ticks), x, botY + 34)
  }

  function render() {
    ctx.clearRect(0, 0, W, H)

    const restPhase = (simClock / T0) % 1
    const restTicks = Math.floor(simClock / T0)

    if (scenario === 'rest') {
      drawClock(restX, restPhase, '钟 A', restTicks, false)
      drawClock(W * 0.62, restPhase, '钟 B', restTicks, false)
    } else {
      const Tm = T0 * gamma()
      const movPhase = (simClock / Tm) % 1
      const movTicks = Math.floor(simClock / Tm)
      drawClock(restX, restPhase, '静止的钟', restTicks, false)
      drawClock(shipX, movPhase, `飞船 v = ${vc.toFixed(2)}c`, movTicks, true)
    }

    // γ 表
    if (annotations.gamma) {
      const g = gamma()
      ctx.font = '13px "SF Mono", Menlo, monospace'
      ctx.fillStyle = 'rgba(255, 235, 200, 0.85)'
      ctx.textAlign = 'left'
      ctx.fillText(`γ = 1/√(1−v²/c²) = ${g.toFixed(2)}`, 18, 30)
      // γ 条
      const barW = Math.min((g - 1) / 6, 1) * (W * 0.3)
      ctx.fillStyle = 'rgba(255, 200, 130, 0.4)'
      ctx.fillRect(18, 40, barW, 3)
    }

    if (statsEl) {
      const g = gamma()
      statsEl.textContent =
        scenario === 'rest'
          ? '两台钟滴答完全同步'
          : `v = ${vc.toFixed(2)}c　γ = ${g.toFixed(2)}　飞船上的 1 秒 = 你的 ${g.toFixed(2)} 秒`
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
      scenario = name
      simClock = 0
      shipX = W * 0.42
      render()
    },
    setAnnotations(a) {
      annotations = a || {}
      render()
    },
    setParam(key, value) {
      if (key === 'vc') vc = value
      render()
    }
  }
}
