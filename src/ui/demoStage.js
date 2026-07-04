import katex from 'katex'
import { BRANCHES } from '../data/branches.js'
import { loadSimModule } from '../sims/simHost.js'
import { formatStageMeta, localize, onLanguageChange, starName, t } from '../i18n.js'

// 演示台：近全屏的"教学仪器"。
// 左：大画布模拟；右：分步课程——每一步一段人话讲解，并把模拟切到对应场景。
// 目的只有一个：让人看懂这条定理。

export function createDemoStage() {
  const root = document.createElement('div')
  root.id = 'demoStage'
  root.innerHTML = `
    <div class="stage-frame">
      <header class="stage-head">
        <div class="stage-meta"><i class="stage-dot"></i><span class="stage-branch"></span></div>
        <h2 class="stage-title"></h2>
        <div class="stage-eq"></div>
        <button class="stage-close" aria-label="关闭">×</button>
      </header>
      <div class="stage-body">
        <div class="stage-canvaswrap">
          <canvas class="stage-canvas"></canvas>
          <div class="stage-stats"></div>
        </div>
        <aside class="stage-panel">
          <nav class="stage-steps"></nav>
          <p class="stage-text"></p>
          <div class="stage-params"></div>
        </aside>
      </div>
    </div>`
  document.body.appendChild(root)

  const q = (sel) => root.querySelector(sel)
  let sim = null
  let config = null
  let currentMod = null
  let currentStar = null
  let activeStep = 0
  let lastMountW = 0
  let onCloseCb = null

  function applyStep(i) {
    if (!sim || !config) return
    activeStep = i
    const step = config.steps[i]
    sim.setScenario?.(step.scenario)
    sim.setAnnotations?.(step.annotations)
    q('.stage-text').textContent = localize(step.text)
    q('.stage-steps')
      .querySelectorAll('button')
      .forEach((b, k) => b.classList.toggle('active', k === i))
  }

  function buildSteps() {
    const nav = q('.stage-steps')
    nav.textContent = ''
    config.steps.forEach((step, i) => {
      const b = document.createElement('button')
      const em = document.createElement('em')
      em.textContent = String(i + 1)
      b.append(em, localize(step.title))
      b.addEventListener('click', () => applyStep(i))
      nav.appendChild(b)
    })
  }

  function buildParams() {
    const wrap = q('.stage-params')
    wrap.textContent = ''
    ;(config.params || []).forEach((p) => {
      if (p.type === 'button') {
        const b = document.createElement('button')
        b.className = 'stage-action'
        b.textContent = localize(p.label)
        b.addEventListener('click', () => sim?.setParam?.(p.key, 1))
        wrap.appendChild(b)
        return
      }
      if (p.type === 'chips') {
        // 预设片：一排小胶囊，一键设值（如地面材质 → 摩擦系数）
        const row = document.createElement('div')
        row.className = 'stage-chiprow'
        const name = document.createElement('span')
        name.textContent = localize(p.label)
        const chips = document.createElement('div')
        chips.className = 'stage-chips'
        p.options.forEach((o) => {
          const b = document.createElement('button')
          b.textContent = localize(o.label)
          if (o.value === p.value) b.classList.add('active')
          b.addEventListener('click', () => {
            sim?.setParam?.(p.key, o.value)
            chips.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b))
          })
          chips.appendChild(b)
        })
        row.append(name, chips)
        wrap.appendChild(row)
        return
      }
      const row = document.createElement('label')
      row.className = 'stage-param'
      const name = document.createElement('span')
      name.textContent = localize(p.label)
      const input = document.createElement('input')
      input.type = 'range'
      input.min = p.min
      input.max = p.max
      input.step = p.step
      input.value = p.value
      const val = document.createElement('i')
      val.textContent = Number(p.value).toFixed(2)
      input.addEventListener('input', () => {
        sim?.setParam?.(p.key, Number(input.value))
        val.textContent = Number(input.value).toFixed(2)
      })
      row.append(name, input, val)
      wrap.appendChild(row)
    })
  }

  let openSeq = 0

  async function open(star) {
    const seq = ++openSeq
    const mod = await loadSimModule(star.simId)
    if (!mod?.stageConfig) return false
    if (seq !== openSeq) return false // 期间又开了别的星，本次作废

    destroySim()
    currentStar = star
    config = mod.stageConfig

    const branch = BRANCHES[star.branch]
    q('.stage-dot').style.background = branch.color
    q('.stage-branch').textContent = formatStageMeta(star)
    q('.stage-title').textContent = starName(star)
    q('.stage-close').setAttribute('aria-label', t('stage.close'))
    try {
      katex.render(star.equation, q('.stage-eq'), { displayMode: false, throwOnError: true })
    } catch {
      q('.stage-eq').textContent = star.equation
    }

    buildSteps()
    buildParams()
    root.classList.add('open')
    currentMod = mod
    activeStep = 0
    lastMountW = 0

    // 等布局定型再挂载；若此刻画布尺寸仍未就绪，ResizeObserver 会在定型后补挂。
    // （不能只靠 rAF：后台标签页不触发。）
    await new Promise((r) => setTimeout(r, 30))
    if (seq !== openSeq) return false
    mountSim()
    return true
  }

  // 挂载模拟：画布必须已有真实尺寸，否则 createSim 会拿到 0 宽导致除零白屏。
  // 尺寸未就绪时直接返回，交给 ResizeObserver 在定型后补挂。
  function mountSim() {
    if (!currentMod || !root.classList.contains('open')) return
    const wrap = q('.stage-canvaswrap')
    const w = wrap.clientWidth
    const h = wrap.clientHeight
    if (w < 20 || h < 20) return
    destroySim()
    sim = currentMod.createSim(q('.stage-canvas'), q('.stage-stats'))
    sim.start()
    lastMountW = w
    applyStep(activeStep)
  }

  function destroySim() {
    if (sim) {
      sim.destroy()
      sim = null
    }
    // 画布重置，避免上一次的尺寸残留
    const old = q('.stage-canvas')
    const fresh = old.cloneNode(false)
    fresh.removeAttribute('width')
    fresh.removeAttribute('height')
    old.replaceWith(fresh)
  }

  // 画布尺寸变化（含从 0 变为可用、窗口 resize）就重建模拟——永不白屏
  const ro = new ResizeObserver(() => {
    if (!root.classList.contains('open')) return
    const w = q('.stage-canvaswrap').clientWidth
    if (w < 20) return
    if (!sim || Math.abs(w - lastMountW) > 4) mountSim()
  })
  ro.observe(q('.stage-canvaswrap'))

  function close() {
    if (!root.classList.contains('open')) return
    destroySim()
    currentMod = null
    currentStar = null
    root.classList.remove('open')
    onCloseCb?.()
  }

  q('.stage-close').addEventListener('click', close)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close()
  })

  onLanguageChange(() => {
    q('.stage-close').setAttribute('aria-label', t('stage.close'))
    if (!root.classList.contains('open') || !config || !currentStar) return
    q('.stage-branch').textContent = formatStageMeta(currentStar)
    q('.stage-title').textContent = starName(currentStar)
    buildSteps()
    buildParams()
    applyStep(activeStep)
  })

  return {
    open,
    close,
    onClose(cb) {
      onCloseCb = cb
    },
    get isOpen() {
      return root.classList.contains('open')
    }
  }
}
