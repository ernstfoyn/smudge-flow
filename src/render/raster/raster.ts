/**
 * Port av Compositor.raster() fra public/orbit/compositor.js
 * (Smudge_animator @ 81cf506).
 *
 * Luminansraster: bildet brytes ned i celler, og hver celle får en form
 * (prikk / linje / rombe) hvis størrelse følger cellens luminans.
 */

import { coverage, variation } from './effects'

export interface RasterProps {
  pattern?: 'off' | 'dots' | 'lines' | 'diamonds'
  cellSize?: number
  strength?: number
  ink?: string
  paper?: string
  invert?: boolean
  colorMode?: 'source' | 'ink'
  sizeMode?: 'luminance' | 'adaptive' | 'uniform'
  dotContrast?: number
  flatThreshold?: number
  isLayer?: boolean
}

export function luminance(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

export function drawRaster(
  source: CanvasImageSource,
  target: HTMLCanvasElement,
  properties: RasterProps,
): void {
  const p = {
    pattern: 'off',
    cellSize: 10,
    strength: 100,
    ink: '#ffffff',
    paper: '#000000',
    invert: false,
    colorMode: 'ink',
    sizeMode: 'luminance',
    dotContrast: 2,
    flatThreshold: 3,
    isLayer: false,
    ...properties,
  } as {
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
    isLayer: boolean
  }

  const w = target.width
  const h = target.height
  const ctx = target.getContext('2d')!

  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
  ctx.clearRect(0, 0, w, h)

  // Tegn inputen inn på mållerretet først. Da virker rasteret på både
  // lerret, bilde og video, og alle skaleres til grafens oppløsning.
  ctx.drawImage(source, 0, 0, w, h)

  if (p.pattern === 'off') {
    ctx.restore()
    return
  }

  const pixels = ctx.getImageData(0, 0, w, h).data
  const cell = Math.max(3, Math.round(p.cellSize))

  ctx.fillStyle = p.paper
  if (!p.isLayer) ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = p.ink
  ctx.beginPath()

  for (let y = 0; y < h; y += cell) {
    for (let x = 0; x < w; x += cell) {
      const cx = Math.min(w - 1, Math.floor(x + cell / 2))
      const cy = Math.min(h - 1, Math.floor(y + cell / 2))
      const i = (cy * w + cx) * 4

      if (p.isLayer && pixels[i + 3] === 0) continue

      let lum = luminance(pixels[i], pixels[i + 1], pixels[i + 2])
      if (p.invert) lum = 1 - lum

      const cov = coverage(lum, p)
      const solid =
        p.sizeMode === 'adaptive' && variation(pixels, w, h, cx, cy, cell) < p.flatThreshold

      if (p.isLayer || p.colorMode === 'source' || p.sizeMode === 'adaptive') {
        ctx.fillStyle =
          p.colorMode === 'source'
            ? `rgb(${pixels[i]},${pixels[i + 1]},${pixels[i + 2]})`
            : p.ink
        ctx.beginPath()
      }
      if (p.isLayer) ctx.globalAlpha = pixels[i + 3] / 255

      const diameter = cell * 0.95 * Math.sqrt(cov)
      const r = diameter / 2

      if (solid) {
        ctx.rect(x, y, cell, cell)
        if (p.colorMode !== 'source') {
          ctx.fillStyle = `rgb(${pixels[i]},${pixels[i + 1]},${pixels[i + 2]})`
        }
      } else if (p.pattern === 'lines') {
        ctx.rect(x, y + (cell - cell * 0.95 * cov) / 2, cell, cell * 0.95 * cov)
      } else if (p.pattern === 'diamonds') {
        ctx.moveTo(x + cell / 2, y + cell / 2 - r)
        ctx.lineTo(x + cell / 2 + r, y + cell / 2)
        ctx.lineTo(x + cell / 2, y + cell / 2 + r)
        ctx.lineTo(x + cell / 2 - r, y + cell / 2)
        ctx.closePath()
      } else {
        ctx.moveTo(x + cell / 2 + r, y + cell / 2)
        ctx.arc(x + cell / 2, y + cell / 2, r, 0, Math.PI * 2)
      }

      if (p.isLayer || p.colorMode === 'source' || p.sizeMode === 'adaptive') ctx.fill()
    }
  }

  if (!p.isLayer && p.colorMode !== 'source' && p.sizeMode !== 'adaptive') ctx.fill()

  if (p.strength < 100) {
    ctx.globalAlpha = 1 - Math.max(0, p.strength) / 100
    ctx.drawImage(source, 0, 0, w, h)
  }

  ctx.restore()
}
