import { describe, expect, it } from 'vitest'
import { canConnectTypes } from '../src/engine/graph'
import type { ValueType } from '../src/engine/types'
import {
  PARAM_META,
  PORT_LEGEND,
  PORT_META,
  paramPortCompatible,
  portMeta,
  valuePortsCompatible,
} from '../src/ui/portStyle'

const TYPES = Object.keys(PORT_META) as ValueType[]

describe('portfarger', () => {
  it('har en farge og etikett for alle verdityper', () => {
    for (const type of TYPES) {
      expect(PORT_META[type].color).toMatch(/^#[0-9a-f]{6}$/i)
      expect(PORT_META[type].label.length).toBeGreaterThan(0)
    }
  })

  it('følger regelen: samme farge = kan kobles', () => {
    for (const source of TYPES) {
      for (const target of TYPES) {
        const sameColor = PORT_META[source].color === PORT_META[target].color
        expect(
          sameColor,
          `${source} → ${target}: farger ${sameColor ? 'matcher' : 'matcher ikke'}, men kompatibilitet er ${canConnectTypes(source, target)}`,
        ).toBe(canConnectTypes(source, target))
      }
    }
  })

  it('gir de vanlige porttypene hver sin farge', () => {
    const used = PORT_LEGEND.map((entry) => entry.type)
    expect(new Set(used).size).toBe(used.length)
    expect(new Set(PORT_LEGEND.map((entry) => entry.color)).size).toBe(PORT_LEGEND.length)
  })

  it('lar bare tall styre parameterinnganger', () => {
    expect(paramPortCompatible('number')).toBe(true)
    expect(paramPortCompatible('object3d')).toBe(false)
    expect(PARAM_META.color).toBe(PORT_META.number.color)
    expect(valuePortsCompatible('canvas', 'drawable')).toBe(true)
    expect(valuePortsCompatible('drawable', 'canvas')).toBe(true)
    expect(valuePortsCompatible('object3d', 'canvas')).toBe(false)
    expect(portMeta('lights').label).toBe('Lys')
  })
})
