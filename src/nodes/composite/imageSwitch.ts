import type { NodeDefinition } from '../../engine/types'

/**
 * Bildevelger: én av fire bilder sendes videre.
 *
 * Inngangene er valgfrie, slik at du kan bygge opp variantene gradvis. En
 * tom inngang gir et gjennomsiktig bilde, ikke en feil.
 */
export const imageSwitchNode: NodeDefinition = {
  type: 'image.switch',
  label: 'Bildevelger',
  category: 'composite',
  description:
    'Velger ett av fire bilder eller videoer. Bytt med Indeks, eller koble et signal til Indeks for å styre kuttet.',
  inputs: [
    { id: 'in0', label: 'A', type: 'drawable', optional: true },
    { id: 'in1', label: 'B', type: 'drawable', optional: true },
    { id: 'in2', label: 'C', type: 'drawable', optional: true },
    { id: 'in3', label: 'D', type: 'drawable', optional: true },
    { id: 'index', label: 'Indeks', type: 'number', optional: true },
  ],
  outputs: [{ id: 'out', label: 'Bilde', type: 'canvas' }],
  params: [
    { key: 'index', label: 'Indeks', type: 'int', default: 0, min: 0, max: 3, animatable: true },
  ],
  evaluate(ctx, inputs, p) {
    const raw = typeof inputs.index === 'number' ? inputs.index : Number(p.index)
    const index = Math.min(3, Math.max(0, Math.round(Number.isFinite(raw) ? raw : 0)))
    const selected = inputs[`in${index}`] as CanvasImageSource | undefined

    const target = ctx.render.canvas(ctx.scopeKey)
    const c = target.ctx
    c.save()
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.globalAlpha = 1
    c.globalCompositeOperation = 'source-over'
    c.clearRect(0, 0, target.width, target.height)
    if (selected) c.drawImage(selected, 0, 0, target.width, target.height)
    c.restore()
    return { out: target.canvas }
  },
}
