import type { NodeDefinition } from '../../engine/types'
import { parseOBJ } from '../../render/geometry/obj'
import { identityTransform, type Object3DValue } from '../../render/three/object3d'

export interface ObjParams {
  /** OBJ-filen som data-URL. */
  file: string
  /** Filnavnet, kun for visning. */
  filename: string
  color: string
  roughness: number
  metalness: number
  scale: number
}

/** Leser en data-URL til tekst. */
async function dataUrlToText(dataUrl: string): Promise<string> {
  const response = await fetch(dataUrl)
  return response.text()
}

/**
 * Importert 3D-modell (OBJ).
 *
 * Filen lagres som data-URL i nodens parametere. Da er modellen en del av
 * grafen — den kan kopieres, lagres og deles som alt annet.
 */
export const objSource: NodeDefinition<ObjParams> = {
  type: 'source.obj',
  label: 'OBJ-modell',
  category: 'source',
  description: 'Importerer en 3D-modell fra OBJ. Filen lagres i noden, så modellen kan gjenbrukes.',
  timeDependent: false,
  inputs: [],
  outputs: [{ id: 'out', label: 'Objekt', type: 'object3d' }],
  params: [
    { key: 'file', label: 'OBJ-fil', type: 'file', default: '' },
    { key: 'filename', label: 'Filnavn', type: 'text', default: '' },
    { key: 'color', label: 'Farge', type: 'color', default: '#b9ff66' },
    { key: 'roughness', label: 'Ruheit', type: 'number', default: 0.5, min: 0, max: 1, step: 0.01 },
    { key: 'metalness', label: 'Metallhet', type: 'number', default: 0.1, min: 0, max: 1, step: 0.01 },
    { key: 'scale', label: 'Skala', type: 'number', default: 1, min: 0.05, max: 5, step: 0.01 },
  ],
  async evaluate(ctx, _inputs, p) {
    const source = String(p.file ?? '')
    if (!source) return { out: undefined }

    const key = source.length > 64 ? `${source.length}:${source.slice(0, 64)}` : source
    let geometry = ctx.nodeCache.get('geometry') as
      | { dispose(): void }
      | undefined
    const cachedKey = ctx.nodeCache.get('key') as string | undefined

    if (!geometry || cachedKey !== key) {
      const text = await dataUrlToText(source)
      const model = parseOBJ(text)

      // three.js lastes dynamisk, så modell-import ikke blåser opp pakken.
      const THREE = await import('three')
      const buffer = new THREE.BufferGeometry()
      const positions = new Float32Array(model.vertices.length * 3)
      model.vertices.forEach((v, i) => {
        positions[i * 3] = v[0]
        positions[i * 3 + 1] = v[1]
        positions[i * 3 + 2] = v[2]
      })
      buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3))

      const normals = new Float32Array(model.normals.length * 3)
      model.normals.forEach((n, i) => {
        normals[i * 3] = n[0]
        normals[i * 3 + 1] = n[1]
        normals[i * 3 + 2] = n[2]
      })
      buffer.setAttribute('normal', new THREE.BufferAttribute(normals, 3))

      const indices = new Uint32Array(model.triangles.length * 3)
      model.triangles.forEach((t, i) => {
        indices[i * 3] = t[0]
        indices[i * 3 + 1] = t[1]
        indices[i * 3 + 2] = t[2]
      })
      buffer.setIndex(new THREE.BufferAttribute(indices, 1))
      buffer.computeBoundingSphere()

      geometry?.dispose()
      geometry = buffer
      ctx.nodeCache.set('geometry', geometry)
      ctx.nodeCache.set('key', key)
    }

    const value: Object3DValue = {
      geometry: geometry as never,
      color: String(p.color),
      roughness: Number(p.roughness),
      metalness: Number(p.metalness),
      opacity: 1,
      emissive: '#000000',
      transform: {
        ...identityTransform(),
        scale: { x: Number(p.scale), y: Number(p.scale), z: Number(p.scale) },
      },
    }

    return { out: value }
  },
}
