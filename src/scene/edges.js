import * as THREE from 'three'
import { BRANCHES } from '../data/branches.js'
import { mulberry32 } from '../utils/prng.js'

// 传承光丝：实线 = 直接推导（derivation），虚线 = 启发（inspiration）。
// 光包沿线从"肩膀"流向"站上来的人"，方向即影响传递的方向。
// 中景才浮现（uReveal 由相机距离驱动），远景让位给星云。

const SEGMENTS = 22

function edgeCurve(a, b) {
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5)
  const dist = a.distanceTo(b)
  // 拱起方向：向上 + 微微向星系外，让线离开盘面呈弧
  const out = mid.clone().setY(0).normalize()
  mid.addScaledVector(new THREE.Vector3(0, 1, 0), dist * 0.09)
  mid.addScaledVector(out, dist * 0.04)
  return new THREE.QuadraticBezierCurve3(a, mid, b)
}

export function createLineage(stars, edges) {
  const rand = mulberry32(1865)
  const byId = new Map(stars.map((s) => [s.id, s]))

  const vertCount = edges.length * SEGMENTS * 2
  const positions = new Float32Array(vertCount * 3)
  const colors = new Float32Array(vertCount * 3)
  const tAlong = new Float32Array(vertCount)
  const types = new Float32Array(vertCount)
  const phases = new Float32Array(vertCount)
  const lens = new Float32Array(vertCount)

  const colA = new THREE.Color()
  const colB = new THREE.Color()
  const mixed = new THREE.Color()

  // 每条边的顶点区间与端点，供悬停聚焦时点亮
  const edgeMeta = []

  let v = 0
  edges.forEach((edge) => {
    edgeMeta.push({ from: edge.from, to: edge.to, start: v, count: SEGMENTS * 2 })
    const from = byId.get(edge.from)
    const to = byId.get(edge.to)
    const a = new THREE.Vector3(...from.pos.galaxy)
    const b = new THREE.Vector3(...to.pos.galaxy)
    const curve = edgeCurve(a, b)
    const pts = curve.getPoints(SEGMENTS)
    const type = edge.type === 'inspiration' ? 1 : 0
    const phase = rand()
    const len = a.distanceTo(b)

    colA.set(BRANCHES[from.branch].color)
    colB.set(BRANCHES[to.branch].color)

    for (let i = 0; i < SEGMENTS; i += 1) {
      for (const [pt, t] of [
        [pts[i], i / SEGMENTS],
        [pts[i + 1], (i + 1) / SEGMENTS]
      ]) {
        positions[v * 3] = pt.x
        positions[v * 3 + 1] = pt.y
        positions[v * 3 + 2] = pt.z
        // 线色：两端学科色渐变，再向白偏移——它是"光"，不是彩带
        mixed.copy(colA).lerp(colB, t).lerp(new THREE.Color(1, 1, 1), 0.4)
        colors[v * 3] = mixed.r
        colors[v * 3 + 1] = mixed.g
        colors[v * 3 + 2] = mixed.b
        tAlong[v] = t
        types[v] = type
        phases[v] = phase
        lens[v] = len
        v += 1
      }
    }
  })

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
  geo.setAttribute('aT', new THREE.BufferAttribute(tAlong, 1))
  geo.setAttribute('aType', new THREE.BufferAttribute(types, 1))
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))
  geo.setAttribute('aLen', new THREE.BufferAttribute(lens, 1))

  const his = new Float32Array(vertCount)
  const hiAttr = new THREE.BufferAttribute(his, 1)
  geo.setAttribute('aHi', hiAttr)

  // 透镜切换：按目标布局重算全部弧线顶点
  function computePositions(lensKey) {
    const out = new Float32Array(vertCount * 3)
    let vi = 0
    edges.forEach((edge) => {
      const a = new THREE.Vector3(...byId.get(edge.from).pos[lensKey])
      const b = new THREE.Vector3(...byId.get(edge.to).pos[lensKey])
      const pts = edgeCurve(a, b).getPoints(SEGMENTS)
      for (let i = 0; i < SEGMENTS; i += 1) {
        for (const pt of [pts[i], pts[i + 1]]) {
          out[vi * 3] = pt.x
          out[vi * 3 + 1] = pt.y
          out[vi * 3 + 2] = pt.z
          vi += 1
        }
      }
    })
    return out
  }

  const posTo = new Float32Array(positions)
  const posToAttr = new THREE.BufferAttribute(posTo, 3)
  geo.setAttribute('aPosTo', posToAttr)

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uReveal: { value: 0 },
      uFocus: { value: 0 },
      uLensT: { value: 0 }
    },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aT;
      attribute float aType;
      attribute float aPhase;
      attribute float aLen;
      attribute float aHi;
      attribute vec3 aPosTo;
      uniform float uLensT;
      varying vec3 vColor;
      varying float vT;
      varying float vType;
      varying float vPhase;
      varying float vLen;
      varying float vHi;

      void main() {
        vColor = aColor;
        vT = aT;
        vType = aType;
        vPhase = aPhase;
        vLen = aLen;
        vHi = aHi;
        float lt = smoothstep(0.0, 1.0, clamp(uLensT * 1.35 - aPhase * 0.35, 0.0, 1.0));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(mix(position, aPosTo, lt), 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uReveal;
      uniform float uFocus;
      varying vec3 vColor;
      varying float vT;
      varying float vType;
      varying float vPhase;
      varying float vLen;
      varying float vHi;

      void main() {
        // 虚线（启发关系）：大间隔断续 + 偏灰色温，与实线（推导）拉开语义距离
        float tri = abs(fract(vT * vLen / 16.0) * 2.0 - 1.0);
        float dash = vType > 0.5 ? smoothstep(0.42, 0.58, tri) : 1.0;

        // 常亮基线：极克制，启发线更淡
        float base = vType > 0.5 ? 0.05 : 0.13;

        // 流光：光包从 t=0（源头）流向 t=1（后继），拖尾渐隐
        float flow = fract(vT - uTime * 0.07 - vPhase);
        float pulse = exp(-flow * 6.5) * 0.85;

        float alpha = (base + pulse) * dash * uReveal;
        vec3 col = mix(vColor, vec3(0.62, 0.66, 0.74), vType * 0.55);
        col *= 0.5 + pulse * 2.4;

        // 悬停聚焦：相关线常亮提色，无关线几乎熄灭
        float focusMul = mix(1.0, mix(0.05, 3.4, vHi), uFocus);
        alpha *= focusMul;
        col = mix(col, vColor * 1.35, uFocus * vHi * 0.7);
        // 聚焦线在远景也可见
        alpha = mix(alpha, min(alpha + 0.28 * vHi * dash, 1.0), uFocus);

        gl_FragColor = vec4(col * alpha, alpha);
      }
    `
  })

  const lines = new THREE.LineSegments(geo, material)
  lines.frustumCulled = false

  let focusTarget = 0
  let lastT = 0

  // 点亮传承：默认点亮与某星直接相连的边；给 idSet 时点亮血脉内全部边
  function setFocus(starId, idSet = null) {
    focusTarget = starId ? 1 : 0
    if (starId) {
      edgeMeta.forEach((m) => {
        const hi = idSet
          ? idSet.has(m.from) && idSet.has(m.to)
          : m.from === starId || m.to === starId
        his.fill(hi ? 1 : 0, m.start, m.start + m.count)
      })
      hiAttr.needsUpdate = true
    }
  }

  // 流派聚焦：两端都在集合内的边点亮（展示流派内部师承网），其余熄灭。
  // 与 setFocus 共用 aHi/focusTarget——hover.js 每帧只调其一，二者不打架。
  function setFocusIds(idSet) {
    focusTarget = idSet ? 1 : 0
    if (idSet) {
      edgeMeta.forEach((m) => {
        const hi = idSet.has(m.from) && idSet.has(m.to)
        his.fill(hi ? 1 : 0, m.start, m.start + m.count)
      })
      hiAttr.needsUpdate = true
    }
  }

  function update(t, reveal) {
    const dt = Math.min(t - lastT, 0.05)
    lastT = t
    material.uniforms.uTime.value = t
    // 聚焦时连线无视 LOD 显影（远景悬停也能看清脉络）
    const u = material.uniforms
    u.uFocus.value += (focusTarget - u.uFocus.value) * Math.min(1, dt * 7)
    u.uReveal.value = Math.max(reveal, u.uFocus.value)
  }

  function beginLens(lensKey) {
    posTo.set(computePositions(lensKey))
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

  return { object: lines, update, setFocus, setFocusIds, beginLens, setLensProgress, commitLens }
}
