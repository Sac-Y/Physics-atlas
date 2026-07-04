const STORAGE_KEY = 'physics-star-atlas-lang'

export const LANGUAGES = {
  zh: { label: '中', name: '中文', htmlLang: 'zh-CN' },
  en: { label: 'EN', name: 'English', htmlLang: 'en' }
}

const TEXT = {
  zh: {
    app: {
      title: '物理学星图',
      subtitle: 'Physics Star Atlas',
      documentTitle: '物理学星图 · Physics Star Atlas',
      branchLegend: '学科图例',
      styleSwitcher: '风格方案',
      lensSwitcher: '透镜',
      languageSwitcher: '语言',
      hint: '拖 拽 旋 转  ·  滚 轮 缩 放',
      resetView: '恢复初始视图'
    },
    branch: {
      mechanics: '经典力学',
      em: '电磁学',
      thermo: '热力学',
      relativity: '相对论',
      quantum: '量子',
      cosmology: '宇宙学'
    },
    lens: {
      galaxy: '星系',
      timeline: '时间轴',
      scale: '尺度'
    },
    axis: {
      timelineTitle: '时间 →',
      scaleTitle: '空间尺度 · 微观 → 宏观',
      particle: '粒子',
      atom: '原子',
      matter: '物质',
      object: '物体',
      planet: '星球',
      universe: '宇宙'
    },
    preset: {
      deepfield: '深空摄影',
      interstellar: '星际穿越'
    },
    search: {
      placeholder: '搜索定律 · 人名　/'
    },
    tour: {
      label: '导览',
      exit: '退出导览',
      prev: '‹ 上一站',
      next: '下一站 ›',
      end: '结束 ›'
    },
    card: {
      close: '关闭',
      stage: '进入演示台 ⤢',
      flipBack: '学术脉络 ⟶',
      flipFront: '⟵ 正面',
      supersedes: '它推翻了',
      supersededBy: '后被谁包含 / 修正',
      leadsTo: '通向今天',
      empty: '—'
    },
    cardFallback: {
      supersedes: '早期模型、直觉或经验描述',
      supersededBy: '后来的理论框架与修正',
      leadsTo: '现代方法、仪器与应用'
    },
    stage: {
      close: '关闭'
    },
    simHint: {
      'gravity-orbit': '抓住行星 · 甩出去',
      'maxwell-field': '抓住电荷 · 摇一摇',
      'entropy-arrow': '看它自己变乱',
      'double-slit': '一次一个光子',
      'light-cone': '把速度推向光速',
      'induction-field': '抓住磁铁 · 抽一下',
      'newton-motion': '甩它 · 按住推它'
    }
  },
  en: {
    app: {
      title: 'Physics Star Atlas',
      subtitle: 'Interactive Lineage Map',
      documentTitle: 'Physics Star Atlas',
      branchLegend: 'Field legend',
      styleSwitcher: 'Visual style',
      lensSwitcher: 'Lens',
      languageSwitcher: 'Language',
      hint: 'DRAG TO ORBIT  ·  SCROLL TO ZOOM',
      resetView: 'Reset view'
    },
    branch: {
      mechanics: 'Classical Mechanics',
      em: 'Electromagnetism',
      thermo: 'Thermodynamics',
      relativity: 'Relativity',
      quantum: 'Quantum Physics',
      cosmology: 'Cosmology'
    },
    lens: {
      galaxy: 'Galaxy',
      timeline: 'Timeline',
      scale: 'Scale'
    },
    axis: {
      timelineTitle: 'Time →',
      scaleTitle: 'Spatial Scale · Micro → Macro',
      particle: 'Particle',
      atom: 'Atom',
      matter: 'Matter',
      object: 'Object',
      planet: 'Planet',
      universe: 'Universe'
    },
    preset: {
      deepfield: 'Deep Field',
      interstellar: 'Interstellar'
    },
    search: {
      placeholder: 'Search laws · people  /'
    },
    tour: {
      label: 'Tours',
      exit: 'Exit tour',
      prev: '‹ Previous',
      next: 'Next ›',
      end: 'End ›'
    },
    card: {
      close: 'Close',
      stage: 'Open Lab ⤢',
      flipBack: 'Lineage ⟶',
      flipFront: '⟵ Front',
      supersedes: 'What it displaced',
      supersededBy: 'Later contained or revised by',
      leadsTo: 'Where it leads',
      empty: '—'
    },
    cardFallback: {
      supersedes: 'Earlier models, intuitions, or empirical descriptions',
      supersededBy: 'Later theoretical frameworks and corrections',
      leadsTo: 'Modern methods, instruments, and applications'
    },
    stage: {
      close: 'Close'
    },
    simHint: {
      'gravity-orbit': 'Grab the planet · throw it',
      'maxwell-field': 'Grab the charge · shake it',
      'entropy-arrow': 'Watch order dissolve',
      'double-slit': 'One photon at a time',
      'light-cone': 'Push speed toward light',
      'induction-field': 'Grab the magnet · pull it',
      'newton-motion': 'Fling it · hold to thrust'
    }
  }
}

