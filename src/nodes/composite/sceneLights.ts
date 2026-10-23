import type { NodeDefinition } from '../../engine/types'
import type { LightsValue } from '../../render/three/sceneValues'

export interface SceneLightsParams {
  ambientColor: string
  ambient: number
  keyColor: string
  keyIntensity: number
  keyX: number
  keyY: number
  keyZ: number
  rimOn: boolean
  rimColor: string
  rimIntensity: number
  rimX: number
  rimY: number
  rimZ: number
}

/**
 * Belysning som *verdi*.
 *
 * Samme grunn som kameraet: lys er en del av scenen, ikke en skjult
 * innstilling. Da kan styrken animeres med loopen, og en hel
 * belysningsoppsett kan gjenbrukes i en blokk.
 */
export const sceneLights: NodeDefinition<SceneLightsParams> = {
  type: 'scene.lights',
  label: 'Belysning (3D)',
  category: 'composite',
  description: 'Omgivelseslys, hovedlys og kantlys som verdi. Koble til 3D-scenen.',
  timeDependent: false,
  inputs: [],
  outputs: [{ id: 'out', label: 'Lys', type: 'lights' }],
  params: [
    { key: 'ambientColor', label: 'Omgivelsesfarge', type: 'color', default: '#ffffff' },
    { key: 'ambient', label: 'Omgivelseslys', type: 'number', default: 1.2, min: 0, max: 4, step: 0.05, animatable: true },
    { key: 'keyColor', label: 'Hovedfarge', type: 'color', default: '#ffffff' },
    { key: 'keyIntensity', label: 'Hovedlys', type: 'number', default: 2, min: 0, max: 8, step: 0.05, animatable: true },
    { key: 'keyX', label: 'Hovedlys X', type: 'number', default: -2, min: -10, max: 10, step: 0.1, animatable: true },
    { key: 'keyY', label: 'Hovedlys Y', type: 'number', default: 3, min: -10, max: 10, step: 0.1, animatable: true },
    { key: 'keyZ', label: 'Hovedlys Z', type: 'number', default: 4, min: -10, max: 10, step: 0.1, animatable: true },
    { key: 'rimOn', label: 'Kantlys', type: 'boolean', default: true },
    { key: 'rimColor', label: 'Kantfarge', type: 'color', default: '#88ccff' },
    { key: 'rimIntensity', label: 'Kantlys styrke', type: 'number', default: 0.6, min: 0, max: 6, step: 0.05, animatable: true },
    { key: 'rimX', label: 'Kantlys X', type: 'number', default: 3, min: -10, max: 10, step: 0.1, animatable: true },
    { key: 'rimY', label: 'Kantlys Y', type: 'number', default: -1, min: -10, max: 10, step: 0.1, animatable: true },
    { key: 'rimZ', label: 'Kantlys Z', type: 'number', default: -3, min: -10, max: 10, step: 0.1, animatable: true },
  ],
  evaluate(_ctx, _inputs, p): { out: LightsValue } {
    return {
      out: {
        ambient: { color: String(p.ambientColor), intensity: Number(p.ambient) },
        key: {
          color: String(p.keyColor),
          intensity: Number(p.keyIntensity),
          position: { x: Number(p.keyX), y: Number(p.keyY), z: Number(p.keyZ) },
        },
        rim: p.rimOn
          ? {
              color: String(p.rimColor),
              intensity: Number(p.rimIntensity),
              position: { x: Number(p.rimX), y: Number(p.rimY), z: Number(p.rimZ) },
            }
          : undefined,
      },
    }
  },
}
