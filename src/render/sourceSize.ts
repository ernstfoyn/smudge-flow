/** Bredden og høyden til en CanvasImageSource, også for video og bilde. */
export function sourceSize(source: CanvasImageSource | null | undefined): {
  width: number
  height: number
} {
  if (!source) return { width: 0, height: 0 }

  if (typeof HTMLVideoElement !== 'undefined' && source instanceof HTMLVideoElement) {
    return { width: source.videoWidth || source.clientWidth, height: source.videoHeight || source.clientHeight }
  }
  if (typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement) {
    return { width: source.naturalWidth || source.width, height: source.naturalHeight || source.height }
  }
  if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) {
    return { width: source.width, height: source.height }
  }
  if (typeof OffscreenCanvas !== 'undefined' && source instanceof OffscreenCanvas) {
    return { width: source.width, height: source.height }
  }
  if (typeof HTMLCanvasElement !== 'undefined' && source instanceof HTMLCanvasElement) {
    return { width: source.width, height: source.height }
  }

  const candidate = source as { width?: number; height?: number }
  return { width: candidate.width ?? 0, height: candidate.height ?? 0 }
}