const ROUTES = {
  'what-is-light': {
    title: {
      zh: '光是什么：两千年之争',
      en: 'What Is Light: A Two-Thousand-Year Argument'
    },
    shortTitle: { zh: '光是什么', en: 'Light' },
    captions: [
      {
        zh: '牛顿把白光拆成彩虹，也把光想成一颗颗飞行的微粒。这个图景解释了直线传播，却在干涉面前留下裂缝。',
        en: 'Newton split white light into a rainbow and imagined light as flying particles. It explained straight-line travel, but interference exposed the cracks.'
      },
      {
        zh: '惠更斯换了一个想象：光不是小弹丸，而是一层层推进的波面。折射和反射开始像水波一样可被理解。',
        en: 'Huygens changed the picture: light was not a pellet, but advancing wavefronts. Reflection and refraction began to look like water waves.'
      },
      {
        zh: '两条狭缝让光自己和自己相遇，屏幕上出现明暗条纹。微粒说最稳固的堡垒，被一串细纹慢慢攻破。',
        en: 'Two slits let light meet itself, painting bright and dark bands on the screen. A few fine fringes broke the strongest wall of the particle story.'
      },
      {
        zh: '菲涅耳把衍射算到阴影深处，连反直觉的亮斑也被预言出来。光的波动性不再只是好看的类比。',
        en: 'Fresnel calculated diffraction deep into shadow, even predicting a counterintuitive bright spot. Wave optics was no longer just a metaphor.'
      },
      {
        zh: '麦克斯韦把电和磁合成同一张方程网，光速从方程里自然冒出。光终于有了身份：它是电磁场的波。',
        en: 'Maxwell tied electricity and magnetism into one set of equations, and the speed of light fell out naturally. Light finally had an identity: an electromagnetic wave.'
      },
      {
        zh: '可光又一次不听话：低频强光打不出电子，高频弱光却可以。爱因斯坦把光量子带回舞台，旧争论变成新问题。',
        en: 'Then light misbehaved again: intense low-frequency light could not eject electrons, while weak high-frequency light could. Einstein brought quanta back onto the stage.'
      },
      {
        zh: '德布罗意把问题反过来问：如果光能像粒子，粒子会不会也像波？从此波粒二象性不再只属于光。',
        en: 'de Broglie reversed the question: if light can behave like particles, can particles behave like waves? Wave-particle duality stopped belonging only to light.'
      },
      {
        zh: '量子电动力学收束了这场争吵：光和电子以量子场的方式相互作用。波和粒子都不是全部答案，只是我们观察时的两种影子。',
        en: 'Quantum electrodynamics reframed the dispute: light and electrons interact as quantum fields. Waves and particles are not the whole answer, just two shadows cast by measurement.'
      }
    ]
  },
  'falling-to-black-holes': {
    title: { zh: '从落体到黑洞', en: 'From Falling Bodies to Black Holes' },
    shortTitle: { zh: '落体到黑洞', en: 'Gravity' },
    captions: [
      {
        zh: '故事从斜面和落体开始。伽利略发现，下落不是重物的特权，而是所有物体共同服从的加速运动。',
        en: 'The story starts with ramps and falling bodies. Galileo found that falling was not a privilege of heavy objects, but a shared accelerated motion.'
      },
      {
        zh: '惯性让运动摆脱了“总要停下”的古老直觉。只要没有外力，物体会把自己的运动状态带下去。',
        en: 'Inertia freed motion from the old intuition that it must always die away. Without an external force, an object carries its state of motion onward.'
      },
      {
        zh: '牛顿第二定律把力、质量和加速度压成一条公式：合力决定运动怎样改变。落体、炮弹、机器和行星轨道，从这里进入同一种可计算语言。',
        en: 'Newton’s second law compressed force, mass, and acceleration into one rule: net force decides how motion changes. Falling bodies, cannons, machines, and planets entered one calculable language.'
      },
      {
        zh: '万有引力把苹果和月亮连到一起。宇宙不再分成地上和天上，只剩同一条平方反比的吸引律。',
        en: 'Universal gravitation tied the apple to the Moon. The cosmos no longer split into earth and heaven; one inverse-square attraction governed both.'
      },
      {
        zh: '拉格朗日换了视角：不必逐个画出受力，只要写下能量和路径。复杂系统由此变得像一条可优化的轨迹。',
        en: 'Lagrange changed the viewpoint: instead of drawing every force, write down energy and paths. Complex systems became trajectories to optimize.'
      },
      {
        zh: '哈密顿把运动搬进相空间，位置和动量一起流动。这个语言后来会穿过经典力学，进入量子世界。',
        en: 'Hamilton moved motion into phase space, where position and momentum flow together. That language later passed through classical mechanics into quantum theory.'
      },
      {
        zh: '爱因斯坦再一次改写重力：物体不是被神秘力量拉着走，而是在弯曲时空中沿最自然的路前进。',
        en: 'Einstein rewrote gravity again: bodies are not pulled by a mysterious force; they follow the most natural paths through curved spacetime.'
      },
      {
        zh: '广义相对论很快给出一个极端答案：如果质量压得足够紧，连光也逃不出边界。黑洞先作为方程结果出现。',
        en: 'General relativity soon produced an extreme answer: compress enough mass tightly enough and even light cannot escape. Black holes first appeared as equations.'
      },
      {
        zh: '一百年后，两个黑洞合并的涟漪穿过地球。落体问题的尽头，变成了人类直接聆听时空震动的仪器。',
        en: 'A century later, ripples from merging black holes crossed Earth. The problem of falling bodies ended in instruments that let us hear spacetime move.'
      }
    ]
  },
  'certainty-to-randomness': {
    title: { zh: '从确定到随机：量子革命', en: 'From Certainty to Randomness: The Quantum Revolution' },
    shortTitle: { zh: '确定到随机', en: 'Quantum' },
    captions: [
      {
        zh: '普朗克原本只是想修好黑体辐射曲线，却被迫让能量一份一份出现。量子革命从一次不情愿的数学补丁开始。',
        en: 'Planck only wanted to repair the blackbody curve, but he had to let energy arrive in packets. The quantum revolution began as a reluctant mathematical patch.'
      },
      {
        zh: '爱因斯坦把这个补丁推向光本身：光像粒子一样交出整份能量。经典波动图景第一次被迫让位。',
        en: 'Einstein pushed that patch onto light itself: light delivered energy like particles. The classical wave picture had to yield for the first time.'
      },
      {
        zh: '玻尔让电子只能待在离散轨道上，原子光谱终于有了台阶。稳定的物质结构，靠的是不连续。',
        en: 'Bohr let electrons occupy only discrete orbits, giving atomic spectra their steps. Stable matter depended on discontinuity.'
      },
      {
        zh: '德布罗意把波性送给所有物质。电子不再只是小球，它也带着能在晶体中衍射的波长。',
        en: 'de Broglie gave wave nature to all matter. An electron was no longer just a tiny ball; it carried a wavelength that could diffract through crystals.'
      },
      {
        zh: '海森堡抛开看不见的轨道，只保留能测到的量。量子世界里，先量什么、后量什么，会改变答案。',
        en: 'Heisenberg discarded invisible orbits and kept only measurable quantities. In the quantum world, the order of measurement changes the answer.'
      },
      {
        zh: '薛定谔给出另一种语言：波函数随时间流动。它看似连续优雅，却把概率推到物理核心。',
        en: 'Schrödinger offered another language: a wavefunction flowing through time. It looked smooth and elegant, yet put probability at the center of physics.'
      },
      {
        zh: '不确定性原理宣布，模糊不是技术缺陷，而是自然的底层规则。确定轨道的旧梦到这里真正破碎。',
        en: 'The uncertainty principle declared that fuzziness is not a technical flaw, but a ground rule of nature. The old dream of exact trajectories broke here.'
      },
      {
        zh: '贝尔把哲学争论变成实验判据。纠缠不是预先藏好的答案，而是现实本身比局域直觉更奇怪。',
        en: 'Bell turned a philosophical fight into an experimental test. Entanglement was not a hidden answer; reality itself was stranger than local intuition.'
      },
      {
        zh: '今天，叠加和纠缠不只让人困惑，也能被工程化使用。量子革命从解释世界，走向重新设计计算与通信。',
        en: 'Today, superposition and entanglement are not only puzzles; they are engineering resources. The quantum revolution moved from explaining the world to redesigning computation and communication.'
      }
    ]
  }
}

