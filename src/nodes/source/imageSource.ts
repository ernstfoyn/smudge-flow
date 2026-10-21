import type { NodeDefinition } from '../../engine/types'

export interface ImageParams {
  src: string
  /** Hvor i bildet vi teller tiden — for video blir tiden samplet her. */
  useVideoTime: boolean
}

/**
 * Bilde- eller video-kilde. Bilde lastes asynkront og caches statisk;
 * video samples deterministisk per frame (se RenderServices.assets.videoFrame).
 */
export const imageSource: NodeDefinition<ImageParams> = {
  type: 'source.image',
  label: 'Bilde / video',
  category: 'source',
  inputs: [],
  outputs: [{ id: 'out', label: 'Bilde', type: 'drawable' }],
  params: [
    { key: 'src', label: 'Fil / URL', type: 'text', default: '' },
    { key: 'useVideoTime', label: 'Bruk videotid', type: 'boolean', default: true },
  ],
  async evaluate(ctx, _inputs, p) {
    if (!p.src) return { out: null }

    const isVideo = /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(p.src)

    if (isVideo && p.useVideoTime) {
      const video = await ctx.render.assets.videoFrame(p.src, ctx.time)
      return { out: video }
    }

    const image = await ctx.render.assets.image(p.src)
    return { out: image }
  },
}
