import type { CanvasTarget, PostOptions, RenderServices } from '../engine/types'
import type { PostProcess } from './three/postProcess'

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
  /** Delt GPU-kontekst for alle postprosesseringer. */
  private postProcess: PostProcess | null = null
  /** three.js lastes først når en effekt faktisk brukes. */
  private postModule: Promise<typeof import('./three/postProcess')> | null = null

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

  /**
   * Fullskjerm-postprosessering.
   *
   * Alle effektnoder deler én WebGL-kontekst. Nettleserne begrenser
   * antallet levende kontekster, så dette må ikke lages per node.
   */
  async post(input: CanvasImageSource, options: PostOptions): Promise<HTMLCanvasElement> {
    if (!this.postModule) {
      this.postModule = import('./three/postProcess')
    }
    const { PostProcess } = await this.postModule

    if (!this.postProcess) {
      this.postProcess = new PostProcess(this.width, this.height)
    } else {
      this.postProcess.resize(this.width, this.height)
    }
    return this.postProcess.render(input, options)
  }

  dispose(): void {
    this.canvases.clear()
    this.postProcess?.dispose()
    this.postProcess = null
  }
}