const listeners = new Set()

function normalizeLang(lang) {
  return lang === 'en' ? 'en' : 'zh'
}

function initialLang() {
  const params = new URLSearchParams(window.location.search)
  return normalizeLang(params.get('lang') || localStorage.getItem(STORAGE_KEY) || 'zh')
}

let currentLang = initialLang()

function applyDocumentLanguage() {
  const meta = LANGUAGES[currentLang]
  document.documentElement.lang = meta.htmlLang
  document.body.dataset.lang = currentLang
  document.title = t('app.documentTitle')
}

export function getLanguage() {
  return currentLang
}

export function setLanguage(lang) {
  const next = normalizeLang(lang)
  if (next === currentLang) return
  currentLang = next
  localStorage.setItem(STORAGE_KEY, next)
  const url = new URL(window.location.href)
  url.searchParams.set('lang', next)
  history.replaceState(null, '', url)
  applyDocumentLanguage()
  listeners.forEach((fn) => fn(next))
}

export function onLanguageChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function localize(value, lang = currentLang) {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  return value[lang] ?? value.zh ?? value.en ?? ''
}

export function t(path, vars = {}) {
  const value = path.split('.').reduce((acc, part) => acc?.[part], TEXT[currentLang])
  let text = typeof value === 'string' ? value : path
  Object.entries(vars).forEach(([key, val]) => {
    text = text.replaceAll(`{${key}}`, String(val))
  })
  return text
}

