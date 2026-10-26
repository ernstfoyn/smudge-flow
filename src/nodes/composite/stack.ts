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

export const STACK_MODES: StackMode[] = [
  'normal',
  'screen',
  'multiply',
  'overlay',
  'lighten',
  'darken',
  'difference',
  'add',
]

/** Innstillinger for ett lag. Nøklet på kant-id, som er deterministisk. */
export interface LayerSettings {
  mode: StackMode
  opacity: number
  visible: boolean
}

export interface StackParams {
  /** Standard blandemodus for lag uten egne innstillinger. */
  mode: StackMode
  /** Standard dekkevne for lag uten egne innstillinger. */
  opacity: number
  /** Reverser lagrekkefølgen (topp lag blir nederst). */
  reverse: boolean
  /** Per-lag-innstillinger, nøklet på kant-id. */
  layers: Record<string, LayerSettings>
}

/** Slår opp innstillingene til et lag, med stabelens standarder som fallback. */
export function layerSettings(
  params: Pick<StackParams, 'mode' | 'opacity' | 'layers'>,
  edgeId: string,
): LayerSettings {
  const own = params.layers?.[edgeId]
  return {
    mode: own?.mode ?? params.mode,
    opacity: own?.opacity ?? params.opacity,
    visible: own?.visible ?? true,
  }
}

/**
 * Lagstabel — compositingens lagliste.
 *
 * Alle lag kobles til samme port. De tegnes i kantrekkefølge, der det
 * første laget er bunnen. Hvert lag har sin egen blandemodus, dekkevne
 * og synlighet, nøklet på kant-id — så innstillingene følger laget når
 * det flyttes, og overlever at det kobles fra og til igjen.
 *
 * For nøyaktig to lag med ulik modus for base og topp: bruk
 * composite.blend. For flere lag: bruk denne.
 */
export const stack: NodeDefinition<StackParams> = {
  type: 'composite.stack',
  label: 'Lagstabel',
  category: 'composite',
  description:
    'Lagliste med z-order. Hvert lag har egen blandemodus, dekkevne og synlighet.',
  inputs: [{ id: 'in', label: 'Lag', type: 'canvas', multiple: true }],
  outputs: [{ id: 'out', label: 'Kompositt', type: 'canvas' }],
  params: [
    {
      key: 'mode', label: 'Standardmodus', type: 'enum', default: 'normal',
      options: STACK_MODES.map((m) => ({ value: m, label: m })),    },
    { key: 'opacity', label: 'Standard dekkevne', type: 'number', default: 1, min: 0, max: 1, step: 0.01, animatable: true },
    { key: 'reverse', label: 'Reverser rekkefølge', type: 'boolean', default: false },
    { key: 'layers', label: 'Lag', type: 'layers', default: {} },
  ],
  evaluate(ctx, { in: layers }, p) {
    const target = ctx.render.canvas(ctx.scopeKey)
    const c = target.ctx

    const values = (Array.isArray(layers) ? layers : layers ? [layers] : []) as CanvasImageSource[]
    // Kantene forteller hvilket lag hver verdi kom fra — det er nøkkelen
    // til per-lag-innstillingene.
    const edges = ctx.inputEdges?.in ?? []

    const entries = values.map((value, index) => ({
      value,
      edgeId: edges[index]?.id ?? String(index),
    }))

    const ordered = p.reverse ? [...entries].reverse() : entries

    c.save()
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.globalAlpha = 1
    c.globalCompositeOperation = 'source-over'
    c.clearRect(0, 0, target.width, target.height)

    for (const entry of ordered) {
      const settings = layerSettings(p, entry.edgeId)
      if (!settings.visible || settings.opacity <= 0) continue
      c.globalAlpha = settings.opacity
      c.globalCompositeOperation = OPS[settings.mode] ?? 'source-over'
      c.drawImage(entry.value, 0, 0, target.width, target.height)
    }

    c.globalAlpha = 1
    c.globalCompositeOperation = 'source-over'
    c.restore()

    return { out: target.canvas }
  },
}
