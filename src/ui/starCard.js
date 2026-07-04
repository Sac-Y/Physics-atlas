import katex from 'katex'
import 'katex/dist/katex.min.css'
import { BRANCHES } from '../data/branches.js'
import { mountSim, hasSim, simHint } from '../sims/simHost.js'
import {
  branchName,
  getLanguage,
  lineageList,
  onLanguageChange,
  starAuthor,
  starName,
  starOneLiner,
  t
} from '../i18n.js'

// 档案卡：点开一颗星的"灵魂界面"。
// 正面 = 理论名 / 提出者·年份 / 精排方程 / 一句话 + live 模拟；
// 背面 = 学术脉络（推翻了谁 / 被谁包含 / 通向今天）。
// 与星空同一套设计语言：深色玻璃、宋体、克制发光。

export function createStarCard() {
  const root = document.createElement('div')
  root.id = 'starCard'
  root.innerHTML = `
    <div class="card-inner">
      <section class="card-face card-front">
        <button class="card-close" aria-label="关闭">×</button>
        <div class="card-meta"><i class="card-dot"></i><span class="card-branch"></span><span class="card-year"></span></div>
        <h2 class="card-title"></h2>
        <div class="card-author"></div>
        <div class="card-eq"></div>
        <p class="card-oneliner"></p>
        <div class="card-simwrap">
          <canvas class="card-simcanvas"></canvas>
          <div class="card-simhint"></div>
        </div>
        <div class="card-stats"></div>
        <button class="card-stage"></button>
        <button class="card-flip card-flip-back"></button>
      </section>
      <section class="card-face card-back">
        <button class="card-close" aria-label="关闭">×</button>
        <h3 class="card-back-title"></h3>
        <div class="card-lineage">
          <div class="card-sec"><h4 class="card-supersedes-title"></h4><ul class="card-supersedes"></ul></div>
          <div class="card-sec"><h4 class="card-supersededBy-title"></h4><ul class="card-supersededBy"></ul></div>
          <div class="card-sec"><h4 class="card-leadsTo-title"></h4><ul class="card-leadsTo"></ul></div>
        </div>
        <button class="card-flip card-flip-front"></button>
      </section>
    </div>`
  document.body.appendChild(root)

  const q = (sel) => root.querySelector(sel)
  let activeSim = null
  let onCloseCb = null
  let onStageCb = null
  let currentStar = null

  function fillList(sel, items, field) {
    const ul = q(sel)
    ul.textContent = ''
    const list = lineageList(items, field)
    list.forEach((text) => {
      const li = document.createElement('li')
      li.textContent = text
      ul.appendChild(li)
    })
  }

  function renderChrome() {
    q('.card-stage').textContent = t('card.stage')
    q('.card-flip-back').textContent = t('card.flipBack')
    q('.card-flip-front').textContent = t('card.flipFront')
    q('.card-supersedes-title').textContent = t('card.supersedes')
    q('.card-supersededBy-title').textContent = t('card.supersededBy')
    q('.card-leadsTo-title').textContent = t('card.leadsTo')
    root.querySelectorAll('.card-close').forEach((b) => {
      b.setAttribute('aria-label', t('card.close'))
    })
  }

  function renderStar(star) {
    const branch = BRANCHES[star.branch]
    q('.card-dot').style.background = branch.color
    q('.card-branch').textContent = branchName(star.branch)
    q('.card-year').textContent = `· ${star.year}`
    q('.card-title').textContent = starName(star)
    q('.card-author').textContent =
      getLanguage() === 'zh'
        ? `${star.author.zh} · ${star.author.en} · ${star.name.en}`
        : `${star.author.en} · ${star.year}`
    q('.card-oneliner').textContent = starOneLiner(star)
    q('.card-back-title').textContent = starName(star)

    try {
      katex.render(star.equation, q('.card-eq'), { displayMode: true, throwOnError: true })
    } catch {
      q('.card-eq').textContent = star.equation
    }

    fillList('.card-supersedes', star.cardBack?.supersedes, 'supersedes')
    fillList('.card-supersededBy', star.cardBack?.supersededBy, 'supersededBy')
    fillList('.card-leadsTo', star.cardBack?.leadsTo, 'leadsTo')

    // 模拟：有则挂载，无则收起画布区
    const simwrap = q('.card-simwrap')
    const statsEl = q('.card-stats')
    const runnable = star.simId && hasSim(star.simId)
    simwrap.style.display = runnable ? '' : 'none'
    statsEl.style.display = runnable ? '' : 'none'
    q('.card-stage').style.display = runnable ? '' : 'none'
    q('.card-simhint').textContent = runnable ? simHint(star.simId) : ''
  }

  async function open(star) {
    destroySim()
    currentStar = star
    root.classList.remove('flipped')
    renderChrome()
    renderStar(star)

    root.classList.add('open')

    const statsEl = q('.card-stats')
    const runnable = star.simId && hasSim(star.simId)
    if (runnable) {
      // 等一个宏任务让布局定型再取 canvas 尺寸。
      // 不能用 rAF：后台标签页 rAF 不触发，挂载会永远卡住。
      await new Promise((r) => setTimeout(r, 0))
      activeSim = await mountSim(star.simId, q('.card-simcanvas'), statsEl)
    }
  }

  function destroySim() {
    if (activeSim) {
      activeSim.destroy()
      activeSim = null
    }
  }

  function close(reason = 'program') {
    if (!root.classList.contains('open')) return
    destroySim()
    root.classList.remove('open')
    onCloseCb?.(reason)
  }

  root.querySelectorAll('.card-close').forEach((b) =>
    b.addEventListener('click', () => close('dismiss'))
  )
  root.querySelectorAll('.card-flip').forEach((b) =>
    b.addEventListener('click', () => root.classList.toggle('flipped'))
  )
  q('.card-stage').addEventListener('click', () => {
    if (currentStar) onStageCb?.(currentStar)
  })
  onLanguageChange(() => {
    renderChrome()
    if (currentStar) renderStar(currentStar)
  })
  renderChrome()
  window.addEventListener('keydown', (e) => {
    // 演示台开着时 Esc 归它管
    if (e.key === 'Escape' && !document.getElementById('demoStage')?.classList.contains('open')) {
      close('dismiss')
    }
  })

  return {
    open,
    close,
    onClose(cb) {
      onCloseCb = cb
    },
    onStage(cb) {
      onStageCb = cb
    },
    get isOpen() {
      return root.classList.contains('open')
    }
  }
}
