// 杨氏双缝实验 · 演示台课程
// 惊讶时刻：一次只发一个光子，点一个个落下——成千上万个点自己画出干涉条纹。

const SLIT_W = 6 // 缝宽（衍射包络用）

export const stageConfig = {
  steps: [
    {
      title: '波的相遇',
      text: '两条缝各自漾出一圈圈波。波峰遇波峰变亮、波峰遇波谷抵消——右边屏幕上出现明暗相间的条纹。这是波独有的签名，弹丸做不到。',
      scenario: 'wave',
      annotations: { rings: true }
    },
    {
      title: '调一调',
      text: '拖下面的滑杆：缝距越小、波长越长，条纹间距越宽——Δy = λL/d。杨用这条关系第一次量出了光的波长，不到一微米。',
      scenario: 'wave',
      annotations: { rings: true, measure: true }
    },
    {
      title: '一次一个光子',
      text: '把光调暗到一次只有一个光子。每个光子只在屏上打出一个点——但看着点慢慢积累：条纹又出现了。单个光子，似乎同时穿过了两条缝。',
      scenario: 'photons',
      annotations: {}
    },
    {
      title: '看它走哪条缝',
      text: '在缝上装探测器，弄清每个光子到底走了哪条。条纹立刻消失，只剩两团。"知道路径"本身就杀死了干涉——这就是量子力学最深的怪。',
      scenario: 'observed',
      annotations: {}
    }
  ],
  params: [
    { key: 'd', label: '缝距', min: 26, max: 90, step: 1, value: 48 },
    { key: 'lambda', label: '波长', min: 9, max: 24, step: 0.5, value: 14 }
  ]
}

// 可见光谱近似着色（λ 滑杆 9~24 映射紫→红）
function waveColor(lambda) {
  const t = (lambda - 9) / 15
  const hue = 275 - t * 275 // 275°(紫) → 0°(红)
  return `hsl(${hue}, 75%, 68%)`
}

