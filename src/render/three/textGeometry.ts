import type { BufferGeometry } from 'three'
import type { Font, FontData } from 'three/examples/jsm/loaders/FontLoader.js'

export interface TextGeometrySpec {
  text: string
  size: number
  depth: number
  segments: number
}

/**
 * Skrifttypen som følger med er Droid Sans. Den ligger i `src/assets`
 * sammen med lisensen, ikke i three-pakken: npm-utgaven av three har ikke
 * eksempelfontene. Droid Sans dekker nordiske tegn (ÆØÅ).
 *
 * Fonten lastes og parses én gang per økt, uansett hvor mange tekstnoder
 * som finnes.
 */
let fontPromise: Promise<Font> | null = null

function loadFont(): Promise<Font> {
  fontPromise ??= (async () => {
    const [{ FontLoader }, data] = await Promise.all([
      import('three/examples/jsm/loaders/FontLoader.js'),
      import('../../assets/droid_sans_regular.typeface.json'),
    ])
    return new FontLoader().parse(data.default as unknown as FontData)
  })()
  return fontPromise
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
    loadFont(),
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
