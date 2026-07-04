// 牛顿运动定律 · 演示台课程（深空实验室版）
// ① 两个世界：真空带 vs 摩擦带，同一次发射同时出发——让东西停下的是摩擦
// ② 点火与熄火：推进器尾焰 + 速度表——力在，加速度在；熄火，速度不回落
// ③ 太空互推：两名宇航员掌心相抵——你永远无法只推别人不推自己
// ④ 永远在坠落：卫星绕行星，关掉引力沿切线飞走——轨道 = 错过地面的直线飞行

const G_ACC = 9.8
const SCALE = 6 // px per meter
const THRUST = 14 // 推进器推力 N

export const stageConfig = {
  steps: [
    {
      title: '两个世界',
      text: '同一次发射，两条冰道：上面是没有摩擦的真空带，下面铺着木板。上面的冰球永远滑下去，下面的很快停住——让东西停下的从来不是"运动会耗尽"，是摩擦这只看不见的手。亲手甩一个试试：两个世界永远同步出发。',
      scenario: 'worlds',
      annotations: { calc: true }
    },
    {
      title: '点火与熄火',
      text: '按住画布点火：尾焰喷出，速度表指针一路爬——力在，加速度就在。松手熄火：指针停在原地，不回落。太空里没有摩擦，熄火的飞船永远不会停。再拖"载荷质量"：同样的火，越重推得越慢——a = F/m。',
      scenario: 'thrust',
      annotations: { calc: true, gauge: true }
    },
    {
      title: '太空互推',
      text: '两名宇航员掌心相抵。按「互推」：两人同时向后漂开——你永远无法只推别人而不推自己。拖质量比，让一个背上重装备：重的漂得慢，但 m×v 两边永远相等。火箭喷出燃气、燃气推回火箭，就是这一下。',
      scenario: 'push',
      annotations: { momentum: true }
    },
    {
      title: '永远在坠落',
      text: '卫星绕着行星转：速度大小从不变，方向却一直被引力掰弯——拐弯也是加速度，引力就是那只手。点一下画布，关掉引力：它沿切线直直飞走（第一定律！）。行星绕太阳，本质是一场永远在坠落、却永远错过的直线飞行。',
      scenario: 'orbit',
      annotations: { calc: true }
    }
  ],
  params: [
    {
      type: 'chips',
      key: 'mu',
      label: '摩擦带材质（下道）',
      value: 0.3,
      options: [
        { label: '冰面', value: 0.02 },
        { label: '木板', value: 0.3 },
        { label: '橡胶', value: 0.7 }
      ]
    },
    { key: 'm', label: '载荷质量 m (kg)', min: 1, max: 8, step: 0.1, value: 2 },
    { key: 'ratio', label: '质量比 m₂/m₁', min: 0.5, max: 4, step: 0.1, value: 2 },
    { type: 'button', key: 'push', label: '互推 ⇄ / 复位' }
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

  let scenario = 'worlds'
  let annotations = { calc: true }
  let mu = 0.3
  let mass = 2
  let ratio = 2
  let simClock = 0
  let raf = 0
  let alive = true

  // —— ① 两个世界 ——
  const laneTop = H * 0.36
  const laneBot = H * 0.68
  const worlds = {
    top: { x: 0, v: 0 }, // 真空带
    bot: { x: 0, v: 0 }, // 摩擦带
    launchTimer: 0,
    odoTop: 0,
    odoBot: 0
  }
  const skids = []
  let grabbed = null // 'top' | 'bot' | null
  let pointerHist = []

  function launchWorlds(x = W * 0.14, v = 5.5) {
    worlds.top.x = x
    worlds.bot.x = x
    worlds.top.v = v
    worlds.bot.v = v
    worlds.odoTop = 0
    worlds.odoBot = 0
    skids.length = 0
    worlds.launchTimer = 0
  }

  // —— ② 点火与熄火 ——
  const ship = { x: W * 0.3, v: 0, thrustDir: 0 }
  const exhaust = [] // {x, y, vx, vy, age}
  let shipOdo = 0

  // —— ③ 太空互推 ——
  const duo = { released: false, x1: 0, x2: 0, v1: 0, v2: 0, flash: 0, y: H * 0.5 }
  const M1 = 90 // 宇航员1（kg，含装备基数）
  function resetDuo() {
    duo.released = false
    duo.x1 = W / 2 - 44
    duo.x2 = W / 2 + 44
    duo.v1 = 0
    duo.v2 = 0
    duo.flash = 0
  }

  // —— ④ 永远在坠落 ——
  const orbit = {
    cx: W * 0.5,
    cy: H * 0.47,
    R: Math.min(H * 0.26, 125),
    theta: -Math.PI / 2,
    vT: 3.0,
    cut: false,
    fx: 0,
    fy: 0,
    fvx: 0,
    fvy: 0,
    timer: 0
  }
  function resetOrbit() {
    orbit.theta = -Math.PI / 2
    orbit.cut = false
    orbit.timer = 0
  }

  // ============ 物理推进 ============
  function step(dt) {
    simClock += dt
    if (scenario === 'worlds') {
      // 真空带：永不减速
      if (grabbed !== 'top') {
        worlds.top.x += worlds.top.v * SCALE * dt
        worlds.odoTop += Math.abs(worlds.top.v) * dt
        if (worlds.top.x > W + 30) worlds.top.x -= W + 60
      }
      // 摩擦带：f = μmg 减速
      if (grabbed !== 'bot') {
        const b = worlds.bot
        if (b.v !== 0) {
          const a = -Math.sign(b.v) * mu * G_ACC
          const v0 = b.v
          b.v += a * dt
          if (Math.sign(b.v) !== Math.sign(v0)) b.v = 0
          b.x += b.v * SCALE * dt
          worlds.odoBot += Math.abs(b.v) * dt
          if (Math.abs(b.v) > 0.6) skids.push({ x: b.x, age: 0 })
          if (b.x > W + 30) b.x -= W + 60
        }
      }
      skids.forEach((s) => (s.age += dt))
      while (skids.length && skids[0].age > 2) skids.shift()
      // 摩擦带停稳后，隔 2.4s 自动重新同步发射（打开永远是活的）
      if (worlds.bot.v === 0 && !grabbed) {
        worlds.launchTimer += dt
        if (worlds.launchTimer > 2.4) launchWorlds()
      }
    } else if (scenario === 'thrust') {
      const mTot = mass
      if (ship.thrustDir !== 0) {
        ship.v += ((ship.thrustDir * THRUST) / mTot) * dt
        // 尾焰粒子
        for (let i = 0; i < 3; i += 1) {
          exhaust.push({
            x: ship.x - ship.thrustDir * (26 + mass * 2),
            y: H * 0.5 + (Math.random() - 0.5) * 8,
            vx: -ship.thrustDir * (60 + Math.random() * 90) + ship.v * SCALE * 0.4,
            vy: (Math.random() - 0.5) * 34,
            age: 0
          })
        }
      }
      ship.v = Math.max(-12, Math.min(12, ship.v))
      ship.x += ship.v * SCALE * dt
      shipOdo += Math.abs(ship.v) * dt
      if (ship.x > W + 40) ship.x -= W + 80
      if (ship.x < -40) ship.x += W + 80
      exhaust.forEach((p) => {
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.age += dt
      })
      while (exhaust.length && exhaust[0].age > 0.7) exhaust.shift()
    } else if (scenario === 'push') {
      if (duo.released) {
        duo.x1 += duo.v1 * SCALE * dt
        duo.x2 += duo.v2 * SCALE * dt
        duo.flash = Math.max(0, duo.flash - dt * 2.6)
        if (duo.x1 < -50 || duo.x2 > W + 50) resetDuo()
      }
    } else if (scenario === 'orbit') {
      if (!orbit.cut) {
        orbit.theta += ((orbit.vT * SCALE) / orbit.R) * dt
      } else {
        orbit.fx += orbit.fvx * dt
        orbit.fy += orbit.fvy * dt
        orbit.timer += dt
        const out = orbit.fx < -60 || orbit.fx > W + 60 || orbit.fy < -60 || orbit.fy > H + 60
        if (out || orbit.timer > 3.4) resetOrbit()
      }
    }
  }

  // ============ 绘制 ============
  function arrow(x, y, dx, dy, color, width = 1.8) {
    const len = Math.hypot(dx, dy)
    if (len < 5) return
    const ux = dx / len
    const uy = dy / len
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.lineWidth = width
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + dx, y + dy)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x + dx, y + dy)
    ctx.lineTo(x + dx - ux * 8 - uy * 4, y + dy - uy * 8 + ux * 4)
    ctx.lineTo(x + dx - ux * 8 + uy * 4, y + dy - uy * 8 - ux * 4)
    ctx.closePath()
    ctx.fill()
  }

  function dots() {
    ctx.fillStyle = 'rgba(150, 175, 255, 0.06)'
    for (let gy = 30; gy < H - 20; gy += 44) {
      for (let gx = 24; gx < W; gx += 46) ctx.fillRect(gx, gy, 1.5, 1.5)
    }
  }

  // 发光冰球
  function puck(x, y, color = '150, 200, 255') {
    const g = ctx.createRadialGradient(x, y, 0, x, y, 16)
    g.addColorStop(0, `rgba(${color}, 1)`)
    g.addColorStop(0.45, `rgba(${color}, 0.55)`)
    g.addColorStop(1, `rgba(${color}, 0)`)
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, 16, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(235, 245, 255, 0.95)'
    ctx.beginPath()
    ctx.arc(x, y, 6.5, 0, Math.PI * 2)
    ctx.fill()
  }

  // 推进器：舱体 + 喷口 + 可选载荷舱
  function thruster(x, y, dir) {
    const bodyW = 34 + mass * 2
    const g = ctx.createLinearGradient(x, y - 12, x, y + 12)
    g.addColorStop(0, 'rgba(170, 195, 250, 0.95)')
    g.addColorStop(1, 'rgba(100, 125, 200, 0.95)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.roundRect(x - bodyW / 2, y - 11, bodyW, 22, 10)
    ctx.fill()
    // 舷窗
    ctx.fillStyle = 'rgba(120, 220, 235, 0.9)'
    ctx.beginPath()
    ctx.arc(x + bodyW / 4, y, 4, 0, Math.PI * 2)
    ctx.fill()
    // 喷口
    ctx.fillStyle = 'rgba(90, 110, 175, 0.95)'
    ctx.beginPath()
    ctx.moveTo(x - bodyW / 2, y - 7)
    ctx.lineTo(x - bodyW / 2 - 8, y - 10)
    ctx.lineTo(x - bodyW / 2 - 8, y + 10)
    ctx.lineTo(x - bodyW / 2, y + 7)
    ctx.closePath()
    ctx.fill()
    // 载荷标签
    ctx.font = '10px "SF Mono", Menlo, monospace'
    ctx.fillStyle = 'rgba(8, 10, 22, 0.9)'
    ctx.textAlign = 'center'
    ctx.fillText(`${mass.toFixed(1)}kg`, x - 2, y + 3.5)
  }

  // 宇航员：头盔 + 躯干 + 可选背包（质量可视化）
  function astronaut(x, y, m, face) {
    const s = 1.35 + (m / 90) * 0.55 // 越重越壮
    // 背包
    ctx.fillStyle = 'rgba(110, 130, 200, 0.85)'
    ctx.beginPath()
    ctx.roundRect(x - face * (14 * s + 8), y - 10 * s, 9 * s + (m > 120 ? 6 : 0), 22 * s, 4)
    ctx.fill()
    // 躯干
    const g = ctx.createLinearGradient(x, y - 14 * s, x, y + 16 * s)
    g.addColorStop(0, 'rgba(210, 220, 245, 0.95)')
    g.addColorStop(1, 'rgba(140, 155, 210, 0.95)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.roundRect(x - 9 * s, y - 8 * s, 18 * s, 26 * s, 7)
    ctx.fill()
    // 头盔
    ctx.beginPath()
    ctx.arc(x, y - 16 * s, 9 * s, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(60, 80, 140, 0.9)'
    ctx.beginPath()
    ctx.arc(x + face * 2.4 * s, y - 16 * s, 5.4 * s, 0, Math.PI * 2)
    ctx.fill()
    // 手臂（伸向对方）
    ctx.strokeStyle = 'rgba(190, 205, 240, 0.9)'
    ctx.lineWidth = 4 * s
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(x + face * 8 * s, y - 2 * s)
    ctx.lineTo(x + face * 18 * s, y - 4 * s)
    ctx.stroke()
    // 质量标签
    ctx.font = '10px "SF Mono", Menlo, monospace'
    ctx.fillStyle = 'rgba(160, 200, 255, 0.65)'
    ctx.textAlign = 'center'
    ctx.fillText(`${m.toFixed(0)}kg`, x, y + 30 * s)
  }

  // 速度仪表盘
  function gauge(cx, cy, v, vMax = 12) {
    const R = 40
    const a0 = Math.PI * 0.8
    const a1 = Math.PI * 2.2
    ctx.strokeStyle = 'rgba(150, 175, 255, 0.28)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(cx, cy, R, a0, a1)
    ctx.stroke()
    // 刻度
    for (let i = 0; i <= 6; i += 1) {
      const a = a0 + ((a1 - a0) * i) / 6
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(a) * (R - 4), cy + Math.sin(a) * (R - 4))
      ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R)
      ctx.stroke()
    }
    const a = a0 + (a1 - a0) * Math.min(Math.abs(v) / vMax, 1)
    ctx.strokeStyle = 'rgba(120, 220, 235, 0.95)'
    ctx.lineWidth = 2.2
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + Math.cos(a) * (R - 8), cy + Math.sin(a) * (R - 8))
    ctx.stroke()
    ctx.font = '10.5px "SF Mono", Menlo, monospace'
    ctx.fillStyle = 'rgba(120, 220, 235, 0.85)'
    ctx.textAlign = 'center'
    ctx.fillText(`${Math.abs(v).toFixed(1)} m/s`, cx, cy + 18)
  }

  function drawCalc(lines) {
    ctx.font = '11.5px "SF Mono", Menlo, monospace'
    ctx.textAlign = 'left'
    lines.forEach(([text, color], i) => {
      ctx.fillStyle = color
      ctx.fillText(text, 16, 26 + i * 18)
    })
  }

  function lane(y, label, tint) {
    ctx.strokeStyle = `rgba(${tint}, 0.35)`
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()
    ctx.font = '10.5px "Songti SC", serif'
    ctx.fillStyle = `rgba(${tint}, 0.6)`
    ctx.textAlign = 'left'
    ctx.fillText(label, 16, y + 16)
  }

  function render() {
    ctx.clearRect(0, 0, W, H)
    dots()

    if (scenario === 'worlds') {
      lane(laneTop, '真 空 带 · μ = 0', '120, 220, 235')
      lane(laneBot, `摩 擦 带 · μ = ${mu.toFixed(2)}`, '255, 170, 120')
      // 刹车痕
      skids.forEach((s) => {
        ctx.fillStyle = `rgba(255, 150, 100, ${0.28 * (1 - s.age / 2)})`
        ctx.fillRect(s.x - 6, laneBot - 2, 12, 2)
      })
      puck(worlds.top.x, laneTop - 14, '120, 220, 235')
      puck(worlds.bot.x, laneBot - 14, '255, 190, 140')
      // 位移对比
      ctx.font = '11px "SF Mono", Menlo, monospace'
      ctx.textAlign = 'right'
      ctx.fillStyle = 'rgba(120, 220, 235, 0.7)'
      ctx.fillText(`${worlds.odoTop.toFixed(1)} m`, W - 16, laneTop - 30)
      ctx.fillStyle = 'rgba(255, 190, 140, 0.7)'
      ctx.fillText(`${worlds.odoBot.toFixed(1)} m`, W - 16, laneBot - 30)
      if (annotations.calc) {
        drawCalc([
          ['真空带：ΣF = 0 → v 恒定，永不停', 'rgba(120, 220, 235, 0.9)'],
          [`摩擦带：f = μmg = ${(mu * 1 * G_ACC).toFixed(2)} N/kg·m`, 'rgba(255, 170, 120, 0.9)'],
          ['唯一的区别：摩擦', 'rgba(235, 240, 255, 0.75)']
        ])
      }
    } else if (scenario === 'thrust') {
      // 尾焰
      exhaust.forEach((p) => {
        const life = 1 - p.age / 0.7
        ctx.fillStyle = `rgba(255, ${150 + life * 90}, ${80 + life * 60}, ${life * 0.55})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, 1.4 + (1 - life) * 3.2, 0, Math.PI * 2)
        ctx.fill()
      })
      thruster(ship.x, H * 0.5, ship.thrustDir)
      if (Math.abs(ship.v) > 0.3) arrow(ship.x, H * 0.5 - 34, ship.v * 6.5, 0, 'rgba(120, 220, 235, 0.95)')
      if (ship.thrustDir !== 0) {
        arrow(ship.x - ship.thrustDir * 70, H * 0.5 + 26, ship.thrustDir * 34, 0, 'rgba(255, 240, 220, 0.95)', 2.2)
        ctx.font = '10px "SF Mono", Menlo, monospace'
        ctx.fillStyle = 'rgba(255, 240, 220, 0.8)'
        ctx.textAlign = 'center'
        ctx.fillText(`F = ${THRUST} N`, ship.x - ship.thrustDir * 55, H * 0.5 + 44)
      }
      if (annotations.gauge) gauge(W - 74, H - 66, ship.v)
      if (annotations.calc) {
        const a = ship.thrustDir !== 0 ? THRUST / mass : 0
        drawCalc([
          [`推力 F = ${ship.thrustDir !== 0 ? THRUST : 0} N`, 'rgba(255, 240, 220, 0.9)'],
          [`a = F/m = ${a.toFixed(2)} m/s²`, 'rgba(120, 220, 235, 0.9)'],
          [`v = ${Math.abs(ship.v).toFixed(1)} m/s ${ship.thrustDir !== 0 ? '（在变）' : '（不变——熄火≠停下）'}`, 'rgba(235, 240, 255, 0.8)']
        ])
      }
      if (ship.thrustDir === 0 && Math.abs(ship.v) < 0.2) {
        ctx.font = '11px "Songti SC", serif'
        ctx.fillStyle = 'rgba(235, 240, 255, 0.4)'
        ctx.textAlign = 'center'
        ctx.fillText('按 住 画 布 左 / 右 侧 点 火', W / 2, H * 0.82)
      }
    } else if (scenario === 'push') {
      const m2 = M1 * ratio
      astronaut(duo.x1, duo.y, M1, 1)
      astronaut(duo.x2, duo.y, m2, -1)
      if (duo.flash > 0) {
        arrow(duo.x1 - 6, duo.y - 44, -34 * duo.flash - 14, 0, 'rgba(255, 240, 220, 0.95)', 2.2)
        arrow(duo.x2 + 6, duo.y - 44, 34 * duo.flash + 14, 0, 'rgba(255, 240, 220, 0.95)', 2.2)
      }
      if (duo.released) {
        if (Math.abs(duo.v1) > 0.1) arrow(duo.x1, duo.y - 58, duo.v1 * 16, 0, 'rgba(120, 220, 235, 0.95)')
        if (Math.abs(duo.v2) > 0.1) arrow(duo.x2, duo.y - 58, duo.v2 * 16, 0, 'rgba(120, 220, 235, 0.95)')
      }
      if (annotations.momentum && duo.released) {
        drawCalc([
          [`m₁v₁ = ${(M1 * Math.abs(duo.v1)).toFixed(0)} kg·m/s ←`, 'rgba(120, 220, 235, 0.9)'],
          [`m₂v₂ = ${(M1 * ratio * Math.abs(duo.v2)).toFixed(0)} kg·m/s →`, 'rgba(120, 220, 235, 0.9)'],
          ['等大 · 反向 · 同时', 'rgba(255, 235, 200, 0.85)']
        ])
      }
    } else if (scenario === 'orbit') {
      // 行星：体积感小星球 + 大气辉光
      const pg = ctx.createRadialGradient(orbit.cx - 4, orbit.cy - 5, 0, orbit.cx, orbit.cy, 26)
      pg.addColorStop(0, 'rgba(255, 225, 180, 1)')
      pg.addColorStop(0.5, 'rgba(230, 170, 110, 0.95)')
      pg.addColorStop(1, 'rgba(160, 110, 70, 0.9)')
      ctx.fillStyle = pg
      ctx.beginPath()
      ctx.arc(orbit.cx, orbit.cy, 18, 0, Math.PI * 2)
      ctx.fill()
      const halo = ctx.createRadialGradient(orbit.cx, orbit.cy, 18, orbit.cx, orbit.cy, 34)
      halo.addColorStop(0, 'rgba(255, 210, 150, 0.25)')
      halo.addColorStop(1, 'rgba(255, 210, 150, 0)')
      ctx.fillStyle = halo
      ctx.beginPath()
      ctx.arc(orbit.cx, orbit.cy, 34, 0, Math.PI * 2)
      ctx.fill()
      // 轨道虚线
      ctx.strokeStyle = 'rgba(150, 175, 255, 0.16)'
      ctx.setLineDash([3, 7])
      ctx.beginPath()
      ctx.arc(orbit.cx, orbit.cy, orbit.R, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])

      let bx
      let by
      if (!orbit.cut) {
        bx = orbit.cx + Math.cos(orbit.theta) * orbit.R
        by = orbit.cy + Math.sin(orbit.theta) * orbit.R
        // 引力（白，指向行星）与速度（青，切向）
        arrow(bx, by, ((orbit.cx - bx) / orbit.R) * 42, ((orbit.cy - by) / orbit.R) * 42, 'rgba(255, 240, 220, 0.95)', 2)
        arrow(bx, by, -Math.sin(orbit.theta) * orbit.vT * 11, Math.cos(orbit.theta) * orbit.vT * 11, 'rgba(120, 220, 235, 0.95)')
        ctx.font = '10px "Songti SC", serif'
        ctx.fillStyle = 'rgba(255, 240, 220, 0.6)'
        ctx.textAlign = 'center'
        ctx.fillText('引力', bx + ((orbit.cx - bx) / orbit.R) * 24, by + ((orbit.cy - by) / orbit.R) * 24 - 6)
      } else {
        bx = orbit.fx
        by = orbit.fy
        arrow(bx, by, orbit.fvx * 0.36, orbit.fvy * 0.36, 'rgba(120, 220, 235, 0.95)')
        ctx.font = '11px "Songti SC", serif'
        ctx.fillStyle = 'rgba(255, 235, 200, 0.75)'
        ctx.textAlign = 'center'
        ctx.fillText('引力关了——沿切线直线飞出（第一定律）', orbit.cx, orbit.cy - orbit.R - 18)
      }
      puck(bx, by, '150, 200, 255')

      if (annotations.calc && !orbit.cut) {
        const Fc = (mass * orbit.vT * orbit.vT) / (orbit.R / SCALE)
        drawCalc([
          ['|v| 不变 · 方向一直在变 = 加速度', 'rgba(120, 220, 235, 0.9)'],
          [`F引力 = mv²/R = ${Fc.toFixed(2)} N → 指向行星`, 'rgba(255, 240, 220, 0.9)'],
          ['点一下画布：关掉引力', 'rgba(235, 240, 255, 0.5)']
        ])
      }
    }

    // 状态陈述行
    if (statsEl) {
      if (scenario === 'worlds') {
        statsEl.textContent = grabbed
          ? '甩出去——两个世界同步出发'
          : worlds.bot.v === 0
            ? '摩擦带停了 · 真空带还在滑（即将重新发射）'
            : '同样的出发 · 不同的世界'
      } else if (scenario === 'thrust') {
        statsEl.textContent =
          ship.thrustDir !== 0 ? '点火中 · 加速度存在，速度在爬' : Math.abs(ship.v) > 0.2 ? '熄火 · 速度保持不变' : '按住画布点火'
      } else if (scenario === 'push') {
        statsEl.textContent = duo.released ? '总动量 = 0，和互推前一样' : '掌心相抵 · 按「互推」'
      } else {
        statsEl.textContent = orbit.cut ? '没有力 · 匀速直线（第一定律）' : '引力提供向心力 · 这就是轨道'
      }
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

  // ============ 交互 ============
  function local(e) {
    const r = canvas.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() }
  }
  function onDown(e) {
    const p = local(e)
    if (scenario === 'worlds') {
      if (Math.hypot(p.x - worlds.top.x, p.y - (laneTop - 14)) < 26) grabbed = 'top'
      else if (Math.hypot(p.x - worlds.bot.x, p.y - (laneBot - 14)) < 26) grabbed = 'bot'
      if (grabbed) {
        pointerHist = [p]
        canvas.setPointerCapture(e.pointerId)
      }
    } else if (scenario === 'thrust') {
      ship.thrustDir = p.x < ship.x ? 1 : -1
      canvas.setPointerCapture(e.pointerId)
    } else if (scenario === 'orbit' && !orbit.cut) {
      const bx = orbit.cx + Math.cos(orbit.theta) * orbit.R
      const by = orbit.cy + Math.sin(orbit.theta) * orbit.R
      orbit.cut = true
      orbit.fx = bx
      orbit.fy = by
      orbit.fvx = -Math.sin(orbit.theta) * orbit.vT * SCALE
      orbit.fvy = Math.cos(orbit.theta) * orbit.vT * SCALE
      orbit.timer = 0
    }
  }
  function onMove(e) {
    if (scenario !== 'worlds' || !grabbed) return
    const p = local(e)
    worlds[grabbed].x = p.x
    worlds[grabbed].v = 0
    pointerHist.push(p)
    if (pointerHist.length > 6) pointerHist.shift()
  }
  function onUp() {
    if (scenario === 'worlds' && grabbed && pointerHist.length >= 2) {
      const a = pointerHist[0]
      const b = pointerHist[pointerHist.length - 1]
      const dt = Math.max((b.t - a.t) / 1000, 0.016)
      const v = (b.x - a.x) / dt / SCALE
      // 两个世界同步出发：同一位置、同一初速
      launchWorlds(worlds[grabbed].x, v)
    }
    grabbed = null
    ship.thrustDir = 0
  }

  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerup', onUp)
  canvas.addEventListener('pointercancel', onUp)

  launchWorlds() // 打开即是活的

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
      grabbed = null
      ship.thrustDir = 0
      if (name === 'worlds') launchWorlds()
      if (name === 'thrust') {
        ship.x = W * 0.3
        ship.v = 0
        shipOdo = 0
        exhaust.length = 0
      }
      if (name === 'push') resetDuo()
      if (name === 'orbit') resetOrbit()
      render()
    },
    setAnnotations(a) {
      annotations = a || {}
      render()
    },
    setParam(key, value) {
      if (key === 'mu') mu = value
      if (key === 'm') mass = value
      if (key === 'ratio') {
        ratio = value
        if (scenario === 'push') resetDuo()
      }
      if (key === 'push' && scenario === 'push') {
        if (duo.released) {
          resetDuo()
        } else {
          const J = 140 // 冲量 kg·m/s
          duo.released = true
          duo.v1 = -J / M1
          duo.v2 = J / (M1 * ratio)
          duo.flash = 1
        }
      }
      render()
    }
  }
}
