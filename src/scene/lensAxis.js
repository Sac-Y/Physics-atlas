import * as THREE from 'three'
import { onLanguageChange, t } from '../i18n.js'

// 透镜坐标轴：时间轴 / 尺度轴。
// 两套轴都躺在星群下方（z=+475、y=0），随 galaxy Group 同承倾角。
// 文字为「贴地 3D 文字」：离屏 canvas 绘字 → CanvasTexture → 躺平的 PlaneGeometry，
// 随轴一起平移/旋转/透视，像画在地面上的跑道字，而非永远正对屏幕的 CSS2D。
// 只在对应透镜下、且切换动画过半时淡入；galaxy 透镜与切换中一律隐去。
// 淡入淡出由阻尼透明度驱动，乘到线材质与每个文字平面材质的 opacity 上；
// ≈0 时 group.visible=false。

const AXIS_Z = 475
const LINE_COLOR = new THREE.Color(150 / 255, 190 / 255, 255 / 255)
const LINE_PEAK = 0.65 // 主横线峰值透明度（AdditiveBlending 后交给场景 UnrealBloom 生辉光）
const TICK_PEAK = 0.8 // 刻度短线峰值透明度
const TICK_LEN = 16 // 短刻度线沿 -z 方向探出的长度（世界单位）
const LABEL_GAP = 12 // 标签落在刻度短线外端更外侧的间隙

// —— 贴地文字标定 ——
// 俯视默认距离下，让 3D 平面投影出与迁移前 CSS2D 相近的屏幕字高。
// 屏幕像素高 px ≈ H_world × (screenH/2) / (tan(fov/2) × dist)
// fov=46°、以两透镜俯视默认距离之间的参考距离标定，H_world = px × tan(fov/2) × REF_DIST / (screenH/2)
const FOV_TAN = Math.tan((46 * Math.PI) / 360) // tan(23°)
const REF_DIST = 1700 // timeline(~1357) 与 scale(~1892) 俯视默认距离的居中参考
const REF_SCREEN_H = 900
const worldTextHeight = (px) => (px * FOV_TAN * REF_DIST) / (REF_SCREEN_H / 2)
const TICK_TEXT_PX = 11.5 // 刻度名字号档（同迁移前）
const TITLE_TEXT_PX = 15 // 轴题字号档（同迁移前）

const TEXT_TINT = 'rgba(200, 225, 255, 0.95)' // 主体亮字（同迁移前 .axis-label 色）
const TEXT_GLOW = 'rgba(150, 190, 255, 0.6)' // 蓝晕（同迁移前 text-shadow）
const CANVAS_SCALE = 2 // 2x 超采样防糊

