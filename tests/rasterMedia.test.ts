import { describe, expect, it } from 'vitest'
import { drawRaster } from '../src/render/raster/raster'

function fakeTarget(width = 32, height = 18) {
  const calls: unknown[][] = []
  const ctx = {
    save: () => {},
    restore: () => {},
    setTransform: () => {},
    clearRect: () => {},
    drawImage: (...args: unknown[]) => calls.push(args),
    fillRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    closePath: () => {},
    fill: () => {},
    getImageData: () => ({ data: new Uint8ClampedArray(width * height * 4) }),
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    fillStyle: '',
  }
  const canvas = { width, height, getContext: () => ctx } as unknown as HTMLCanvasElement
  return { canvas, calls }
}

describe('raster med bilde og video', () => {
  it('tegner en vilkårlig CanvasImageSource inn på mållerretet', () => {
    const { canvas, calls } = fakeTarget(32, 18)
    const video = { fake: 'video' }

    drawRaster(video as unknown as CanvasImageSource, canvas, { pattern: 'off' })

    expect(calls).toContainEqual([video, 0, 0, 32, 18])
  })

  it('leser pikslene fra mållerretet, ikke fra kilden', () => {
    const { canvas } = fakeTarget()
    const video = { fake: 'video' }
    expect(() => drawRaster(video as unknown as CanvasImageSource, canvas, { pattern: 'dots' })).not.toThrow()
  })
})
