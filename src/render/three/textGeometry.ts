import type { BufferGeometry } from 'three'
import type { Font, FontData } from 'three/examples/jsm/loaders/FontLoader.js'

export interface TextGeometrySpec {
  text: string
  size: number
  depth: number
  segments: number
  /** Font-ID fra TEXT3D_FONTS. */
  font: string
}

type FontLoaderModule = { default: unknown }

const FONT_LOADERS: Record<string, () => Promise<FontLoaderModule>> = {
  'droid-sans-regular': () => import('../../assets/droid_sans_regular.typeface.json'),
  'droid-sans-bold': () => import('../../assets/droid_sans_bold.typeface.json'),
  'droid-sans-mono-regular': () => import('../../assets/droid_sans_mono_regular.typeface.json'),
  'droid-serif-regular': () => import('../../assets/droid_serif_regular.typeface.json'),
  'droid-serif-bold': () => import('../../assets/droid_serif_bold.typeface.json'),
  'gentilis-regular': () => import('../../assets/gentilis_regular.typeface.json'),
  'gentilis-bold': () => import('../../assets/gentilis_bold.typeface.json'),
}

const fontCache = new Map<string, Promise<Font>>()

function loadFont(id: string): Promise<Font> {
  const key = FONT_LOADERS[id] ? id : 'droid-sans-regular'
  const existing = fontCache.get(key)
  if (existing) return existing

  const promise = (async () => {
    const [{ FontLoader }, data] = await Promise.all([
      import('three/examples/jsm/loaders/FontLoader.js'),
      FONT_LOADERS[key](),
    ])
    return new FontLoader().parse(data.default as unknown as FontData)
  })()
  fontCache.set(key, promise)
  return promise
}

/**
 * Bygger ekstrudert tekstgeometri, sentrert rundt origo.
 *
 * `depth` er tykkelsen. Med `depth: 0` blir teksten flat, men fortsatt ekte
 * geometri — den kan roteres og belyses som alt annet i scenen.
 */
export async function buildTextGeometry(spec: TextGeometrySpec): Promise<BufferGeometry> {
  const [{ TextGeometry }, font] = await Promise.all([
    import('three/examples/jsm/geometries/TextGeometry.js'),
    loadFont(spec.font),
  ])

  const geometry = new TextGeometry(spec.text.length > 0 ? spec.text : ' ', {
    font,
    size: Math.max(0.05, spec.size),
    depth: Math.max(0, spec.depth),
    curveSegments: Math.max(1, Math.round(spec.segments)),
    bevelEnabled: false,
  })
  geometry.center()
  return geometry
}
