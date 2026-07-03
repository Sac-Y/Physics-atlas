import * as THREE from 'three'
import { mulberry32 } from '../utils/prng.js'
import { PIXEL_RATIO } from '../utils/display.js'

// 恒星色温谱（近似黑体，从蓝白到红橙），权重偏向暗弱的暖色星——真实星野的质感来源
const STELLAR_COLORS = [
  { c: [0.61, 0.69, 1.0], w: 0.04, bright: 1.6 },
  { c: [0.79, 0.84, 1.0], w: 0.1, bright: 1.25 },
  { c: [0.97, 0.97, 1.0], w: 0.18, bright: 1.0 },
  { c: [1.0, 0.96, 0.92], w: 0.26, bright: 0.85 },
  { c: [1.0, 0.82, 0.63], w: 0.26, bright: 0.7 },
  { c: [1.0, 0.7, 0.47], w: 0.16, bright: 0.55 }
]

function pickColor(rand) {
  let r = rand()
  for (const s of STELLAR_COLORS) {
    if (r < s.w) return s
    r -= s.w
  }
  return STELLAR_COLORS[2]
}

export function createBackgroundStars() {
  const rand = mulberry32(20260702)
  const FIELD = 9000
  const BAND = 6500
  const total = FIELD + BAND

  const positions = new Float32Array(total * 3)
  const colors = new Float32Array(total * 3)
  const sizes = new Float32Array(total)
  const phases = new Float32Array(total)
  const bandFlag = new Float32Array(total)

  // 银河带：一个倾斜的大圆盘面
  const bandNormal = new THREE.Vector3(0.32, 1, 0.18).normalize()
  const bandU = new THREE.Vector3(1, 0, 0).cross(bandNormal).normalize()
  const bandV = bandNormal.clone().cross(bandU).normalize()

  const gauss = () => {
    // Box–Muller
    const u = Math.max(rand(), 1e-9)
    const v = rand()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }

  // 星团簇：真实星野不是均匀的
  const clusters = []
  for (let i = 0; i < 26; i += 1) {
    const dir = new THREE.Vector3(gauss(), gauss() * 0.6, gauss()).normalize()
    clusters.push({ dir, r: 4500 + rand() * 3000 })
  }

  const p = new THREE.Vector3()
  for (let i = 0; i < total; i += 1) {
    const isBand = i >= FIELD
    if (isBand) {
      const ang = rand() * Math.PI * 2
      const rad = 3000 + rand() * 5000
      p.copy(bandU).multiplyScalar(Math.cos(ang) * rad)
        .addScaledVector(bandV, Math.sin(ang) * rad)
        .addScaledVector(bandNormal, gauss() * 380)
    } else if (rand() < 0.3) {
      const cl = clusters[Math.floor(rand() * clusters.length)]
      p.copy(cl.dir).multiplyScalar(cl.r)
      p.x += gauss() * 220
      p.y += gauss() * 220
      p.z += gauss() * 220
    } else {
      p.set(gauss(), gauss(), gauss()).normalize()
        .multiplyScalar(4000 + rand() * 4000)
    }

    positions[i * 3] = p.x
    positions[i * 3 + 1] = p.y
    positions[i * 3 + 2] = p.z

    const spec = pickColor(rand)
    // 亮度服从幂律：绝大多数暗弱，极少数刺眼
    const mag = Math.pow(rand(), 3.2)
    const b = (0.32 + mag * 1.3) * spec.bright
    colors[i * 3] = spec.c[0] * b
    colors[i * 3 + 1] = spec.c[1] * b
    colors[i * 3 + 2] = spec.c[2] * b

    sizes[i] = (isBand ? 1.0 : 1.3) + mag * (isBand ? 2.6 : 4.6)
    phases[i] = rand()
    bandFlag[i] = isBand ? 1 : 0
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))
  geo.setAttribute('aBand', new THREE.BufferAttribute(bandFlag, 1))

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: PIXEL_RATIO },
      uDensity: { value: 1 },
      uBand: { value: 0.85 },
      uWarmth: { value: 0.6 },
      uIntro: { value: 1 }
    },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aPhase;
      attribute float aBand;
      uniform float uTime;
      uniform float uPixelRatio;
      varying vec3 vColor;
      varying float vTwinkle;
      varying float vBand;

      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        vColor = aColor;
        vBand = aBand;
        vTwinkle = 0.8 + 0.2 * sin(uTime * (0.3 + aPhase * 1.4) + aPhase * 43.0);
        float size = aSize * uPixelRatio * (620.0 / -mv.z);
        gl_PointSize = clamp(size, 0.6, 9.0 * uPixelRatio);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uDensity;
      uniform float uBand;
      uniform float uWarmth;
      uniform float uIntro;
      varying vec3 vColor;
      varying float vTwinkle;
      varying float vBand;

      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float r2 = dot(d, d);
        float glow = exp(-r2 * 16.0) * smoothstep(0.25, 0.16, r2);
        float alpha = glow * vTwinkle * uDensity * mix(1.0, uBand, vBand) * uIntro;
        vec3 col = vColor * mix(1.0, 1.18, uWarmth * 0.4);
        gl_FragColor = vec4(col * alpha, alpha);
      }
    `
  })

  const points = new THREE.Points(geo, material)
  points.frustumCulled = false
  points.renderOrder = -10

  function applyPreset(preset) {
    material.uniforms.uDensity.value = preset.backdrop.density
    material.uniforms.uBand.value = preset.backdrop.band
    material.uniforms.uWarmth.value = preset.backdrop.warmth
  }

  function update(t) {
    material.uniforms.uTime.value = t
  }

  function setIntro(v) {
    material.uniforms.uIntro.value = v
  }

  return { object: points, update, applyPreset, setIntro }
}
