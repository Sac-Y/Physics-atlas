import * as THREE from 'three'
import { BRANCHES } from '../data/branches.js'
import { PIXEL_RATIO } from '../utils/display.js'

// 理论恒星层：大小/亮度 = 影响力，颜色 = 学科。
// 白热核心 + 学科色光晕 + 衍射星芒；前沿理论缓慢脉动，经典沉稳。

const INFLUENCE_SIZE = { 1: 38, 2: 50, 3: 68, 4: 98, 5: 152 }

export function createTheoryStars(starData) {
  const n = starData.length
  const positions = new Float32Array(n * 3)
  const colors = new Float32Array(n * 3)
  const sizes = new Float32Array(n)
  const pulses = new Float32Array(n)
  const phases = new Float32Array(n)

  const color = new THREE.Color()
  starData.forEach((s, i) => {
    positions[i * 3] = s.pos[0]
    positions[i * 3 + 1] = s.pos[1]
    positions[i * 3 + 2] = s.pos[2]
    color.set(BRANCHES[s.branch].color)
    colors[i * 3] = color.r
    colors[i * 3 + 1] = color.g
    colors[i * 3 + 2] = color.b
    sizes[i] = INFLUENCE_SIZE[s.influence] ?? 34
    pulses[i] = s.frontier ? 1 : 0
    phases[i] = (i * 0.618) % 1
  })

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  geo.setAttribute('aPulse', new THREE.BufferAttribute(pulses, 1))
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))

  const keeps = new Float32Array(n)
  const keepAttr = new THREE.BufferAttribute(keeps, 1)
  geo.setAttribute('aKeep', keepAttr)

  // 透镜切换：目标坐标槽，shader 内 mix，粒子按 aPhase 错峰启动
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
      uSpike: { value: 1 },
      uHalo: { value: 1 },
      uCoreHeat: { value: 0.8 },
      uFocus: { value: 0 },
      uLensT: { value: 0 },
      uIntro: { value: 1 }
    },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aPulse;
      attribute float aPhase;
      attribute float aKeep;
      attribute vec3 aPosTo;
      uniform float uTime;
      uniform float uPixelRatio;
      uniform float uLensT;
      varying vec3 vColor;
      varying float vBig;
      varying float vKeep;

      void main() {
        vColor = aColor;
        vBig = smoothstep(40.0, 110.0, aSize);
        vKeep = aKeep;
        // 前沿理论的脉动：4% 振幅、~5s 周期，是呼吸不是闪烁
        float pulse = 1.0 + aPulse * 0.04 * sin(uTime * 1.25 + aPhase * 6.2831);
        // 透镜流动：每颗星按相位错峰出发，整片星空像水流过
        float lt = smoothstep(0.0, 1.0, clamp(uLensT * 1.35 - aPhase * 0.35, 0.0, 1.0));
        vec3 pos = mix(position, aPosTo, lt);
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(aSize * pulse * uPixelRatio * (620.0 / -mv.z), 2.0, 380.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uSpike;
      uniform float uHalo;
      uniform float uCoreHeat;
      uniform float uFocus;
      uniform float uIntro;
      varying vec3 vColor;
      varying float vBig;
      varying float vKeep;

      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float r = length(p);
        if (r > 1.0) discard;

        // 边缘羽化：一切分量在 sprite 边界前平滑归零，近景放大也不暴露 quad/圆盘硬边
        float edge = smoothstep(1.0, 0.72, r);

        // 白热核心
        float core = exp(-r * r * 42.0);
        // 学科色光晕：双层衰减，边缘极软
        float halo = exp(-r * 3.2) * 0.55 + exp(-r * 8.0) * 0.5;
        // 衍射星芒：只有大星（超巨星）才配得上，细而长，随尺寸渐显
        float sx = pow(max(0.0, 1.0 - abs(p.y)), 60.0) * exp(-abs(p.x) * 2.4);
        float sy = pow(max(0.0, 1.0 - abs(p.x)), 60.0) * exp(-abs(p.y) * 2.4);
        float spikes = (sx + sy) * uSpike * vBig * 1.1;

        vec3 hot = mix(vColor, vec3(1.0, 0.98, 0.94), uCoreHeat);
        vec3 col = hot * core * (1.7 + vBig * 1.4)
                 + vColor * halo * uHalo * (1.0 + vBig * 0.6)
                 + mix(vColor, vec3(1.0), 0.6) * spikes;
        // 悬停聚焦：脉络内的星保持/微增亮度，其余沉暗
        float focusMul = mix(1.0, mix(0.16, 1.25, vKeep), uFocus) * uIntro;

        float alpha = (core + halo * 0.6 * uHalo + spikes) * edge * focusMul;
        gl_FragColor = vec4(col * edge * focusMul, alpha);
      }
    `
  })

  const points = new THREE.Points(geo, material)
  points.frustumCulled = false

  function applyPreset(preset) {
    material.uniforms.uSpike.value = preset.stars.spike
    material.uniforms.uHalo.value = preset.stars.halo
    material.uniforms.uCoreHeat.value = preset.stars.coreHeat
  }

  let focusTarget = 0
  let lastT = 0

  // 聚焦：keepIndices 内的星保持明亮，其余沉暗（null 取消）
  function setFocus(keepIndices) {
    focusTarget = keepIndices ? 1 : 0
    if (keepIndices) {
      for (let i = 0; i < n; i += 1) keeps[i] = keepIndices.has(i) ? 1 : 0
      keepAttr.needsUpdate = true
    }
  }

  function update(t) {
    const dt = Math.min(t - lastT, 0.05)
    lastT = t
    material.uniforms.uTime.value = t
    const u = material.uniforms.uFocus
    u.value += (focusTarget - u.value) * Math.min(1, dt * 7)
  }

  // —— 透镜切换 ——
  function beginLens(targets) {
    posTo.set(targets)
    posToAttr.needsUpdate = true
  }
  function setLensProgress(v) {
    material.uniforms.uLensT.value = v
  }
  function commitLens() {
    geo.attributes.position.array.set(posTo)
    geo.attributes.position.needsUpdate = true
    material.uniforms.uLensT.value = 0
  }

  return {
    object: points,
    update,
    applyPreset,
    setFocus,
    beginLens,
    setLensProgress,
    commitLens,
    setIntro(v) {
      material.uniforms.uIntro.value = v
    }
  }
}
