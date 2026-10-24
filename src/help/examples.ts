import type { Graph, GraphEdge, GraphNode } from '../engine/types'
import { createEdge, createGraph } from '../engine/graph'
import { DRIVE_PORT_ID } from '../engine/drive'
import { defaultGraph, makeNode } from '../state/defaultGraph'

/**
 * Eksempelgrafer som hjelpen kan laste inn. Hver er liten nok til å forstås
 * på et blikk, og viser ett konsept av gangen.
 */

export interface HelpExample {
  id: string
  title: string
  description: string
  build: () => Graph
}

/** Flytter nodene under fargeforklaringen øverst til høyre i lerretet. */
const CANVAS_OFFSET = { x: 40, y: 160 }

function graphOf(nodes: GraphNode[], edges: GraphEdge[], settings = {}): Graph {
  const graph = createGraph({ width: 960, height: 960, fps: 60, frames: 240, ...settings })
  const placed = nodes.map((node) => ({
    ...node,
    position: { x: node.position.x + CANVAS_OFFSET.x, y: node.position.y + CANVAS_OFFSET.y },
  }))
  return { ...graph, nodes: placed, edges }
}

/** Kobler en kilde med et signal til Styring, med egne innstillinger. */
function signalEdge(source: string, target: string, param: string | null, amount: number): GraphEdge {
  return {
    ...createEdge(source, 'signal', target, DRIVE_PORT_ID, 'drive'),
    drive: { param, amount },
  }
}

export const HELP_EXAMPLES: HelpExample[] = [
  {
    id: 'startgraf',
    title: 'Startgrafen',
    description:
      'Gradient og Generativ grafikk blandes i Lagstabel og vises i Viewport. Prøv å endre tall i Egenskaper.',
    build: () => defaultGraph(),
  },
  {
    id: 'signal-styring',
    title: 'Signal som beveger en node',
    description:
      'Et sinussignal styrer størrelsen på de generative prikkene. Marker Signal og endre Styrke, eller marker prikkene og se hva Styring viser.',
    build: () => {
      const signal = makeNode('curve.signal', 'signal', { x: 0, y: 0 })
      signal.params = { ...signal.params, shape: 'sine', speed: 1 }
      const dots = makeNode('source.motionGraphics', 'dots', { x: 320, y: 0 })
      const view = makeNode('output.viewport', 'view', { x: 640, y: 0 })
      return graphOf(
        [signal, dots, view],
        [
          signalEdge('signal', 'dots', 'size', 0.5),
          createEdge('dots', 'out', 'view', 'frame'),
        ],
      )
    },
  },
  {
    id: 'lagstabel',
    title: 'Lag som blandes',
    description:
      'To bilder legges oppå hverandre i en Lagstabel. Rekkefølgen i listen bestemmer hva som ligger øverst, og hvert lag har sin egen modus.',
    build: () => {
      const gradient = makeNode('source.gradient', 'bg', { x: 0, y: 0 })
      const dots = makeNode('source.motionGraphics', 'dots', { x: 0, y: 260 })
      const stack = makeNode('composite.stack', 'stack', { x: 320, y: 120 })
      const view = makeNode('output.viewport', 'view', { x: 640, y: 120 })
      return graphOf(
        [gradient, dots, stack, view],
        [
          createEdge('bg', 'out', 'stack', 'in'),
          createEdge('dots', 'out', 'stack', 'in'),
          createEdge('stack', 'out', 'view', 'frame'),
        ],
      )
    },
  },
  {
    id: '3d-scene',
    title: '3D-tekst i en scene',
    description:
      '3D-tekst flyttes med Transform 3D, tegnes av 3D-scenen, og vises i Viewport. Oransje porter er 3D-objekter.',
    build: () => {
      const text = makeNode('source.text3D', 'text', { x: 0, y: 0 })
      const move = makeNode('modifier.transform3D', 'move', { x: 300, y: 0 })
      const scene = makeNode('composite.sceneRender', 'scene', { x: 600, y: 0 })
      const view = makeNode('output.viewport', 'view', { x: 900, y: 0 })
      return graphOf(
        [text, move, scene, view],
        [
          createEdge('text', 'out', 'move', 'in'),
          createEdge('move', 'out', 'scene', 'in'),
          createEdge('scene', 'out', 'view', 'frame'),
        ],
      )
    },
  },
  {
    id: 'blob',
    title: 'Blob uten bilde',
    description:
      'Blob er en frittstående kilde. Uten tilkoblet bilde pakkes en fargegradient rundt formen.',
    build: () => {
      const blob = makeNode('source.blob3D', 'blob', { x: 0, y: 0 })
      const view = makeNode('output.viewport', 'view', { x: 320, y: 0 })
      return graphOf([blob, view], [createEdge('blob', 'out', 'view', 'frame')])
    },
  },
  {
    id: 'keyframes',
    title: 'Keyframes',
    description:
      'Størrelsen på blobben er satt på tre tidspunkter. Mellom dem jevnes verdien ut, og den ender der den startet, så loopen lukker seg.',
    build: () => {
      const blob = makeNode('source.blob3D', 'blob', { x: 0, y: 0 })
      blob.tracks = {
        size: [
          { frame: 0, value: 0.25 },
          { frame: 120, value: 0.7 },
          { frame: 239, value: 0.25 },
        ],
      }
      const view = makeNode('output.viewport', 'view', { x: 320, y: 0 })
      return graphOf([blob, view], [createEdge('blob', 'out', 'view', 'frame')])
    },
  },
]

export function findExample(id: string): HelpExample | undefined {
  return HELP_EXAMPLES.find((example) => example.id === id)
}
