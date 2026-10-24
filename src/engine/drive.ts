import type { ParamDef } from './types'

/**
 * Port-id for «Styring»: én inngang per node som lar en tallkilde styre
 * flere parametere samtidig (kantens `kind` er 'drive').
 */
export const DRIVE_PORT_ID = 'drive:all'

/** Kan parameteren styres av en tallverdi? */
export function isDrivableParam(param: ParamDef): boolean {
  return (param.type === 'number' || param.type === 'int') && param.animatable !== false
}

/** Parameterne en tallkilde kan styre. */
export function drivableParams(params: readonly ParamDef[]): ParamDef[] {
  return params.filter(isDrivableParam)
}
