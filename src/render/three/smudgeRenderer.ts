import * as THREE from 'three'
import { smudgeFragmentShader } from '../shaders/smudgeFragment.glsl'
import { smudgeVertexShader } from '../shaders/smudgeVertex.glsl'

export type SmudgeShape = 'plane' | 'sphere' | 'cylinder'

export interface SmudgeUniforms {
  uTime: number
  uTwist: number
  uPull: number
  uNoiseScale: number
  uOctaves: number
  uNoiseType: number
  uRepeat: number
  uMirror: number
  uKaleido: number
  uTrailCount: number
  uTrailSpread: number
  uTrailSwirl: number
  uTrailFade: number
  uHue: number
  uSaturation: number
  uGloss: number
  uRimColor: string
}

export interface SmudgeTransform {
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number }
  scale: number
}

/**
 * Renderer for Smudge-materialet.
 *
 * Port av Stage.jsx i Smudge_animator @ 81cf506: et sterkt subdividert
 * plan (eller kule/sylinder) med egen vertex-shader som forskyver
 * vertexene etter et støyfelt, og en fragment-shader som bygger
 * trailen, fargerommet og glass-glansen.
 */
export class SmudgeRenderer {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
  private mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>
  private material: THREE.ShaderMaterial
  private texture: THREE.Texture
  private geometry: THREE.BufferGeometry
  private shape: SmudgeShape = 'plane'
  private segments = 180
  private width = 0
  private height = 0

  constructor(width: number, height: number) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    })
    this.renderer.setPixelRatio(1)
    this.renderer.setClearColor(new THREE.Color('#000000'), 0)

    this.texture = new THREE.Texture()
    this.texture.minFilter = THREE.LinearFilter
    this.texture.magFilter = THREE.LinearFilter
    this.texture.generateMipmaps = false

    this.material = new THREE.ShaderMaterial({
      vertexShader: smudgeVertexShader,
      fragmentShader: smudgeFragmentShader,
      side: THREE.DoubleSide,
      toneMapped: false,
      uniforms: {
        uTexture: { value: this.texture },
        uTime: { value: 0 },
        uTwist: { value: 0 },
        uPull: { value: 0 },
        uNoiseScale: { value: 1.6 },
        uOctaves: { value: 4 },
        uNoiseType: { value: 0 },
        uRepeat: { value: 1 },
        uMirror: { value: 0 },
        uKaleido: { value: 0 },
        uTrailCount: { value: 0 },
        uTrailSpread: { value: 0.55 },
        uTrailSwirl: { value: 0.5 },
        uTrailFade: { value: 0.85 },
        uHue: { value: 0 },
        uSaturation: { value: 1 },
        uGloss: { value: 1 },
        uRimColor: { value: new THREE.Color('#8be9fd') },
      },
    })

    this.geometry = this.buildGeometry('plane', 180)
    this.mesh = new THREE.Mesh(this.geometry, this.material)
    this.scene.add(this.mesh)

    this.resize(width, height)
  }

  private buildGeometry(shape: SmudgeShape, segments: number): THREE.BufferGeometry {
    const seg = Math.max(8, Math.round(segments))
    switch (shape) {
      case 'sphere':
        return new THREE.SphereGeometry(1.25, seg, seg)
      case 'cylinder':
        return new THREE.CylinderGeometry(1.0, 1.0, 2.4, seg, seg, true)
      case 'plane':
      default:
        return new THREE.PlaneGeometry(2.4, 2.4, seg, seg)
    }
  }

  resize(width: number, height: number): void {
    if (width === this.width && height === this.height) return
    this.width = width
    this.height = height
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / Math.max(1, height)
    this.camera.updateProjectionMatrix()
  }

  /** Bytter geometri når formen endres. */
  setShape(shape: SmudgeShape, segments: number): void {
    const seg = Math.max(8, Math.round(segments))
    if (shape === this.shape && seg === this.segments) return
    this.shape = shape
    this.segments = seg
    this.geometry.dispose()
    this.geometry = this.buildGeometry(shape, seg)
    this.mesh.geometry = this.geometry
  }

  setInput(image: CanvasImageSource): void {
    this.texture.image = image as TexImageSource
    this.texture.needsUpdate = true
  }

  setUniforms(values: SmudgeUniforms): void {
    const u = this.material.uniforms
    u.uTime.value = values.uTime
    u.uTwist.value = values.uTwist
    u.uPull.value = values.uPull
    u.uNoiseScale.value = values.uNoiseScale
    u.uOctaves.value = values.uOctaves
    u.uNoiseType.value = values.uNoiseType
    u.uRepeat.value = values.uRepeat
    u.uMirror.value = values.uMirror
    u.uKaleido.value = values.uKaleido
    u.uTrailCount.value = values.uTrailCount
    u.uTrailSpread.value = values.uTrailSpread
    u.uTrailSwirl.value = values.uTrailSwirl
    u.uTrailFade.value = values.uTrailFade
    u.uHue.value = values.uHue
    u.uSaturation.value = values.uSaturation
    u.uGloss.value = values.uGloss
    ;(u.uRimColor.value as THREE.Color).set(values.uRimColor)
  }

  setTransform(transform: SmudgeTransform): void {
    this.mesh.position.set(transform.position.x, transform.position.y, transform.position.z)
    this.mesh.rotation.set(
      THREE.MathUtils.degToRad(transform.rotation.x),
      THREE.MathUtils.degToRad(transform.rotation.y),
      THREE.MathUtils.degToRad(transform.rotation.z),
    )
    this.mesh.scale.setScalar(transform.scale)
  }

  render(cameraDistance = 3.6): HTMLCanvasElement {
    this.camera.position.set(0, 0, cameraDistance)
    this.camera.lookAt(0, 0, 0)
    this.renderer.setRenderTarget(null)
    this.renderer.render(this.scene, this.camera)
    return this.renderer.domElement
  }

  dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
    this.texture.dispose()
    this.renderer.dispose()
  }
}
