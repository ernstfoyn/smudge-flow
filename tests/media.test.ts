import { describe, expect, it } from 'vitest'
import {
  formatBytes,
  formatDuration,
  isMediaFile,
  mediaParamsFromAsset,
  type StoredAsset,
} from '../src/assets/media'
import { imageSource, type ImageParams } from '../src/nodes/source/imageSource'
import type { EvalContext, RenderServices } from '../src/engine/types'
import { fakeRender } from './fakeRender'

const asset: StoredAsset = {
  id: 'asset-1',
  name: 'klipp.mp4',
  mime: 'video/mp4',
  size: 2_500_000,
  width: 1920,
  height: 1080,
  duration: 12.4,
  createdAt: '2026-01-01T00:00:00.000Z',
  blob: new Blob(['x'], { type: 'video/mp4' }),
}

function context(time = 2.5): EvalContext {
  return {
    nodeId: 'image',
    scopeKey: 'root/image',
    frame: 150,
    fps: 60,
    totalFrames: 600,
    time,
    phase: 0.25,
    width: 100,
    height: 100,
    render: {} as EvalContext['render'],
    nodeCache: new Map(),
  }
}

function render(overrides: Partial<RenderServices['assets']> = {}): RenderServices {
  return {
    ...fakeRender(),
    assets: {
      resolveAsset: async (id) => `blob:${id}`,
      audio: async () => ({ fake: 'audio' }) as unknown as AudioBuffer,
      image: async () => ({ fake: 'image' }) as unknown as HTMLImageElement,
      videoFrame: async () => ({ fake: 'video' }) as unknown as HTMLVideoElement,
      ...overrides,
    },
  }
}

const params = (patch: Partial<ImageParams> = {}): ImageParams => ({
  src: '',
  useVideoTime: true,
  ...patch,
})

describe('mediafiler', () => {
  it('kjenner igjen bilde og video fra MIME eller filnavn', () => {
    expect(isMediaFile({ type: 'image/png', name: 'a.png' })).toBe(true)
    expect(isMediaFile({ type: '', name: 'b.JPG' })).toBe(true)
    expect(isMediaFile({ type: 'video/webm', name: 'c.webm' })).toBe(true)
    expect(isMediaFile({ type: '', name: 'd.mov' })).toBe(true)
    expect(isMediaFile({ type: 'application/pdf', name: 'e.pdf' })).toBe(false)
    expect(isMediaFile({ type: '', name: 'modell.obj' })).toBe(false)
  })

  it('viser lesbar størrelse og varighet', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2_500_000)).toBe('2.4 MB')
    expect(formatDuration(12.4)).toBe('0:12')
    expect(formatDuration(125)).toBe('2:05')
    expect(formatDuration(undefined)).toBe('')
  })

  it('lager nodeparametere med fil-ID og metadata', () => {
    expect(mediaParamsFromAsset(asset)).toEqual({
      sourceMode: 'file',
      assetId: 'asset-1',
      assetName: 'klipp.mp4',
      assetMime: 'video/mp4',
      assetSize: 2_500_000,
      assetWidth: 1920,
      assetHeight: 1080,
      assetDuration: 12.4,
      src: '',
    })
  })
})

describe('Bilde/video-noden', () => {
  it('slår opp lokal fil og bruker videotid', async () => {
    let seenTime = -1
    const ctx = context(2.5)
    ctx.render = render({
      videoFrame: async (_src, time) => {
        seenTime = time
        return { fake: 'video' } as unknown as HTMLVideoElement
      },
    })

    const out = await imageSource.evaluate(
      ctx,
      {},
      params({ sourceMode: 'file', assetId: 'asset-1', assetMime: 'video/mp4' }),
    )
    expect(seenTime).toBe(2.5)
    expect(out).toEqual({ out: { fake: 'video' } })
  })

  it('bruker frame 0 når videotid er slått av', async () => {
    let seenTime = -1
    const ctx = context(2.5)
    ctx.render = render({
      videoFrame: async (_src, time) => {
        seenTime = time
        return { fake: 'video' } as unknown as HTMLVideoElement
      },
    })
    await imageSource.evaluate(
      ctx,
      {},
      params({ sourceMode: 'file', assetId: 'asset-1', assetMime: 'video/mp4', useVideoTime: false }),
    )
    expect(seenTime).toBe(0)
  })

  it('behandler en URL som bilde når filen ikke er lokal', async () => {
    let resolved = false
    let imageSrc = ''
    const ctx = context()
    ctx.render = render({
      resolveAsset: async (id) => {
        resolved = true
        return `blob:${id}`
      },
      image: async (src) => {
        imageSrc = src
        return { fake: 'image' } as unknown as HTMLImageElement
      },
    })

    const out = await imageSource.evaluate(
      ctx,
      {},
      params({ sourceMode: 'url', src: 'https://example.com/bilde.png' }),
    )
    expect(resolved).toBe(false)
    expect(imageSrc).toBe('https://example.com/bilde.png')
    expect(out).toEqual({ out: { fake: 'image' } })
  })

  it('gir tydelig feil når den lokale filen mangler', async () => {
    const ctx = context()
    ctx.render = render({
      resolveAsset: async () => {
        throw new Error('mangler')
      },
    })
    await expect(
      imageSource.evaluate(
        ctx,
        {},
        params({ sourceMode: 'file', assetId: 'borte', assetName: 'klipp.mp4' }),
      ),
    ).rejects.toThrow(/klipp\.mp4.*finnes ikke/i)
  })

  it('gir ingen output når kilden er tom', async () => {
    const ctx = context()
    ctx.render = render()
    expect(await imageSource.evaluate(ctx, {}, params({ sourceMode: 'url', src: '' }))).toEqual({
      out: null,
    })
  })
})
