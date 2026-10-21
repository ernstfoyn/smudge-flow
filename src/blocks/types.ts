import type { GraphEdge, GraphNode, GroupInput, GroupOutput } from '../engine/types'

/**
 * En gjenbrukbart blokk — altså et nodetre som kan lastes inn på nytt.
 *
 * En blokk er i praksis en gruppe-node som er lagret utenfor grafen:
 *   - `nodes`/`edges` er innholdet
 *   - `inputs`/`outputs` er de eksponerte portene som gjør blokken
 *     brukbar på nytt innhold
 *
 * Forskjellen på en blokk og en vanlig gruppe er at blokken lever i et
 * bibliotek: den kan settes inn mange ganger, i mange grafer, og den kan
 * deles som en JSON-fil.
 */
export interface BlockTemplate {
  id: string
  name: string
  description?: string
  /** Kategori i biblioteket, f.eks. «Generativ» eller «3D». */
  category?: string
  /** Versjon, for fremtidige migreringer. */
  version: number
  nodes: GraphNode[]
  edges: GraphEdge[]
  inputs: GroupInput[]
  outputs: GroupOutput[]
  /** Bygget: true for innebygde oppsett, false for brukerens egne. */
  builtin?: boolean
  createdAt?: string
}

export const BLOCK_VERSION = 1

export function createEmptyBlock(name: string, description?: string): BlockTemplate {
  return {
    id: `block-${Date.now().toString(36)}`,
    name,
    description,
    version: BLOCK_VERSION,
    nodes: [],
    edges: [],
    inputs: [],
    outputs: [],
    createdAt: new Date().toISOString(),
  }
}
