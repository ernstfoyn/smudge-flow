import { paint, stops, type GradientStop } from '../../engine/color/gradient'

/**
 * Lager en 1×256-gradient som kan samples i en shader.
 *
 * Shaderne bruker bare x-aksen, så høyden er 1 piksel. Stoppene males med
 * samme `paint()`-funksjon som Canvas-gradientene, slik at mykhet og
 * fargeinterpolering blir identisk i 2D og shader.
 */
export function gradientLutFor(
  cache: Map<string, unknown>,
  key: string,
  colorA: string,
  colorB: string,
  list?: GradientStop[],
  size = 256,
): HTMLCanvasElement {
  const ramp = stops({
    colorA,
    colorB,
    gradient: list && list.length ? { stops: list } : undefined,
  })
  const signature = JSON.stringify(ramp)
  const cached = cache.get(key) as
    | { signature: string; canvas: HTMLCanvasElement }
    | undefined
  if (cached && cached.signature === signature) return cached.canvas
  const canvas = gradientLut(ramp, size)
  cache.set(key, { signature, canvas })
  return canvas
}

export function gradientLut(list: GradientStop[], size = 256): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(2, Math.round(size))
  canvas.height = 1
  const c = canvas.getContext('2d')!
  const gradient = c.createLinearGradient(0, 0, canvas.width, 0)
  for (const stop of paint(list, {})) {
    gradient.addColorStop(stop.position, stop.color)
  }
  c.fillStyle = gradient
  c.fillRect(0, 0, canvas.width, canvas.height)
  return canvas
}
