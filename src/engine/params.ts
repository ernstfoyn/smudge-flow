import type { GraphNode, NodeDefinition } from './types'
import { evaluateTracks, getPath, setPath } from './animation/keyframes'
import { applyLfo } from './animation/lfo'

/**
 * Effektiv parameterverdi for én frame:
 *   node.params → keyframes → LFO → clamp/round
 *
 * Rekkefølgen er bevisst: en keyframe overstyrer grunnverdien, og LFOen
 * legger seg på toppen av den animerte verdien.
 */
export function resolveParamsAt(
  node: GraphNode,
  frame: number,
  phase: number,
  def: NodeDefinition,
): Record<string, unknown> {
  const out = evaluateTracks(node.params, node.tracks, frame) as Record<string, any>

  for (const p of def.params) {
    if (p.type === 'enum' || p.type === 'text' || p.type === 'color' || p.type === 'boolean') {
      continue
    }

    const lfo = node.lfo?.[p.key]
    if (!lfo?.on) continue

    const base = Number(getPath(out, p.key) ?? p.default ?? 0)
    const value = applyLfo(
      base,
      lfo,
      [p.min ?? 0, p.max ?? 1],
      p.type === 'int',
      phase,
    )
    setPath(out, p.key, value)
  }

  // Håndhev int og range ETTER animasjon, slik at verdien alltid er gyldig.
  for (const p of def.params) {
    if (p.type !== 'int' && p.type !== 'number') continue
    let value = Number(getPath(out, p.key) ?? p.default ?? 0)
    if (!Number.isFinite(value)) value = Number(p.default ?? 0)
    if (p.type === 'int') value = Math.round(value)
    if (p.min !== undefined) value = Math.max(p.min, value)
    if (p.max !== undefined) value = Math.min(p.max, value)
    setPath(out, p.key, value)
  }

  return out
}
