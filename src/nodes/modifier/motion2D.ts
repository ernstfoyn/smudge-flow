import type { NodeDefinition } from '../../engine/types'
import {
  MOTION2D_PRESETS,
  offsetPhase,
  sampleMotion2D,
  type Motion2DPreset,
} from '../../engine/animation/motionPresets'

export interface Motion2DParams {
  preset: Motion2DPreset
  amplitude: number
  cycles: number
  phase: number
}

/**
 * Bevegelsespreset for 2D-innhold.
 *
 * Dette er «Objektbevegelse» fra den opprinnelige appen, men som en egen
 * node i stedet for en skjult egenskap på hvert objekt. Noden tegner
 * innholdet på nytt rundt lerretets midtpunkt, akkurat som `transform2D`,
 * og blander inn bevegelsen fra valgt preset.
 *
 * Siden alt styres av `ctx.phase` og hele sykluser, lukker loopen eksakt.
 */
export const motion2D: NodeDefinition<Motion2DParams> = {
  type: 'modifier.motion2D',
  label: 'Objektbevegelse',
  category: 'modifier',
  description:
    'Ferdige 2D-bevegelser: svev, gli, sirkelbane, vugging, puls og fade. Løkkesikker.',
  timeDependent: true,
  inputs: [{ id: 'in', label: 'Inn', type: 'drawable' }],
  outputs: [{ id: 'out', label: 'Ut', type: 'canvas' }],
  params: [
    {
      key: 'preset',
      label: 'Bevegelse',
      type: 'enum',
      default: 'none',
      options: MOTION2D_PRESETS,
    },
    {
      key: 'amplitude',
      label: 'Bevegelsesutslag (px)',
      type: 'number',
      default: 80,
      min: 0,
      max: 500,
      step: 1,
      animatable: true,
    },
    {
      key: 'cycles',
      label: 'Sykluser per loop',
      type: 'int',
      default: 1,
      min: 1,
      max: 8,
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
  ],
  evaluate(ctx, { in: input }, p) {
    const target = ctx.render.canvas(ctx.scopeKey)
    const { ctx: c, width: w, height: h } = target
    const state = sampleMotion2D(
      p.preset,
      offsetPhase(ctx.phase, Number(p.phase)),
      Number(p.amplitude),
      Number(p.cycles),
    )

    c.save()
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.globalAlpha = 1
    c.globalCompositeOperation = 'source-over'
    c.clearRect(0, 0, w, h)

    if (input) {
      c.globalAlpha = Math.max(0, Math.min(1, state.opacity))
      c.translate(w / 2 + state.x, h / 2 + state.y)
      c.rotate((state.rotation * Math.PI) / 180)
      c.scale(state.scale, state.scale)
      c.drawImage(input as CanvasImageSource, -w / 2, -h / 2, w, h)
    }

    c.restore()
    return { out: target.canvas }
  },
}