export function createSim(canvas, statsEl) {
  const dpr = Math.min(window.devicePixelRatio, 1.5)
  const W = canvas.clientWidth
  const H = canvas.clientHeight
  canvas.width = W * dpr
  canvas.height = H * dpr
  const ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)

  const cy = H / 2
  const barrierX = W * 0.34
  const screenX = W * 0.9
  const L = screenX - barrierX

  let scenario = 'wave'
  let annotations = { rings: true }
  let d = 48
  let lambda = 14
  let simClock = 0
  let raf = 0
  let alive = true

  // 光子模式状态
  const hits = [] // {y, age}
  const HIST_BINS = 96
  let hist = new Float32Array(HIST_BINS)
  let photonAcc = 0

  function slitYs() {
    return [cy - d / 2, cy + d / 2]
  }

  // 屏上强度（双缝干涉 × 单缝衍射包络）；observed 模式退化为两团
  function intensity(y) {
    const th = Math.atan2(y - cy, L)
    if (scenario === 'observed') {
      const [s1, s2] = slitYs()
      const proj = (s) => Math.exp(-(((y - s) / 26) ** 2))
      return (proj(s1) + proj(s2)) / 2
    }
    const phase = (Math.PI * d * Math.sin(th)) / lambda
    const beta = (Math.PI * SLIT_W * Math.sin(th)) / lambda
    const envelope = beta === 0 ? 1 : (Math.sin(beta) / beta) ** 2
    return Math.cos(phase) ** 2 * envelope
  }

  function samplePhotonY() {
    // 拒绝采样
    for (let k = 0; k < 60; k += 1) {
      const y = Math.random() * H
      if (Math.random() < intensity(y)) return y
    }
    return cy
  }

  function resetAccum() {
    hits.length = 0
    hist = new Float32Array(HIST_BINS)
  }

  function step(dt) {
    simClock += dt
    hits.forEach((h) => (h.age += dt))
    if (scenario === 'photons' || scenario === 'observed') {
      photonAcc += dt
      // 逐渐加速发射：前几个看清"一次一个"，后面快速积累
      const rate = Math.min(4 + hits.length * 0.6, 220)
      while (photonAcc > 1 / rate) {
        photonAcc -= 1 / rate
        const y = samplePhotonY()
        hits.push({ y, age: 0 })
        const bin = Math.min(HIST_BINS - 1, Math.max(0, Math.floor((y / H) * HIST_BINS)))
        hist[bin] += 1
        if (hits.length > 2600) hits.shift()
      }
    }
  }

  function render() {
    ctx.clearRect(0, 0, W, H)
    const col = waveColor(lambda)
    const [s1, s2] = slitYs()

    // 光源
    const src = ctx.createRadialGradient(W * 0.08, cy, 0, W * 0.08, cy, 14)
    src.addColorStop(0, 'rgba(255,244,224,1)')
    src.addColorStop(1, 'rgba(255,200,130,0)')
    ctx.fillStyle = src
    ctx.beginPath()
    ctx.arc(W * 0.08, cy, 14, 0, Math.PI * 2)
    ctx.fill()

    // 挡板与双缝
    ctx.strokeStyle = 'rgba(180, 195, 235, 0.6)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(barrierX, 12)
    ctx.lineTo(barrierX, s1 - SLIT_W)
    ctx.moveTo(barrierX, s1 + SLIT_W)
    ctx.lineTo(barrierX, s2 - SLIT_W)
    ctx.moveTo(barrierX, s2 + SLIT_W)
    ctx.lineTo(barrierX, H - 12)
    ctx.stroke()

    // 探测器（observed）
    if (scenario === 'observed') {
      ctx.fillStyle = 'rgba(255, 122, 77, 0.85)'
      ;[s1, s2].forEach((s) => {
        ctx.beginPath()
        ctx.arc(barrierX + 9, s, 3.4, 0, Math.PI * 2)
        ctx.fill()
      })
      ctx.font = '10px "Songti SC", serif'
      ctx.fillStyle = 'rgba(255, 170, 130, 0.7)'
      ctx.textAlign = 'left'
      ctx.fillText('探测器', barrierX + 16, s1 - 6)
    }

    // 波纹环（从两缝漾出，波长间距）
    if (annotations.rings && scenario === 'wave') {
      const spread = (simClock * 26) % lambda
      ;[s1, s2].forEach((s) => {
        for (let r = spread; r < L * 1.06; r += lambda) {
          const alpha = 0.3 * (1 - r / (L * 1.06))
          if (alpha < 0.015) continue
          ctx.beginPath()
          ctx.arc(barrierX, s, r, -Math.PI / 2.4, Math.PI / 2.4)
          ctx.strokeStyle = col.replace(')', `, ${alpha})`).replace('hsl', 'hsla')
          ctx.lineWidth = 1
          ctx.stroke()
        }
      })
    }

    // 屏幕
    ctx.strokeStyle = 'rgba(180, 195, 235, 0.5)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(screenX, 12)
    ctx.lineTo(screenX, H - 12)
    ctx.stroke()

    if (scenario === 'wave') {
      // 连续条纹：沿屏发光 + 强度曲线
      for (let y = 12; y < H - 12; y += 2) {
        const I = intensity(y)
        if (I < 0.02) continue
        ctx.fillStyle = col.replace(')', `, ${I * 0.85})`).replace('hsl', 'hsla')
        ctx.fillRect(screenX - 3, y, 6, 2)
        ctx.fillStyle = col.replace(')', `, ${I * 0.1})`).replace('hsl', 'hsla')
        ctx.fillRect(screenX - 8, y, 16, 2)
      }
      // 强度曲线（屏右侧）
      ctx.strokeStyle = 'rgba(200, 215, 250, 0.5)'
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let y = 12; y < H - 12; y += 2) {
        const x = screenX + 8 + intensity(y) * (W - screenX - 14)
        if (y === 12) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    } else {
      // 光子命中点 + 直方图
      hits.forEach((h) => {
        const flash = Math.max(0, 1 - h.age * 2.4)
        ctx.fillStyle = `rgba(230, 240, 255, ${0.34 + flash * 0.66})`
        const r = 1 + flash * 2.4
        ctx.beginPath()
        ctx.arc(screenX + (Math.random() - 0.5) * 0, h.y, r, 0, Math.PI * 2)
        ctx.fill()
      })
      const maxBin = Math.max(1, ...hist)
      ctx.strokeStyle = 'rgba(200, 215, 250, 0.55)'
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let b = 0; b < HIST_BINS; b += 1) {
        const y = ((b + 0.5) / HIST_BINS) * H
        const x = screenX + 8 + (hist[b] / maxBin) * (W - screenX - 14)
        if (b === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }

    // 条纹间距量尺
    if (annotations.measure) {
      const dy = (lambda * L) / d
      const y0 = cy - dy / 2
      ctx.strokeStyle = 'rgba(255, 235, 200, 0.55)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(screenX - 18, y0)
      ctx.lineTo(screenX - 18, y0 + dy)
      ctx.moveTo(screenX - 23, y0)
      ctx.lineTo(screenX - 13, y0)
      ctx.moveTo(screenX - 23, y0 + dy)
      ctx.lineTo(screenX - 13, y0 + dy)
      ctx.stroke()
      ctx.fillStyle = 'rgba(255, 235, 200, 0.75)'
      ctx.font = '11px "SF Mono", Menlo, monospace'
      ctx.textAlign = 'right'
      ctx.fillText('Δy', screenX - 27, cy + 4)
    }

    if (statsEl) {
      const dy = ((lambda * L) / d).toFixed(1)
      statsEl.textContent =
        scenario === 'wave'
          ? `d = ${d}　λ = ${lambda.toFixed(1)}　Δy = λL/d = ${dy}`
          : scenario === 'photons'
            ? `已落下 ${hits.length} 个光子——条纹正在自己长出来`
            : `路径已知：干涉消失，只剩两团（${hits.length} 个光子）`
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
      resetAccum()
      render()
    },
    setAnnotations(a) {
      annotations = a || {}
      render()
    },
    setParam(key, value) {
      if (key === 'd') d = value
      if (key === 'lambda') lambda = value
      resetAccum()
      render()
    }
  }
}
