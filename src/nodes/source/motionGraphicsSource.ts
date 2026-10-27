import type { NodeDefinition } from '../../engine/types'
import {
  MOTION_MODES,
  sample,
  type MotionMode,
  type MotionProperties,
} from '../../render/raster/motionGraphics'
import {
  color as sampleGradient,
  stops as gradientStops,
  type GradientStop,
} from '../../engine/color/gradient'

export interface MotionGraphicsParams extends MotionProperties {
  /** 0 = farger fra gradient, 1 = kun farge A. */
  useGradient: boolean
  /** Flerfarge-gradient. Tom liste faller tilbake til Farge A/B. */
  stops?: GradientStop[]
}

/**
 * Generativ grafisk loop (prikkefelt, fliser, vifte, striper, ovaler).
 * Port av Orbit sin prosedurale 2D-generator.
 */
export const motionGraphicsSource: NodeDefinition<MotionGraphicsParams> = {
  type: 'source.motionGraphics',
  label: 'Generativ grafikk',
  category: 'source',
  inputs: [],
  outputs: [{ id: 'out', label: 'Former', type: 'canvas' }],
  params: [
    {
      key: 'motion', label: 'Mønster', type: 'enum', default: 'dotfield',
      options: MOTION_MODES.map((m) => ({ value: m.id, label: m.label })),
    },
    { key: 'count', label: 'Antall', type: 'int', default: 32, min: 1, max: 100, animatable: true },
    { key: 'columns', label: 'Kolonner', type: 'int', default: 8, min: 1, max: 20, animatable: true },
    { key: 'spacing', label: 'Avstand', type: 'number', default: 70, min: 10, max: 300, animatable: true },
    { key: 'phaseOffset', label: 'Faseforskyvning', type: 'number', default: 0.12, min: 0, max: 1, step: 0.01, animatable: true },
    { key: 'lineWidth', label: 'Linjetykkelse', type: 'number', default: 3, min: 1, max: 40, animatable: true },
    { key: 'size', label: 'Størrelse', type: 'number', default: 76, min: 12, max: 600, animatable: true },
    { key: 'spread', label: 'Spredning', type: 'number', default: 100, min: 20, max: 150, animatable: true },
    { key: 'amplitude', label: 'Utslag', type: 'number', default: 100, min: 0, max: 200, animatable: true },
    { key: 'centerX', label: 'Sentrum X', type: 'number', default: 50, min: 0, max: 100, animatable: true },
    { key: 'centerY', label: 'Sentrum Y', type: 'number', default: 50, min: 0, max: 100, animatable: true },
    { key: 'opacity', label: 'Dekkevne', type: 'number', default: 83, min: 5, max: 100, animatable: true },
    { key: 'scale', label: 'Puls', type: 'number', default: 30, min: 0, max: 80, animatable: true },
    { key: 'rotation', label: 'Rotasjon', type: 'number', default: 35, min: 0, max: 100, animatable: true },
    { key: 'speed', label: 'Hastighet', type: 'number', default: 1, min: 1, max: 4, animatable: true },
    { key: 'useGradient', label: 'Gradientfarger', type: 'boolean', default: true },
    {
      key: 'colorA', label: 'Farge', type: 'color', default: '#b9ff66',
      showWhen: { key: 'useGradient', in: [false] },
    },
    { key: 'colorB', label: 'Farge B', type: 'color', default: '#4bdac5' },
    {
      key: 'stops', label: 'Fargestopp', type: 'gradient', default: [],
      showWhen: { key: 'useGradient', in: [true] },
    },
  ],
  evaluate(ctx, _inputs, p) {
    const target = ctx.render.canvas(ctx.scopeKey)
    const { ctx: c, width: w, height: h } = target

    c.save()
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.globalAlpha = 1
    c.globalCompositeOperation = 'source-over'
    c.clearRect(0, 0, w, h)
    c.globalAlpha = p.opacity / 100

    const items = sample({ ...p, motion: p.motion as MotionMode }, ctx.phase, w, h)
    const ramp = gradientStops({
      colorA: p.colorA,
      colorB: p.colorB,
      gradient: p.stops && p.stops.length ? { stops: p.stops } : undefined,
    })

    for (const item of items) {
      const mix = p.useGradient ? item.x / Math.max(1, w) : 0
      c.fillStyle = p.useGradient ? sampleGradient(ramp, mix) : p.colorA

      c.save()
      c.translate(item.x, item.y)
      c.rotate(item.rotation)
      c.scale(item.sx, item.sy)

      if (item.shape === 'rectangle') {
        c.fillRect(-item.size / 2, -item.size / 2, item.size, item.size)
      } else {
        c.beginPath()
        c.arc(0, 0, item.size / 2, 0, Math.PI * 2)
        c.fill()
      }
      c.restore()
    }

    c.restore()
    return { out: target.canvas }
  },
}
