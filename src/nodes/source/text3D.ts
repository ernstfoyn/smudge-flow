import type { BufferGeometry } from 'three'
import type { NodeDefinition } from '../../engine/types'
import { identityTransform, type Object3DValue, type ShadingMode } from '../../render/three/object3d'

export interface Text3DParams {
  text: string
  size: number
  depth: number
  segments: number
  shading: string
  color: string
  roughness: number
  metalness: number
  opacity: number
  emissive: string
}

/**
 * Ekte 3D-tekst: tekstens omriss ekstruderes til geometri.
 *
 * Geometrien er uendret mellom frames, så den memoiseres på samme måte som
 * `source.mesh3D`. Endres teksten, bygges den på nytt og den gamle disposes.
 *
 * Skrifttypen er låst til Droid Sans, som dekker nordiske tegn. Det holder
 * teksten forutsigbar og unngår å laste en fontfil fra nettet ved kjøring.
 */
export const text3D: NodeDefinition<Text3DParams> = {
  type: 'source.text3D',
  label: '3D-tekst',
  category: 'source',
  description:
    'Ekstrudert tekstgeometri. Koble den til 3D-transform eller 3D-scene. Én linje per node.',
  timeDependent: false,
  inputs: [],
  outputs: [{ id: 'out', label: 'Objekt', type: 'object3d' }],
  params: [
    { key: 'text', label: 'Tekst', type: 'text', default: 'SMUDGE' },
    { key: 'size', label: 'Størrelse', type: 'number', default: 0.5, min: 0.05, max: 3, step: 0.01 },
    { key: 'depth', label: 'Tykkelse', type: 'number', default: 0.16, min: 0, max: 1, step: 0.01 },
    { key: 'segments', label: 'Kurver', type: 'int', default: 6, min: 1, max: 24 },
    {
      key: 'shading', label: 'Materialmodus', type: 'enum', default: 'standard',
      options: [
        { value: 'standard', label: 'Standard' },
        { value: 'wireframe', label: 'Wireframe' },
        { value: 'normals', label: 'Normaler' },
      ],
    },
    { key: 'color', label: 'Farge', type: 'color', default: '#b9ff66' },
    { key: 'roughness', label: 'Ruheit', type: 'number', default: 0.35, min: 0, max: 1, step: 0.01 },
    { key: 'metalness', label: 'Metallhet', type: 'number', default: 0.25, min: 0, max: 1, step: 0.01 },
    { key: 'opacity', label: 'Dekkevne', type: 'number', default: 1, min: 0, max: 1, step: 0.01 },
    { key: 'emissive', label: 'Selvlys', type: 'color', default: '#000000' },
  ],
  async evaluate(ctx, _inputs, p) {
    const { buildTextGeometry } = await import('../../render/three/textGeometry')

    const text = String(p.text ?? '')
    const size = Number(p.size)
    const depth = Number(p.depth)
    const segments = Math.round(Number(p.segments))
    const cacheKey = `${text}:${size}:${depth}:${segments}`

    let geometry = ctx.nodeCache.get('geometry') as BufferGeometry | undefined
    const cachedKey = ctx.nodeCache.get('geometryKey') as string | undefined

    if (!geometry || cachedKey !== cacheKey) {
      geometry?.dispose()
      geometry = await buildTextGeometry({ text, size, depth, segments })
      ctx.nodeCache.set('geometry', geometry)
      ctx.nodeCache.set('geometryKey', cacheKey)
    }

    const value: Object3DValue = {
      geometry,
      color: String(p.color),
      roughness: Number(p.roughness),
      metalness: Number(p.metalness),
      opacity: Number(p.opacity),
      emissive: String(p.emissive),
      shading: String(p.shading ?? 'standard') as ShadingMode,
      transform: identityTransform(),
    }

    return { out: value }
  },
}
