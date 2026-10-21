import type { NodeDefinition } from '../../engine/types'

export type BlendMode =
  | 'normal'
  | 'screen'
  | 'multiply'
  | 'overlay'
  | 'lighten'
  | 'darken'
  | 'difference'
  | 'add'

const OPS: Record<BlendMode, GlobalCompositeOperation> = {
  normal: 'source-over',
  screen: 'screen',
  multiply: 'multiply',
  overlay: 'overlay',
  lighten: 'lighten',
  darken: 'darken',
  difference: 'difference',
  add: 'lighter',
}

export interface BlendParams {
  mode: BlendMode
  opacity: number
}

/**
 * Lagsammensetning med ekte blendemodeller.
 * Port av BlendStage.jsx sin OPS-tabell.
 */
export const blend: NodeDefinition<BlendParams> = {
  type: 'composite.blend',
  label: 'Blanding',
  category: 'composite',
  description:
    'Blander to lag: «Bunn» tegnes først, «Topp» blandes oppå med blandemodus. For flere lag: bruk Lagstabel.',
  inputs: [
    { id: 'base', label: 'Bunn', type: 'canvas', optional: true },
    { id: 'top', label: 'Topp', type: 'canvas', optional: true },
  ],
  outputs: [{ id: 'out', label: 'Kompositt', type: 'canvas' }],
  params: [
    {
      key: 'mode', label: 'Blandemodus', type: 'enum', default: 'screen',
      options: (Object.keys(OPS) as BlendMode[]).map((m) => ({ value: m, label: m })),
    },
    { key: 'opacity', label: 'Dekkevne', type: 'number', default: 0.85, min: 0, max: 1, step: 0.01, animatable: true },
  ],
  evaluate(ctx, { base, top }, p) {
    const target = ctx.render.canvas(ctx.nodeId)
    const c = target.ctx

    c.save()
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.globalAlpha = 1
    c.globalCompositeOperation = 'source-over'
    c.clearRect(0, 0, target.width, target.height)

    if (base) c.drawImage(base as CanvasImageSource, 0, 0, target.width, target.height)

    if (top) {
      c.globalAlpha = p.opacity as number
      c.globalCompositeOperation = OPS[p.mode as BlendMode] ?? 'source-over'
      c.drawImage(top as CanvasImageSource, 0, 0, target.width, target.height)
    }

    c.globalAlpha = 1
    c.globalCompositeOperation = 'source-over'
    c.restore()

    return { out: target.canvas }
  },
}
