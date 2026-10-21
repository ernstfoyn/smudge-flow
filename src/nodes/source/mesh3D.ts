import type { BufferGeometry } from 'three'
import type { NodeDefinition } from '../../engine/types'
import { identityTransform, type Object3DValue } from '../../render/three/object3d'

export interface Mesh3DParams {
  shape: string
  size: number
  color: string
  roughness: number
  metalness: number
  opacity: number
  emissive: string
  segments: number
}

/**
 * Prosedural 3D-geometri.
 *
 * Geometrien er uendret mellom frames, så noden memoisert.
 * three.js lastes dynamisk, slik at appen starter lett selv om
 * 3D ikke brukes.
 */
export const mesh3D: NodeDefinition<Mesh3DParams> = {
  type: 'source.mesh3D',
  label: '3D-form',
  category: 'source',
  description: 'Prosedural 3D-geometri. Koble den til 3D-transform eller 3D-scene.',
  timeDependent: false,
  inputs: [],
  outputs: [{ id: 'out', label: 'Objekt', type: 'object3d' }],
  params: [
    {
      key: 'shape', label: 'Form', type: 'enum', default: 'torus',
      options: [
        { value: 'box', label: 'Boks' },
        { value: 'sphere', label: 'Kule' },
        { value: 'torus', label: 'Torus' },
        { value: 'plane', label: 'Plan' },
        { value: 'cylinder', label: 'Sylinder' },
        { value: 'icosahedron', label: 'Ikosaeder' },
      ],
    },
    { key: 'size', label: 'Størrelse', type: 'number', default: 0.5, min: 0.05, max: 4, step: 0.01 },
    { key: 'segments', label: 'Segmenter', type: 'int', default: 8, min: 3, max: 48 },
    { key: 'color', label: 'Farge', type: 'color', default: '#b9ff66' },
    { key: 'roughness', label: 'Ruheit', type: 'number', default: 0.4, min: 0, max: 1, step: 0.01 },
    { key: 'metalness', label: 'Metallhet', type: 'number', default: 0.2, min: 0, max: 1, step: 0.01 },
    { key: 'opacity', label: 'Dekkevne', type: 'number', default: 1, min: 0, max: 1, step: 0.01 },
    { key: 'emissive', label: 'Selvlys', type: 'color', default: '#000000' },
  ],
  async evaluate(ctx, _inputs, p) {
    // Lazy: three.js hentes først når noden faktisk evalueres.
    const { buildGeometry } = await import('../../render/three/geometry')

    const cacheKey = `${p.shape}:${p.size}:${p.segments}`
    let geometry = ctx.nodeCache.get('geometry') as BufferGeometry | undefined
    const cachedKey = ctx.nodeCache.get('geometryKey') as string | undefined

    if (!geometry || cachedKey !== cacheKey) {
      geometry?.dispose()
      geometry = buildGeometry(p.shape as never, Number(p.size), Number(p.segments))
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
      transform: identityTransform(),
    }

    return { out: value }
  },
}
