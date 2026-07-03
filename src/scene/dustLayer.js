import * as THREE from 'three'
import { BRANCHES } from '../data/branches.js'
import { mulberry32 } from '../utils/prng.js'
import { PIXEL_RATIO } from '../utils/display.js'

// 微尘星：物理学史的次级成果，弥散在各学科星云外围。
// 不参与悬停/连线，只提供"这片天空真的很厚"的密度感；
// 颜色是学科色向灰白坍缩后的微光，比理论星暗一个数量级。

export function createDustLayer(dust) {
  const rand = mulberry32(1929)
  const n = dust.length
  const positions = new Float32Array(n * 3)
  const colors = new Float32Array(n * 3)
  const sizes = new Float32Array(n)
  const phases = new Float32Array(n)

  const color = new THREE.Color()
  const grey = new THREE.Color(0.82, 0.85, 0.92)

  dust.forEach((d, i) => {
    positions[i * 3] = d.pos.galaxy[0]
    positions[i * 3 + 1] = d.pos.galaxy[1]
    positions[i * 3 + 2] = d.pos.galaxy[2]
    color.set(BRANCHES[d.branch].color).lerp(grey, 0.6)
    const b = 0.35 + rand() * 0.5
    colors[i * 3] = color.r * b
    colors[i * 3 + 1] = color.g * b
    colors[i * 3 + 2] = color.b * b
    sizes[i] = 1.4 + rand() * 2.2
    phases[i] = rand()
  })

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))

  const posTo = new Float32Array(positions)
  const posToAttr = new THREE.BufferAttribute(posTo, 3)
  geo.setAttribute('aPosTo', posToAttr)

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: PIXEL_RATIO },
      uDim: { value: 1 },
      uLensT: { value: 0 }
    },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aPhase;
      attribute vec3 aPosTo;
      uniform float uTime;
      uniform float uPixelRatio;
      uniform float uLensT;
      varying vec3 vColor;
      varying float vTwinkle;

      void main() {
        float lt = smoothstep(0.0, 1.0, clamp(uLensT * 1.35 - aPhase * 0.35, 0.0, 1.0));
        vec4 mv = modelViewMatrix * vec4(mix(position, aPosTo, lt), 1.0);
        gl_Position = projectionMatrix * mv;
        vColor = aColor;
        vTwinkle = 0.8 + 0.2 * sin(uTime * (0.4 + aPhase * 1.1) + aPhase * 41.0);
        gl_PointSize = clamp(aSize * uPixelRatio * (620.0 / -mv.z), 0.6, 6.0 * uPixelRatio);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uDim;
      varying vec3 vColor;
      varying float vTwinkle;

      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float r2 = dot(d, d);
        float glow = exp(-r2 * 16.0) * smoothstep(0.25, 0.16, r2);
        float alpha = glow * vTwinkle * uDim;
        gl_FragColor = vec4(vColor * alpha, alpha);
      }
    `
  })

  const points = new THREE.Points(geo, material)
  points.frustumCulled = false
  points.renderOrder = -4

  return {
    object: points,
    update(t, dim = 1) {
      material.uniforms.uTime.value = t
      material.uniforms.uDim.value = dim
    },
    beginLens(targets) {
      posTo.set(targets)
      posToAttr.needsUpdate = true
    },
    setLensProgress(v) {
      material.uniforms.uLensT.value = v
    },
    commitLens() {
      geo.attributes.position.array.set(posTo)
      geo.attributes.position.needsUpdate = true
      material.uniforms.uLensT.value = 0
    }
  }
}
