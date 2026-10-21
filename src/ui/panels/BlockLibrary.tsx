import { useRef } from 'react'
import { useLibraryStore, allBlocks } from '../../state/useLibraryStore'
import { useGraphStore } from '../../state/useGraphStore'
import { BUILTIN_BLOCKS } from '../../blocks/builtins'

/**
 * Blokk-biblioteket.
 *
 * Her ligger ferdige oppsett (innebygde) og blokker du selv har lagret.
 * En blokk settes inn i grafen som en gruppe-node med eksponerte porter,
 * og kan kobles til nytt innhold.
 */
export function BlockLibrary() {
  const userBlocks = useLibraryStore((s) => s.blocks)
  const removeBlock = useLibraryStore((s) => s.removeBlock)
  const exportBlock = useLibraryStore((s) => s.exportBlock)
  const importBlocks = useLibraryStore((s) => s.importBlocks)
  const insertBlock = useGraphStore((s) => s.insertBlock)

  const fileRef = useRef<HTMLInputElement>(null)

  const insert = (id: string) => {
    const block = allBlocks(userBlocks).find((b) => b.id === id)
    if (!block) return
    // Plasser litt til høyre for det som allerede finnes.
    const graph = useGraphStore.getState().graph
    const maxX = graph.nodes.reduce((max, n) => Math.max(max, n.position.x), 0)
    insertBlock(block, { x: maxX + 380, y: 120 })
  }

  const onImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const count = await importBlocks(file)
      useGraphStore.getState().notice =
        count > 0 ? `Importerte ${count} blokk(er).` : 'Fant ingen gyldige blokker i filen.'
    } catch {
      useGraphStore.getState().notice = 'Kunne ikke lese filen.'
    }
    event.target.value = ''
  }

  const renderBlock = (
    block: (typeof BUILTIN_BLOCKS)[number],
    actions: React.ReactNode,
  ) => (
    <li
      key={block.id}
      className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-2 transition hover:border-zinc-700"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="truncate text-[12px] font-medium text-zinc-200">{block.name}</h4>
          {block.description && (
            <p className="mt-0.5 text-[10px] leading-snug text-zinc-500">{block.description}</p>
          )}
          <p className="mt-1 text-[9px] text-zinc-600">
            {block.nodes.length} noder
            {block.inputs.length > 0 && ` · ${block.inputs.length} inngang(er)`}
            {block.outputs.length > 0 && ` · ${block.outputs.length} utgang(er)`}
          </p>
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">{actions}</div>
    </li>
  )

  return (
    <div className="flex flex-col gap-4 p-3">
      <section>
        <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
          Innebygde oppsett
        </h3>
        <ul className="flex flex-col gap-1.5">
          {BUILTIN_BLOCKS.map((block) =>
            renderBlock(
              block,
              <button
                key={block.id}
                type="button"
                onClick={() => insert(block.id)}
                className="rounded border border-lime-500/50 bg-lime-500/10 px-2 py-1 text-[10px] text-lime-200 hover:bg-lime-500/20"
              >
                Last inn
              </button>,
            ),
          )}
        </ul>
      </section>

      <section>
        <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
          Mine blokker
        </h3>

        {userBlocks.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-800 p-2 text-[11px] leading-relaxed text-zinc-600">
            Ingen lagrede blokker ennå. Marker noder i grafen og trykk «⬚ Lag
            blokk» for å lagre nodetreet her — du kan bruke det på nytt innhold
            senere.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {userBlocks.map((block) =>
              renderBlock(
                block,
                <>
                  <button
                    key={`load-${block.id}`}
                    type="button"
                    onClick={() => insert(block.id)}
                    className="rounded border border-lime-500/50 bg-lime-500/10 px-2 py-1 text-[10px] text-lime-200 hover:bg-lime-500/20"
                  >
                    Last inn
                  </button>
                  <button
                    key={`exp-${block.id}`}
                    type="button"
                    onClick={() => exportBlock(block.id)}
                    className="rounded border border-zinc-700 px-2 py-1 text-[10px] text-zinc-400 hover:bg-zinc-800"
                  >
                    Eksporter
                  </button>
                  <button
                    key={`del-${block.id}`}
                    type="button"
                    onClick={() => removeBlock(block.id)}
                    className="rounded border border-red-900/60 px-2 py-1 text-[10px] text-red-400 hover:bg-red-950/40"
                  >
                    Slett
                  </button>
                </>,
              ),
            )}
          </ul>
        )}

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="mt-2 w-full rounded border border-zinc-700 px-2 py-1.5 text-[11px] text-zinc-300 hover:bg-zinc-800"
        >
          ⬆ Importer blokk fra fil
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" onChange={onImport} className="hidden" />
      </section>
    </div>
  )
}
