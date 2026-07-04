// 麦克斯韦方程组 · 可玩模拟 + 演示台课程
// 一个可以摇的电荷：扰动以恒定速度 c 向外传播；
// 沿传播轴画出 E（青，垂直）与 B（暖白，⊙/⊗）交替相生——这就是光。

import { getLanguage, localize } from '../i18n.js'

const C = 180 // 波速（画布 px/s），全程恒定——这是重点
const HIST_DT = 1 / 120 // 加速度历史采样步长

export const stageConfig = {
  steps: [
    {
      title: { zh: '摇一摇电荷', en: 'Shake a Charge' },
      text: {
        zh: '抓住电荷上下摇。看清楚：场不是瞬间跟上的——你制造的扰动以一个有限的速度向外跑。电磁作用不是超距的，这个认识本身就是革命。',
        en: 'Grab the charge and shake it. The field does not update instantly: the disturbance travels outward at a finite speed. Electromagnetic action is not action at a distance.'
      },
      scenario: 'manual',
      annotations: { rings: true }
    },
    {
      title: { zh: '电与磁互相孕育', en: 'Electric and Magnetic Fields' },
      text: {
        zh: '变化的电场产生磁场，变化的磁场又产生电场——青色箭头是电场 E，⊙ 与 ⊗ 是垂直屏幕进出的磁场 B。它们互为因果、彼此推着往前跑，谁也离不开谁。',
        en: 'A changing electric field creates a magnetic field, and a changing magnetic field creates an electric field. They sustain each other as the wave moves.'
      },
      scenario: 'auto',
      annotations: { E: true, B: true, rings: true }
    },
    {
      title: { zh: '这就是光', en: 'This Is Light' },
      text: {
        zh: '拖动频率滑杆：波长跟着变，但波速永远不变——c = fλ。麦克斯韦算出这个速度恰好等于光速的那一刻，人类才知道：光，就是电磁波。',
        en: 'Move the frequency slider. Wavelength changes, but wave speed stays fixed: c = fλ. Maxwell found that this speed was the speed of light.'
      },
      scenario: 'auto',
      annotations: { E: true, measure: true }
    },
    {
      title: { zh: '整个频谱', en: 'The Whole Spectrum' },
      text: {
        zh: '从无线电到伽马射线，差别只有频率。你的眼睛只看得见中间窄窄的一段。把滑杆从左推到右，你正在扫过整个电磁频谱。',
        en: 'Radio waves and gamma rays differ by frequency. Your eyes see only a narrow middle band. Slide across the control to sweep the electromagnetic spectrum.'
      },
      scenario: 'auto',
      annotations: { E: true, spectrum: true }
    }
  ],
  params: [
    { key: 'freq', label: { zh: '频率', en: 'Frequency' }, min: 0.35, max: 2.4, step: 0.01, value: 0.9 }
  ]
}

const BANDS = [
  [0.55, { zh: '无线电', en: 'radio' }, '#c9a27a'],
  [0.85, { zh: '微波', en: 'microwave' }, '#d8b06a'],
  [1.15, { zh: '红外', en: 'infrared' }, '#e0755a'],
  [1.55, { zh: '可见光', en: 'visible light' }, '#7ae08a'],
  [1.85, { zh: '紫外', en: 'ultraviolet' }, '#8a7dff'],
  [2.15, { zh: 'X 射线', en: 'X-rays' }, '#6fb7ff'],
  [Infinity, { zh: '伽马射线', en: 'gamma rays' }, '#e8f0ff']
]

