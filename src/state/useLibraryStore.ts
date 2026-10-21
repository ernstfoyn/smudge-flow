import { create } from 'zustand'
import { BUILTIN_BLOCKS } from '../blocks/builtins'
import { withDefaultSources } from '../blocks/builder'
import { BLOCK_VERSION, createEmptyBlock, type BlockTemplate } from '../blocks/types'

const STORAGE_KEY = 'smudgeflow.blocks.v1'

function loadStored(): BlockTemplate[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as BlockTemplate[]
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((b) => b && Array.isArray(b.nodes) && Array.isArray(b.edges))
      .map((b) => ({ ...b, version: b.version ?? BLOCK_VERSION, builtin: false }))
  } catch {
    return []
  }
}

function persist(blocks: BlockTemplate[]): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(blocks))
  } catch {
    // Full lager eller privat modus — ignorer.
  }
}

interface LibraryState {
  /** Brukerens egne blokker. */
  blocks: BlockTemplate[]
  addBlock: (block: BlockTemplate) => void
  removeBlock: (id: string) => void
  renameBlock: (id: string, name: string) => void
  /** Eksporterer en blokk som JSON-fil. */
  exportBlock: (id: string) => void
  /** Importerer blokker fra en JSON-fil. */
  importBlocks: (file: File) => Promise<number>
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  blocks: loadStored(),

  addBlock: (block) => {
    const blocks = [...get().blocks, { ...block, builtin: false }]
    persist(blocks)
    set({ blocks })
  },

  removeBlock: (id) => {
    const blocks = get().blocks.filter((b) => b.id !== id)
    persist(blocks)
    set({ blocks })
  },

  renameBlock: (id, name) => {
    const blocks = get().blocks.map((b) => (b.id === id ? { ...b, name } : b))
    persist(blocks)
    set({ blocks })
  },

  exportBlock: (id) => {
    const block = get().blocks.find((b) => b.id === id)
    if (!block) return
    const blob = new Blob([JSON.stringify(block, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${block.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.blokk.json`
    a.click()
    URL.revokeObjectURL(url)
  },

  importBlocks: async (file) => {
    const text = await file.text()
    const parsed = JSON.parse(text) as BlockTemplate | BlockTemplate[]
    const list = Array.isArray(parsed) ? parsed : [parsed]

    const valid = list
      .filter((b) => b && Array.isArray(b.nodes) && Array.isArray(b.edges))
      .map((b) => ({
        ...withDefaultSources({ ...b, version: b.version ?? BLOCK_VERSION, builtin: false }),
        id: `block-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`,
        createdAt: new Date().toISOString(),
      }))

    const blocks = [...get().blocks, ...valid]
    persist(blocks)
    set({ blocks })
    return valid.length
  },
}))

/** Alle blokker: innebygde først, så brukerens egne. */
export function allBlocks(userBlocks: BlockTemplate[]): BlockTemplate[] {
  return [...BUILTIN_BLOCKS, ...userBlocks]
}

export { BUILTIN_BLOCKS, createEmptyBlock }
