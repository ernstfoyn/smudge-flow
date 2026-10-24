import { describe, expect, it } from 'vitest'
import { HELP_EXAMPLES } from '../src/help/examples'
import { HELP_TOPICS } from '../src/help/content'
import { nodeParamDefs, nodePorts } from '../src/engine/graph'
import { DRIVE_PORT_ID, driveSettings } from '../src/engine/drive'
import { registry } from '../src/nodes'
import { defaultGraph } from '../src/state/defaultGraph'
import { canConnectTypes } from '../src/engine/graph'
import type { Graph } from '../src/engine/types'

/** Sjekker at hver kobling peker på noder og porter som faktisk finnes. */
function problemsIn(graph: Graph): string[] {
  const problems: string[] = []
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  const ids = new Set<string>()
  for (const node of graph.nodes) {
    if (ids.has(node.id)) problems.push(`dobbel node-id ${node.id}`)
    ids.add(node.id)
    if (!registry.has(node.type)) problems.push(`ukjent type ${node.type}`)
  }

  for (const edge of graph.edges) {
    const source = byId.get(edge.source)
    const target = byId.get(edge.target)
    if (!source || !target) {
      problems.push(`kobling ${edge.id} peker på manglende node`)
      continue
    }
    const out = nodePorts(source).outputs.find((p) => p.id === edge.sourcePort)
    if (!out) {
      problems.push(`${edge.id}: utgangen ${edge.sourcePort} finnes ikke`)
      continue
    }

    if (edge.kind === 'drive') {
      if (out.type !== 'number') problems.push(`${edge.id}: styring krever tall`)
      if (edge.targetPort === DRIVE_PORT_ID) {
        const { param } = driveSettings(edge)
        const keys = nodeParamDefs(target).map((p) => p.key)
        if (param !== null && !keys.includes(param)) problems.push(`${edge.id}: parameteren ${param} finnes ikke`)
      } else if (edge.targetPort.startsWith('param:')) {
        const key = edge.targetPort.slice('param:'.length)
        if (!nodeParamDefs(target).some((p) => p.key === key)) problems.push(`${edge.id}: diamanten ${key} finnes ikke`)
      } else {
        problems.push(`${edge.id}: ugyldig styringsport`)
      }
      continue
    }

    if (edge.kind === 'param') {
      const key = edge.targetPort.slice('param:'.length)
      if (!nodeParamDefs(target).some((p) => p.key === key)) problems.push(`${edge.id}: diamanten ${key} finnes ikke`)
      continue
    }

    const inPort = nodePorts(target).inputs.find((p) => p.id === edge.targetPort)
    if (!inPort) {
      problems.push(`${edge.id}: inngangen ${edge.targetPort} finnes ikke`)
      continue
    }
    if (!canConnectTypes(out.type, inPort.type)) problems.push(`${edge.id}: feil type`)
  }

  return problems
}

describe('hjelpens eksempler', () => {
  it('har unike id-er som hjelpen peker til', () => {
    const ids = HELP_EXAMPLES.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)

    const used = HELP_TOPICS.flatMap((t) =>
      t.blocks.flatMap((b) => (b.type === 'example' ? [b.id] : [])),
    )
    expect(used.length).toBeGreaterThan(0)
    for (const id of used) expect(ids).toContain(id)
  })

  for (const example of HELP_EXAMPLES) {
    it(`«${example.title}» er en gyldig graf`, () => {
      const graph = example.build()
      expect(graph.nodes.length).toBeGreaterThan(0)
      expect(problemsIn(graph)).toEqual([])
    })
  }

  it('startgrafen er den samme som appen starter med', () => {
    expect(HELP_EXAMPLES.find((e) => e.id === 'startgraf')?.build().nodes.map((n) => n.id).sort()).toEqual(
      defaultGraph().nodes.map((n) => n.id).sort(),
    )
  })

  it('hver graf har en viewport, så resultatet kan ses', () => {
    for (const example of HELP_EXAMPLES) {
      expect(example.build().nodes.some((n) => n.type === 'output.viewport')).toBe(true)
    }
  })
})
