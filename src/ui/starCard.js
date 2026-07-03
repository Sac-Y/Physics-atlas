import katex from 'katex'
import 'katex/dist/katex.min.css'
import { BRANCHES } from '../data/branches.js'
import { mountSim, hasSim, simHint } from '../sims/simHost.js'

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
        <button class="card-stage">进入演示台 ⤢</button>
        <button class="card-flip">学术脉络 ⟶</button>
      </section>
      <section class="card-face card-back">
        <button class="card-close" aria-label="关闭">×</button>
        <h3 class="card-back-title"></h3>
        <div class="card-lineage">
          <div class="card-sec"><h4>它推翻了</h4><ul class="card-supersedes"></ul></div>
          <div class="card-sec"><h4>后被谁包含 / 修正</h4><ul class="card-supersededBy"></ul></div>
          <div class="card-sec"><h4>通向今天</h4><ul class="card-leadsTo"></ul></div>
        </div>
        <button class="card-flip">⟵ 正面</button>
      </section>
    </div>`
  document.body.appendChild(root)

  const q = (sel) => root.querySelector(sel)
  let activeSim = null
  let onCloseCb = null
  let onStageCb = null
  let currentStar = null

  function fillList(sel, items) {
    const ul = q(sel)
    ul.textContent = ''
    const list = items?.length ? items : ['—']
    list.forEach((text) => {
      const li = document.createElement('li')
      li.textContent = text
      ul.appendChild(li)
    })
  }

  async function open(star) {
    destroySim()
    currentStar = star
    root.classList.remove('flipped')

    const branch = BRANCHES[star.branch]
    q('.card-dot').style.background = branch.color
    q('.card-branch').textContent = branch.zh
    q('.card-year').textContent = `· ${star.year}`
    q('.card-title').textContent = star.name.zh
    q('.card-author').textContent = `${star.author.zh} · ${star.author.en} · ${star.name.en}`
    q('.card-oneliner').textContent = star.oneLiner
    q('.card-back-title').textContent = star.name.zh

    try {
      katex.render(star.equation, q('.card-eq'), { displayMode: true, throwOnError: true })
    } catch {
      q('.card-eq').textContent = star.equation
    }

    fillList('.card-supersedes', star.cardBack?.supersedes)
    fillList('.card-supersededBy', star.cardBack?.supersededBy)
    fillList('.card-leadsTo', star.cardBack?.leadsTo)

    // 模拟：有则挂载，无则收起画布区
    const simwrap = q('.card-simwrap')
    const statsEl = q('.card-stats')
    const runnable = star.simId && hasSim(star.simId)
    simwrap.style.display = runnable ? '' : 'none'
    statsEl.style.display = runnable ? '' : 'none'
    q('.card-stage').style.display = runnable ? '' : 'none'
    q('.card-simhint').textContent = runnable ? simHint(star.simId) : ''

    root.classList.add('open')

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
