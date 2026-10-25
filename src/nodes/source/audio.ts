import type { NodeDefinition } from '../../engine/types'
import { analyzeAudio } from '../../engine/audio/spectrum'

export interface AudioParams {
  src: string
  assetId?: string
  assetName?: string
  assetMime?: string
  assetSize?: number
  assetDuration?: number
  sourceMode?: 'file' | 'url'
  gain: number
  window: number
  loopAudio: boolean
}

/**
 * Lydkilde: leser en lokal lydfil eller en URL og gir nivå og tre
 * frekvensbånd som kan styre parametere.
 *
 * Analysen er deterministisk for en gitt tid i lyden. Er lyden kortere enn
 * animasjonen, kan den loopes med «Loop lyd».
 */
export const audioSource: NodeDefinition<AudioParams> = {
  type: 'source.audio',
  label: 'Lyd',
  category: 'source',
  description:
    'Leser en lydfil og gir nivå, bass, mellomtone og diskant som tall. Koble utgangene til parametere eller Styring for musikkdrevne visuals.',
  inputs: [],
  outputs: [
    { id: 'level', label: 'Nivå', type: 'number' },
    { id: 'bass', label: 'Bass', type: 'number' },
    { id: 'mid', label: 'Mellomtone', type: 'number' },
    { id: 'treble', label: 'Diskant', type: 'number' },
  ],
  params: [
    { key: 'src', label: 'URL', type: 'text', default: '' },
    { key: 'gain', label: 'Forsterkning', type: 'number', default: 1.5, min: 0.1, max: 10, step: 0.1, animatable: true },
    { key: 'window', label: 'Analysevindu (s)', type: 'number', default: 0.06, min: 0.01, max: 0.5, step: 0.01, animatable: false },
    { key: 'loopAudio', label: 'Loop lyd', type: 'boolean', default: true },
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
          `Lydfilen «${p.assetName || 'ukjent'}» finnes ikke i denne nettleseren. Velg filen på nytt i Lyd-noden.`,
        )
      }
    } else {
      src = String(p.src ?? '')
    }

    if (!src) return { level: 0, bass: 0, mid: 0, treble: 0 }

    const buffer = await ctx.render.assets.audio(src)
    const duration = buffer.duration
    const time =
      p.loopAudio && duration > 0 ? ((ctx.time % duration) + duration) % duration : ctx.time
    const levels = analyzeAudio(buffer, time, Number(p.window), Number(p.gain))
    return {
      level: levels.level,
      bass: levels.bass,
      mid: levels.mid,
      treble: levels.treble,
    }
  },
}
