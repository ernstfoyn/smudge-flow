import * as THREE from 'three'
import { toMesh } from './meshBuilder'
import type { Object3DValue } from './object3d'

export interface SceneRenderOptions {
  cameraDistance: number
  cameraHeight: number
  fov: number
  background: string
  ambient: number
  directional: number
  spin: number
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
      if (child !== this.ambient && child !== this.key) this.scene.remove(child)
    }

    for (const object of objects) {
      const mesh = toMesh(object)
      if (options.spin !== 0) {
        mesh.rotation.y += phase * Math.PI * 2 * options.spin
      }
      this.scene.add(mesh)
    }

    const distance = options.cameraDistance
    this.camera.position.set(0, options.cameraHeight, distance)
    this.camera.lookAt(0, 0, 0)
    this.ambient.intensity = options.ambient
    this.key.intensity = options.directional

    this.renderer.setClearColor(new THREE.Color(options.background), 0)
    this.renderer.render(this.scene, this.camera)
    return this.renderer.domElement
  }

  dispose(): void {
    this.renderer.dispose()
  }
}
