import type { CanvasTarget, RenderServices } from '../engine/types'

/**
 * Eneste sted som eier DOM/canvas-ressurser.
 *
 * Canvas basseng: nøkkel = nodeId, slik at samme node gjenbruker samme
 * lerret mellom frames (unngår GC-storm ved 60 fps i 1920×1080).
 */
export class BrowserRenderServices implements RenderServices {
  private canvases = new Map<string, CanvasTarget>()
  private images = new Map<string, Promise<HTMLImageElement>>()
  private videos = new Map<string, HTMLVideoElement>()
  /** Versjon per lerret — brukes til memo i motoren. */
  private versions = new WeakMap<object, number>()

  constructor(
    public width: number,
    public height: number,
  ) {}

  setSize(width: number, height: number): void {
    if (width === this.width && height === this.height) return
    this.width = width
    this.height = height
    this.dispose()
  }

  canvas(key: string): CanvasTarget {
    let target = this.canvases.get(key)
    if (!target) {
      const canvas = document.createElement('canvas')
      canvas.width = this.width
      canvas.height = this.height
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!
      target = { canvas, ctx, width: this.width, height: this.height, version: 0 }
      this.canvases.set(key, target)
    }
    return target
  }

  /** Markerer at lerreret for nøkkelen har nytt innhold. */
  touch(key: string): void {
    const target = this.canvases.get(key)
    if (!target) return
    target.version += 1
    this.versions.set(target.canvas, target.version)
  }

  versionOf(value: unknown): number {
    if (value && typeof value === 'object') return this.versions.get(value as object) ?? 0
    return 0
  }

  assets = {
    image: (src: string): Promise<HTMLImageElement> => {
      if (!src) return Promise.reject(new Error('Ingen bildekilde valgt.'))
      let pending = this.images.get(src)
      if (!pending) {
        pending = new Promise((resolve, reject) => {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          img.onload = () => resolve(img)
          img.onerror = () => reject(new Error(`Kunne ikke laste bildet: ${src}`))
          img.src = src
        })
        this.images.set(src, pending)
      }
      return pending
    },

    /**
     * Deterministisk video-input: vi seeker til ønsket tid og venter på
     * 'seeked'. Under eksport er dette påkrevd — ellers får hver frame
     * et tilfeldig bilde.
     */
    videoFrame: async (src: string, time: number): Promise<HTMLVideoElement> => {
      let video = this.videos.get(src)
      if (!video) {
        video = document.createElement('video')
        video.src = src
        video.muted = true
        video.playsInline = true
        video.preload = 'auto'
        this.videos.set(src, video)
        await new Promise<void>((resolve, reject) => {
          video!.onloadedmetadata = () => resolve()
          video!.onerror = () => reject(new Error(`Kunne ikke laste videoen: ${src}`))
        })
      }
      const duration = Number.isFinite(video.duration) ? video.duration : 0
      const target = duration > 0 ? Math.min(time, Math.max(0, duration - 0.001)) : time
      if (Math.abs(video.currentTime - target) > 1 / 240) {
        await new Promise<void>((resolve) => {
          video!.onseeked = () => resolve()
          video!.currentTime = target
        })
      }
      return video
    },
  }

  dispose(): void {
    this.canvases.clear()
  }
}
