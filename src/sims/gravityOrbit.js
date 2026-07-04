// 万有引力 · 可玩模拟 + 演示台课程
// 卡片模式：抓住行星甩出去，预测椭圆浮现。
// 演示台模式：四步课程——圆轨道受力 → 甩出椭圆 → 等面积定律 → 逃逸。

import { getLanguage } from '../i18n.js'

const G = 12000
const SUN_R = 10
const TRAIL_MAX = 320
const SWEEP_WINDOW = 1.7 // 等面积着色的时间窗（秒）

export const stageConfig = {
  steps: [
    {
      title: { zh: '引力与圆轨道', en: 'Gravity and Circular Orbits' },
      text: {
        zh: '行星每时每刻都在向太阳"坠落"（白色箭头是引力），只是它横向跑得足够快（青色箭头是速度），坠落刚好变成绕圈。苹果和月亮，服从的是同一条定律。',
        en: 'A planet is constantly falling toward the Sun: the white arrow is gravity. It also moves sideways fast enough that falling becomes orbiting. Apples and moons obey the same law.'
      },
      scenario: 'circular',
      annotations: { force: true, velocity: true }
    },
    {
      title: { zh: '亲手甩出椭圆', en: 'Throw an Ellipse' },
      text: {
        zh: '抓住行星，甩出去。松手的瞬间，未来的整条轨道就已经定了——虚线就是它。太阳不在椭圆中心，而在焦点上：这是开普勒第一定律，牛顿用引力把它证了出来。',
        en: 'Grab the planet and throw it. The moment you release, its future orbit is set: the dashed curve shows it. The Sun sits at a focus, not the center of the ellipse.'
      },
      scenario: 'free',
      annotations: { force: true, velocity: true }
    },
    {
      title: { zh: '等面积定律', en: 'Equal Areas' },
      text: {
        zh: '看扫过的扇形：靠近太阳时行星飞快、扇形短而胖；远离时缓慢、扇形长而瘦——但相同时间扫过的面积相同。这是开普勒第二定律，本质是角动量守恒。',
        en: 'Watch the swept wedges: near the Sun the planet moves fast and the sector is short and wide; far away it moves slowly and the sector is long and thin. Equal times sweep equal areas.'
      },
      scenario: 'ellipse',
      annotations: { sweep: true }
    },
    {
      title: { zh: '逃逸', en: 'Escape' },
      text: {
        zh: '把初速度推过临界值 √2·v圆，椭圆"啪"地破开成双曲线，行星一去不返。第一宇宙速度和第二宇宙速度的分野，就在这一下。用滑杆试试临界点。',
        en: 'Push the initial speed past √2 times circular speed and the ellipse opens into an escape path. The slider lets you feel the boundary between orbit and departure.'
      },
      scenario: 'escape',
      annotations: { velocity: true }
    }
  ],
  params: [
    { key: 'vScale', label: { zh: '初速倍率', en: 'Initial speed' }, min: 0.55, max: 1.55, step: 0.01, value: 1 }
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

  const cx = W / 2
  const cy = H / 2
  const R0 = Math.min(W, H) * 0.3

  const planet = { x: cx + R0, y: cy, vx: 0, vy: -Math.sqrt(G / R0) }
  const trail = []
  const sweep = [] // {x, y, t} 等面积着色窗口
  let annotations = {}
  let vScale = 1
  let scenario = 'free'
  let simClock = 0
  let grabbed = false
  let pointerHist = []
  let raf = 0
  let alive = true

  function setScenario(name) {
    scenario = name
    trail.length = 0
    sweep.length = 0
    const v0 = Math.sqrt(G / R0) * vScale
    planet.x = cx + R0
    planet.y = cy
    if (name === 'circular') {
      planet.vx = 0
      planet.vy = -v0
    } else if (name === 'ellipse') {
      planet.vx = 0
      planet.vy = -v0 * 0.72
    } else if (name === 'escape') {
      planet.vx = 0
      planet.vy = -Math.sqrt((2 * G) / R0) * 1.02 * vScale
    } else {
      // free：温和圆轨道起步，等用户来甩
      planet.vx = 0
      planet.vy = -v0
    }
  }
  setScenario('free')

  function orbit() {
    const rx = planet.x - cx
    const ry = planet.y - cy
    const r = Math.hypot(rx, ry)
    const v2 = planet.vx ** 2 + planet.vy ** 2
    const energy = v2 / 2 - G / r
    const L = rx * planet.vy - ry * planet.vx
    const ex = (planet.vy * L) / G - rx / r
    const ey = (-planet.vx * L) / G - ry / r
    const e = Math.hypot(ex, ey)
    const a = energy < 0 ? -G / (2 * energy) : Infinity
    return { r, v: Math.sqrt(v2), e, a, ex, ey, bound: energy < 0 }
  }

  function step(dt) {
    simClock += dt
    if (grabbed) return
    const sub = dt / 4
    for (let i = 0; i < 4; i += 1) {
      const rx = planet.x - cx
      const ry = planet.y - cy
      const r2 = rx * rx + ry * ry
      const r = Math.sqrt(r2)
      const f = -G / (r2 * r)
      planet.vx += rx * f * sub
      planet.vy += ry * f * sub
      planet.x += planet.vx * sub
      planet.y += planet.vy * sub
      if (r < SUN_R + 4 || r > Math.max(W, H) * 2.2) {
        setScenario(scenario)
        return
      }
    }
    trail.push({ x: planet.x, y: planet.y })
    if (trail.length > TRAIL_MAX) trail.shift()
    if (annotations.sweep) {
      sweep.push({ x: planet.x, y: planet.y, t: simClock })
      while (sweep.length && simClock - sweep[0].t > SWEEP_WINDOW) sweep.shift()
    }
  }

  function arrow(x, y, dx, dy, color) {
    const len = Math.hypot(dx, dy)
    if (len < 6) return
    const ux = dx / len
    const uy = dy / len
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + dx, y + dy)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x + dx, y + dy)
    ctx.lineTo(x + dx - ux * 7 - uy * 3.4, y + dy - uy * 7 + ux * 3.4)
    ctx.lineTo(x + dx - ux * 7 + uy * 3.4, y + dy - uy * 7 - ux * 3.4)
    ctx.closePath()
    ctx.fill()
  }

  function drawEllipse(o) {
    if (!o.bound || o.e >= 0.985 || !isFinite(o.a) || o.a > Math.max(W, H) * 2) return
    const b = o.a * Math.sqrt(1 - o.e * o.e)
    const phi = Math.atan2(o.ey, o.ex)
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(phi)
    ctx.translate(-o.a * o.e, 0)
    ctx.beginPath()
    ctx.ellipse(0, 0, o.a, b, 0, 0, Math.PI * 2)
    ctx.setLineDash([3, 7])
    ctx.strokeStyle = 'rgba(150, 190, 255, 0.28)'
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.restore()
  }

  function render() {
    ctx.clearRect(0, 0, W, H)
    const o = orbit()

    // 等面积扇形：太阳→最近一段轨迹围成的区域
    if (annotations.sweep && sweep.length > 2) {
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      sweep.forEach((p) => ctx.lineTo(p.x, p.y))
      ctx.closePath()
      ctx.fillStyle = 'rgba(77, 230, 217, 0.14)'
      ctx.fill()
      ctx.strokeStyle = 'rgba(77, 230, 217, 0.35)'
      ctx.lineWidth = 1
      ctx.stroke()
    }

    for (let i = 1; i < trail.length; i += 1) {
      const t = i / trail.length
      ctx.strokeStyle = `rgba(140, 200, 255, ${t * 0.4})`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(trail[i - 1].x, trail[i - 1].y)
      ctx.lineTo(trail[i].x, trail[i].y)
      ctx.stroke()
    }

    drawEllipse(o)

    const sun = ctx.createRadialGradient(cx, cy, 0, cx, cy, 30)
    sun.addColorStop(0, 'rgba(255, 244, 224, 1)')
    sun.addColorStop(0.25, 'rgba(255, 208, 130, 0.85)')
    sun.addColorStop(1, 'rgba(255, 170, 80, 0)')
    ctx.fillStyle = sun
    ctx.beginPath()
    ctx.arc(cx, cy, 30, 0, Math.PI * 2)
    ctx.fill()

    const glow = ctx.createRadialGradient(planet.x, planet.y, 0, planet.x, planet.y, 12)
    glow.addColorStop(0, 'rgba(190, 235, 255, 1)')
    glow.addColorStop(0.35, 'rgba(120, 200, 255, 0.5)')
    glow.addColorStop(1, 'rgba(120, 200, 255, 0)')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(planet.x, planet.y, 12, 0, Math.PI * 2)
    ctx.fill()

    // 矢量标注：引力（暖白，指向太阳）与速度（青）
    if (annotations.force) {
      const rx = cx - planet.x
      const ry = cy - planet.y
      const r = Math.hypot(rx, ry)
      const fRel = Math.min(1.4, (R0 * R0) / (r * r)) // 以 R0 处的力为基准
      const len = 16 + fRel * 30
      arrow(planet.x, planet.y, (rx / r) * len, (ry / r) * len, 'rgba(255, 235, 200, 0.85)')
    }
    if (annotations.velocity) {
      const vRef = Math.sqrt(G / R0)
      const len = (o.v / vRef) * 30
      arrow(planet.x, planet.y, (planet.vx / o.v) * len, (planet.vy / o.v) * len, 'rgba(120, 220, 235, 0.9)')
    }

    if (statsEl) {
      const F = (G / (o.r * o.r)) * 1000
      statsEl.textContent = grabbed
        ? getLanguage() === 'en' ? 'release to throw it' : '松手，把它甩出去'
        : `r = ${o.r.toFixed(0)}　v = ${o.v.toFixed(1)}　F ∝ 1/r² = ${F.toFixed(2)}　e = ${
          o.bound ? o.e.toFixed(2) : getLanguage() === 'en' ? '≥1 escape' : '≥1 逃逸'
        }`
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

  function toLocal(e) {
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, t: performance.now() }
  }
  function onDown(e) {
    const p = toLocal(e)
    if (Math.hypot(p.x - planet.x, p.y - planet.y) < 34) {
      grabbed = true
      pointerHist = [p]
      canvas.setPointerCapture(e.pointerId)
    }
  }
  function onMove(e) {
    if (!grabbed) return
    const p = toLocal(e)
    planet.x = p.x
    planet.y = p.y
    pointerHist.push(p)
    if (pointerHist.length > 6) pointerHist.shift()
    trail.length = 0
    sweep.length = 0
  }
  function onUp() {
    if (!grabbed) return
    grabbed = false
    if (pointerHist.length >= 2) {
      const a = pointerHist[0]
      const b = pointerHist[pointerHist.length - 1]
      const dt = Math.max((b.t - a.t) / 1000, 0.016)
      planet.vx = ((b.x - a.x) / dt) * 0.9
      planet.vy = ((b.y - a.y) / dt) * 0.9
    }
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
      setScenario(name)
      render()
    },
    setAnnotations(a) {
      annotations = a || {}
      sweep.length = 0
      render()
    },
    setParam(key, value) {
      if (key === 'vScale') {
        vScale = value
        setScenario(scenario)
        render()
      }
    }
  }
}
