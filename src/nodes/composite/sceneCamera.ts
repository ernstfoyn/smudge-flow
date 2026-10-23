import type { NodeDefinition } from '../../engine/types'
import type { CameraValue } from '../../render/three/sceneValues'

export interface SceneCameraParams {
  posX: number
  posY: number
  posZ: number
  targetX: number
  targetY: number
  targetZ: number
  fov: number
  near: number
  far: number
}

/**
 * 3D-kamera som *verdi*.
 *
 * Kameraet er en del av scenen, ikke en innstilling på rendereren. Det
 * gjør at det kan animeres med keyframes eller LFO, kobles til en
 * loop-generator, og gjenbrukes i blokker — akkurat som objektene.
 */
export const sceneCamera: NodeDefinition<SceneCameraParams> = {
  type: 'scene.camera',
  label: 'Kamera (3D)',
  category: 'composite',
  description: 'Kamera som verdi. Koble til 3D-scenen for å styre og animere kameraføringen.',
  timeDependent: false,
  inputs: [],
  outputs: [{ id: 'out', label: 'Kamera', type: 'camera' }],
  params: [
    { key: 'posX', label: 'Posisjon X', type: 'number', default: 0, min: -20, max: 20, step: 0.05, animatable: true },
    { key: 'posY', label: 'Posisjon Y', type: 'number', default: 0, min: -20, max: 20, step: 0.05, animatable: true },
    { key: 'posZ', label: 'Posisjon Z', type: 'number', default: 4, min: -20, max: 20, step: 0.05, animatable: true },
    { key: 'targetX', label: 'Mål X', type: 'number', default: 0, min: -10, max: 10, step: 0.05, animatable: true },
    { key: 'targetY', label: 'Mål Y', type: 'number', default: 0, min: -10, max: 10, step: 0.05, animatable: true },
    { key: 'targetZ', label: 'Mål Z', type: 'number', default: 0, min: -10, max: 10, step: 0.05, animatable: true },
    { key: 'fov', label: 'Synsvinkel', type: 'number', default: 45, min: 5, max: 140, step: 1, animatable: true },
    { key: 'near', label: 'Nærplan', type: 'number', default: 0.1, min: 0.01, max: 10, step: 0.01 },
    { key: 'far', label: 'Fjernplan', type: 'number', default: 100, min: 1, max: 500, step: 1 },
  ],
  evaluate(_ctx, _inputs, p): { out: CameraValue } {
    return {
      out: {
        position: { x: Number(p.posX), y: Number(p.posY), z: Number(p.posZ) },
        target: { x: Number(p.targetX), y: Number(p.targetY), z: Number(p.targetZ) },
        fov: Number(p.fov),
        near: Number(p.near),
        far: Number(p.far),
      },
    }
  },
}
