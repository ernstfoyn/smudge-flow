import { describe, expect, it } from 'vitest'
import { analyzeLottie } from '../src/export/lottie/compat'
import { exportLottie } from '../src/export/lottie/exportLottie'
import type { Graph, GraphEdge, GraphNode } from '../src/engine/types'

const settings = {
  width: 960,
  height: 960,
  fps: 60,
  frames: 120,
  loop: true,
  background: '#000000',
}

function node(
  id: string,
  type: string,
  params: Record<string, unknown> = {},
  tracks: GraphNode['tracks'] = {},
): GraphNode {
  return {
    id,
    type,
    title: id,
    params,
    tracks,
    lfo: {},
    position: { x: 0, y: 0 },
    enabled: true,
  }
}

function edge(source: string, target: string, targetPort = 'in'): GraphEdge {
  return {
    id: `${source}.out->${target}.${targetPort}`,
    source,
    sourcePort: 'out',
    target,
    targetPort,
    kind: 'value',
  }
}

function graph(nodes: GraphNode[], edges: GraphEdge[]): Graph {
  return { version: 1, settings, nodes, edges }
}

function output(id = 'out'): GraphNode {
  return node(id, 'output.viewport')
}

function fillOf(layer: Record<string, any>): number[] | undefined {
  const group = layer.shapes?.[0]
  const fill = group?.it?.find((item: Record<string, any>) => item.ty === 'fl')
  return fill?.c?.k
}

describe('Lottie-kompatibilitet', () => {
  it('merker en form som native', () => {
    const shape = node('shape', 'source.shape2D', { shape: 'ellipse' })
    const analysis = analyzeLottie(graph([shape, output()], [edge('shape', 'out', 'frame')]))
    expect(analysis.nodes.shape.status).toBe('native')
  })

  it('merker en lagstabel med en støttet og en ustøttet node som partial', () => {
    const shape = node('shape', 'source.shape2D', { shape: 'rectangle' })
    const noise = node('noise', 'source.noise')
    const stack = node('stack', 'composite.stack')
    const analysis = analyzeLottie(
      graph(
        [shape, noise, stack, output()],
        [edge('shape', 'stack'), edge('noise', 'stack'), edge('stack', 'out', 'frame')],
      ),
    )
    expect(analysis.nodes.noise.status).toBe('unsupported')
    expect(analysis.nodes.stack.status).toBe('partial')
  })

  it('merker en lagstabel uten eksporterbare lag som ustøttet', () => {
    const noise = node('noise', 'source.noise')
    const pattern = node('pattern', 'modifier.pattern')
    const stack = node('stack', 'composite.stack')
    const analysis = analyzeLottie(
      graph(
        [noise, pattern, stack, output()],
        [edge('noise', 'stack'), edge('pattern', 'stack'), edge('stack', 'out', 'frame')],
      ),
    )
    expect(analysis.nodes.stack.status).toBe('unsupported')
  })

  it('merker gradienttekst som ustøttet', () => {
    const text = node('text', 'source.text2D', { text: 'Hei', gradient: true })
    const analysis = analyzeLottie(graph([text, output()], [edge('text', 'out', 'frame')]))
    expect(analysis.nodes.text.status).toBe('unsupported')
  })
})

describe('Lottie-eksport', () => {
  it('eksporterer en form med fyll og transform', () => {
    const shape = node('shape', 'source.shape2D', {
      shape: 'ellipse', width: 0.4, height: 0.2, x: 0.25, y: 0.75, fill: '#ff0000', opacity: 1,
    })
    const result = exportLottie(graph([shape, output()], [edge('shape', 'out', 'frame')]))
    const layer = result.document.layers[0]
    expect(layer.ty).toBe(4)
    expect(layer.ks.p.k).toEqual([240, 720, 0])
    expect(fillOf(layer)).toEqual([1, 0, 0, 1])
    expect(result.layers).toBe(1)
  })

  it('eksporterer en gradientkilde som gradient-fyll', () => {
    const gradient = node('gradient', 'source.gradient', {
      fill: 'linear', colorA: '#ff0000', colorB: '#0000ff', stops: [],
    })
    const result = exportLottie(graph([gradient, output()], [edge('gradient', 'out', 'frame')]))
    const group = result.document.layers[0].shapes[0]
    const fill = group.it.find((item: Record<string, any>) => item.ty === 'gf')
    expect(fill).toBeTruthy()
    expect(fill.g.p).toBeGreaterThan(2)
    expect(fill.g.k.k.slice(1, 4)).toEqual([1, 0, 0])
    expect(fill.g.k.k.slice(-3)).toEqual([0, 0, 1])
  })

  it('eksporterer tekst med fontliste', () => {
    const text = node('text', 'source.text2D', {
      text: 'SMUDGE', size: 100, scale: 1, font: 'Arial, Helvetica, sans-serif', weight: '700',
      color: '#ffffff', align: 'center', x: 0.5, y: 0.5, lineHeight: 1.1, opacity: 1,
    })
    const result = exportLottie(graph([text, output()], [edge('text', 'out', 'frame')]))
    const layer = result.document.layers[0]
    expect(layer.ty).toBe(5)
    expect(layer.t.d.k[0].s.t).toBe('SMUDGE')
    expect(result.document.fonts.list[0].fName).toBe('Arial')
  })

  it('gjør om animert bredde fra andel til piksler', () => {
    const shape = node('shape', 'source.shape2D', { shape: 'rectangle' }, {
      width: [
        { frame: 0, value: 0.25 },
        { frame: 60, value: 0.5 },
      ],
    })
    const result = exportLottie(graph([shape, output()], [edge('shape', 'out', 'frame')]))
    const rectangle = result.document.layers[0].shapes[0].it.find(
      (item: Record<string, any>) => item.ty === 'rc',
    )
    expect(rectangle.s.a).toBe(1)
    expect(rectangle.s.k[0].s[0]).toBe(240)
    expect(rectangle.s.k[rectangle.s.k.length - 1].s[0]).toBe(480)
  })

  it('bevarer keyframes på posisjon', () => {
    const shape = node('shape', 'source.shape2D', { shape: 'ellipse' }, {
      x: [
        { frame: 0, value: 0.25 },
        { frame: 60, value: 0.75 },
      ],
    })
    const result = exportLottie(graph([shape, output()], [edge('shape', 'out', 'frame')]))
    const position = result.document.layers[0].ks.p
    expect(position.a).toBe(1)
    expect(position.k.length).toBeGreaterThan(1)
  })

  it('legger topplaget først i Lottie-listen', () => {
    const red = node('red', 'source.shape2D', { shape: 'rectangle', fill: '#ff0000' })
    const blue = node('blue', 'source.shape2D', { shape: 'rectangle', fill: '#0000ff' })
    const stack = node('stack', 'composite.stack', { mode: 'normal', opacity: 1, layers: {}, reverse: false })
    const result = exportLottie(
      graph(
        [red, blue, stack, output()],
        [edge('red', 'stack'), edge('blue', 'stack'), edge('stack', 'out', 'frame')],
      ),
    )
    expect(fillOf(result.document.layers[0])).toEqual([0, 0, 1, 1])
    expect(fillOf(result.document.layers[1])).toEqual([1, 0, 0, 1])
  })

  it('hopper over ustøttede noder med advarsel', () => {
    const noise = node('noise', 'source.noise')
    const result = () => exportLottie(graph([noise, output()], [edge('noise', 'out', 'frame')]))
    expect(result).toThrow(/Lottie-kompatible/)
  })
})
