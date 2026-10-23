import * as THREE from 'three'
import { lookPreamble, postVertexShader } from '../shaders/looks'

export interface PostOptions {  /** GLOW-koden for effekten (uten preamble). */
  glsl: string
  /**
   * Sant hvis `glsl` er en komplett fragment-shader, med egen main().
   * Da brukes den som den er, og resten av uniformene settes under.
   */
  custom?: boolean
  /** Styrke 0..2. */
  amount: number
  /** Skala/frekvens 0..1. */
  scale: number
  /** Animert tid, i sekunder. */
  time: number
  /** Ekstra tall-uniformer (vec2 sendes som tallpar). */
  uniforms?: Record<string, number | [number, number]>
  /** Ekstra farge-uniformer. */
  colors?: Record<string, string>
}

/**
 * Tom tekstur for generatorer som ikke har noen inngang.
 * En 1×1-lerret er nok: shaderen sampler den aldri.
 */
function blankCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  return canvas
}

/**
 * Fullskjerm-postprosessering.
 *
 * Alle effektnoder deler ÉN WebGL-kontekst. Nettleserne begrenser antallet
 * levende kontekster, så 16 effekt-noder må ikke hver sin kontekst.
 *
 * Materialene caches per GLOW-kode, slik at hver effekt bare kompileres én gang.
 */
export class PostProcess {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private quad: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>
  private materials = new Map<string, THREE.ShaderMaterial>()
  private texture: THREE.Texture
  private width = 0
  private height = 0

  constructor(width: number, height: number) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: true,
    })
    this.renderer.setPixelRatio(1)

    this.texture = new THREE.Texture(blankCanvas())
    this.texture.needsUpdate = true
    this.texture.minFilter = THREE.LinearFilter
    this.texture.magFilter = THREE.LinearFilter
    this.texture.generateMipmaps = false

    const geometry = new THREE.PlaneGeometry(2, 2)
    const material = new THREE.ShaderMaterial({
      vertexShader: postVertexShader,
      fragmentShader: `${lookPreamble}
vec3 applyLook(vec3 col, vec2 uv, vec2 centered) {
  return col;
}
void main() {
  vec2 uv = vUv;
  vec2 centered = uv - 0.5;
  vec3 col = texture2D(uTexture, uv).rgb;
  col = applyLook(col, uv, centered);
  gl_FragColor = vec4(col, 1.0);
}
`,
      uniforms: {
        uTexture: { value: this.texture },
        uAmount: { value: 1 },
        uScale: { value: 0.5 },
        uTime: { value: 0 },
      },
    })

    this.quad = new THREE.Mesh(geometry, material)
    this.quad.frustumCulled = false
    this.scene.add(this.quad)

    this.resize(width, height)
  }

  resize(width: number, height: number): void {
    if (width === this.width && height === this.height) return
    this.width = width
    this.height = height
    this.renderer.setSize(width, height, false)
  }

  /**
   * Setter sammen shaderen for én effekt.
   *
   * Effektkoden blir kroppen i applyLook(), slik at den får tilgang på
   * uAmount (bl/pw), uScale (sc) og retningen (dir) — akkurat som i den
   * gamle monolittiske shaderen.
   */
  private materialFor(glsl: string, custom: boolean): THREE.ShaderMaterial {
    const key = custom ? `custom:${glsl}` : glsl
    const cached = this.materials.get(key)
    if (cached) return cached

    const fragmentShader = custom
      ? glsl
      : `${lookPreamble}
vec3 applyLook(vec3 col, vec2 uv, vec2 centered) {
  float bl = clamp(uAmount, 0.0, 1.0);   // hvor mye den blandes inn
  float pw = uAmount;                   // styrken i effekten selv
  float sc = uScale;
  vec2 dir = normalize(centered + 1e-5);
${glsl}
}
void main() {
  vec2 uv = vUv;
  vec2 centered = uv - 0.5;
  vec3 col = texture2D(uTexture, uv).rgb;
  col = applyLook(col, uv, centered);
  gl_FragColor = vec4(col, 1.0);
}
`

    const material = new THREE.ShaderMaterial({
      vertexShader: postVertexShader,
      fragmentShader,
      uniforms: {
        uTexture: { value: this.texture },
        uAmount: { value: 1 },
        uScale: { value: 0.5 },
        uTime: { value: 0 },
      },
    })
    this.materials.set(key, material)
    return material
  }

  /** Kjører et pass og returnerer resultatet i et lerret. */
  render(input: CanvasImageSource | null, options: PostOptions): HTMLCanvasElement {
    this.resize(this.width, this.height)

    // Generatorer (støy, celler) har ingen inngang. Da beholder vi den
    // tomme 1×1-teksturen, som shaderen uansett ikke sampler.
    if (input) {
      this.texture.image = input as TexImageSource
      this.texture.needsUpdate = true
    }

    const material = this.materialFor(options.glsl, !!options.custom)
    material.uniforms.uAmount.value = options.amount
    material.uniforms.uScale.value = options.scale
    material.uniforms.uTime.value = options.time

    // Ekstra uniformer (blob-shaderen har en hel haug).
    for (const [name, value] of Object.entries(options.uniforms ?? {})) {
      if (!material.uniforms[name]) {
        material.uniforms[name] = { value: 0 }
      }
      if (Array.isArray(value)) {
        material.uniforms[name].value = new THREE.Vector2(value[0], value[1])
      } else {
        material.uniforms[name].value = value
      }
    }
    for (const [name, value] of Object.entries(options.colors ?? {})) {
      if (!material.uniforms[name]) {
        material.uniforms[name] = { value: new THREE.Color(value) }
      } else {
        ;(material.uniforms[name].value as THREE.Color).set(value)
      }
    }

    this.quad.material = material

    this.renderer.setRenderTarget(null)
    this.renderer.render(this.scene, this.camera)
    return this.renderer.domElement
  }

  dispose(): void {
    for (const material of this.materials.values()) material.dispose()
    this.texture.dispose()
    this.renderer.dispose()
  }
}
