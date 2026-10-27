import type { DriveSettings, GraphEdge, ParamDef } from './types'

/**
 * Signalstyring.
 *
 * Et signal (−1…1) fra en kurvenode modulerer parametere *rundt grunnverdien*,
 * slik LFO-en i den opprinnelige appen gjorde:
 *
 *   effektiv = grunnverdi + signal × styrke × (max − min) / 2
 *
 * Styrken er relativ til hver parameters eget område. Derfor kan samme signal
 * styre mange noder med helt ulike områder, og flere signaler kan legge seg
 * oppå hverandre.
 */

/** Port-id for «Styring»: én inngang per node som tar imot signaler. */
export const DRIVE_PORT_ID = 'drive:all'

const PARAM_PREFIX = 'param:'

/** Nodetypen som lager signaler. Diamantkoblinger fra den blir modulering. */
export const SIGNAL_NODE_TYPE = 'curve.signal'

export const DEFAULT_DRIVE: DriveSettings = { param: null, amount: 0.5 }

/** Kan parameteren styres av en tallverdi? */
export function isDrivableParam(param: ParamDef): boolean {
  return (param.type === 'number' || param.type === 'int') && param.animatable !== false
}

/** Parameterne et signal kan styre. */
export function drivableParams(params: readonly ParamDef[]): ParamDef[] {
  return params.filter(isDrivableParam)
}

/** Er parameteren synlig gitt de andre parameterne? */
export function isParamVisible(param: ParamDef, values: Record<string, unknown>): boolean {
  if (!param.showWhen) return true
  const current = values[param.showWhen.key]
  // Mangler den styrende verdien (eldre grafer), viser vi parameteren.
  // Det er bedre enn å skjule et felt brukeren kanskje trenger.
  if (current === undefined) return true
  return param.showWhen.in.some((value) => value === current)
}

/** Innstillingene for en signalkant, med trygge standardverdier. */
export function driveSettings(edge: GraphEdge): DriveSettings {
  const fixed = edge.targetPort.startsWith(PARAM_PREFIX)
    ? edge.targetPort.slice(PARAM_PREFIX.length)
    : null
  const raw = edge.drive
  const amount = Number.isFinite(raw?.amount) ? Math.max(-1, Math.min(1, raw!.amount)) : DEFAULT_DRIVE.amount
  return {
    // Koblet rett til en diamant: da styrer den bare den ene parameteren.
    param: fixed ?? raw?.param ?? null,
    amount,
  }
}

/** Parameternøklene en signalkant styrer på en node med disse parameterne. */
export function drivenKeys(edge: GraphEdge, params: readonly ParamDef[]): string[] {
  const { param } = driveSettings(edge)
  const candidates = drivableParams(params)
  return param === null
    ? candidates.map((p) => p.key)
    : candidates.filter((p) => p.key === param).map((p) => p.key)
}

/** Parameterens spennvidde: (max − min), eller en fornuftig reserve uten grenser. */
export function paramSpan(param: ParamDef | undefined, base: number): number {
  if (param?.min !== undefined && param?.max !== undefined && param.max > param.min) {
    return param.max - param.min
  }
  return Math.max(1, Math.abs(base)) * 2
}

/** Legger en samlet modulering oppå grunnverdien. */
export function modulate(base: number, delta: number, param: ParamDef | undefined): number {
  let value = base + delta * paramSpan(param, base) * 0.5
  if (!Number.isFinite(value)) value = base
  if (param?.type === 'int') value = Math.round(value)
  if (param?.min !== undefined) value = Math.max(param.min, value)
  if (param?.max !== undefined) value = Math.min(param.max, value)
  return value
}
