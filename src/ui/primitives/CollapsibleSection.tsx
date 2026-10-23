import { useEffect, useState, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'

const STORAGE_PREFIX = 'smudgeflow.ui.open.'

function readOpen(key: string, fallback: boolean): boolean {
  if (typeof localStorage === 'undefined') return fallback
  try {
    const stored = localStorage.getItem(STORAGE_PREFIX + key)
    return stored === null ? fallback : stored === '1'
  } catch {
    return fallback
  }
}

function writeOpen(key: string, open: boolean): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_PREFIX + key, open ? '1' : '0')
  } catch {
    // Privat modus / full lagring: valget gjelder bare denne økten.
  }
}

/** Åpen/lukket-tilstand som huskes mellom økter. */
export function usePersistentOpen(key: string, defaultOpen = true) {
  const [open, setOpen] = useState(() => readOpen(key, defaultOpen))

  useEffect(() => {
    writeOpen(key, open)
  }, [key, open])

  return [open, setOpen] as const
}

interface CollapsibleSectionProps {
  /** Stabil nøkkel for lagret åpen/lukket-tilstand. */
  id: string
  title: ReactNode
  badge?: ReactNode
  /** Valgfri fargeprikk foran tittelen. */
  accent?: string
  defaultOpen?: boolean
  actions?: ReactNode
  className?: string
  bodyClassName?: string
  children: ReactNode
}

/**
 * Sammenleggbar seksjon med chevron, valgfritt antall og handlinger.
 *
 * Brukes i alle sidepanelene, slik at lange lister kan lukkes i stedet for å
 * scrolle. Tilstanden lagres i localStorage per `id`.
 */
export function CollapsibleSection({
  id,
  title,
  badge,
  accent,
  defaultOpen = true,
  actions,
  className = '',
  bodyClassName = '',
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = usePersistentOpen(id, defaultOpen)

  return (
    <section className={`min-w-0 ${className}`}>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="group flex min-w-0 flex-1 items-center gap-1.5 rounded px-0.5 py-0.5 text-left"
        >
          <ChevronRight
            size={12}
            aria-hidden
            className={`shrink-0 text-zinc-600 transition-transform duration-150 group-hover:text-zinc-400 ${
              open ? 'rotate-90' : ''
            }`}
          />
          {accent && (
            <span
              aria-hidden
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: accent }}
            />
          )}
          <span className="truncate text-[10px] font-semibold uppercase tracking-widest text-zinc-500 transition group-hover:text-zinc-300">
            {title}
          </span>
          {badge != null && (
            <span className="ml-auto shrink-0 rounded bg-zinc-800/80 px-1 text-[9px] tabular-nums text-zinc-500">
              {badge}
            </span>
          )}
        </button>
        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </div>
      {open && <div className={`mt-1.5 ${bodyClassName}`}>{children}</div>}
    </section>
  )
}
