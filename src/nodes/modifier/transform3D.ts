import type { NodeDefinition } from '../../engine/types'
import { applyTransform, type Object3DValue } from '../../render/three/object3d'

export interface Transform3DParams {
  posX: number
  posY: number
  posZ: number
  rotX: number
  rotY: number
  rotZ: number
  scaleX: number
  scaleY: number
  scaleZ: number
}

/**
 * 3D-transform.
 *
 * Transforms *objektet*, ikke pikselene. Det er hele poenget med å ha en
 * egen 3D-verdidom: geometrien kan roteres uten å tape skarpe kanter,
 * og flere 3D-objekter kan slås sammen i én scene.
 */
export const transform3D: NodeDefinition<Transform3DParams> = {
  type: 'modifier.transform3D',
  label: '3D-transform',
  category: 'modifier',
  description: 'Flytter, roterer og skalerer 3D-objekter.',
  timeDependent: false,
  inputs: [{ id: 'in', label: 'Objekt', type: 'object3d' }],
  outputs: [{ id: 'out', label: 'Objekt', type: 'object3d' }],
  params: [
    { key: 'posX', label: 'Posisjon X', type: 'number', default: 0, min: -5, max: 5, step: 0.01, animatable: true },
    { key: 'posY', label: 'Posisjon Y', type: 'number', default: 0, min: -5, max: 5, step: 0.01, animatable: true },
    { key: 'posZ', label: 'Posisjon Z', type: 'number', default: 0, min: -5, max: 5, step: 0.01, animatable: true },
    { key: 'rotX', label: 'Rotasjon X', type: 'number', default: 0, min: -180, max: 180, animatable: true },
    { key: 'rotY', label: 'Rotasjon Y', type: 'number', default: 0, min: -180, max: 180, animatable: true },
    { key: 'rotZ', label: 'Rotasjon Z', type: 'number', default: 0, min: -180, max: 180, animatable: true },
    { key: 'scaleX', label: 'Skala X', type: 'number', default: 1, min: 0.01, max: 10, step: 0.01, animatable: true },
    { key: 'scaleY', label: 'Skala Y', type: 'number', default: 1, min: 0.01, max: 10, step: 0.01, animatable: true },
    { key: 'scaleZ', label: 'Skala Z', type: 'number', default: 1, min: 0.01, max: 10, step: 0.01, animatable: true },
  ],
  evaluate(_ctx, { in: input }, p) {
    const value = input as Object3DValue | undefined
    if (!value) return { out: undefined }

    return {
      out: applyTransform(value, {
        position: { x: Number(p.posX), y: Number(p.posY), z: Number(p.posZ) },
        rotation: { x: Number(p.rotX), y: Number(p.rotY), z: Number(p.rotZ) },
        scale: { x: Number(p.scaleX), y: Number(p.scaleY), z: Number(p.scaleZ) },
      }),
    }
  },
}
