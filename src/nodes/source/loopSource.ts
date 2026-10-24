import type { NodeDefinition } from '../../engine/types'
import { loopedNoise } from '../../engine/animation/curves'

export type LoopAlgorithm = 'sine' | 'triangle' | 'saw' | 'square' | 'noise'
export type LoopWindow = 'none' | 'pingpong' | 'cosine'

export interface LoopParams {
  algorithm: LoopAlgorithm
  /** Hvor mange sykluser per loop. */
  cycles: number
  /** Hvor stort utslaget er, relativt til (max - min). */
  amplitude: number
  /** Forskyvning av midtpunktet. */
  offset: number
  min: number
  max: number
  /**
   * Vinduet former kurven slik at første og siste frame er lik.
   * 'pingpong' = frem og tilbake, 'cosine' = myk kurve.
   */
  window: LoopWindow
  /** Antall punkter i støyen (bestemmer detaljgrad). */
  detail: number
  /** Frø for støyen — samme frø gir samme loop. */
  seed: number
}

const TWO_PI = Math.PI * 2

function wave(algorithm: LoopAlgorithm, t: number, params: LoopParams): number {
  switch (algorithm) {
    case 'triangle':
      return (2 / Math.PI) * Math.asin(Math.sin(TWO_PI * t))
    case 'saw':
      return (t - Math.floor(t)) * 2 - 1
    case 'square':
      return Math.sin(TWO_PI * t) >= 0 ? 1 : -1
    case 'noise':
      return loopedNoise(t - Math.floor(t), params.detail, params.seed)
    case 'sine':
    default:
      return Math.sin(TWO_PI * t)
  }
}

/** Former fasen slik at verdien ved p=0 og p=1 er lik. */
function applyWindow(phase: number, window: LoopWindow): number {
  const p = phase - Math.floor(phase)
  switch (window) {
    case 'pingpong':
      return 1 - Math.abs(2 * p - 1)
    case 'cosine':
      return (1 - Math.cos(TWO_PI * p)) / 2
    case 'none':
    default:
      return p
  }
}

/**
 * Automatisk looping.
 *
 * Lager verdier som er *løkkesikre*: verdien ved frame 0 er identisk med
 * verdien ved frame N (altså når lopen lukker seg), uansett fps.
 * Det gjør at resultatet kan eksporteres og loope uten hopp.
 *
 * Verdien kan kobles til hvilken som helst parameter i en annen node
 * (parameter-kobling), og da er hele kjeden automatisert.
 */
export const loopSource: NodeDefinition<LoopParams> = {
  type: 'source.loop',
  label: 'Loop-generator',
  category: 'curve',
  description:
    'Alt-i-ett kurve med vindu: sinus, trekant, sag, firkant og støy. Koble «Verdi» til en parameter for å automatisere den.',
  inputs: [],
  outputs: [
    { id: 'value', label: 'Verdi', type: 'number' },
    { id: 'phase', label: 'Fase', type: 'number' },
    { id: 'pingpong', label: 'Frem/tilbake', type: 'number' },
  ],
  params: [
    {
      key: 'algorithm', label: 'Algoritme', type: 'enum', default: 'sine',
      options: [
        { value: 'sine', label: 'Sine' },
        { value: 'triangle', label: 'Trekant' },
        { value: 'saw', label: 'Sag' },
        { value: 'square', label: 'Firkant' },
        { value: 'noise', label: 'Støy (løkkesikker)' },
      ],
    },
    { key: 'cycles', label: 'Sykluser', type: 'int', default: 1, min: 1, max: 16, animatable: true },
    { key: 'amplitude', label: 'Utslag', type: 'number', default: 1, min: 0, max: 2, step: 0.01, animatable: true },
    { key: 'offset', label: 'Forskyvning', type: 'number', default: 0, min: -10, max: 10, step: 0.01, animatable: true },
    { key: 'min', label: 'Min', type: 'number', default: 0, min: -100, max: 100, animatable: true },
    { key: 'max', label: 'Max', type: 'number', default: 1, min: -100, max: 100, animatable: true },
    {
      key: 'window', label: 'Vindu', type: 'enum', default: 'pingpong',
      options: [
        { value: 'none', label: 'Ingen' },
        { value: 'pingpong', label: 'Frem og tilbake' },
        { value: 'cosine', label: 'Cosine (myk)' },
      ],
    },
    { key: 'detail', label: 'Detalj', type: 'int', default: 6, min: 2, max: 64, animatable: true },
    { key: 'seed', label: 'Frø', type: 'int', default: 1, min: 0, max: 999, animatable: true },
  ],
  evaluate(ctx, _inputs, p) {
    const raw = ctx.phase
    const windowed = applyWindow(raw, p.window as LoopWindow)
    const shaped = wave(p.algorithm as LoopAlgorithm, windowed * (p.cycles as number), p)

    const min = Number(p.min)
    const max = Number(p.max)
    const center = (min + max) / 2 + Number(p.offset)
    const half = ((max - min) / 2) * Number(p.amplitude)
    const value = center + shaped * half

    const pingpong = 1 - Math.abs(2 * (raw - Math.floor(raw)) - 1)

    return {
      value,
      phase: raw,
      pingpong,
    }
  },
}
