import * as THREE from 'three'
import { mulberry32 } from '../utils/prng.js'
import { PIXEL_RATIO } from '../utils/display.js'

// 星系盘面散星：填充六大星云区之间的空隙，让它们读作"同一片星系"，
// 而不是六个孤立的彩色团。整个盘面在以肉眼几乎不可察的速度旋转。

const CENTER = new THREE.Vector3(80, 0, -100)
const RX = 1180
const RZ = 880

export function createDiscStars() {
  const rand = mulberry32(1905)
  const N = 3400

  const gauss = () => {
    const u = Math.max(rand(), 1e-9)
    const v = rand()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }

  const positions = new Float32Array(N * 3)
  const sizes = new Float32Array(N)
  const brights = new Float32Array(N)
  const phases = new Float32Array(N)

  for (let i = 0; i < N; i += 1) {
    // 椭圆盘面、向心致密、带一点旋涡剪切
    const rr = Math.pow(rand(), 0.55)
    const ang = rand() * Math.PI * 2 + rr * 1.8
    const x = Math.cos(ang) * rr * RX + gauss() * 40
    const z = Math.sin(ang) * rr * RZ + gauss() * 40
    const y = gauss() * (28 + (1 - rr) * 26)

    positions[i * 3] = x
    positions[i * 3 + 1] = y
    positions[i * 3 + 2] = z

    const mag = Math.pow(rand(), 2.6)
    sizes[i] = 0.9 + mag * 3.4
    brights[i] = 0.42 + mag * 1.1
    phases[i] = rand()
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  geo.setAttribute('aBright', new THREE.BufferAttribute(brights, 1))
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: PIXEL_RATIO },
      uCenter: { value: CENTER },
      uTint: { value: new THREE.Color(1.0, 0.94, 0.85) },
      uDim: { value: 1 }
    },
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute float aBright;
      attribute float aPhase;
      uniform float uTime;
      uniform float uPixelRatio;
      uniform vec3 uCenter;
      varying float vBright;
      varying float vTwinkle;

      void main() {
        // 整盘极慢旋转：约 26 分钟一圈
        float a = uTime * 0.004;
        float ca = cos(a);
        float sa = sin(a);
        vec3 pos = position;
        pos.xz = mat2(ca, -sa, sa, ca) * pos.xz;
        vec4 mv = modelViewMatrix * vec4(uCenter + pos, 1.0);
        gl_Position = projectionMatrix * mv;
        vBright = aBright;
        vTwinkle = 0.82 + 0.18 * sin(uTime * (0.5 + aPhase) + aPhase * 37.0);
        gl_PointSize = clamp(aSize * uPixelRatio * (620.0 / -mv.z), 0.6, 7.0 * uPixelRatio);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTint;
      uniform float uDim;
      varying float vBright;
      varying float vTwinkle;

      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float r2 = dot(d, d);
        float glow = exp(-r2 * 16.0) * smoothstep(0.25, 0.16, r2);
        float alpha = glow * vBright * vTwinkle * uDim;
        gl_FragColor = vec4(uTint * alpha, alpha);
      }
    `
  })

  const points = new THREE.Points(geo, material)
  points.frustumCulled = false
  points.renderOrder = -6

  return {
    object: points,
    update(t, dim = 1) {
      material.uniforms.uTime.value = t
      material.uniforms.uDim.value = dim
    },
    applyPreset() {}
  }
}
