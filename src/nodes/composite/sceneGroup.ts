import type { NodeDefinition } from '../../engine/types'
import { identityTransform, type Object3DValue } from '../../render/three/object3d'

export interface SceneGroupParams {
  opacity: number
  visible: boolean
}

/**
 * Grupperer 3D-objekter til ett objekt.
 *
 * Gruppen har ingen egen geometri — bare barn og en transform. Sett en
 * `scene.object` etter gruppen for å flytte hele gruppen som én enhet.
 *
 * Dette er den ene av to ting en vanlig graf ikke kan uttrykke: hierarki.
 * (Den andre er rekkefølge, som lagstabelen tar seg av.)
 */
export const sceneGroup: NodeDefinition<SceneGroupParams> = {
  type: 'scene.group',
  label: 'Gruppe (3D)',
  category: 'composite',
  description:
    'Slår sammen flere 3D-objekter til ett. Koble en Objekt-node etter for å flytte hele gruppen.',
  timeDependent: false,
  inputs: [{ id: 'children', label: 'Objekter', type: 'object3d', multiple: true }],
  outputs: [{ id: 'out', label: 'Gruppe', type: 'object3d' }],
  params: [
    { key: 'opacity', label: 'Dekkevne', type: 'number', default: 1, min: 0, max: 1, step: 0.01, animatable: true },
    { key: 'visible', label: 'Synlig', type: 'boolean', default: true },
  ],
  evaluate(_ctx, { children }, p) {
    const list = (Array.isArray(children) ? children : children ? [children] : []) as Object3DValue[]
    if (!list.length) return { out: undefined }

    const opacity = Number(p.opacity)
    const visible = p.visible !== false

    return {
      out: {
        color: '#ffffff',
        roughness: 1,
        metalness: 0,
        opacity,
        emissive: '#000000',
        transform: identityTransform(),
        visible,
        // Dekkevnen ganges ned i barna, slik at den virker selv om barna
        // har sine egne materialer.
        children: list.map((child) => ({
          ...child,
          opacity: child.opacity * opacity,
          visible: visible && child.visible !== false,
        })),
      },
    }
  },
}
