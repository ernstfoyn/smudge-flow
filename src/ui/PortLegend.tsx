import { ChevronRight } from 'lucide-react'
import { usePersistentOpen } from './primitives/CollapsibleSection'
import { PARAM_META, PORT_LEGEND } from './portStyle'

/**
 * Kompakt fargeforklaring oppå graf-lerretet.
 *
 * Den er sammenleggbar og husker valget, slik at den ikke stjeler plass når
 * brukeren har lært systemet.
 */
export function PortLegend() {
  const [open, setOpen] = usePersistentOpen('flow.portlegend', true)

  return (
    <div className="pointer-events-auto absolute right-3 top-3 z-10 w-[min(214px,calc(100%-1.5rem))] rounded-xl border border-zinc-700/80 bg-zinc-900/90 p-2 shadow-xl backdrop-blur">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="group flex w-full items-center gap-1.5 rounded text-left"
      >
        <ChevronRight
          size={12}
          aria-hidden
          className={`shrink-0 text-zinc-600 transition-transform group-hover:text-zinc-400 ${
            open ? 'rotate-90' : ''
          }`}
        />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
          Portfarger
        </span>
        <span className="ml-auto text-[9px] text-zinc-600">{open ? 'skjul' : 'vis'}</span>
      </button>

      {open && (
        <div className="mt-1.5 flex flex-col gap-1.5">
          <p className="text-[10px] leading-snug text-zinc-500">
            Like farger kan kobles. Dra fra en prikk til en annen.
          </p>
          <div className="flex flex-wrap gap-x-2.5 gap-y-1">
            {PORT_LEGEND.map((item) => (
              <span key={item.type} className="flex items-center gap-1 text-[10px] text-zinc-300">
                <span
                  aria-hidden
                  className="h-2 w-2 rounded-full"
                  style={{ background: item.color }}
                />
                {item.label}
              </span>
            ))}
          </div>
          <p className="flex items-center gap-1.5 text-[9px] leading-snug text-zinc-500">
            <span
              aria-hidden
              className="inline-block h-2 w-2 shrink-0 rotate-45 rounded-[1px]"
              style={{ background: PARAM_META.color }}
            />
            Diamant = parameter (styres av Tall)
          </p>
        </div>
      )}
    </div>
  )
}
