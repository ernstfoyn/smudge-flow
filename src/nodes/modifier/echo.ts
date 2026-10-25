import type { CanvasTarget, NodeDefinition } from '../../engine/types'

export interface EchoParams {
  count: number
  decay: number
  offsetX: number
  offsetY: number
}

/**
 * Echo: tegner de siste framesene bak det gjeldende bildet.
 *
 * Noden holder en liten historikk i node-cachen. Den er laget for avspilling
 * og eksport, der frames evalueres i rekkefølge. Hopper du i tidslinjen,
 * starter historikken på nytt fra den frameen.
 */
export const echoNode: NodeDefinition<EchoParams> = {
  type: 'modifier.echo',
  label: 'Echo',
  category: 'modifier',
  description:
    'Lager etterslep av de siste framesene. Etterslepene kan forskyves og falme ut. Historikken bygges opp frame for frame.',
  inputs: [{ id: 'in', label: 'Bilde', type: 'drawable' }],
  outputs: [{ id: 'out', label: 'Bilde', type: 'canvas' }],
  params: [
    { key: 'count', label: 'Antall etterslep', type: 'int', default: 4, min: 1, max: 8, animatable: false },
    { key: 'decay', label: 'Utfading', type: 'number', default: 0.72, min: 0, max: 0.98, step: 0.01, animatable: true },
    { key: 'offsetX', label: 'Forskyvning X', type: 'number', default: 0, min: -0.25, max: 0.25, step: 0.005, animatable: true },
    { key: 'offsetY', label: 'Forskyvning Y', type: 'number', default: 0, min: -0.25, max: 0.25, step: 0.005, animatable: true },
  ],
  evaluate(ctx, { in: input }, p) {
    const target = ctx.render.canvas(ctx.scopeKey)
    const c = target.ctx
    const w = target.width
    const h = target.height
    const count = Math.max(1, Math.round(Number(p.count)))
    const historyKey = `${ctx.scopeKey}:echo`
    let history = ctx.nodeCache.get(historyKey) as CanvasTarget[] | undefined
    if (!history) {
      history = []
      ctx.nodeCache.set(historyKey, history)
    }

    // Start hver avspilling (og eksport) med tom historikk.
    if (ctx.frame === 0) history.length = 0
    if (history.length > count) history.length = count

    c.save()
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.clearRect(0, 0, w, h)
    c.globalCompositeOperation = 'source-over'

    if (!input) {
      c.restore()
      return { out: target.canvas }
    }

    const decay = Math.min(0.98, Math.max(0, Number(p.decay)))
    for (let i = history.length - 1; i >= 0; i--) {
      const step = (i + 1) / count
      c.globalAlpha = decay ** (i + 1)
      c.drawImage(
        history[i].canvas,
        Number(p.offsetX) * w * step,
        Number(p.offsetY) * h * step,
        w,
        h,
      )
    }

    c.globalAlpha = 1
    c.drawImage(input as CanvasImageSource, 0, 0, w, h)

    // Gjenbruk den eldste historikkflaten når vi har nok frames.
    const slot =
      history.length >= count
        ? history.pop()!
        : ctx.render.canvas(`${ctx.scopeKey}:echo:${history.length}`)
    slot.ctx.save()
    slot.ctx.setTransform(1, 0, 0, 1, 0, 0)
    slot.ctx.clearRect(0, 0, w, h)
    slot.ctx.drawImage(input as CanvasImageSource, 0, 0, w, h)
    slot.ctx.restore()
    history.unshift(slot)

    c.restore()
    return { out: target.canvas }
  },
}
