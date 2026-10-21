import type { NodeDefinition } from '../../engine/types'
import { drawRaster } from '../../render/raster/raster'

export interface RasterParams {
  pattern: 'off' | 'dots' | 'lines' | 'diamonds'
  cellSize: number
  strength: number
  ink: string
  paper: string
  invert: boolean
  colorMode: 'source' | 'ink'
  sizeMode: 'luminance' | 'adaptive' | 'uniform'
  dotContrast: number
  flatThreshold: number
}

/** Luminansraster. Port av Orbit sin compositor. */
export const raster: NodeDefinition<RasterParams> = {
  type: 'modifier.raster',
  label: 'Raster',
  category: 'modifier',
  inputs: [{ id: 'in', label: 'Inn', type: 'canvas' }],
  outputs: [{ id: 'out', label: 'Ut', type: 'canvas' }],
  params: [
    {
      key: 'pattern', label: 'Mønster', type: 'enum', default: 'dots',
      options: [
        { value: 'off', label: 'Av · original' },
        { value: 'dots', label: 'Prikker' },
        { value: 'lines', label: 'Linjer' },
        { value: 'diamonds', label: 'Diamanter' },
      ],
    },
    { key: 'cellSize', label: 'Rutestørrelse', type: 'int', default: 10, min: 3, max: 80, animatable: true },
    { key: 'strength', label: 'Styrke', type: 'number', default: 100, min: 0, max: 100, animatable: true },
    { key: 'dotContrast', label: 'Kontrast', type: 'number', default: 2, min: 0.5, max: 4, step: 0.1, animatable: true },
    { key: 'flatThreshold', label: 'Flaterskel', type: 'number', default: 3, min: 0.5, max: 20, step: 0.5 },
    { key: 'ink', label: 'Rasterfarge', type: 'color', default: '#ffffff' },
    { key: 'paper', label: 'Papirfarge', type: 'color', default: '#000000' },
    { key: 'invert', label: 'Inverter luminans', type: 'boolean', default: false },
    {
      key: 'colorMode', label: 'Farger', type: 'enum', default: 'source',
      options: [
        { value: 'source', label: 'Originalfarger' },
        { value: 'ink', label: 'Ensfarget' },
      ],
    },
    {
      key: 'sizeMode', label: 'Størrelse', type: 'enum', default: 'luminance',
      options: [
        { value: 'luminance', label: 'Fra lysstyrke' },
        { value: 'adaptive', label: 'Adaptivt' },
        { value: 'uniform', label: 'Jevn størrelse' },
      ],
    },
  ],
  evaluate(ctx, { in: input }, p) {
    const target = ctx.render.canvas(ctx.scopeKey)
    const source = input as HTMLCanvasElement

    if (!source) {
      target.ctx.clearRect(0, 0, target.width, target.height)
      return { out: target.canvas }
    }

    drawRaster(source, target.canvas, p)
    return { out: target.canvas }
  },
}
