import type { NodeDefinition, ParamDef } from '../../engine/types'
import { curveValue, type CurveParams, type CurveShape } from '../../engine/animation/curves'

/**
 * Frittstående kurvenoder.
 *
 * Hver node lager en løkkesikker verdi som kan kobles til diamanten på
 * hvilken som helst tallparameter i grafen. Alle deler samme grunnparametere
 * (sykluser, fase, min, max); noen former har i tillegg egne.
 */

const CYCLES: ParamDef = {
  key: 'cycles', label: 'Sykluser', type: 'int', default: 1, min: 1, max: 32, animatable: false,
}
const PHASE: ParamDef = {
  key: 'phase', label: 'Fase', type: 'number', default: 0, min: 0, max: 1, step: 0.01, animatable: true,
}
const MIN: ParamDef = {
  key: 'min', label: 'Min', type: 'number', default: 0, min: -1000, max: 1000, step: 0.01, animatable: true,
}
const MAX: ParamDef = {
  key: 'max', label: 'Max', type: 'number', default: 1, min: -1000, max: 1000, step: 0.01, animatable: true,
}
const SEED: ParamDef = {
  key: 'seed', label: 'Frø', type: 'int', default: 1, min: 0, max: 999, animatable: false,
}

interface CurveSpec {
  shape: CurveShape
  label: string
  description: string
  extra: ParamDef[]
}

const SPECS: CurveSpec[] = [
  {
    shape: 'sine',
    label: 'Sinus',
    description: 'Myk sinuskurve som svinger jevnt opp og ned.',
    extra: [],
  },
  {
    shape: 'triangle',
    label: 'Trekant',
    description: 'Lineær opp-og-ned-kurve med skarpe topper.',
    extra: [],
  },
  {
    shape: 'saw',
    label: 'Sagtann',
    description: 'Stiger jevnt og hopper tilbake i starten av hver syklus.',
    extra: [],
  },
  {
    shape: 'square',
    label: 'Firkant / puls',
    description: 'Hopper mellom min og max. Pulsbredden styrer hvor lenge den er på.',
    extra: [
      { key: 'width', label: 'Pulsbredde', type: 'number', default: 0.5, min: 0, max: 1, step: 0.01, animatable: true },
    ],
  },
  {
    shape: 'noise',
    label: 'Støy (løkkesikker)',
    description: 'Organisk, glatt støy som lukker seg nøyaktig når loopen starter på nytt.',
    extra: [
      { key: 'detail', label: 'Detalj', type: 'int', default: 6, min: 2, max: 64, animatable: false },
      SEED,
    ],
  },
  {
    shape: 'ease',
    label: 'Myk puls (ease)',
    description: 'Myk opp-og-ned med rolig start og slutt, som en pustende bevegelse.',
    extra: [],
  },
  {
    shape: 'bounce',
    label: 'Sprett',
    description: 'Som en ball som spretter: skarpe bunner og runde topper.',
    extra: [],
  },
  {
    shape: 'spring',
    label: 'Fjær (dempet)',
    description: 'Starter på max, svinger og dør ut mot midten i hver syklus.',
    extra: [
      { key: 'ripples', label: 'Svingninger', type: 'number', default: 4, min: 0, max: 24, step: 0.5, animatable: true },
      { key: 'damping', label: 'Demping', type: 'number', default: 5, min: 0, max: 20, step: 0.1, animatable: true },
    ],
  },
  {
    shape: 'steps',
    label: 'Trapp',
    description: 'Stiger i faste trinn og starter på nytt for hver syklus.',
    extra: [
      { key: 'detail', label: 'Trinn', type: 'int', default: 6, min: 2, max: 64, animatable: false },
    ],
  },
  {
    shape: 'hold',
    label: 'Tilfeldig trinn',
    description: 'Hopper til en ny tilfeldig verdi i faste trinn (sample & hold). Samme frø gir samme rekke.',
    extra: [
      { key: 'detail', label: 'Trinn', type: 'int', default: 6, min: 2, max: 64, animatable: false },
      SEED,
    ],
  },
]

function makeCurve(spec: CurveSpec): NodeDefinition {
  return {
    type: `curve.${spec.shape}`,
    label: spec.label,
    category: 'curve',
    hidden: true,
    description: `${spec.description} Koble «Verdi» til en diamant for å styre en parameter.`,
    inputs: [],
    outputs: [
      { id: 'value', label: 'Verdi', type: 'number' },
      { id: 'inverse', label: 'Invertert', type: 'number' },
    ],
    params: [CYCLES, PHASE, MIN, MAX, ...spec.extra],
    evaluate(ctx, _inputs, p) {
      const t = ctx.phase * Number(p.cycles) + Number(p.phase)
      const shaped = curveValue(spec.shape, t, p as unknown as Partial<CurveParams>)
      const min = Number(p.min)
      const max = Number(p.max)
      const value = min + ((shaped + 1) / 2) * (max - min)
      return { value, inverse: min + max - value }
    },
  }
}

export const curveNodes: NodeDefinition[] = SPECS.map(makeCurve)
