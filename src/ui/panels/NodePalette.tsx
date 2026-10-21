import { registry } from '../../nodes'
import { useGraphStore } from '../../state/useGraphStore'

const CATEGORY_LABEL: Record<string, string> = {
  source: 'Kilder',
  modifier: 'Modifikatorer',
  composite: 'Kompositt',
  output: 'Output',
}

export function NodePalette() {
  const addNode = useGraphStore((s) => s.addNode)

  const categories = ['source', 'modifier', 'composite', 'output'] as const

  return (
    <div className="flex flex-col gap-4 p-3">
      <p className="text-[11px] leading-relaxed text-zinc-500">
        Dra en node inn i grafen, eller klikk for å legge den til.
      </p>

      {categories.map((category) => {
        const defs = registry.byCategory(category)
        if (!defs.length) return null
        return (
          <section key={category}>
            <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              {CATEGORY_LABEL[category]}
            </h3>
            <div className="flex flex-col gap-1">
              {defs.map((def) => (
                <button
                  key={def.type}
                  type="button"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('application/smudge-node', def.type)}
                  onClick={() => addNode(def.type, { x: 120 + Math.random() * 160, y: 120 + Math.random() * 160 })}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/70 px-2.5 py-1.5 text-left text-[12px] text-zinc-200 transition hover:border-lime-500/60 hover:bg-zinc-800"
                  title={def.description}
                >
                  {def.label}
                  <span className="ml-2 text-[10px] text-zinc-600">{def.type}</span>
                  {def.description && (
                    <span className="mt-0.5 block text-[10px] leading-snug text-zinc-600">
                      {def.description}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
