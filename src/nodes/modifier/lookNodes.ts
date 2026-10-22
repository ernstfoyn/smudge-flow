import type { NodeDefinition } from '../../engine/types'
import { LOOKS, type LookDefinition } from '../../render/shaders/looks'

export interface LookParams {
  amount: number
  scale: number
}

/**
 * Lager en node for én stilistisk effekt.
 *
 * Alle 16 effekter deler samme implementasjon; det som skiller dem, er
 * GLOW-koden. Rekkefølgen i grafen bestemmer rekkefølgen effektene
 * anvendes i — det er kantene, ikke en array, som styrer.
 */
function createLookNode(look: LookDefinition): NodeDefinition<LookParams> {
  return {
    type: look.type,
    label: look.label,
    category: 'modifier',
    description: look.description,
    inputs: [{ id: 'in', label: 'Inn', type: 'canvas' }],
    outputs: [{ id: 'out', label: 'Ut', type: 'canvas' }],
    params: [
      {
        key: 'amount',
        label: 'Styrke',
        type: 'number',
        default: 1,
        min: 0,
        max: 2,
        step: 0.01,
        animatable: true,
      },
      {
        key: 'scale',
        label: 'Skala',
        type: 'number',
        default: 0.5,
        min: 0,
        max: 1,
        step: 0.01,
        animatable: true,
      },
    ],
    async evaluate(ctx, { in: input }, p) {
      const target = ctx.render.canvas(ctx.scopeKey)
      const source = input as HTMLCanvasElement | undefined

      if (!source) {
        target.ctx.clearRect(0, 0, target.width, target.height)
        return { out: target.canvas }
      }

      // Tiden looper: én syklus per grafsyklus, slik at effekten lukker seg.
      const time = ctx.phase * (ctx.totalFrames / ctx.fps)

      const result = await ctx.render.post(source, {
        glsl: look.glsl,
        amount: Number(p.amount),
        scale: Number(p.scale),
        time,
      })

      const c = target.ctx
      c.save()
      c.setTransform(1, 0, 0, 1, 0, 0)
      c.globalAlpha = 1
      c.globalCompositeOperation = 'source-over'
      c.clearRect(0, 0, target.width, target.height)
      c.drawImage(result, 0, 0, target.width, target.height)
      c.restore()

      return { out: target.canvas }
    },
  }
}

/** Alle effektnodene, i den rekkefølgen de lå i den gamle appen. */
export const lookNodes: NodeDefinition<any>[] = LOOKS.map(createLookNode)
