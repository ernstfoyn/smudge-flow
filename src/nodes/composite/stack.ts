import type { NodeDefinition } from '../../engine/types'

export type StackMode =
  | 'normal'
  | 'screen'
  | 'multiply'
  | 'overlay'
  | 'lighten'
  | 'darken'
  | 'difference'
  | 'add'

const OPS: Record<StackMode, GlobalCompositeOperation> = {
  normal: 'source-over',
  screen: 'screen',
  multiply: 'multiply',
  overlay: 'overlay',
  lighten: 'lighten',
  darken: 'darken',
  difference: 'difference',
  add: 'lighter',
}

export interface StackParams {
  mode: StackMode
  /** Dekkevne for lag 2..N. Første lag tegnes alltid fullt. */
  opacity: number
  /** Reverser lagrekkefølgen (topp lag blir nederst). */
  reverse: boolean
}

/**
 * Lagstabel — kombinerer et ubegrenset antall lag.
 *
 * Alle lag kobles til samme port. De tegnes i kantrekkefølge, der det
 * første laget er bunnen og resten blandes oppå med samme modus og
 * dekkevne. Rekkefølgen kan endres i inspectoren.
 *
 * For nøyaktig to lag med ulik modus for base og topp: bruk
 * composite.blend. For flere lag: bruk denne.
 */
export const stack: NodeDefinition<StackParams> = {
  type: 'composite.stack',
  label: 'Lagstabel',
  category: 'composite',
  description: 'Kombinerer mange lag i én node. Koble alle lag til porten «Lag».',
  inputs: [{ id: 'in', label: 'Lag', type: 'canvas', multiple: true }],
  outputs: [{ id: 'out', label: 'Kompositt', type: 'canvas' }],
  params: [
    {
      key: 'mode', label: 'Blandemodus', type: 'enum', default: 'screen',
      options: (Object.keys(OPS) as StackMode[]).map((m) => ({ value: m, label: m })),
    },
    { key: 'opacity', label: 'Dekkevne', type: 'number', default: 0.9, min: 0, max: 1, step: 0.01, animatable: true },
    { key: 'reverse', label: 'Reverser rekkefølge', type: 'boolean', default: false },
  ],
  evaluate(ctx, { in: layers }, p) {
    const target = ctx.render.canvas(ctx.scopeKey)
    const c = target.ctx

    const list = (Array.isArray(layers) ? layers : layers ? [layers] : []) as CanvasImageSource[]
    const ordered = p.reverse ? [...list].reverse() : list

    c.save()
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.globalAlpha = 1
    c.globalCompositeOperation = 'source-over'
    c.clearRect(0, 0, target.width, target.height)

    ordered.forEach((layer, index) => {
      if (index === 0) {
        // Bunnen tegnes fullt og uten blanding.
        c.globalAlpha = 1
        c.globalCompositeOperation = 'source-over'
      } else {
        c.globalAlpha = p.opacity as number
        c.globalCompositeOperation = OPS[p.mode as StackMode] ?? 'source-over'
      }
      c.drawImage(layer, 0, 0, target.width, target.height)
    })

    c.globalAlpha = 1
    c.globalCompositeOperation = 'source-over'
    c.restore()

    return { out: target.canvas }
  },
}
