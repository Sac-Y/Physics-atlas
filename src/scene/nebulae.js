import * as THREE from 'three'
import { BRANCHES } from '../data/branches.js'
import { mulberry32 } from '../utils/prng.js'
import { PIXEL_RATIO } from '../utils/display.js'

// 每个学科一片星云：外层稀薄尘埃丝 + 内层致密云体 + 核心辉光。
// 质感来自 fbm 噪声在片元里雕出的云絮结构，不是均匀圆形光斑。

const NOISE_GLSL = /* glsl */ `
  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
    for (int i = 0; i < 4; i++) {
      v += amp * vnoise(p);
      p = rot * p * 2.03;
      amp *= 0.5;
    }
    return v;
  }
`

// 粒子数与单粒子透明度联动：数量减、单张增，云的总亮度不变而 GPU overdraw 大减
function buildBranchCloud(key, branch, rand) {
  const OUTER = 150
  const INNER = 110
  const CORE = 1
  const total = OUTER + INNER + CORE
  const { scale, elong, stretch } = branch.nebula
  const elongDir = new THREE.Vector3(elong[0], 0, elong[1]).normalize()

  const offsets = new Float32Array(total * 3)
  const sizes = new Float32Array(total)
  const seeds = new Float32Array(total)
  const kinds = new Float32Array(total) // 0 外层丝絮 1 内层云体 2 核心辉光
  const spins = new Float32Array(total)

  const gauss = () => {
    const u = Math.max(rand(), 1e-9)
    const v = rand()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }

  // 2~3 条纤维臂方向：让星云有拉丝结构而非圆团
  const arms = []
  const armCount = 2 + Math.floor(rand() * 2)
  for (let a = 0; a < armCount; a += 1) {
    const ang = rand() * Math.PI * 2
    arms.push(new THREE.Vector3(Math.cos(ang), (rand() - 0.5) * 0.5, Math.sin(ang)))
  }

  const p = new THREE.Vector3()
  for (let i = 0; i < total; i += 1) {
    const isCore = i === total - 1
    const isInner = !isCore && i >= OUTER
    const kind = isCore ? 2 : isInner ? 1 : 0

    if (isCore) {
      p.set(0, 0, 0)
    } else if (kind === 0 && rand() < 0.62) {
      // 沿纤维臂散布：星云的拉丝骨架
      const arm = arms[Math.floor(rand() * arms.length)]
      const t = (rand() * 2 - 1) * 470 * scale
      p.copy(arm).multiplyScalar(t)
      p.x += gauss() * 70
      p.y += gauss() * 32
      p.z += gauss() * 70
    } else {
      const s = (kind === 1 ? 105 : 205) * scale
      p.set(gauss() * s, gauss() * s * 0.32, gauss() * s)
    }

    // 整体沿主方向拉伸：让每片星云有自己的姿态而不是圆团
    if (!isCore) {
      const along = p.dot(elongDir)
      p.addScaledVector(elongDir, along * (stretch - 1))
    }

    offsets[i * 3] = p.x
    offsets[i * 3 + 1] = p.y
    offsets[i * 3 + 2] = p.z

    sizes[i] = isCore
      ? 1050 * scale
      : (kind === 1
        ? 150 + rand() * 220
        : 300 + rand() * 430) * (0.8 + scale * 0.25)
    seeds[i] = rand() * 100
    kinds[i] = kind
    spins[i] = (rand() - 0.5) * 0.02 // 极慢的公转，rad/s
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(offsets, 3))
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
  geo.setAttribute('aKind', new THREE.BufferAttribute(kinds, 1))
  geo.setAttribute('aSpin', new THREE.BufferAttribute(spins, 1))

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: PIXEL_RATIO },
      uAnchor: { value: new THREE.Vector3(...branch.anchor) },
      uColor: { value: new THREE.Color(branch.color) },
      uIntensity: { value: 1 },
      uSaturation: { value: 0.8 },
      uDustTint: { value: new THREE.Color('#c98a4b') },
      uDustAmount: { value: 0.4 },
      uCoreGlow: { value: 0.5 },
      uFade: { value: 1 },
      uFocus: { value: 1 } // 流派聚焦倍率：匹配分支 1.0、其余 ~0.15，无聚焦全 1
    },
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute float aSeed;
      attribute float aKind;
      attribute float aSpin;
      uniform float uTime;
      uniform float uPixelRatio;
      uniform vec3 uAnchor;
      varying float vSeed;
      varying float vKind;

      void main() {
        vSeed = aSeed;
        vKind = aKind;
        // 极慢公转：整片云在呼吸地转，肉眼几乎察觉不到速度，只察觉到"活着"
        float a = uTime * aSpin;
        float ca = cos(a);
        float sa = sin(a);
        vec3 off = position;
        off.xz = mat2(ca, -sa, sa, ca) * off.xz;
        vec4 mv = modelViewMatrix * vec4(uAnchor + off, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(aSize * uPixelRatio * (620.0 / -mv.z), 2.0, 850.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uIntensity;
      uniform float uSaturation;
      uniform vec3 uDustTint;
      uniform float uDustAmount;
      uniform float uCoreGlow;
      uniform float uFade;
      uniform float uFocus;
      varying float vSeed;
      varying float vKind;

      ${NOISE_GLSL}

      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float r = length(uv) * 2.0;
        if (r > 1.0) discard;

        float luma = dot(uColor, vec3(0.299, 0.587, 0.114));
        vec3 branchCol = mix(vec3(luma), uColor, uSaturation);

        // 核心辉光不需要噪声，先走短路径省片元开销
        if (vKind > 1.5) {
          float g = exp(-r * r * 5.0) * smoothstep(1.0, 0.7, r);
          float density = g * uCoreGlow * 0.5;
          vec3 col = mix(branchCol, vec3(1.0, 0.93, 0.82), 0.55);
          float alpha = density * uIntensity * uFade * uFocus;
          gl_FragColor = vec4(col * alpha, alpha);
          return;
        }

        float mask = smoothstep(1.0, 0.15, r);
        // 皮壳像素直接丢弃，不跑 4 层噪声
        if (mask < 0.02) discard;

        // 片内缓慢旋转 + 噪声域漂移：云絮内部在极慢地翻涌
        float rotA = uTime * 0.008 + vSeed;
        float cr = cos(rotA);
        float sr = sin(rotA);
        vec2 nuv = mat2(cr, -sr, sr, cr) * uv;

        float n = fbm(nuv * 2.55 + vSeed * 13.7 + uTime * 0.006);

        float density;
        vec3 col;
        if (vKind > 0.5) {
          // 内层云体：高对比雕刻，亮絮与暗隙并存
          float carve = smoothstep(0.3, 0.8, n);
          density = mask * carve * (0.35 + 0.65 * carve) * 0.4;
          vec3 lit = mix(branchCol, vec3(1.0, 0.95, 0.88), 0.3);
          col = mix(branchCol * 0.55, lit, carve);
        } else {
          // 外层丝絮：稀薄拉丝，暗部沉入尘埃色
          float carve = smoothstep(0.38, 0.9, n);
          density = mask * carve * 0.26;
          col = mix(uDustTint * 0.5, branchCol * 0.9, carve);
          col = mix(col, uDustTint * 0.4, uDustAmount * (1.0 - n));
        }

        float alpha = density * uIntensity * uFade * uFocus;
        gl_FragColor = vec4(col * alpha, alpha);
      }
    `
  })

  const points = new THREE.Points(geo, material)
  points.frustumCulled = false
  points.renderOrder = -5
  return { key, points, material }
}

export function createNebulae() {
  const rand = mulberry32(9200)
  const clouds = Object.entries(BRANCHES).map(([key, branch]) =>
    buildBranchCloud(key, branch, rand)
  )

  const group = new THREE.Group()
  clouds.forEach((c) => group.add(c.points))

  function applyPreset(preset) {
    clouds.forEach((c) => {
      const u = c.material.uniforms
      u.uIntensity.value = preset.nebula.intensity
      u.uSaturation.value = preset.nebula.saturation
      u.uDustTint.value.set(preset.nebula.dustTint)
      u.uDustAmount.value = preset.nebula.dustAmount
      u.uCoreGlow.value = preset.nebula.coreGlow
    })
  }

  // 流派聚焦：给定 branch key 时，匹配云保持全亮、其余沉到 0.15；null 时全部回 1
  let focusKey = null
  const DIM = 0.15
  function setBranchFocus(key) {
    focusKey = key
  }

  let lastT = 0
  function update(t, fade = 1) {
    const dt = Math.min(t - lastT, 0.05)
    lastT = t
    const k = Math.min(1, dt * 6)
    clouds.forEach((c) => {
      const u = c.material.uniforms
      u.uTime.value = t
      u.uFade.value = fade
      const target = focusKey === null || c.key === focusKey ? 1 : DIM
      u.uFocus.value += (target - u.uFocus.value) * k
    })
  }

  return { object: group, update, applyPreset, setBranchFocus }
}
