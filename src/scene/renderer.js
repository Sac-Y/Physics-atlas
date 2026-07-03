import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { PIXEL_RATIO } from '../utils/display.js'

export function createStage(container) {
  // antialias 关闭：走 EffectComposer 后 MSAA 本就不生效，只浪费默认帧缓冲内存
  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    powerPreference: 'high-performance'
  })
  renderer.setPixelRatio(PIXEL_RATIO)
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.outputColorSpace = THREE.SRGBColorSpace
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()

  const camera = new THREE.PerspectiveCamera(
    46,
    window.innerWidth / window.innerHeight,
    1,
    40000
  )

  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))

  // bloom 用半分辨率渲染目标：辉光本就是低频信息，半分辨率无感、显存减半
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2),
    0.7,
    0.85,
    0.12
  )
  composer.addPass(bloom)
  composer.addPass(new OutputPass())

  function resize() {
    const w = Math.max(window.innerWidth, 1)
    const h = Math.max(window.innerHeight, 1)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
    composer.setSize(w, h)
  }
  // ResizeObserver 而非 window resize：容器从 0 尺寸初始化（如预览面板）也能恢复
  new ResizeObserver(resize).observe(container)
  resize()

  function applyPreset(preset) {
    renderer.toneMappingExposure = preset.exposure
    scene.background = new THREE.Color(preset.background)
    bloom.strength = preset.bloom.strength
    bloom.radius = preset.bloom.radius
    bloom.threshold = preset.bloom.threshold
  }

  return { renderer, scene, camera, composer, bloom, applyPreset }
}