export function branchName(branch) {
  return t(`branch.${branch}`)
}

export function presetLabel(key) {
  return t(`preset.${key}`)
}

export function simHint(simId) {
  return t(`simHint.${simId}`)
}

export function starName(star) {
  return localize(star.name)
}

export function starAuthor(star) {
  return localize(star.author)
}

export function starOneLiner(star) {
  if (currentLang === 'zh') return star.oneLiner ?? ''
  if (star.oneLiner?.en) return star.oneLiner.en
  const branch = branchName(star.branch).toLowerCase()
  return `${starName(star)} is a key ${branch} waypoint, linking earlier ideas to the lineage of modern physics.`
}

export function lineageList(items, field) {
  if (currentLang === 'zh') return items?.length ? items : [t('card.empty')]
  if (!items?.length) return [t('card.empty')]
  const translated = items
    .map((item) => (typeof item === 'object' ? item.en : ''))
    .filter(Boolean)
  return translated.length ? translated : [t(`cardFallback.${field}`)]
}

export function routeTitle(route) {
  return localize(ROUTES[route.id]?.title ?? route.title)
}

export function routeShortTitle(route) {
  return localize(ROUTES[route.id]?.shortTitle ?? ROUTES[route.id]?.title ?? route.title).split(':')[0].split('：')[0]
}

export function routeCaption(route, index) {
  return localize(ROUTES[route.id]?.captions?.[index] ?? route.stops[index]?.caption)
}

export function dustName(dust) {
  if (currentLang === 'zh') return dust.name
  return `${branchName(dust.branch)} waypoint · ${dust.year}`
}

export function formatStageMeta(star) {
  return `${branchName(star.branch)} · ${starAuthor(star)} · ${star.year}`
}

export function applyInitialLanguage() {
  applyDocumentLanguage()
}