// 离屏 canvas 绘字 → CanvasTexture → 躺平的 PlaneGeometry。
// 辉光用 shadowBlur 烘进纹理（蓝晕 + 主体亮字）。宽度按文字实测，
// 世界尺寸由 heightWorld 定高、按纹理宽高比定宽，保证不拉伸。
// 返回 { mesh, material }。mesh 未定位（由调用方设置 position）。
function makeTextPlane(text, { fontPx, font, heightWorld }) {
  const pad = fontPx * 0.9 // 给 shadowBlur 辉光留出边距，避免被裁
  const measureCanvas = document.createElement('canvas')
  const mctx = measureCanvas.getContext('2d')
  mctx.font = `${fontPx}px ${font}`
  const textW = Math.ceil(mctx.measureText(text).width)

  const cw = (textW + pad * 2) * CANVAS_SCALE
  const ch = (fontPx + pad * 2) * CANVAS_SCALE
  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')
  ctx.scale(CANVAS_SCALE, CANVAS_SCALE)
  ctx.font = `${fontPx}px ${font}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const cx = (textW + pad * 2) / 2
  const cy = (fontPx + pad * 2) / 2

  // 外圈蓝晕：先描一层带 shadowBlur 的字，把辉光烘进纹理
  ctx.shadowColor = TEXT_GLOW
  ctx.shadowBlur = 10
  ctx.fillStyle = TEXT_GLOW
  ctx.fillText(text, cx, cy)
  // 主体亮字：叠在辉光之上
  ctx.shadowBlur = 3
  ctx.shadowColor = 'rgba(3, 4, 10, 0.9)' // 内圈深色保字形
  ctx.fillStyle = TEXT_TINT
  ctx.fillText(text, cx, cy)

  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.colorSpace = THREE.SRGBColorSpace

  const aspect = cw / ch
  const h = heightWorld * ((fontPx + pad * 2) / fontPx) // 含 padding 的整块高
  const w = h * aspect
  const geo = new THREE.PlaneGeometry(w, h)
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  })
  const mesh = new THREE.Mesh(geo, material)
  // 躺平在布局平面：文字朝 +y，俯视端正、左→右与轴向一致
  mesh.rotation.x = -Math.PI / 2
  return { mesh, material }
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

// 构建一套轴：一条主横线 + 若干刻度（短线 + 贴地文字）+ 一个轴题。
// 返回 { group, setOpacity(a), tick(dt) }
const TICK_FONT = '"SF Mono", Menlo, monospace'
const TITLE_FONT = '"Songti SC", "Noto Serif SC", "STSong", serif'

function buildAxis({ x0, x1, ticks, endLabel, tickLen = TICK_LEN, tickLabelGap = LABEL_GAP, titleGap = 54 }) {
  const group = new THREE.Group()
  // 全部文字平面材质，供淡入淡出统一乘 opacity
  const textMats = []

  // 主横线（带沿线参数 aU 供流光采样）
  const lineGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(x0, 0, AXIS_Z),
    new THREE.Vector3(x1, 0, AXIS_Z)
  ])
  lineGeo.setAttribute('aU', new THREE.BufferAttribute(new Float32Array([0, 1]), 1))
  const lineMat = makeLineMaterial()
  const line = new THREE.Line(lineGeo, lineMat)
  group.add(line)

  const tickHeightW = worldTextHeight(TICK_TEXT_PX)
  const titleHeightW = worldTextHeight(TITLE_TEXT_PX)

  // 刻度：每个刻度一段短线（加法混合、更亮）+ 一块贴地文字
  const tickPts = []
  ticks.forEach((tk) => {
    tickPts.push(
      new THREE.Vector3(tk.x, 0, AXIS_Z),
      new THREE.Vector3(tk.x, 0, AXIS_Z - tickLen)
    )
    const { mesh, material } = makeTextPlane(tk.label, {
      fontPx: TICK_TEXT_PX * 4, // 高分辨率绘制，世界尺寸另定
      font: TICK_FONT,
      heightWorld: tickHeightW
    })
    // 刻度名在轴线 -z 侧（俯视上方）；平面锚点在几何中心，沿 -z 再退半个高留白
    mesh.position.set(tk.x, 0, AXIS_Z - tickLen - tickLabelGap - mesh.geometry.parameters.height / 2)
    group.add(mesh)
    textMats.push(material)
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

  // 轴题：轴线下方（+z 侧）居中，与刻度名分居两侧
  const title = makeTextPlane(endLabel, {
    fontPx: TITLE_TEXT_PX * 4,
    font: TITLE_FONT,
    heightWorld: titleHeightW
  })
  title.mesh.position.set((x0 + x1) / 2, 0, AXIS_Z + titleGap + title.mesh.geometry.parameters.height / 2)
  group.add(title.mesh)
  textMats.push(title.material)

  const setOpacity = (a) => {
    lineMat.uniforms.uFade.value = a
    tickMat.opacity = a * TICK_PEAK
    textMats.forEach((m) => {
      m.opacity = a
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
  let timeline
  let scale

  function rebuildAxes() {
    group.clear()

    // —— 时间轴 —— x = (year-1600)*3.2，横线从 x=-30 到 2020
    const YEAR0 = 1600
    const SCALE_T = 3.2
    const tx = (year) => (year - YEAR0) * SCALE_T
    timeline = buildAxis({
      x0: -30,
      x1: tx(2020),
      ticks: [1600, 1700, 1800, 1900, 2000].map((y) => ({ x: tx(y), label: String(y) })),
      endLabel: t('axis.timelineTitle'),
      tickLen: 10,
      tickLabelGap: 2,
      titleGap: 22
    })

    // —— 尺度轴 —— x = scaleExp*55
    const SX = 55
    const scaleTicks = [
      { exp: -18, key: 'particle' },
      { exp: -10, key: 'atom' },
      { exp: -6, key: 'matter' },
      { exp: 0, key: 'object' },
      { exp: 7, key: 'planet' },
      { exp: 26, key: 'universe' }
    ].map((tick) => ({
      x: tick.exp * SX,
      label: t(`axis.${tick.key}`)
    }))
    scale = buildAxis({
      x0: -18 * SX - 30,
      x1: 26 * SX,
      ticks: scaleTicks,
      endLabel: t('axis.scaleTitle')
    })

    group.add(timeline.group, scale.group)
  }

  rebuildAxes()
  onLanguageChange(rebuildAxes)
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

    // 两套都近乎全暗时整组隐藏（贴地文字随 group 一起跳过渲染）
    group.visible = aTime > 0.004 || aScale > 0.004
  }

  return { group, update }
}
