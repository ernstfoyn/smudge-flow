import { beforeEach, describe, expect, it } from 'vitest'
import { layerSettings, type StackParams } from '../src/nodes/composite/stack'
import { rekeySubgraph } from '../src/engine/graph'
import { useGraphStore } from '../src/state/useGraphStore'
import type { Graph } from '../src/engine/types'

const base: Pick<StackParams, 'mode' | 'opacity' | 'layers'> = {
  mode: 'screen',
  opacity: 0.9,
  layers: {},
}

describe('laginnstillinger', () => {
  it('bruker stabelens standarder når laget ikke har egne', () => {
    const s = layerSettings(base, 'en-kant')
    expect(s).toEqual({ mode: 'screen', opacity: 0.9, visible: true })
  })

  it('lar laget overstyre modus og dekkevne', () => {
    const s = layerSettings(
      {
        ...base,
        layers: { 'en-kant': { mode: 'multiply', opacity: 0.4, visible: false } },
      },
      'en-kant',
    )
    expect(s).toEqual({ mode: 'multiply', opacity: 0.4, visible: false })
  })

  it('blander ikke lagene', () => {
    const params: StackParams = {
      ...base,
      reverse: false,
      layers: {
        a: { mode: 'multiply', opacity: 0.2, visible: true },
        b: { mode: 'add', opacity: 1, visible: false },
      },
    }
    expect(layerSettings(params, 'a').mode).toBe('multiply')
    expect(layerSettings(params, 'b').mode).toBe('add')
    expect(layerSettings(params, 'c').mode).toBe('screen')
  })
})

describe('setLayerSetting', () => {
  function graph(): Graph {
    return {
      version: 1,
      settings: { width: 10, height: 10, fps: 30, frames: 60, loop: true, background: '#000' },
      nodes: [
        { id: 'a', type: 'source.gradient', title: 'A', params: {}, position: { x: 0, y: 0 } },
        { id: 'b', type: 'source.gradient', title: 'B', params: {}, position: { x: 0, y: 0 } },
        {
          id: 'st',
          type: 'composite.stack',
          title: 'Stabel',
          params: { mode: 'screen', opacity: 0.9, reverse: false, layers: {} },
          position: { x: 0, y: 0 },
        },
      ],
      edges: [
        { id: 'a.out->st.in', source: 'a', sourcePort: 'out', target: 'st', targetPort: 'in' },
        { id: 'b.out->st.in', source: 'b', sourcePort: 'out', target: 'st', targetPort: 'in' },
      ],
    }
  }

  beforeEach(() => {
    useGraphStore.getState().setGraph(graph())
    useGraphStore.getState().clearHistory()
  })

  it('lagrer innstillinger nøklet på kant-id', () => {
    useGraphStore.getState().setLayerSetting('st', 'b.out->st.in', { mode: 'multiply', opacity: 0.3 })

    const stack = useGraphStore.getState().graph.nodes.find((n) => n.id === 'st')!
    const layers = stack.params.layers as Record<string, { mode: string; opacity: number }>
    expect(layers['b.out->st.in'].mode).toBe('multiply')
    expect(layers['b.out->st.in'].opacity).toBe(0.3)
    expect(layers['a.out->st.in']).toBeUndefined()
  })

  it('beholder andre lags innstillinger', () => {
    const store = useGraphStore.getState()
    store.setLayerSetting('st', 'a.out->st.in', { opacity: 0.2 })
    store.setLayerSetting('st', 'b.out->st.in', { opacity: 0.8 })

    const stack = useGraphStore.getState().graph.nodes.find((n) => n.id === 'st')!
    const layers = stack.params.layers as Record<string, { opacity: number }>
    expect(layers['a.out->st.in'].opacity).toBe(0.2)
    expect(layers['b.out->st.in'].opacity).toBe(0.8)
  })

  it('tar vare på innstillingene når laget kobles fra og til igjen', () => {
    const store = useGraphStore.getState()
    store.setLayerSetting('st', 'b.out->st.in', { mode: 'difference' })
    store.disconnect('b.out->st.in')

    // Ny kobling får samme id, fordi id-en er avledet av kilde og mål.
    store.connect('b', 'out', 'st', 'in')

    const stack = useGraphStore.getState().graph.nodes.find((n) => n.id === 'st')!
    const layers = stack.params.layers as Record<string, { mode: string }>
    expect(layers['b.out->st.in'].mode).toBe('difference')
  })
})

describe('rekeySubgraph', () => {
  it('flytter per-lag-nøklene til de nye kant-ID-ene', () => {
    const subgraph = {
      nodes: [
        { id: 'a', type: 'source.gradient', title: 'A', params: {}, position: { x: 0, y: 0 } },
        {
          id: 'st',
          type: 'composite.stack',
          title: 'Stabel',
          params: {
            mode: 'screen',
            opacity: 0.9,
            layers: { 'a.out->st.in': { mode: 'multiply', opacity: 0.5, visible: true } },
          },
          position: { x: 0, y: 0 },
        },
      ],
      edges: [
        { id: 'a.out->st.in', source: 'a', sourcePort: 'out', target: 'st', targetPort: 'in' },
      ],
      inputs: [],
      outputs: [],
    }

    const copy = rekeySubgraph(subgraph, 'kopi')
    const stack = copy.nodes.find((n) => n.type === 'composite.stack')!
    const layers = stack.params.layers as Record<string, { mode: string }>

    // Nøkkelen peker nå på kopiens egen kant, ikke originalens.
    expect(Object.keys(layers)).toEqual([copy.edges[0].id])
    expect(layers[copy.edges[0].id].mode).toBe('multiply')
  })
})
