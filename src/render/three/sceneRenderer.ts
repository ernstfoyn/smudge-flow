import * as THREE from 'three'
import { toObject3D } from './meshBuilder'
import type { Object3DValue } from './object3d'
import type { CameraValue, LightsValue } from './sceneValues'

export interface SceneRenderOptions {
  cameraDistance: number
  cameraHeight: number
  fov: number
  background: string
  ambient: number
  directional: number
  spin: number
  /** Kamera som verdi. Overstyrer avstand/høyde/synsvinkel når den finnes. */
  camera?: CameraValue
  /** Belysning som verdi. Overstyrer lysstyrkene når den finnes. */
  lights?: LightsValue
}

/**
 * Renderer for 3D-scener i grafen.
 *
 * Eier én WebGL-kontekst og tegner objektene ned på et 2D-lerret, slik at
 * 3D kan blandes med 2D-lag i samme kompositt.
 */
export class SceneRenderer {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
  private ambient = new THREE.AmbientLight(0xffffff, 1)
  private key = new THREE.DirectionalLight(0xffffff, 2)
  private rim = new THREE.DirectionalLight(0x88ccff, 0.6)
  private width = 0
  private height = 0

  constructor(width: number, height: number) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      // Trengs for å kunne kopiere lerretet videre med drawImage.
      preserveDrawingBuffer: true,
    })
    this.renderer.setPixelRatio(1)
    this.scene.add(this.ambient)
    this.scene.add(this.key)
    this.scene.add(this.rim)
    this.rim.visible = false
    this.key.position.set(-2, 3, 4)
    this.resize(width, height)
  }

  resize(width: number, height: number): void {
    if (width === this.width && height === this.height) return
    this.width = width
    this.height = height
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / Math.max(1, height)
    this.camera.updateProjectionMatrix()
  }

  /** Tegner objektene og returnerer lerretet med resultatet. */
  render(objects: Object3DValue[], options: SceneRenderOptions, phase: number): HTMLCanvasElement {
    this.resize(this.width, this.height)

    // Tøm scenen (vi bygger den på nytt hver frame — antallet er lite).
    for (const child of [...this.scene.children]) {
      if (child !== this.ambient && child !== this.key && child !== this.rim) {
        this.scene.remove(child)
      }
    }

    for (const object of objects) {
      const node = toObject3D(object)
      // Uten kameranode roterer vi objektene (gammel oppførsel).
      // Med kamera er det kameraet som går rundt — mer naturlig.
      if (options.spin !== 0 && !options.camera) {
        node.rotation.y += phase * Math.PI * 2 * options.spin
      }
      this.scene.add(node)
    }

    this.applyLights(options)
    this.applyCamera(options, phase)

    this.renderer.setClearColor(new THREE.Color(options.background), 0)
    this.renderer.render(this.scene, this.camera)
    return this.renderer.domElement
  }

  private applyCamera(options: SceneRenderOptions, phase: number): void {
    if (options.camera) {
      const camera = options.camera
      let { x, y, z } = camera.position

      // Spin går rundt målet, slik at loopen lukker seg eksakt.
      if (options.spin !== 0) {
        const target = camera.target
        const dx = x - target.x
        const dz = z - target.z
        const angle = phase * Math.PI * 2 * options.spin
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)
        x = target.x + dx * cos - dz * sin
        z = target.z + dx * sin + dz * cos
      }

      this.camera.fov = camera.fov
      this.camera.near = camera.near
      this.camera.far = camera.far
      this.camera.position.set(x, y, z)
      this.camera.lookAt(camera.target.x, camera.target.y, camera.target.z)
      this.camera.updateProjectionMatrix()
      return
    }

    this.camera.fov = options.fov
    this.camera.near = 0.1
    this.camera.far = 100
    this.camera.position.set(0, options.cameraHeight, options.cameraDistance)
    this.camera.lookAt(0, 0, 0)
    this.camera.updateProjectionMatrix()
  }

  private applyLights(options: SceneRenderOptions): void {
    if (options.lights) {
      const lights = options.lights
      this.ambient.color.set(lights.ambient.color)
      this.ambient.intensity = lights.ambient.intensity

      this.key.color.set(lights.key.color)
      this.key.intensity = lights.key.intensity
      this.key.position.set(lights.key.position.x, lights.key.position.y, lights.key.position.z)

      if (lights.rim) {
        this.rim.visible = true
        this.rim.color.set(lights.rim.color)
        this.rim.intensity = lights.rim.intensity
        this.rim.position.set(lights.rim.position.x, lights.rim.position.y, lights.rim.position.z)
      } else {
        this.rim.visible = false
      }
      return
    }

    this.rim.visible = false
    this.ambient.intensity = options.ambient
    this.key.intensity = options.directional
    // Uten lysnode beholder hovedlyset sin faste posisjon fra konstruktøren.
  }

  dispose(): void {
    this.renderer.dispose()
  }
}
