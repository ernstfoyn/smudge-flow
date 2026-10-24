import { describe, expect, it } from 'vitest'
import { registry } from '../src/nodes'
import { searchNodes } from '../src/ui/nodeSearch'

const defs = registry.all()

describe('nodesøk til Tab-menyen', () => {
  it('viser alle noder i registerrekkefølge når søket er tomt', () => {
    expect(searchNodes(defs, '   ').map((def) => def.type)).toEqual(
      defs.map((def) => def.type),
    )
  })

  it('finner noder på label, type og beskrivelse', () => {
    expect(searchNodes(defs, 'objektbevegelse').map((def) => def.type)).toContain(
      'modifier.motion2D',
    )
    expect(searchNodes(defs, 'sceneRender').map((def) => def.type)).toContain(
      'composite.sceneRender',
    )
    expect(searchNodes(defs, 'løkkesikker').map((def) => def.type)).toContain(
      'modifier.motion2D',
    )
  })

  it('er tolerant for norske tegn', () => {
    expect(searchNodes(defs, 'bolge').map((def) => def.type)).toContain(
      'modifier.motion3D',
    )
    expect(searchNodes(defs, 'BØLGE').map((def) => def.type)).toContain(
      'modifier.motion3D',
    )
  })

  it('krever at alle ordene i søket finnes', () => {
    expect(searchNodes(defs, '3d tekst').map((def) => def.type)).toContain(
      'source.text3D',
    )
    expect(searchNodes(defs, '3d ukjentord')).toHaveLength(0)
  })

  it('finner kategorier og sorterer labeltreff før beskrivelsestreff', () => {
    const categoryHits = searchNodes(defs, 'modifikator')
    expect(categoryHits.length).toBeGreaterThan(0)
    expect(categoryHits.every((def) => def.category === 'modifier')).toBe(true)

    const ranked = searchNodes(defs, '3d')
    expect(ranked.length).toBeGreaterThan(0)
    expect(ranked[0].label.toLowerCase().startsWith('3d')).toBe(true)
  })

  it('gir en tom liste når ingenting passer', () => {
    expect(searchNodes(defs, 'finnes-ikke-123')).toEqual([])
  })
})
