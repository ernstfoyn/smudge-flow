import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { Search } from 'lucide-react'
import type { NodeDefinition } from '../engine/types'
import { registry } from '../nodes'
import { CATEGORY_COLOR, CATEGORY_LABEL } from './categoryStyle'
import { searchNodes } from './nodeSearch'

interface HostRect {
  left: number
  top: number
  width: number
  height: number
}

interface Props {
  /** Posisjonen til musepekeren i skjermkoordinater. */
  anchor: { x: number; y: number }
  /** Lerretets posisjon og størrelse i skjermkoordinater. */
  host: HostRect
  onPick: (def: NodeDefinition) => void
  onClose: () => void
}

const MENU_WIDTH = 420
const MENU_MAX_HEIGHT = 440
const EDGE_GAP = 8

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

/**
 * Houdini-inspirert hurtigmeny: Tab åpner et søk på lerretet, piltastene
 * velger og Enter legger noden der markøren sto.
 */
export function NodeTabMenu({ anchor, host, onPick, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const results = useMemo(() => searchNodes(registry.listed(), query), [query])
  const current = results[active]

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Klikk utenfor menyen (også utenfor lerretet) lukker den.
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (panelRef.current?.contains(event.target as Node)) return
      onClose()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [onClose])

  // Tab og Escape lukker menyen uansett hvor fokuset måtte ha havnet.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key !== 'Tab' && event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      onClose()
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [onClose])

  // Hold det aktive treffet synlig når man navigerer med piltastene.
  useEffect(() => {
    const row = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)
    row?.scrollIntoView({ block: 'nearest' })
  }, [active, results])

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!results.length) return
      setActive((index) => (index + 1) % results.length)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!results.length) return
      setActive((index) => (index - 1 + results.length) % results.length)
      return
    }

    if (event.key === 'Home') {
      event.preventDefault()
      setActive(0)
      return
    }

    if (event.key === 'End') {
      event.preventDefault()
      setActive(Math.max(0, results.length - 1))
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      if (current) onPick(current)
    }
  }

  const menuWidth = Math.min(MENU_WIDTH, Math.max(0, host.width - EDGE_GAP * 2))
  const left = clamp(anchor.x - host.left, EDGE_GAP, host.width - menuWidth - EDGE_GAP)

  const anchorTop = anchor.y - host.top
  const spaceBelow = Math.max(0, host.height - anchorTop - EDGE_GAP * 2)
  const spaceAbove = Math.max(0, anchorTop - EDGE_GAP * 2)
  const openUp = spaceBelow < 300 && spaceAbove > spaceBelow
  const maxHeight = Math.min(MENU_MAX_HEIGHT, openUp ? spaceAbove : spaceBelow)
  const position = openUp
    ? { bottom: host.height - anchorTop + EDGE_GAP }
    : { top: anchorTop + EDGE_GAP }

  return (
    <>
      <div
        aria-hidden
        className="absolute inset-0 z-30 bg-transparent"
        onPointerDown={onClose}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Legg til node"
        onKeyDown={handleKeyDown}
        className="absolute z-40 flex flex-col overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900/98 shadow-2xl shadow-black/60 backdrop-blur"
        style={{ ...position, left, width: menuWidth, maxHeight }}
      >
        <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2">
          <Search size={14} aria-hidden className="shrink-0 text-lime-400" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-haspopup="listbox"
            aria-controls="node-tab-list"
            aria-autocomplete="list"
            aria-activedescendant={current ? `node-tab-option-${active}` : undefined}
            aria-label="Søk etter node"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setActive(0)
            }}
            placeholder="Søk etter node …"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-zinc-100 outline-none placeholder:text-zinc-600"
          />
          <kbd className="shrink-0 rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-[9px] font-medium text-zinc-500">
            Tab
          </kbd>
        </div>

        <div
          ref={listRef}
          id="node-tab-list"
          role="listbox"
          aria-label="Noder"
          className="min-h-0 flex-1 overflow-y-auto p-1"
        >
          {results.length ? (
            results.map((def, index) => {
              const isActive = index === active
              return (
                <button
                  key={def.type}
                  id={`node-tab-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  data-index={index}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => onPick(def)}
                  className={`flex w-full flex-col gap-0.5 rounded-lg border px-2 py-1.5 text-left transition ${
                    isActive
                      ? 'border-lime-500/40 bg-lime-500/10'
                      : 'border-transparent hover:bg-zinc-800/70'
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: CATEGORY_COLOR[def.category] ?? '#71717a' }}
                    />
                    <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-zinc-100">
                      {def.label}
                    </span>
                    <span className="shrink-0 text-[9px] text-zinc-500">{def.type}</span>
                  </span>
                  <span className="flex min-w-0 items-center gap-1.5 pl-3.5">
                    {def.description && (
                      <span className="min-w-0 flex-1 truncate text-[10px] leading-snug text-zinc-500">
                        {def.description}
                      </span>
                    )}
                    <span
                      className="shrink-0 rounded border px-1 py-px text-[9px] font-medium"
                      style={{
                        color: CATEGORY_COLOR[def.category] ?? '#a1a1aa',
                        borderColor: `${CATEGORY_COLOR[def.category] ?? '#71717a'}55`,
                        backgroundColor: `${CATEGORY_COLOR[def.category] ?? '#71717a'}14`,
                      }}
                    >
                      {CATEGORY_LABEL[def.category]}
                    </span>
                  </span>
                </button>
              )
            })
          ) : (
            <p className="px-3 py-8 text-center text-[11px] leading-relaxed text-zinc-500">
              Ingen noder passer «{query.trim()}».
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-zinc-800 px-3 py-1.5 text-[10px] text-zinc-500">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-zinc-700 px-1">↑</kbd>
            <kbd className="rounded border border-zinc-700 px-1">↓</kbd>
            velg
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-zinc-700 px-1">Enter</kbd>
            legg til
          </span>
          <span className="ml-auto flex items-center gap-1">
            <kbd className="rounded border border-zinc-700 px-1">Esc</kbd>
            lukk
          </span>
        </div>
      </div>
    </>
  )
}
