import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

// 相机原则：所有运动都是指数阻尼（damp），永远没有线性缓动、没有硬切。
const MIN_R = 120
const MAX_R = 7800
const OVERVIEW_TARGET = new THREE.Vector3(80, 0, -100)
const OVERVIEW_DIRECTION = new THREE.Vector3(0.35, 0.52, 1).normalize()
const INTRO_RADIUS = 5400
const OVERVIEW_RADIUS = 1900

export function createCameraRig(camera, domElement) {
  const controls = new OrbitControls(camera, domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.055
  controls.rotateSpeed = 0.55
  controls.enablePan = false
  controls.enableZoom = false // 缩放自己接管，做平滑 dolly

  controls.target.copy(OVERVIEW_TARGET) // 星系视觉重心（外扩后的锚点质心）

  // 开场：从极远处缓缓沉入
  let radius = INTRO_RADIUS
  let targetRadius = OVERVIEW_RADIUS
  camera.position.copy(OVERVIEW_DIRECTION).multiplyScalar(radius)
    .add(controls.target)
  camera.lookAt(controls.target)

  let lastInteraction = -6 // 负值让开场自转立刻开始渐入
  let autoRotate = 0
  const desiredTarget = controls.target.clone()
  let desiredDirection = null

  function interruptFlight() {
    desiredDirection = null
    desiredTarget.copy(controls.target)
    targetRadius = radius
  }

  domElement.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault()
      desiredDirection = null
      desiredTarget.copy(controls.target)
      targetRadius = THREE.MathUtils.clamp(
        radius * Math.exp(e.deltaY * 0.0011),
        MIN_R,
        MAX_R
      )
      lastInteraction = performance.now() / 1000
    },
    { passive: false }
  )
  domElement.addEventListener('pointerdown', () => {
    interruptFlight()
    lastInteraction = performance.now() / 1000
  })

  const dir = new THREE.Vector3()

  function update(dt, t) {
    // 静置 5 秒后星空开始极慢自转（3 秒渐入渐出）
    const idle = t - lastInteraction
    const targetAuto = idle > 5 ? 1 : 0
    autoRotate = THREE.MathUtils.damp(autoRotate, targetAuto, 0.8, dt)
    controls.autoRotate = autoRotate > 0.01
    controls.autoRotateSpeed = 0.16 * autoRotate

    controls.update()

    // 注视点与半径都指数收敛（fly-to 与滚轮共用同一套阻尼）
    controls.target.x = THREE.MathUtils.damp(controls.target.x, desiredTarget.x, 3.0, dt)
    controls.target.y = THREE.MathUtils.damp(controls.target.y, desiredTarget.y, 3.0, dt)
    controls.target.z = THREE.MathUtils.damp(controls.target.z, desiredTarget.z, 3.0, dt)
    radius = THREE.MathUtils.damp(radius, targetRadius, 3.0, dt)
    dir.copy(camera.position).sub(controls.target).normalize()
    if (desiredDirection) {
      dir.x = THREE.MathUtils.damp(dir.x, desiredDirection.x, 3.0, dt)
      dir.y = THREE.MathUtils.damp(dir.y, desiredDirection.y, 3.0, dt)
      dir.z = THREE.MathUtils.damp(dir.z, desiredDirection.z, 3.0, dt)
      dir.normalize()
      if (dir.angleTo(desiredDirection) < 0.002) desiredDirection = null
    }
    camera.position.copy(controls.target).addScaledVector(dir, radius)
    camera.lookAt(controls.target)

    return radius
  }

  // 飞向一颗星：注视点移过去、半径收到近景。
  // sideShift>0 时注视点向相机右侧偏移，给右侧档案卡让出构图。
  const right = new THREE.Vector3()
  function focusOn(worldPos, r = 320, sideShift = 80) {
    desiredDirection = null
    right.setFromMatrixColumn(camera.matrix, 0).setY(0).normalize()
    desiredTarget.copy(worldPos).addScaledVector(right, sideShift)
    targetRadius = THREE.MathUtils.clamp(r, MIN_R, MAX_R)
    lastInteraction = performance.now() / 1000
  }

  function flyToView(worldPos, r, direction = null) {
    desiredTarget.copy(worldPos)
    desiredDirection = direction ? direction.clone().normalize() : null
    targetRadius = THREE.MathUtils.clamp(r, MIN_R, MAX_R)
    lastInteraction = performance.now() / 1000
  }

  // 只转向、不动注视点/半径：dir 为「注视点 → 相机」的目标方向单位向量，或 null 清空。
  // 收敛与到位清空由 update() 里既有的 desiredDirection 阻尼逻辑处理；
  // 用户 pointerdown / wheel 会立即清空（interruptFlight / wheel 监听），交还控制权。
  function steerTo(direction) {
    desiredDirection = direction ? direction.clone().normalize() : null
    if (direction) lastInteraction = performance.now() / 1000
  }

  function getZoom01() {
    return THREE.MathUtils.clamp(
      (Math.log(radius) - Math.log(MIN_R)) / (Math.log(MAX_R) - Math.log(MIN_R)),
      0,
      1
    )
  }

  function setTargetRadius(r) {
    targetRadius = THREE.MathUtils.clamp(r, MIN_R, MAX_R)
    lastInteraction = performance.now() / 1000
  }

  function resetOverview() {
    flyToView(OVERVIEW_TARGET, OVERVIEW_RADIUS, OVERVIEW_DIRECTION)
  }

  return {
    controls,
    update,
    getZoom01,
    setTargetRadius,
    resetOverview,
    flyToView,
    focusOn,
    steerTo,
    get radius() { return radius }
  }
}
