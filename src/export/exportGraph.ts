import type { Graph, NodeId } from '../engine/types'
import type { Evaluator } from '../engine/evaluator'
import { encodeFrames, type EncodeResult } from './encodeFrames'
import type { OutputFormat } from './outputFormat'
import type { BrowserRenderServices } from '../render/RenderServices'

export interface ExportOptions {
  graph: Graph
  evaluator: Evaluator
  /** Node-ID-en som definerer leveransen. */
  outputNodeId: NodeId
  canvas: HTMLCanvasElement
  prefer?: OutputFormat
  /** Lydsporet som skal muxes inn. Utelates for stille video. */
  audio?: {
    assetId?: string
    src?: string
    loop?: boolean
  }
  onProgress?: (progress: number, frame: number, total: number) => void
  signal?: AbortSignal
  /**
   * Renderstørrelsen. Eksporten kjører alltid i FULL oppløsning,
   * uansett hva forhåndsvisningen er nedskalert til.
   */
  render?: BrowserRenderServices
}

/**
 * Koder hele grafen til en video.
 *
 * Eksporten bruker SAMME evalueringsmotor som forhåndsvisningen — vi kjører
 * bare en frame-løkke uten rAF. Derfor blir eksporten bit-identisk med
 * det du så i forhåndsvisningen.
 */
export async function exportGraph(options: ExportOptions): Promise<EncodeResult> {
  const { graph, evaluator, outputNodeId, canvas } = options
  const { fps, frames, width, height } = graph.settings

  // Full oppløsning under eksport.
  options.render?.setSize(width, height)

  if (canvas.width !== width) canvas.width = width
  if (canvas.height !== height) canvas.height = height

  const ctx = canvas.getContext('2d')!

  let audioBuffer: AudioBuffer | undefined
  if (options.audio && options.render) {
    const { assetId, src } = options.audio
    const url = assetId ? await options.render.assets.resolveAsset(assetId) : src
    if (url) audioBuffer = await options.render.assets.audio(url)
  }

  return encodeFrames({
    canvas,
    fps,
    frames,
    prefer: options.prefer,
    audio: audioBuffer,
    audioLoop: options.audio?.loop ?? true,
    signal: options.signal,
    onProgress: options.onProgress,
    render: async (frame) => {
      const outputs = await evaluator.evaluateFrame(graph, frame, [outputNodeId], {
        signal: options.signal,
      })
      const source = outputs.get(outputNodeId)?.frame as CanvasImageSource | undefined
      if (!source) throw new Error('Output-noden produserte ingen frame.')

      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
      ctx.clearRect(0, 0, width, height)
      ctx.drawImage(source, 0, 0, width, height)
      ctx.restore()
    },
  })
}
