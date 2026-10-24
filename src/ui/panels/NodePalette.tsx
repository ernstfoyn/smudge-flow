import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { registry } from '../../nodes'
import type { NodeDefinition } from '../../engine/types'
import { useGraphStore } from '../../state/useGraphStore'
import { CollapsibleSection } from '../primitives/CollapsibleSection'
import { CATEGORY_COLOR, CATEGORY_LABEL, CATEGORY_ORDER } from '../categoryStyle'
import { searchNodes } from '../nodeSearch'

export function NodePalette() {
  const addNode = useGraphStore((s) => s.addNode)
  const [query, setQuery] = useState('')

  const add = (type: string) =>
    addNode(type, { x: 120 + Math.random() * 160, y: 120 + Math.random() * 160 })

  const renderNode = (def: NodeDefinition) => (
    <button
      key={def.type}
      type="button"
      draggable
      onDragStart={(e) => e.dataTransfer.setData('application/smudge-node', def.type)}
      onClick={() => add(def.type)}
      className="group rounded-lg border border-zinc-800 bg-zinc-900/70 px-2.5 py-1.5 text-left transition hover:border-lime-500/60 hover:bg-zinc-800"
      title={def.description}
    >
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: CATEGORY_COLOR[def.category] ?? '#71717a' }}
        />
        <span className="min-w-0 flex-1 truncate text-[12px] text-zinc-200">{def.label}</span>
        <span className="shrink-0 text-[9px] text-zinc-600">{def.type}</span>
      </span>
      {def.description && (
        <span className="mt-0.5 block truncate text-[10px] leading-snug text-zinc-600">
          {def.description}
        </span>
      )}
    </button>
  )

  const q = query.trim()
  const searchResults = q ? searchNodes(registry.listed(), q) : []

  return (
    <div className="flex flex-col gap-3 p-3">
      <p className="text-[11px] leading-relaxed text-zinc-500">
        Dra en node inn i grafen, eller klikk for å legge den til.
      </p>

      <div className="sticky top-0 z-10 -mx-3 -mt-3 bg-zinc-950/95 px-3 pb-2 pt-3 backdrop-blur">
        <div className="relative">
          <Search
            size={12}
            aria-hidden
            className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setQuery('')
            }}
            placeholder="Søk etter node …"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 py-1.5 pl-7 pr-7 text-[11px] text-zinc-200 outline-none transition placeholder:text-zinc-600 focus:border-lime-500/60"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              title="Tøm søket"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
            >
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {q ? (
        <section className="flex flex-col gap-1">
          <div className="flex items-center justify-between px-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              Treff
            </span>
            <span className="text-[9px] tabular-nums text-zinc-600">
              {searchResults.length} node{searchResults.length === 1 ? '' : 'r'}
            </span>
          </div>
          {searchResults.length > 0 ? (
            searchResults.map(renderNode)
          ) : (
            <p className="rounded-lg border border-dashed border-zinc-800 p-3 text-[11px] leading-relaxed text-zinc-600">
              Ingen noder passer «{query.trim()}». Prøv et annet navn, eller tøm søket.
            </p>
          )}
        </section>
      ) : (
        CATEGORY_ORDER.map((category) => {
          const defs = registry.byCategory(category)
          if (!defs.length) return null
          return (
            <CollapsibleSection
              key={category}
              id={`palette.${category}`}
              title={CATEGORY_LABEL[category]}
              badge={defs.length}
              accent={CATEGORY_COLOR[category]}
            >
              <div className="flex flex-col gap-1">{defs.map(renderNode)}</div>
            </CollapsibleSection>
          )
        })
      )}
    </div>
  )
}
