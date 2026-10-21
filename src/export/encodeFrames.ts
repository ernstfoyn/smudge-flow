/**
 * Deterministisk videoeksport.
 *
 * Port av src/utils/frameExport.js + public/orbit/video-export.js
 * (Smudge_animator @ 81cf506).
 *
 * Vi koder hver tidslinjeframe nøyaktig én gang og gir encoderen et
 * eksplisitt tidsstempel. 12 frames @ 6 fps gir derfor en video som er
 * nøyaktig 2,000 s lang, uavhengig av skjermens oppdateringsrate.
 *
 * MediaBunny 1.61.3 (MPL-2.0) ligger i ./vendor og lastes kun ved eksport.
 */

import type { MediaBunnyApi } from './vendor/mediabunny-types'

const MEDIABUNNY = () =>
  // @ts-expect-error — den vendorede byggingen har ingen deklarasjonsfil
  import('./vendor/mediabunny.js') as unknown as Promise<MediaBunnyApi>

export interface EncodeOptions {
  canvas: HTMLCanvasElement
  fps: number
  frames: number
  /** Tegner den gitte rammen. Må vente på ferdigstillelse. */
  render: (frame: number) => Promise<void> | void
  prefer?: 'mp4' | 'webm'
  onProgress?: (progress: number, frame: number, total: number) => void
  signal?: AbortSignal
}

export interface EncodeResult {
  blob: Blob
  extension: 'mp4' | 'webm'
  fps: number
  frames: number
  duration: number
}

export async function encodeFrames({
  canvas,
  fps,
  frames,
  render,
  prefer = 'mp4',
  onProgress,
  signal,
}: EncodeOptions): Promise<EncodeResult> {
  if (!canvas) throw new Error('Ingen canvas å eksportere.')
  const total = Math.max(1, Math.round(frames))
  const rate = Math.max(1, Math.round(fps))

  const B = await MEDIABUNNY()
  if (signal?.aborted) throw new DOMException('Avbrutt', 'AbortError')

  const quality = new B.Quality({ bitrate: 12_000_000 })
  const options = { width: canvas.width, height: canvas.height, frameRate: rate, quality }

  const canAvc = await B.canEncodeVideo('avc', options)
  const canVp9 = await B.canEncodeVideo('vp9', options)
  const canVp8 = await B.canEncodeVideo('vp8', options)

  let codec = ''
  let format: any
  let extension: 'mp4' | 'webm' = 'mp4'

  const useAvc = () => {
    codec = 'avc'
    format = new B.Mp4OutputFormat({ fastStart: 'in-memory' })
    extension = 'mp4'
  }
  const useVp9 = () => {
    codec = 'vp9'
    format = new B.WebMOutputFormat()
    extension = 'webm'
  }
  const useVp8 = () => {
    codec = 'vp8'
    format = new B.WebMOutputFormat()
    extension = 'webm'
  }

  if (prefer === 'webm') {
    if (canVp9) useVp9()
    else if (canVp8) useVp8()
    else if (canAvc) useAvc()
  } else {
    if (canAvc) useAvc()
    else if (canVp9) useVp9()
    else if (canVp8) useVp8()
  }

  if (!codec) {
    throw new Error(
      'Nettleseren støtter ikke eksakt videoeksport i denne oppløsningen. Prøv Chrome eller Edge.',
    )
  }

  const output = new B.Output({ format, target: new B.BufferTarget() })
  const source = new B.CanvasSource(canvas, { codec, quality, latencyMode: 'realtime' })
  output.addVideoTrack(source, { frameRate: rate })

  try {
    await output.start()

    for (let frame = 0; frame < total; frame++) {
      if (signal?.aborted) throw new DOMException('Avbrutt', 'AbortError')

      await render(frame)
      await source.add(frame / rate, 1 / rate, { keyFrame: frame === 0 })
      onProgress?.((frame + 1) / total, frame + 1, total)

      // La UI-en puste — uten å påvirke tidsstemplene.
      await new Promise((resolve) => setTimeout(resolve, 0))
    }

    await output.finalize()

    return {
      blob: new Blob([output.target.buffer], {
        type: extension === 'mp4' ? 'video/mp4' : 'video/webm',
      }),
      extension,
      fps: rate,
      frames: total,
      duration: total / rate,
    }
  } catch (error) {
    await output.cancel().catch(() => {})
    throw error
  }
}
