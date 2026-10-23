import type { NodeDefinition } from '../../engine/types'
import {
  MOTION3D_PRESETS,
  offsetPhase,
  sampleMotion3D,
  type Motion3DPreset,
} from '../../engine/animation/motionPresets'
import {
  composeTransform,
  type Object3DValue,
} from '../../render/three/object3d'

export interface Motion3DParams {
  preset: Motion3DPreset
  strength: number
  cycles: number
  phase: number
  phaseOffset: number
}

/**
 * Animasjonspreset for 3D-objekter.
 *
 * Presetene er hentet fra Orbit: orbit, bølge, rutenett, spiral, sverm,
 * vuggende rotasjon og puls. Bevegelsen legges *oppå* objektets egen
 * transform, så keyframes og plassering beholdes.
 *
 * Når inngangen er en gruppe (for eksempel fra `modifier.scatter3D`),
 * får hvert toppnivå-barn sin egen bevegelse med `phaseOffset`. Da blir
 * det samme per-kopi-fasen som i den opprinnelige cloneren.
 */
export const motion3D: NodeDefinition<Motion3DParams> = {
  type: 'modifier.motion3D',
  label: '3D-animasjonspreset',
  category: 'modifier',
  description:
    'Orbit, bølge, spiral, sverm, spinn og puls for 3D-objekter. Grupper får bevegelse per objekt.',
  timeDependent: true,
  inputs: [{ id: 'in', label: 'Objekt', type: 'object3d' }],
  outputs: [{ id: 'out', label: 'Objekt', type: 'object3d' }],
  params: [
    {
      key: 'preset',
      label: 'Animasjonspreset',
      type: 'enum',
      default: 'none',
      options: MOTION3D_PRESETS,
    },
    {
      key: 'strength',
      label: 'Bevegelsesutslag (%)',
      type: 'number',
      default: 100,
      min: 0,
      max: 200,
      step: 1,
      animatable: true,
    },
    {
      key: 'cycles',
      label: 'Sykluser per loop',
      type: 'int',
      default: 1,
      min: 1,
      max: 4,
    },
    {
      key: 'phase',
      label: 'Startfase',
      type: 'number',
      default: 0,
      min: 0,
      max: 1,
      step: 0.01,
    },
    {
      key: 'phaseOffset',
      label: 'Faseforskyvning per objekt',
      type: 'number',
      default: 0.15,
      min: 0,
      max: 1,
      step: 0.01,
    },
  ],
  evaluate(ctx, { in: input }, p) {
    const value = input as Object3DValue | undefined
    if (!value) return { out: undefined }
    if (p.preset === 'none') return { out: value }

    const phase = offsetPhase(ctx.phase, Number(p.phase))
    const strength = Number(p.strength)
    const cycles = Number(p.cycles)
    const phaseOffset = Number(p.phaseOffset)

    // En gruppe representerer flere objekter/kloner. Da beveger vi hvert
    // toppnivå-barn for seg, slik at spiral/sverm og faseforskyvningen
    // virker per objekt. En enkelt objektbunke behandles som ett objekt.
    const children = value.children
    if (!children?.length) {
      const delta = sampleMotion3D(p.preset, phase, strength, cycles, 0, 1, phaseOffset)
      return {
        out: {
          ...value,
          transform: composeTransform(value.transform, delta),
        },
      }
    }

    return {
      out: {
        ...value,
        children: children.map((child, index) => {
          const delta = sampleMotion3D(
            p.preset,
            phase,
            strength,
            cycles,
            index,
            children.length,
            phaseOffset,
          )
          return {
            ...child,
            transform: composeTransform(child.transform, delta),
          }
        }),
      },
    }
  },
}
