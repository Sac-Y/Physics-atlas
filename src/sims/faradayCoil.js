// 法拉第电磁感应 · 演示台
// 亲手拖磁铁穿过线圈：电流表只在"变化"的瞬间摆动。
// 静止的磁铁什么也不给你——发电的从来不是磁，是变化。

export const stageConfig = {
  steps: [
    {
      title: '磁生电？',
      text: '抓住磁铁，推进线圈、再拔出来。盯着下面的电流表：只有磁铁在动的瞬间，指针才摆——停住就归零。法拉第盯着这个"只在变化时出现"的电流，看了十年。',
      scenario: 'manual',
      annotations: { meter: true }
    },
    {
      title: '快与慢',
      text: '同样的路程，快抽和慢抽完全不同：越快，指针甩得越猛。感应电动势正比于磁通量的变化率——ε = −dΦ/dt。看下面滚动的曲线：Φ 变得越陡，ε 的尖峰越高。',
      scenario: 'manual',
      annotations: { meter: true, trace: true }
    },
    {
      title: '反抗改变',
      text: '注意电流的方向（线圈上的箭头）：磁铁靠近时电流产生的磁场把它往外推，离开时又把它往回拉——感应电流永远在反抗你。这是楞次定律，也是能量守恒在电磁世界的签名。',
      scenario: 'manual',
      annotations: { meter: true, lenz: true }
    },
    {
      title: '从手到电网',
      text: '把"晃磁铁"做到极致：让它不知疲倦地往复。指针左右摆动——这就是交流电。全世界每一座发电站，本质上都是这只手，被换成了蒸汽、水流或风。',
      scenario: 'auto',
      annotations: { meter: true, trace: true }
    }
  ],
  params: [
    { key: 'freq', label: '往复频率', min: 0.2, max: 1.6, step: 0.01, value: 0.6 }
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

  const railY = H * 0.42
  const coilX = W * 0.62
  const COIL_N = 7
  const MAG_W = 92
  const MAG_H = 34

  let scenario = 'manual'
  let annotations = { meter: true }
  let freq = 0.6
  let simClock = 0
  let magX = W * 0.24
  let magVel = 0
  let grabbed = false
  let lastPointerX = 0
  let emf = 0 // 平滑后的感应电动势
  let needle = 0
  const trace = [] // {t, phi, emf}
  let raf = 0
  let alive = true

  // 磁通量：磁铁中心距线圈的钟形函数
  function flux(x) {
    const u = (x - coilX) / 70
    return 1 / (1 + u * u)
  }

  function step(dt) {
    simClock += dt
    let prevX = magX
    if (scenario === 'auto' && !grabbed) {
      magX = coilX - 150 + Math.sin(2 * Math.PI * freq * simClock) * 130
    } else if (!grabbed) {
      magVel *= 0.94 // 松手后缓停
      magX += magVel * dt
    }
    magX = Math.max(MAG_W / 2 + 8, Math.min(W - MAG_W / 2 - 8, magX))

    const dPhi = flux(magX) - flux(prevX)
    const rawEmf = dt > 0 ? -dPhi / dt : 0
    emf += (rawEmf - emf) * Math.min(1, dt * 14)
    needle += (Math.max(-1, Math.min(1, emf / 5.5)) - needle) * Math.min(1, dt * 10)

    trace.push({ t: simClock, phi: flux(magX), emf: Math.max(-1, Math.min(1, emf / 5.5)) })
    while (trace.length && simClock - trace[0].t > 6) trace.shift()
  }

  function render() {
    ctx.clearRect(0, 0, W, H)

    // 导轨
    ctx.strokeStyle = 'rgba(150, 175, 255, 0.12)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(16, railY)
    ctx.lineTo(W - 16, railY)
    ctx.stroke()

    // 线圈（侧视：一列圆环截面）
    for (let i = 0; i < COIL_N; i += 1) {
      const x = coilX - ((COIL_N - 1) * 14) / 2 + i * 14
      ctx.strokeStyle = 'rgba(210, 190, 150, 0.75)'
      ctx.lineWidth = 2.4
      ctx.beginPath()
      ctx.ellipse(x, railY, 7, 44, 0, 0, Math.PI * 2)
      ctx.stroke()
      // 楞次定律：感应电流方向箭头（环顶小箭头，方向随 emf 正负）
      if (annotations.lenz && Math.abs(needle) > 0.06) {
        const dir = needle > 0 ? 1 : -1
        ctx.fillStyle = 'rgba(120, 220, 235, 0.9)'
        ctx.beginPath()
        ctx.moveTo(x + dir * 4, railY - 48)
        ctx.lineTo(x - dir * 3, railY - 51)
        ctx.lineTo(x - dir * 3, railY - 45)
        ctx.closePath()
        ctx.fill()
      }
    }
    // 楞次：推/拒提示
    if (annotations.lenz && Math.abs(needle) > 0.1) {
      const approaching = needle > 0
      ctx.font = '11px "Songti SC", serif'
      ctx.fillStyle = 'rgba(255, 235, 200, 0.75)'
      ctx.textAlign = 'center'
      ctx.fillText(approaching ? '线圈在推它 →' : '← 线圈在拉它', coilX, railY - 62)
    }

    // 磁铁（N 暖 / S 冷，克制配色）
    const mx = magX - MAG_W / 2
    ctx.fillStyle = 'rgba(255, 150, 110, 0.85)'
    ctx.fillRect(mx, railY - MAG_H / 2, MAG_W / 2, MAG_H)
    ctx.fillStyle = 'rgba(120, 170, 255, 0.85)'
    ctx.fillRect(mx + MAG_W / 2, railY - MAG_H / 2, MAG_W / 2, MAG_H)
    ctx.font = '13px "Avenir Next", sans-serif'
    ctx.fillStyle = 'rgba(10, 12, 24, 0.9)'
    ctx.textAlign = 'center'
    ctx.fillText('N', mx + MAG_W / 4, railY + 5)
    ctx.fillText('S', mx + (3 * MAG_W) / 4, railY + 5)

    // 电流表
    if (annotations.meter) {
      const gx = W * 0.3
      const gy = H * 0.8
      const R = 42
      ctx.strokeStyle = 'rgba(150, 175, 255, 0.3)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(gx, gy, R, Math.PI * 1.15, Math.PI * 1.85)
      ctx.stroke()
      // 刻度中线
      ctx.beginPath()
      ctx.moveTo(gx, gy - R + 6)
      ctx.lineTo(gx, gy - R - 4)
      ctx.stroke()
      // 指针
      const ang = -Math.PI / 2 + needle * 0.95
      ctx.strokeStyle = 'rgba(255, 235, 200, 0.9)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(gx, gy)
      ctx.lineTo(gx + Math.cos(ang) * (R - 4), gy + Math.sin(ang) * (R - 4))
      ctx.stroke()
      ctx.fillStyle = 'rgba(225, 232, 250, 0.5)'
      ctx.font = '10px "Songti SC", serif'
      ctx.fillText('感应电流', gx, gy + 16)
    }

    // Φ 与 ε 滚动曲线
    if (annotations.trace && trace.length > 2) {
      const x0 = W * 0.52
      const w = W * 0.42
      const yPhi = H * 0.74
      const yEmf = H * 0.9
      const t0 = trace[0].t
      const t1 = trace[trace.length - 1].t
      const px = (t) => x0 + ((t - t0) / Math.max(t1 - t0, 0.5)) * w
      ctx.lineWidth = 1.2
      ctx.strokeStyle = 'rgba(255, 200, 130, 0.7)'
      ctx.beginPath()
      trace.forEach((p, i) => {
        const x = px(p.t)
        const y = yPhi - p.phi * 22
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()
      ctx.strokeStyle = 'rgba(120, 220, 235, 0.8)'
      ctx.beginPath()
      trace.forEach((p, i) => {
        const x = px(p.t)
        const y = yEmf - p.emf * 16
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()
      ctx.font = '10px "SF Mono", Menlo, monospace'
      ctx.fillStyle = 'rgba(255, 200, 130, 0.7)'
      ctx.textAlign = 'left'
      ctx.fillText('Φ', x0 - 14, yPhi - 8)
      ctx.fillStyle = 'rgba(120, 220, 235, 0.8)'
      ctx.fillText('ε', x0 - 14, yEmf - 4)
    }

    if (statsEl) {
      statsEl.textContent = grabbed
        ? '推进去、抽出来——看指针'
        : `ε = −dΦ/dt = ${(emf / 5.5).toFixed(2)}　${Math.abs(needle) < 0.03 ? '磁铁不动，什么都不发生' : ''}`
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

  // —— 拖磁铁 ——
  function toLocalX(e) {
    return e.clientX - canvas.getBoundingClientRect().left
  }
  function onDown(e) {
    const x = toLocalX(e)
    const y = e.clientY - canvas.getBoundingClientRect().top
    if (Math.abs(x - magX) < MAG_W / 2 + 12 && Math.abs(y - railY) < MAG_H) {
      grabbed = true
      lastPointerX = x
      canvas.setPointerCapture(e.pointerId)
    }
  }
  function onMove(e) {
    if (!grabbed) return
    const x = toLocalX(e)
    magVel = (x - lastPointerX) * 34
    magX = x
    lastPointerX = x
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
