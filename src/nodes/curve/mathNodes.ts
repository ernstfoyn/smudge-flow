import type { NodeDefinition, ParamDef } from '../../engine/types'

const NUMBER = { type: 'number' as const }

function finite(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

const operationOptions: ParamDef['options'] = [
  { value: 'add', label: 'Legg sammen (A + B)' },
  { value: 'subtract', label: 'Trekk fra (A − B)' },
  { value: 'multiply', label: 'Multipliser (A × B)' },
  { value: 'divide', label: 'Del (A ÷ B)' },
  { value: 'min', label: 'Minste av A og B' },
  { value: 'max', label: 'Største av A og B' },
  { value: 'power', label: 'Potens (A ^ B)' },
  { value: 'modulo', label: 'Modulo (A mod B)' },
  { value: 'abs', label: 'Absoluttverdi av A' },
  { value: 'floor', label: 'Gulv av A' },
  { value: 'ceil', label: 'Tak av A' },
  { value: 'round', label: 'Rund av A' },
  { value: 'sign', label: 'Fortegn til A' },
]

function calculate(operation: string, a: number, b: number): number {
  switch (operation) {
    case 'subtract':
      return a - b
    case 'multiply':
      return a * b
    case 'divide':
      return b === 0 ? 0 : a / b
    case 'min':
      return Math.min(a, b)
    case 'max':
      return Math.max(a, b)
    case 'power':
      return a ** b
    case 'modulo':
      return b === 0 ? 0 : a % b
    case 'abs':
      return Math.abs(a)
    case 'floor':
      return Math.floor(a)
    case 'ceil':
      return Math.ceil(a)
    case 'round':
      return Math.round(a)
    case 'sign':
      return Math.sign(a)
    case 'add':
    default:
      return a + b
  }
}

/**
 * Matematikk på tall og signaler.
 *
 * A og B kan komme fra signaler eller andre tallkilder. Er en inngang ikke
 * koblet til, brukes den faste verdien i parameteren. Da kan noden også
 * brukes som en enkel konstant eller skaleringsnode.
 */
export const mathNode: NodeDefinition = {
  type: 'value.math',
  label: 'Matematikk',
  category: 'curve',
  description:
    'Regner på to tall eller signaler: legg sammen, multipliser, min/maks, potens, modulo og avrunding. Ukoblede innganger bruker de faste verdiene A og B.',
  inputs: [
    { id: 'a', label: 'A', ...NUMBER, optional: true },
    { id: 'b', label: 'B', ...NUMBER, optional: true },
  ],
  outputs: [{ id: 'out', label: 'Verdi', type: 'number' }],
  params: [
    { key: 'operation', label: 'Operasjon', type: 'enum', default: 'add', options: operationOptions },
    { key: 'a', label: 'A (fast)', ...NUMBER, default: 0, min: -100000, max: 100000, step: 0.01, animatable: true },
    { key: 'b', label: 'B (fast)', ...NUMBER, default: 1, min: -100000, max: 100000, step: 0.01, animatable: true },
  ],
  evaluate(_ctx, inputs, p) {
    const a = typeof inputs.a === 'number' ? inputs.a : finite(p.a, 0)
    const b = typeof inputs.b === 'number' ? inputs.b : finite(p.b, 1)
    const value = calculate(String(p.operation), a, b)
    return { out: Number.isFinite(value) ? value : 0 }
  },
}

/**
 * Remap: flytter et tallområde til et annet.
 *
 * Nyttig for å gjøre et signal fra −1…1 om til for eksempel 0…100, eller for
 * å klemme og mykne en verdi før den styrer en parameter.
 */
export const remapNode: NodeDefinition = {
  type: 'value.remap',
  label: 'Remap',
  category: 'curve',
  description:
    'Flytter et tall fra ett område til et annet, for eksempel −1…1 til 0…100. Kan klemme til området og bruke myk smoothstep-kurve.',
  inputs: [{ id: 'in', label: 'Verdi', ...NUMBER, optional: true }],
  outputs: [{ id: 'out', label: 'Verdi', type: 'number' }],
  params: [
    { key: 'value', label: 'Verdi (fast)', ...NUMBER, default: 0, min: -100000, max: 100000, step: 0.01, animatable: true },
    { key: 'fromMin', label: 'Fra min', ...NUMBER, default: -1, min: -100000, max: 100000, step: 0.01, animatable: true },
    { key: 'fromMax', label: 'Fra maks', ...NUMBER, default: 1, min: -100000, max: 100000, step: 0.01, animatable: true },
    { key: 'toMin', label: 'Til min', ...NUMBER, default: 0, min: -100000, max: 100000, step: 0.01, animatable: true },
    { key: 'toMax', label: 'Til maks', ...NUMBER, default: 1, min: -100000, max: 100000, step: 0.01, animatable: true },
    { key: 'clamp', label: 'Klem til området', type: 'boolean', default: true },
    { key: 'smooth', label: 'Myk overgang (smoothstep)', type: 'boolean', default: false },
  ],
  evaluate(_ctx, inputs, p) {
    const value = typeof inputs.in === 'number' ? inputs.in : finite(p.value, 0)
    const fromMin = finite(p.fromMin, -1)
    const fromMax = finite(p.fromMax, 1)
    const toMin = finite(p.toMin, 0)
    const toMax = finite(p.toMax, 1)

    let t = fromMax === fromMin ? 0 : (value - fromMin) / (fromMax - fromMin)
    if (p.clamp) t = Math.min(1, Math.max(0, t))
    if (p.smooth) t = t * t * (3 - 2 * t)
    const out = toMin + t * (toMax - toMin)
    return { out: Number.isFinite(out) ? out : toMin }
  },
}

/**
 * Velger én av fire tallinnganger. Praktisk for å bytte mellom signaler,
 * faste verdier eller ulike varianter av en animasjon.
 */
export const valueSwitchNode: NodeDefinition = {
  type: 'value.switch',
  label: 'Verdi-velger',
  category: 'curve',
  description:
    'Velger én av fire tallinnganger. Bytt inngang med Indeks, eller koble et signal til Indeks for å styre valget.',
  inputs: [
    { id: 'in0', label: 'A', ...NUMBER, optional: true },
    { id: 'in1', label: 'B', ...NUMBER, optional: true },
    { id: 'in2', label: 'C', ...NUMBER, optional: true },
    { id: 'in3', label: 'D', ...NUMBER, optional: true },
    { id: 'index', label: 'Indeks', type: 'number', optional: true },
  ],
  outputs: [{ id: 'out', label: 'Verdi', type: 'number' }],
  params: [
    { key: 'index', label: 'Indeks', type: 'int', default: 0, min: 0, max: 3, animatable: true },
  ],
  evaluate(_ctx, inputs, p) {
    const raw = typeof inputs.index === 'number' ? inputs.index : finite(p.index, 0)
    const index = Math.min(3, Math.max(0, Math.round(raw)))
    const value = inputs[`in${index}`]
    return { out: typeof value === 'number' ? value : 0 }
  },
}
