import { afterEach, describe, expect, it, vi } from 'vitest'
import { Evaluator } from '../src/engine/evaluator'
import { NodeRegistry } from '../src/engine/registry'
import { blob3D } from '../src/nodes/source/blob3D'
import type { Graph, PostOptions, RenderServices } from '../src/engine/types'

/** RenderServices som husker hva blob-noden sendte til GPU-steget. */
function recordingRender() {
  const calls: Array<{ input: unknown; options: PostOptions }> = []
  const gradients: string[] = []

  const context = {
    createLinearGradient: () => ({ addColorStop: (_o: number, c: string) => gradients.push(c) }),
    createRadialGradient: () => ({ addColorStop: (_o: number, c: string) => gradients.push(c) }),
    fillRect: () => {},
    clearRect: () => {},
    drawImage: () => {},
    save: () => {},
    restore: () => {},
    setTransform: () => {},
    fillStyle: '',
    globalAlpha: 1,
    globalCompositeOperation: '',
  }
  const canvases = new Map<string, unknown>()

  vi.stubGlobal('document', {
    createElement: () => ({
      width: 1,
      height: 1,
      getContext: () => context,
    }),
  })

  const render = {
    width: 64,
    height: 64,
    canvas: (key: string) => {
      if (!canvases.has(key)) {
        canvases.set(key, { canvas: { key }, ctx: context, width: 64, height: 64, version: 0 })
      }
      return canvases.get(key)
    },
    assets: {},
    touch: () => {},
    versionOf: () => 0,
    post: async (input: unknown, options: PostOptions) => {
      calls.push({ input, options })
      return { fake: true }
    },
    dispose: () => {},
  } as unknown as RenderServices

  return { render, calls, gradients }
}

function graph(): Graph {
  return {
    version: 1,
    settings: { width: 64, height: 64, fps: 60, frames: 60, loop: true, background: '#000' },
    nodes: [
      { id: 'blob', type: 'source.blob3D', title: 'Blob', params: { imageA: '#112233', imageB: '#aabbcc' }, position: { x: 0, y: 0 } },
    ],
    edges: [],
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('blob uten bilde', () => {
  it('har valgfri bildeinngang', () => {
    expect(blob3D.inputs[0].optional).toBe(true)
  })

  it('evalueres alene, med en fargetekstur i stedet for et bilde', async () => {
    const { render, calls, gradients } = recordingRender()
    const evaluator = new Evaluator(new NodeRegistry().registerAll([blob3D]), render)

    await evaluator.evaluateFrame(graph(), 10, ['blob'])

    expect(calls).toHaveLength(1)
    expect(calls[0].input).toBeTruthy()
    expect(calls[0].options.textures?.uBgGradient).toBeTruthy()
    expect(gradients).toContain('#112233')
    expect(gradients).toContain('#aabbcc')
  })

  it('bruker det tilkoblede bildet når det finnes', async () => {
    const { render, calls } = recordingRender()
    const image = { image: true }
    const source = {
      type: 'test.image',
      label: 'Bilde',
      category: 'source' as const,
      inputs: [],
      outputs: [{ id: 'out', label: 'Bilde', type: 'canvas' as const }],
      params: [],
      evaluate: () => ({ out: image }),
    }
    const evaluator = new Evaluator(new NodeRegistry().registerAll([blob3D, source]), render)
    const g = graph()
    g.nodes.push({ id: 'img', type: 'test.image', title: 'Bilde', params: {}, position: { x: 0, y: 0 } })
    g.edges.push({ id: 'e', source: 'img', sourcePort: 'out', target: 'blob', targetPort: 'in' })

    await evaluator.evaluateFrame(g, 10, ['blob'])
    expect(calls[0].input).toBe(image)
  })
})
