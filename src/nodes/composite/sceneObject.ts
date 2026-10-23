import type { NodeDefinition } from '../../engine/types'
import {
  composeTransform,
  type Object3DValue,
  type Transform3D,
} from '../../render/three/object3d'

export interface SceneObjectParams {
  posX: number
  posY: number
  posZ: number
  rotX: number
  rotY: number
  rotZ: number
  scaleX: number
  scaleY: number
  scaleZ: number
  opacity: number
  visible: boolean
}

/**
 * Et håndtak på et 3D-objekt.
 *
 * Noden legger sin transform *oppå* objektets egen, og multipliserer
 * dekkevnen. Det gjør den brukbar både som plasseringsverktøy og som
 * forelder: sett en `scene.object` etter en `scene.group`, og hele
 * gruppen flytter seg.
 *
 * Forskjellen fra `modifier.transform3D` er hensikten: der *erstatter*
 * transformen objektets egen, her legges den oppå. Det er nettopp det
 * som gjør kjeder og hierarki forutsigbare.
 */
export const sceneObject: NodeDefinition<SceneObjectParams> = {
  type: 'scene.object',
  label: 'Objekt',
  category: 'composite',
  description:
    'Plasserer og styler ett 3D-objekt. Legges oppå objektets egen transform, så den kan også brukes som forelder for en gruppe.',
  timeDependent: false,
  inputs: [{ id: 'in', label: 'Objekt', type: 'object3d' }],
  outputs: [{ id: 'out', label: 'Objekt', type: 'object3d' }],
  params: [
    { key: 'posX', label: 'Posisjon X', type: 'number', default: 0, min: -10, max: 10, step: 0.01, animatable: true },
    { key: 'posY', label: 'Posisjon Y', type: 'number', default: 0, min: -10, max: 10, step: 0.01, animatable: true },
    { key: 'posZ', label: 'Posisjon Z', type: 'number', default: 0, min: -10, max: 10, step: 0.01, animatable: true },
    { key: 'rotX', label: 'Rotasjon X', type: 'number', default: 0, min: -180, max: 180, animatable: true },
    { key: 'rotY', label: 'Rotasjon Y', type: 'number', default: 0, min: -180, max: 180, animatable: true },
    { key: 'rotZ', label: 'Rotasjon Z', type: 'number', default: 0, min: -180, max: 180, animatable: true },
    { key: 'scaleX', label: 'Skala X', type: 'number', default: 1, min: 0, max: 10, step: 0.01, animatable: true },
    { key: 'scaleY', label: 'Skala Y', type: 'number', default: 1, min: 0, max: 10, step: 0.01, animatable: true },
    { key: 'scaleZ', label: 'Skala Z', type: 'number', default: 1, min: 0, max: 10, step: 0.01, animatable: true },
    { key: 'opacity', label: 'Dekkevne', type: 'number', default: 1, min: 0, max: 1, step: 0.01, animatable: true },
    { key: 'visible', label: 'Synlig', type: 'boolean', default: true },
  ],
  evaluate(_ctx, { in: input }, p) {
    const value = input as Object3DValue | undefined
    if (!value) return { out: undefined }

    const delta: Transform3D = {
      position: { x: Number(p.posX), y: Number(p.posY), z: Number(p.posZ) },
      rotation: { x: Number(p.rotX), y: Number(p.rotY), z: Number(p.rotZ) },
      scale: { x: Number(p.scaleX), y: Number(p.scaleY), z: Number(p.scaleZ) },
    }

    return {
      out: {
        ...value,
        transform: composeTransform(value.transform, delta),
        opacity: value.opacity * Number(p.opacity),
        visible: value.visible !== false && p.visible !== false,
      },
    }
  },
}
