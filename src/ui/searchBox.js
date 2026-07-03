// 搜索框：输入定律名 / 人名，直接飞到那颗星。
// 快捷键 "/" 聚焦；Enter 选第一项；Esc 收起。

export function createSearchBox({ stars, onSelect }) {
  const root = document.createElement('div')
  root.className = 'hud hud-search'
  root.innerHTML = `
    <input class="search-input" type="text" placeholder="搜索定律 · 人名　/" spellcheck="false" />
    <ul class="search-results"></ul>`
  document.body.appendChild(root)

  const input = root.querySelector('.search-input')
  const list = root.querySelector('.search-results')
  let results = []

  function match(qRaw) {
    const q = qRaw.trim().toLowerCase()
    if (!q) return []
    const scored = []
    stars.forEach((s) => {
      const fields = [s.name.zh, s.name.en, s.author.zh, s.author.en]
      let best = -1
      fields.forEach((f) => {
        const t = f.toLowerCase()
        if (t.startsWith(q)) best = Math.max(best, 2)
        else if (t.includes(q)) best = Math.max(best, 1)
      })
      if (best > 0) scored.push({ s, best })
    })
    return scored
      .sort((a, b) => b.best - a.best || b.s.influence - a.s.influence)
      .slice(0, 8)
      .map((r) => r.s)
  }

  function renderResults() {
    list.textContent = ''
    results.forEach((s, i) => {
      const li = document.createElement('li')
      li.className = i === 0 ? 'hit' : ''
      const name = document.createElement('span')
      name.textContent = s.name.zh
      const meta = document.createElement('i')
      meta.textContent = `${s.author.zh} · ${s.year}`
      li.append(name, meta)
      li.addEventListener('click', () => select(s))
      list.appendChild(li)
    })
    root.classList.toggle('has-results', results.length > 0)
  }

  function select(star) {
    input.value = ''
    results = []
    renderResults()
    input.blur()
    onSelect(star)
  }

  input.addEventListener('input', () => {
    results = match(input.value)
    renderResults()
  })
  input.addEventListener('keydown', (e) => {
    e.stopPropagation() // 输入时不触发全局快捷键
    if (e.key === 'Enter' && results[0]) select(results[0])
    if (e.key === 'Escape') {
      input.value = ''
      results = []
      renderResults()
      input.blur()
    }
  })
  window.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== input) {
      e.preventDefault()
      input.focus()
    }
  })

  return {
    focus: () => input.focus(),
    clear() {
      input.value = ''
      results = []
      renderResults()
      input.blur()
    }
  }
}
