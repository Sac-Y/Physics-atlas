import * as THREE from 'three'
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'

// 透镜坐标轴：时间轴 / 尺度轴。
// 两套轴都躺在星群下方（z=+475、y=0），随 galaxy Group 同承倾角。
// 只在对应透镜下、且切换动画过半时淡入；galaxy 透镜与切换中一律隐去。
// 淡入淡出由阻尼透明度驱动，作用于线材质 opacity 与全部 CSS2D 标签，
// ≈0 时 group.visible=false（CSS2DRenderer 会连同标签一起跳过）。

const AXIS_Z = 475
const LINE_COLOR = new THREE.Color(150 / 255, 190 / 255, 255 / 255)
const LINE_PEAK = 0.65 // 主横线峰值透明度（AdditiveBlending 后交给场景 UnrealBloom 生辉光）
const TICK_PEAK = 0.8 // 刻度短线峰值透明度
const TICK_LEN = 16 // 短刻度线沿 -z 方向探出的长度（世界单位）
const LABEL_GAP = 12 // 标签落在刻度短线外端更外侧的间隙

function makeLabel(text, cls = '') {
  const el = document.createElement('div')
  el.className = `axis-label${cls ? ` ${cls}` : ''}`
  el.textContent = text
  el.style.opacity = '0'
  return el
}

// 主横线着色器：加法混合的底光 + 沿 x 极慢流动的光包。
// uFade 控整体淡入淡出（0~1），uTime 驱动流光相位。底光克制、光包更慢更暗，
// 交给场景的 UnrealBloom 生辉光，避免自身过曝糊成白条。
function makeLineMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uFade: { value: 0 },
      uColor: { value: LINE_COLOR.clone() },
      uPeak: { value: LINE_PEAK }
    },
    vertexShader: /* glsl */ `
      attribute float aU;   // 0~1 沿线参数
      varying float vU;
      void main() {
        vU = aU;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uFade;
      uniform vec3 uColor;
      uniform float uPeak;
      varying float vU;
      void main() {
        // 底光：一条克制的稳定光带
        float base = 0.42;
        // 光包：沿 +x 极慢流动（速度远慢于传承光丝），拖尾渐隐
        float flow = fract(vU - uTime * 0.018);
        float pulse = exp(-flow * 5.0) * 0.7;
        float a = (base + pulse) * uPeak * uFade;
        vec3 col = uColor * (0.85 + pulse * 0.9);
        gl_FragColor = vec4(col, a);
      }
    `
  })
}

// 构建一套轴：一条主横线 + 若干刻度（短线 + 标签）+ 一个右端方向标签。
// 返回 { group, setOpacity(a), tick(dt) }
function buildAxis({ x0, x1, ticks, endLabel }) {
  const group = new THREE.Group()
  const labels = []

  // 主横线（带沿线参数 aU 供流光采样）
  const lineGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(x0, 0, AXIS_Z),
    new THREE.Vector3(x1, 0, AXIS_Z)
  ])
  lineGeo.setAttribute('aU', new THREE.BufferAttribute(new Float32Array([0, 1]), 1))
  const lineMat = makeLineMaterial()
  const line = new THREE.Line(lineGeo, lineMat)
  group.add(line)

  // 刻度：每个刻度一段短线（加法混合、更亮）+ 一个 CSS2D 标签
  const tickPts = []
  ticks.forEach((tk) => {
    tickPts.push(
      new THREE.Vector3(tk.x, 0, AXIS_Z),
      new THREE.Vector3(tk.x, 0, AXIS_Z - TICK_LEN)
    )
    const el = makeLabel(tk.label)
    const obj = new CSS2DObject(el)
    obj.position.set(tk.x, 0, AXIS_Z - TICK_LEN - LABEL_GAP)
    group.add(obj)
    labels.push(el)
  })
  const tickGeo = new THREE.BufferGeometry().setFromPoints(tickPts)
  const tickMat = new THREE.LineBasicMaterial({
    color: LINE_COLOR,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  })
  const tickLines = new THREE.LineSegments(tickGeo, tickMat)
  group.add(tickLines)

  // 轴题：移到轴线下方（+z 侧），右对齐轴末端附近——与上方刻度标签分居两侧，互不碰撞
  const endEl = makeLabel(endLabel, 'axis-end')
  const endObj = new CSS2DObject(endEl)
  // 轴题居中于轴线下方（+z 侧），与轴线留出呼吸间距
  endObj.position.set((x0 + x1) / 2, 0, AXIS_Z + 54)
  group.add(endObj)
  labels.push(endEl)

  const setOpacity = (a) => {
    lineMat.uniforms.uFade.value = a
    tickMat.opacity = a * TICK_PEAK
    const s = a.toFixed(3)
    labels.forEach((el) => {
      el.style.opacity = s
    })
  }
  // 只在可见时推进流光相位，省开销
  const tick = (dt, a) => {
    if (a > 0.01) lineMat.uniforms.uTime.value += dt
  }

  return { group, setOpacity, tick }
}

export function createLensAxes() {
  const group = new THREE.Group()

  // —— 时间轴 —— x = (year-1600)*3.2，横线从 x=-30 到 2020
  const YEAR0 = 1600
  const SCALE_T = 3.2
  const tx = (year) => (year - YEAR0) * SCALE_T
  const timeline = buildAxis({
    x0: -30,
    x1: tx(2020),
    ticks: [1600, 1700, 1800, 1900, 2000].map((y) => ({ x: tx(y), label: String(y) })),
    endLabel: '时间 →'
  })

  // —— 尺度轴 —— x = scaleExp*55
  const SX = 55
  const scaleTicks = [
    { exp: -18, name: '粒子' },
    { exp: -10, name: '原子' },
    { exp: -6, name: '物质' },
    { exp: 0, name: '物体' },
    { exp: 7, name: '星球' },
    { exp: 26, name: '宇宙' }
  ].map((t) => ({
    x: t.exp * SX,
    label: t.name
  }))
  const scale = buildAxis({
    x0: -18 * SX - 30,
    x1: 26 * SX,
    ticks: scaleTicks,
    endLabel: '空间尺度 · 微观 → 宏观'
  })

  group.add(timeline.group, scale.group)
  group.visible = false

  // 每套轴各自维护一个阻尼透明度
  let aTime = 0
  let aScale = 0

  function update(lensCurrent, lensAnim, dt) {
    // 目标透镜：切换中取动画目标，否则取当前
    const targetLens = lensAnim ? lensAnim.to : lensCurrent
    const animPass = lensAnim ? lensAnim.t > 0.5 : true
    const wantTime = targetLens === 'timeline' && animPass ? 1 : 0
    const wantScale = targetLens === 'scale' && animPass ? 1 : 0

    const k = Math.min(1, dt * 3.0)
    aTime += (wantTime - aTime) * k
    aScale += (wantScale - aScale) * k

    timeline.setOpacity(aTime)
    scale.setOpacity(aScale)
    timeline.tick(dt, aTime)
    scale.tick(dt, aScale)

    // 两套都近乎全暗时整组隐藏，CSS2DRenderer 连标签一起跳过
    group.visible = aTime > 0.004 || aScale > 0.004
  }

  return { group, update }
}
