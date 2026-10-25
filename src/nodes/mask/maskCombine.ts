import type { NodeDefinition } from '../../engine/types'

export type MaskCombineMode = 'union' | 'intersect' | 'subtract'

export interface MaskCombineParams {
  mode: MaskCombineMode
}

/**
 * Kombinerer to masker. Nyttig for å bygge sammensatte matter uten å stable
 * mange maskebrukere.
 */
export const maskCombine: NodeDefinition<MaskCombineParams> = {
  type: 'mask.combine',
  label: 'Kombiner masker',
  category: 'mask',
  description:
    'Slår sammen to masker: union (A eller B), snitt (A og B) eller trekk fra (A uten B).',
  inputs: [
    { id: 'a', label: 'Maske A', type: 'canvas', optional: true },
    { id: 'b', label: 'Maske B', type: 'canvas', optional: true },
  ],
  outputs: [{ id: 'out', label: 'Maske', type: 'canvas' }],
  params: [
    {
      key: 'mode', label: 'Modus', type: 'enum', default: 'union',
      options: [
        { value: 'union', label: 'A eller B (union)' },
        { value: 'intersect', label: 'A og B (snitt)' },
        { value: 'subtract', label: 'A uten B' },
      ],
    },
  ],
  evaluate(ctx, { a, b }, p) {
    const target = ctx.render.canvas(ctx.scopeKey)
    const c = target.ctx
    c.save()
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.clearRect(0, 0, target.width, target.height)
    c.globalCompositeOperation = 'source-over'

    if (a) c.drawImage(a as CanvasImageSource, 0, 0, target.width, target.height)
    if (b) {
      c.globalCompositeOperation =
        p.mode === 'intersect'
          ? 'destination-in'
          : p.mode === 'subtract'
            ? 'destination-out'
            : 'source-over'
      c.drawImage(b as CanvasImageSource, 0, 0, target.width, target.height)
    }

    c.restore()
    return { out: target.canvas }
  },
}
