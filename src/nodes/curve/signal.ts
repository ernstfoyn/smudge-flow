import type { NodeDefinition, ParamDef } from '../../engine/types'
import {
  DEFAULT_CURVE_POINTS,
  curveValue,
  type CurveParams,
  type CurveShape,
} from '../../engine/animation/curves'
import { SIGNAL_NODE_TYPE } from '../../engine/drive'

/** Formene i nedtrekkslisten, i den rekkefølgen de vises. */
export const SIGNAL_SHAPES: Array<{ value: CurveShape; label: string }> = [
  { value: 'sine', label: 'Sinus' },
  { value: 'triangle', label: 'Trekant' },
  { value: 'saw', label: 'Sagtann' },
  { value: 'square', label: 'Firkant / puls' },
  { value: 'noise', label: 'Støy (løkkesikker)' },
  { value: 'ease', label: 'Myk puls' },
  { value: 'bounce', label: 'Sprett' },
  { value: 'spring', label: 'Fjær (dempet)' },
  { value: 'steps', label: 'Trapp' },
  { value: 'hold', label: 'Tilfeldig trinn' },
  { value: 'draw', label: 'Tegnet kurve' },
]

const when = (key: string, ...values: string[]): ParamDef['showWhen'] => ({ key, in: values })

const params: ParamDef[] = [
  { key: 'shape', label: 'Form', type: 'enum', default: 'sine', options: SIGNAL_SHAPES },
  {
    key: 'speed', label: 'Hastighet', type: 'int', default: 1, min: 1, max: 32, animatable: false,
  },
  { key: 'phase', label: 'Fase', type: 'number', default: 0, min: 0, max: 1, step: 0.01, animatable: true },
  {
    key: 'width', label: 'Pulsbredde', type: 'number', default: 0.5, min: 0, max: 1, step: 0.01,
    animatable: true, showWhen: when('shape', 'square'),
  },
  {
    key: 'ripples', label: 'Svingninger', type: 'number', default: 4, min: 0, max: 24, step: 0.5,
    animatable: true, showWhen: when('shape', 'spring'),
  },
  {
    key: 'damping', label: 'Demping', type: 'number', default: 5, min: 0, max: 20, step: 0.1,
    animatable: true, showWhen: when('shape', 'spring'),
  },
  {
    key: 'detail', label: 'Detalj / trinn', type: 'int', default: 6, min: 2, max: 64, animatable: false,
    showWhen: when('shape', 'noise', 'steps', 'hold'),
  },
  {
    key: 'seed', label: 'Frø', type: 'int', default: 1, min: 0, max: 999, animatable: false,
    showWhen: when('shape', 'noise', 'hold'),
  },
  {
    key: 'interp', label: 'Interpolering', type: 'enum', default: 'smooth',
    options: [
      { value: 'smooth', label: 'Glatt' },
      { value: 'linear', label: 'Rette linjer' },
    ],
    showWhen: when('shape', 'draw'),
  },
  { key: 'points', label: 'Tegnet kurve', type: 'curve', default: DEFAULT_CURVE_POINTS },
]

/**
 * Signal: bare en kurve. Form, hastighet og fase — ingenting annet.
 *
 * Utgangen er alltid −1…1. Hvor mye signalet styrer, og hvilke parametere,
 * velges på selve koblingen (under «Styring» på målnoden). Da kan samme
 * signal styre mange noder med ulike områder.
 *
 * Hastighet er heltall sykluser per loop, så verdien er lik ved frame 0 og
 * frame N, og eksporten loopes uten hopp.
 */
export const signalNode: NodeDefinition = {
  type: SIGNAL_NODE_TYPE,
  label: 'Signal',
  category: 'curve',
  description:
    'En kurve som beveger seg i loopen. Koble «Signal» til «Styring» på en node, og velg der hvor mye den skal styre og hvilke parametere.',
  inputs: [],
  outputs: [{ id: 'signal', label: 'Signal', type: 'number' }],
  params,
  evaluate(ctx, _inputs, p) {
    const t = ctx.phase * Number(p.speed) + Number(p.phase)
    return { signal: curveValue(p.shape as CurveShape, t, p as unknown as Partial<CurveParams>) }
  },
}
