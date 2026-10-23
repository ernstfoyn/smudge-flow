import { useEffect, useRef, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useLibraryStore } from '../../state/useLibraryStore'
import { useGraphStore } from '../../state/useGraphStore'
import { BUILTIN_BLOCKS } from '../../blocks/builtins'
import type { BlockTemplate } from '../../blocks/types'
import { CollapsibleSection } from '../primitives/CollapsibleSection'

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
  const replaceWithBlock = useGraphStore((s) => s.replaceWithBlock)
  const { fitView } = useReactFlow()

  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<BlockTemplate | null>(null)

  // Lukk dialogen med Escape.
  useEffect(() => {
    if (!pending) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPending(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [pending])

  /** Panorerer til noden som nettopp ble satt inn, så den ikke blir borte utenfor lerretet. */
  const reveal = (id: string | null) => {
    if (!id) return
    // React Flow må registrere og måle noden før fitView vet hvor den er.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        void fitView({ nodes: [{ id }], padding: 0.6, duration: 450, maxZoom: 1.1 })
      })
    })
  }

  const insert = (block: BlockTemplate) => {
    const graph = useGraphStore.getState().graph
    const maxX = graph.nodes.reduce((max, n) => Math.max(max, n.position.x), 0)
    reveal(insertBlock(block, { x: maxX + 380, y: 120 }))
  }

  const replace = (block: BlockTemplate) => {
    replaceWithBlock(block)
    // Ved erstatning er hele treet nytt: vis både gruppen og viewporten.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        void fitView({ padding: 0.2, duration: 450, maxZoom: 1.2 })
      })
    })
  }

  const confirm = (mode: 'add' | 'replace') => {
    if (!pending) return
    if (mode === 'add') insert(pending)
    else replace(pending)
    setPending(null)
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
      <CollapsibleSection
        id="blocks.builtin"
        title="Innebygde oppsett"
        badge={BUILTIN_BLOCKS.length}
      >
        <ul className="flex flex-col gap-1.5">
          {BUILTIN_BLOCKS.map((block) =>
            renderBlock(
              block,
              <button
                key={block.id}
                type="button"
                onClick={() => setPending(block)}
                className="rounded border border-lime-500/50 bg-lime-500/10 px-2 py-1 text-[10px] text-lime-200 hover:bg-lime-500/20"
              >
                Last inn
              </button>,
            ),
          )}
        </ul>
      </CollapsibleSection>

      <CollapsibleSection
        id="blocks.mine"
        title="Mine blokker"
        badge={userBlocks.length}
      >
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
                    onClick={() => setPending(block)}
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
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={onImport}
          className="hidden"
        />
      </CollapsibleSection>

      {pending && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onMouseDown={() => setPending(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="block-dialog-title"
            className="w-full max-w-sm rounded-xl border border-zinc-700 bg-zinc-900 p-4 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h3 id="block-dialog-title" className="text-[13px] font-semibold text-zinc-100">
              Last inn «{pending.name}»
            </h3>
            <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-400">
              {pending.nodes.length} noder
              {pending.inputs.length > 0 && ` · ${pending.inputs.length} inngang(er)`}
              {pending.outputs.length > 0 && ` · ${pending.outputs.length} utgang(er)`}.
              Vil du legge blokken til i grafen du har, eller erstatte hele nodetreet?
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-zinc-600">
              Ved erstatning beholdes fps, lengde og oppløsning.
            </p>

            <div className="mt-4 flex flex-col gap-1.5">
              <button
                type="button"
                autoFocus
                onClick={() => confirm('add')}
                className="rounded-lg border border-lime-500/60 bg-lime-500/15 px-3 py-2 text-[12px] font-medium text-lime-100 transition hover:bg-lime-500/25"
              >
                Legg til i grafen
              </button>
              <button
                type="button"
                onClick={() => confirm('replace')}
                className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-[12px] font-medium text-red-200 transition hover:bg-red-500/20"
              >
                Erstatt hele grafen
              </button>
              <button
                type="button"
                onClick={() => setPending(null)}
                className="rounded-lg border border-zinc-700 px-3 py-2 text-[12px] text-zinc-400 transition hover:bg-zinc-800"
              >
                Avbryt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
