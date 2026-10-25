import type { NodeDefinition } from '../../engine/types'

export interface ImageParams {
  /** URL når kilden er en nettadresse. */
  src: string
  /** Lokal fil i IndexedDB. */
  assetId?: string
  assetName?: string
  assetMime?: string
  assetSize?: number
  assetWidth?: number
  assetHeight?: number
  assetDuration?: number
  /** 'file' bruker filbanken, 'url' bruker src. Eldre grafer uten verdi utledes. */
  sourceMode?: 'file' | 'url'
  /** Hvor i videoen vi teller tiden — for video blir tiden samplet her. */
  useVideoTime: boolean
}

/**
 * Bilde- eller video-kilde.
 *
 * En lokal fil slås opp i IndexedDB via render-tjenesten og får en blob-URL.
 * Bildet lastes asynkront og caches statisk; video samples deterministisk per
 * frame (se RenderServices.assets.videoFrame).
 */
export const imageSource: NodeDefinition<ImageParams> = {
  type: 'source.image',
  label: 'Bilde / video',
  category: 'source',
  description:
    'Bilde eller video fra en lokal fil eller en URL. Velg fil, dra den inn på noden, eller lim inn et bilde fra utklippstavlen.',
  inputs: [],
  outputs: [{ id: 'out', label: 'Bilde', type: 'drawable' }],
  params: [
    { key: 'src', label: 'URL', type: 'text', default: '' },
    { key: 'useVideoTime', label: 'Bruk videotid', type: 'boolean', default: true },
  ],
  async evaluate(ctx, _inputs, p) {
    const mode = p.sourceMode ?? (p.assetId ? 'file' : 'url')
    const assetId = mode !== 'url' ? String(p.assetId ?? '') : ''

    let src = ''
    if (assetId) {
      try {
        src = await ctx.render.assets.resolveAsset(assetId)
      } catch {
        throw new Error(
          `Filen «${p.assetName || 'ukjent'}» finnes ikke i denne nettleseren. Velg filen på nytt i Bilde/video-noden.`,
        )
      }
    } else {
      src = String(p.src ?? '')
    }
    if (!src) return { out: null }

    const mime = assetId ? String(p.assetMime ?? '') : ''
    const isVideo =
      mime.startsWith('video/') || /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(src)

    if (isVideo) {
      const time = p.useVideoTime ? ctx.time : 0
      const video = await ctx.render.assets.videoFrame(src, time)
      return { out: video }
    }

    const image = await ctx.render.assets.image(src)
    return { out: image }
  },
}
