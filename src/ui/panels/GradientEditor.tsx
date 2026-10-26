import { useState } from 'react'
import { color, type GradientStop } from '../../engine/color/gradient'

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `stop-${crypto.randomUUID()}`
  }
  return `stop-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function withIds(stops: GradientStop[]): GradientStop[] {
  return stops.map((stop, index) => ({ ...stop, id: stop.id ?? `stop-${index}` }))
}

function sorted(stops: GradientStop[]): GradientStop[] {
  return [...stops].sort((a, b) => a.position - b.position)
}

/**
 * Redigerbar flerfarge-gradient.
 *
 * Posisjonen er 0–1 langs gradienten. Mykhet styrer hvor bred overgangen
 * mellom to fargestopp er, som i Orbit/GradientRamp.
 */
export function GradientEditor({
  value,
  fallback,
  onChange,
}: {
  value: unknown
  fallback: GradientStop[]
  onChange: (stops: GradientStop[]) => void
}) {
  const raw = Array.isArray(value) ? (value as GradientStop[]) : []
  const stops = withIds(raw.length ? raw : fallback)
  const [selected, setSelected] = useState(0)
  const active = Math.min(selected, stops.length - 1)
  const current = stops[active]
  const preview = sorted(stops)

  const update = (next: GradientStop[]) => onChange(withIds(next))

  const addStopAt = (position: number) => {
    if (stops.length >= 8) return
    const clamped = Math.min(1, Math.max(0, position))
    const existing = stops.findIndex((stop) => Math.abs(stop.position - clamped) < 0.012)
    if (existing >= 0) {
      setSelected(existing)
      return
    }
    const next = [
      ...stops,
      {
        id: newId(),
        position: clamped,
        color: color(sorted(stops), clamped),
        softness: 1,
      },
    ]
    update(next)
    setSelected(next.length - 1)
  }

  const addStop = () => {
    const ordered = sorted(stops)
    let position = 0.5
    let largest = 0
    for (let i = 1; i < ordered.length; i++) {
      const gap = ordered[i].position - ordered[i - 1].position
      if (gap > largest) {
        largest = gap
        position = (ordered[i].position + ordered[i - 1].position) / 2
      }
    }
    addStopAt(position)
  }

  const clickGradient = (event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width <= 0) return
    addStopAt((event.clientX - rect.left) / rect.width)
  }

  const removeStop = (index: number) => {
    if (stops.length <= 2) return
    update(stops.filter((_, i) => i !== index))
    setSelected(Math.max(0, Math.min(active, stops.length - 2)))
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <button
        type="button"
        onClick={clickGradient}
        disabled={stops.length >= 8}
        className="relative h-7 w-full cursor-crosshair overflow-hidden rounded border border-zinc-700 disabled:cursor-not-allowed disabled:opacity-70"
        style={{
          background: `linear-gradient(90deg, ${preview
            .map((stop) => `${stop.color} ${(stop.position * 100).toFixed(2)}%`)
            .join(', ')})`,
        }}
        aria-label="Klikk for å legge til et fargestopp"
        title="Klikk for å legge til et fargestopp"
      >
        {preview.map((stop) => (
          <span
            key={stop.id ?? `${stop.position}-${stop.color}`}
            aria-hidden
            className="pointer-events-none absolute top-0 h-full w-px bg-white/80 shadow-[0_0_0_1px_rgba(0,0,0,0.45)]"
            style={{ left: `${stop.position * 100}%` }}
          />
        ))}
      </button>

      <div className="flex flex-col gap-1">
        {stops.map((stop, index) => (
          <div
            key={stop.id ?? index}
            onClick={() => setSelected(index)}
            className={`flex min-w-0 items-center gap-1.5 rounded border px-1.5 py-1 ${
              index === active
                ? 'border-sky-500/50 bg-sky-500/10'
                : 'border-zinc-800 bg-zinc-950/50'
            }`}
          >
            <input
              type="color"
              value={stop.color}
              onChange={(event) =>
                update(stops.map((s, i) => (i === index ? { ...s, color: event.target.value } : s)))
              }
              className="h-5 w-7 shrink-0 cursor-pointer rounded border border-zinc-700 bg-transparent p-0"
              title="Farge"
            />
            <input
              type="range"
              min={0}
              max={1}
              step={0.001}
              value={stop.position}
              onChange={(event) =>
                update(
                  stops.map((s, i) =>
                    i === index ? { ...s, position: Number(event.target.value) } : s,
                  ),
                )
              }
              className="h-1 min-w-0 flex-1 accent-sky-400"
              title="Posisjon"
            />
            <span className="w-8 shrink-0 text-right text-[9px] tabular-nums text-zinc-500">
              {Math.round(stop.position * 100)}%
            </span>
            <button
              type="button"
              title="Fjern fargestopp"
              disabled={stops.length <= 2}
              onClick={(event) => {
                event.stopPropagation()
                removeStop(index)
              }}
              className="shrink-0 px-1 text-[10px] text-red-400 hover:text-red-300 disabled:opacity-25"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={addStop}
          disabled={stops.length >= 8}
          className="rounded border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
        >
          + Farge
        </button>
        <span className="text-[9px] text-zinc-600">{stops.length} / 8 stopp</span>
      </div>

      {current && (
        <label className="flex min-w-0 items-center gap-2 text-[10px] text-zinc-500">
          Mykhet
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={current.softness ?? 1}
            onChange={(event) =>
              update(
                stops.map((s, i) =>
                  i === active ? { ...s, softness: Number(event.target.value) } : s,
                ),
              )
            }
            className="h-1 min-w-0 flex-1 accent-sky-400"
          />
          <span className="w-8 shrink-0 text-right tabular-nums text-zinc-400">
            {Math.round((current.softness ?? 1) * 100)}%
          </span>
        </label>
      )}
      <p className="text-[10px] leading-relaxed text-zinc-600">
        Klikk direkte på gradientstripen for å legge til et fargestopp. Dra i
        posisjonen for å flytte et stopp. Mykhet gjør overgangen mellom nabofargene
        bredere eller hardere.
      </p>
    </div>
  )
}
