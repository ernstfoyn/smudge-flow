import { describe, expect, it } from 'vitest'
import { analyzeAudio, type AudioDataLike } from '../src/engine/audio/spectrum'
import { audioSource, type AudioParams } from '../src/nodes/source/audio'
import { registry } from '../src/nodes'
import type { EvalContext, RenderServices } from '../src/engine/types'
import { fakeRender } from './fakeRender'

function tone(frequency: number, amplitude = 0.8, sampleRate = 8000, seconds = 1): AudioDataLike {
  const length = sampleRate * seconds
  const data = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    data[i] = Math.sin((2 * Math.PI * frequency * i) / sampleRate) * amplitude
  }
  return {
    numberOfChannels: 1,
    length,
    sampleRate,
    getChannelData: () => data,
  }
}

function silence(): AudioDataLike {
  return {
    numberOfChannels: 1,
    length: 8000,
    sampleRate: 8000,
    getChannelData: () => new Float32Array(8000),
  }
}

describe('lydanalyse', () => {
  it('gir null for stille lyd', () => {
    const levels = analyzeAudio(silence(), 0.5)
    expect(levels.level).toBe(0)
    expect(levels.bass).toBe(0)
    expect(levels.mid).toBe(0)
    expect(levels.treble).toBe(0)
  })

  it('finner bass i en lav tone', () => {
    const levels = analyzeAudio(tone(100), 0.5, 0.06, 1)
    expect(levels.level).toBeGreaterThan(0)
    expect(levels.bass).toBeGreaterThan(levels.treble)
  })

  it('finner diskant i en høy tone', () => {
    const levels = analyzeAudio(tone(5000), 0.5, 0.06, 1)
    expect(levels.treble).toBeGreaterThan(levels.bass)
  })

  it('gir verdier i 0..1 og reagerer på forsterkning', () => {
    const low = analyzeAudio(tone(100), 0.5, 0.06, 0.5)
    const high = analyzeAudio(tone(100), 0.5, 0.06, 4)
    for (const v of Object.values(high)) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
    expect(high.bass).toBeGreaterThan(low.bass)
  })

  it('er deterministisk', () => {
    const audio = tone(440)
    expect(analyzeAudio(audio, 0.4)).toEqual(analyzeAudio(audio, 0.4))
  })
})

describe('Lyd-noden', () => {
  const params: AudioParams = {
    src: '',
    useLoop: true,
    gain: 1.5,
    window: 0.06,
    loopAudio: true,
  } as AudioParams

  function context(render: RenderServices, time = 0.5): EvalContext {
    return {
      nodeId: 'audio', scopeKey: 'root/audio', frame: Math.round(time * 60), fps: 60,
      totalFrames: 60, time, phase: time, width: 100, height: 100, render, nodeCache: new Map(),
    }
  }

  function render(buffer: AudioBuffer | null, missing = false): RenderServices {
    return {
      ...fakeRender(),
      assets: {
        resolveAsset: async () => {
          if (missing) throw new Error('mangler')
          return 'blob:lyd'
        },
        audio: async () => {
          if (!buffer) throw new Error('ingen lyd')
          return buffer
        },
        image: async () => ({}) as HTMLImageElement,
        videoFrame: async () => ({}) as HTMLVideoElement,
      },
    }
  }

  it('returnerer nivå og frekvensbånd som tall', async () => {
    const buffer = {
      duration: 1,
      numberOfChannels: 1,
      length: 8000,
      sampleRate: 8000,
      getChannelData: () => new Float32Array(8000).fill(0.5),
    } as unknown as AudioBuffer
    const out = await audioSource.evaluate(
      context(render(buffer)),
      {},
      { ...params, sourceMode: 'file', assetId: 'a', assetMime: 'audio/wav' },
    )
    expect(out.level).toBeGreaterThan(0)
    expect(typeof out.bass).toBe('number')
    expect(typeof out.mid).toBe('number')
    expect(typeof out.treble).toBe('number')
  })

  it('gir null uten kilde', async () => {
    const out = await audioSource.evaluate(context(render(null)), {}, params)
    expect(out).toEqual({ level: 0, bass: 0, mid: 0, treble: 0 })
  })

  it('forklarer når den lokale lydfilen mangler', async () => {
    await expect(
      audioSource.evaluate(
        context(render(null, true)),
        {},
        { ...params, sourceMode: 'file', assetId: 'borte', assetName: 'sang.mp3' },
      ),
    ).rejects.toThrow(/sang\.mp3.*finnes ikke/i)
  })

  it('er registrert i paletten', () => {
    expect(registry.has('source.audio')).toBe(true)
    expect(registry.listed().some((def) => def.type === 'source.audio')).toBe(true)
  })
})
