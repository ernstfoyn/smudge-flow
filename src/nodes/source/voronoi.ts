import type { NodeDefinition } from '../../engine/types'
import type { GradientStop } from '../../engine/color/gradient'
import { blit } from '../../render/blit'
import { gradientLutFor } from '../../render/raster/gradientTexture'
import { voronoiFragmentShader } from '../../render/shaders/generators'

export interface VoronoiParams {
  scale: number
  mode: 'f1' | 'edges' | 'cells'
  edge: number
  drift: number
  contrast: number
  seed: number
  colorA: string
  colorB: string
  /** Flerfarge-gradient. Tom liste faller tilbake til Farge A/B. */
  stops?: GradientStop[]
}

const MODES = ['f1', 'edges', 'cells'] as const

/**
 * Cellemønster (Voronoi).
 *
 * Tre moduser, alle fra vgpu sin `voronoi2d`:
 *   f1    — avstand til nærmeste frøpunkt (bløte felt)
 *   edges — f2 - f1 (skarpe eller myke cellekanter)
 *   cells — én tilfeldig farge per celle, stabil gjennom loopen
 *
 * Driften er en sirkel i planet, så mønsteret beveger seg uten å «hoppe»
 * når loopen starter på nytt.
 */
export const voronoi: NodeDefinition<VoronoiParams> = {
  type: 'source.voronoi',
  label: 'Celler',
  category: 'source',
  description:
    'Voronoi-mønster: avstandsfelt, kanter eller farge per celle. Loop-sikker drift.',
  inputs: [],
  outputs: [{ id: 'out', label: 'Bilde', type: 'canvas' }],
  params: [
    { key: 'scale', label: 'Skala', type: 'number', default: 8, min: 2, max: 40, step: 0.1, animatable: true },
    {
      key: 'mode', label: 'Modus', type: 'enum', default: 'edges',
      options: [
        { value: 'f1', label: 'Avstand (f1)' },
        { value: 'edges', label: 'Cellekanter' },
        { value: 'cells', label: 'Farge per celle' },
      ],
    },
    { key: 'edge', label: 'Kantbredde', type: 'number', default: 0.12, min: 0.005, max: 1, step: 0.005, animatable: true },
    { key: 'drift', label: 'Drift per loop', type: 'number', default: 0.15, min: 0, max: 1, step: 0.01, animatable: true },
    { key: 'contrast', label: 'Kontrast', type: 'number', default: 1, min: 0.1, max: 3, step: 0.01, animatable: true },
    { key: 'seed', label: 'Frø', type: 'number', default: 1, min: 0, max: 100, step: 0.01 },
    { key: 'colorA', label: 'Farge A', type: 'color', default: '#0b0b12' },
    { key: 'colorB', label: 'Farge B', type: 'color', default: '#4bdac5' },
    { key: 'stops', label: 'Fargestopp', type: 'gradient', default: [] },
  ],
  async evaluate(ctx, _inputs, p) {
    const target = ctx.render.canvas(ctx.scopeKey)
    const ramp = gradientLutFor(
      ctx.nodeCache,
      'colorRamp',
      String(p.colorA),
      String(p.colorB),
      p.stops,
    )

    const result = await ctx.render.post(null, {
      glsl: voronoiFragmentShader,
      custom: true,
      amount: 1,
      scale: 0.5,
      time: ctx.phase,
      uniforms: {
        uScale: Number(p.scale),
        uMode: Math.max(0, MODES.indexOf(p.mode ?? 'edges')),
        uEdge: Number(p.edge),
        uDrift: Number(p.drift),
        uContrast: Number(p.contrast),
        uSeed: Number(p.seed),
        uAspect: ctx.width / Math.max(1, ctx.height),
      },
      colors: {
        uColorA: String(p.colorA),
        uColorB: String(p.colorB),
      },
      textures: {
        uColorRamp: ramp,
      },
    })

    blit(target, result)
    return { out: target.canvas }
  },
}
