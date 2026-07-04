// 导览航线：给"不知道从哪看起"的人。
// 选一条航线 → 相机逐站飞行，每站点亮该星的传承脉络，底部字幕讲故事。
// 自动前进按阅读时长计；用户任何拖拽/滚轮立即打断接管——星空是他的了。

import { onLanguageChange, routeCaption, routeShortTitle, routeTitle, t } from '../i18n.js'

const STOP_RADIUS = 460 // 每站的观看距离
const LINGER_END = 4 // 最后一站停留

export function createTourPlayer({ routes, rig, hover, canvas, onStart }) {
  // —— 菜单 ——
  const menu = document.createElement('div')
  menu.className = 'hud hud-styles hud-tours'
  menu.id = 'tourMenu'
  const label = document.createElement('span')
  label.className = 'tour-label'
  label.textContent = t('tour.label')
  menu.appendChild(label)
  routes.forEach((route) => {
    const b = document.createElement('button')
    b.textContent = routeShortTitle(route)
    b.title = routeTitle(route)
    b.dataset.routeId = route.id
    b.addEventListener('click', () => start(route))
    menu.appendChild(b)
  })
  document.body.appendChild(menu)

  // —— 字幕条 ——
  const bar = document.createElement('div')
  bar.id = 'tourBar'
  bar.innerHTML = `
    <div class="tour-head">
      <span class="tour-route"></span>
      <span class="tour-progress"></span>
      <button class="tour-exit" aria-label="">×</button>
    </div>
    <p class="tour-caption"></p>
    <div class="tour-nav">
      <button class="tour-prev"></button>
      <button class="tour-next"></button>
    </div>
    <div class="tour-timer"></div>`
  document.body.appendChild(bar)
  const q = (sel) => bar.querySelector(sel)

  let active = null // { route, stop, wait, total }
  let captionTimer = 0

  function readSeconds(text) {
    return Math.min(Math.max(3 + text.length * 0.1, 5), 8)
  }

  function goToStop(i) {
    const stop = active.route.stops[i]
    active.stop = i
    active.total = readSeconds(routeCaption(active.route, i)) + 1.2 // 加上飞行前摇
    active.wait = active.total
    active.lingering = false
    hover.lock(stop.starId)
    rig.focusOn(hover.getWorldPos(stop.starId), STOP_RADIUS, 70)
    // 字幕淡出→换词→淡入
    bar.classList.add('swap')
    captionTimer = 0.35
    q('.tour-progress').textContent = `${i + 1} / ${active.route.stops.length}`
    q('.tour-prev').disabled = i === 0
    q('.tour-next').textContent = i + 1 === active.route.stops.length ? t('tour.end') : t('tour.next')
  }

  function start(route) {
    onStart?.() // 让主装配收拾现场（关卡片/演示台、回星系透镜）
    active = { route, stop: -1, wait: 0 }
    q('.tour-route').textContent = routeTitle(route)
    bar.classList.add('open')
    menu.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('active', b.dataset.routeId === route.id)
    })
    goToStop(0)
  }

  function end(reason = '') {
    if (!active) return
    active = null
    hover.lock(null)
    bar.classList.remove('open')
    menu.querySelectorAll('button').forEach((b) => b.classList.remove('active'))
    if (reason === 'interrupt') {
      // 交还控制权，不做任何镜头动作——用户已经在拖了
    }
  }

  // 打断接管：导览中的任何主动操作都把星空还给用户
  canvas.addEventListener('pointerdown', () => end('interrupt'))
  canvas.addEventListener('wheel', () => end('interrupt'), { passive: true })
  bar.addEventListener('click', (e) => {
    if (e.target.closest('.tour-exit')) return end()
    if (!active) return
    if (e.target.closest('.tour-prev') && active.stop > 0) goToStop(active.stop - 1)
    if (e.target.closest('.tour-next')) {
      if (active.stop + 1 < active.route.stops.length) goToStop(active.stop + 1)
      else end()
    }
  })
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') end()
  })

  function update(dt) {
    if (!active) return
    if (captionTimer > 0) {
      captionTimer -= dt
      if (captionTimer <= 0) {
        q('.tour-caption').textContent = routeCaption(active.route, active.stop)
        bar.classList.remove('swap')
      }
    }
    // 自动前进的进度线：让"它在走"被看见
    const frac = active.total > 0 ? 1 - Math.max(active.wait, 0) / active.total : 0
    q('.tour-timer').style.width = `${(frac * 100).toFixed(1)}%`
    active.wait -= dt
    if (active.wait <= 0) {
      if (active.stop + 1 < active.route.stops.length) {
        goToStop(active.stop + 1)
      } else if (!active.lingering) {
        active.lingering = true
        active.wait = LINGER_END
      } else {
        end()
      }
    }
  }

  function renderLanguage() {
    label.textContent = t('tour.label')
    q('.tour-exit').setAttribute('aria-label', t('tour.exit'))
    q('.tour-prev').textContent = t('tour.prev')
    routes.forEach((route) => {
      const btn = menu.querySelector(`button[data-route-id="${route.id}"]`)
      if (!btn) return
      btn.textContent = routeShortTitle(route)
      btn.title = routeTitle(route)
    })
    if (active) {
      q('.tour-route').textContent = routeTitle(active.route)
      q('.tour-caption').textContent = routeCaption(active.route, active.stop)
      q('.tour-next').textContent =
        active.stop + 1 === active.route.stops.length ? t('tour.end') : t('tour.next')
    } else {
      q('.tour-next').textContent = t('tour.next')
    }
  }
  onLanguageChange(renderLanguage)
  renderLanguage()

  return {
    update,
    end,
    get isActive() {
      return Boolean(active)
    }
  }
}