export function createSim(canvas, statsEl) {
  const dpr = Math.min(window.devicePixelRatio, 1.5)
  const W = canvas.clientWidth
  const H = canvas.clientHeight
  canvas.width = W * dpr
  canvas.height = H * dpr
  const ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)

  const qx = W * 0.16
  const cy = H / 2
  const AMP = Math.min(H * 0.16, 52)

  let scenario = 'auto'
  let annotations = { E: true, B: true, rings: true }
  let freq = 0.9
  let simClock = 0
  let qy = 0 // 电荷位移
  let qv = 0
  let grabbed = false
  let raf = 0
  let alive = true

  // 加速度历史环形缓冲：远处的场读取"迟到"的历史 a(t - d/c)
  const HIST_N = Math.ceil((W / C) / HIST_DT) + 8
  const hist = new Float32Array(HIST_N)
  let histHead = 0
  let histAcc = 0 // 采样累积

  const rings = [] // {t0, amp}
  let ringAcc = 0

  function pushHist(a, dt) {
    histAcc += dt
    while (histAcc >= HIST_DT) {
      histAcc -= HIST_DT
      histHead = (histHead + 1) % HIST_N
      hist[histHead] = a
    }
  }
  function retardedA(d) {
    const back = Math.round(d / C / HIST_DT)
    if (back >= HIST_N) return 0
    return hist[(histHead - back + HIST_N * 2) % HIST_N]
  }

  function step(dt) {
    simClock += dt
    let a = 0
    if (scenario === 'auto' && !grabbed) {
      const w = 2 * Math.PI * freq
      qy = AMP * Math.sin(w * simClock)
      qv = AMP * w * Math.cos(w * simClock)
      a = -AMP * w * w * Math.sin(w * simClock)
    } else {
      // 手动：位移由指针驱动，加速度用弹簧回中估计（松手后阻尼回落）
      if (!grabbed) {
        const k = 30
        const acc = -k * qy - 4 * qv
        qv += acc * dt
        qy += qv * dt
        a = acc
      } else {
        a = grabAccel
        grabAccel *= 0.7
      }
    }
    pushHist(a / (AMP * 20), dt) // 归一化存储

    ringAcc += dt
    const strength = Math.abs(a) / (AMP * 12)
    if (ringAcc > 0.14 && strength > 0.05) {
      ringAcc = 0
      rings.push({ t0: simClock, amp: Math.min(strength, 1) })
    }
    while (rings.length && (simClock - rings[0].t0) * C > Math.hypot(W, H)) rings.shift()
  }

  function arrow(x, y0, dy, color) {
    if (Math.abs(dy) < 3) return
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(x, y0)
    ctx.lineTo(x, y0 + dy)
    ctx.stroke()
    const s = Math.sign(dy)
    ctx.beginPath()
    ctx.moveTo(x, y0 + dy)
    ctx.lineTo(x - 3.2, y0 + dy - s * 6)
    ctx.lineTo(x + 3.2, y0 + dy - s * 6)
    ctx.closePath()
    ctx.fill()
  }

  function waveColor() {
    if (!annotations.spectrum) return null
    for (const [top, name, color] of BANDS) {
      if (freq < top) return { name, color }
    }
    return null
  }

  function render() {
    ctx.clearRect(0, 0, W, H)
    const spec = waveColor()
    const eColor = spec ? spec.color : 'rgba(120, 220, 235, 0.9)'

    // 扰动涟漪：以 c 恒速外扩
    if (annotations.rings) {
      rings.forEach((ring) => {
        const r = (simClock - ring.t0) * C
        const alpha = ring.amp * Math.max(0, 1 - r / (W * 0.9)) * 0.35
        if (alpha <= 0.01) return
        ctx.beginPath()
        ctx.arc(qx, cy, r, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(140, 200, 255, ${alpha})`
        ctx.lineWidth = 1
        ctx.stroke()
      })
    }

    // 传播轴
    ctx.strokeStyle = 'rgba(150, 175, 255, 0.1)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(qx, cy)
    ctx.lineTo(W - 20, cy)
    ctx.stroke()

    // E / B 场：读取迟到的加速度历史
    const GAP = 24
    for (let x = qx + GAP; x < W - 24; x += GAP) {
      const aRet = retardedA(x - qx)
      const ey = aRet * 46
      if (annotations.E) arrow(x, cy, -ey, eColor)
      if (annotations.B && Math.abs(ey) > 4) {
        // ⊙（指向屏外）/ ⊗（指向屏内），大小随场强
        const by = cy + 44
        const rr = Math.min(Math.abs(ey) * 0.16 + 2, 7)
        ctx.strokeStyle = 'rgba(255, 235, 200, 0.75)'
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.arc(x, by, rr, 0, Math.PI * 2)
        ctx.stroke()
        if (ey > 0) {
          ctx.fillStyle = 'rgba(255, 235, 200, 0.85)'
          ctx.beginPath()
          ctx.arc(x, by, 1.4, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.beginPath()
          ctx.moveTo(x - rr * 0.6, by - rr * 0.6)
          ctx.lineTo(x + rr * 0.6, by + rr * 0.6)
          ctx.moveTo(x + rr * 0.6, by - rr * 0.6)
          ctx.lineTo(x - rr * 0.6, by + rr * 0.6)
          ctx.stroke()
        }
      }
    }

    // 波长量尺：一整个周期 λ = c / f
    if (annotations.measure) {
      const lambda = C / freq
      const x0 = qx + GAP * 2
      const yb = cy - AMP - 26
      ctx.strokeStyle = 'rgba(255, 235, 200, 0.55)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x0, yb)
      ctx.lineTo(x0 + lambda, yb)
      ctx.moveTo(x0, yb - 5)
      ctx.lineTo(x0, yb + 5)
      ctx.moveTo(x0 + lambda, yb - 5)
      ctx.lineTo(x0 + lambda, yb + 5)
      ctx.stroke()
      ctx.fillStyle = 'rgba(255, 235, 200, 0.75)'
      ctx.font = '11px "SF Mono", Menlo, monospace'
      ctx.textAlign = 'center'
      ctx.fillText('λ', x0 + lambda / 2, yb - 8)
    }

    // 电荷本体
    const glow = ctx.createRadialGradient(qx, cy + qy, 0, qx, cy + qy, 16)
    glow.addColorStop(0, 'rgba(255, 240, 220, 1)')
    glow.addColorStop(0.3, 'rgba(255, 200, 140, 0.6)')
    glow.addColorStop(1, 'rgba(255, 180, 100, 0)')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(qx, cy + qy, 16, 0, Math.PI * 2)
    ctx.fill()

    if (statsEl) {
      const lambda = C / freq
      const bandInfo = spec ? `　${localize(spec.name)}` : ''
      statsEl.textContent = grabbed
        ? getLanguage() === 'en' ? 'shake up and down - watch the disturbance run outward' : '上下摇，看扰动跑出去'
        : `f = ${freq.toFixed(2)}　λ = ${lambda.toFixed(0)}　c = f·λ = ${C} ${
          getLanguage() === 'en' ? '(constant)' : '（恒定）'
        }${bandInfo}`
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

  // —— 拖拽电荷 ——
  let lastPointerY = 0
  let grabAccel = 0
  function toLocalY(e) {
    return e.clientY - canvas.getBoundingClientRect().top
  }
  function onDown(e) {
    const y = toLocalY(e)
    const x = e.clientX - canvas.getBoundingClientRect().left
    if (Math.hypot(x - qx, y - (cy + qy)) < 34) {
      grabbed = true
      lastPointerY = y
      canvas.setPointerCapture(e.pointerId)
    }
  }
  function onMove(e) {
    if (!grabbed) return
    const y = toLocalY(e)
    const ny = Math.max(-AMP * 1.6, Math.min(AMP * 1.6, y - cy))
    grabAccel = (ny - qy) * 260 // 位移突变 ≈ 大加速度
    qv = (y - lastPointerY) * 30
    qy = ny
    lastPointerY = y
  }
  function onUp() {
    grabbed = false
  }

  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerup', onUp)
  canvas.addEventListener('pointercancel', onUp)

  return {
    start() {
      alive = true
      render()
      raf = requestAnimationFrame(loop)
    },
    destroy() {
      alive = false
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
    },
    setScenario(name) {
      scenario = name
      if (name === 'auto') grabbed = false
      render()
    },
    setAnnotations(a) {
      annotations = a || {}
      render()
    },
    setParam(key, value) {
      if (key === 'freq') freq = value
      render()
    }
  }
}
