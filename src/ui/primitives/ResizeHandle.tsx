import {
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { clamp } from '../layoutMath'

interface ResizeHandleProps {
  /** Vertikal skiller sidepaneler, horisontal skiller bunnpanelet. */
  orientation: 'vertical' | 'horizontal'
  value: number
  min: number
  max: number
  /** Snu retningen: dra mot venstre/opp for å gjøre panelet større. */
  invert?: boolean
  label: string
  onChange: (value: number) => void
  onReset: () => void
}

/**
 * Tastatur- og pekerstyrt skillestripe mellom hovedpanelene.
 *
 * Panelet får en ny størrelse allerede mens brukeren drar. Dobbeltklikk (eller
 * Home/End på tastaturet) gir en rask vei tilbake til en brukbar størrelse.
 */
export function ResizeHandle({
  orientation,
  value,
  min,
  max,
  invert = false,
  label,
  onChange,
  onReset,
}: ResizeHandleProps) {
  const drag = useRef<{ position: number; value: number } | null>(null)

  const pointerPosition = (event: ReactPointerEvent<HTMLDivElement>) =>
    orientation === 'vertical' ? event.clientX : event.clientY

  const stopDragging = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    drag.current = null
    document.body.classList.remove('is-resizing')
    document.body.style.cursor = ''
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { position: pointerPosition(event), value }
    document.body.classList.add('is-resizing')
    document.body.style.cursor = orientation === 'vertical' ? 'col-resize' : 'row-resize'
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    const raw = pointerPosition(event) - drag.current.position
    const delta = invert ? -raw : raw
    onChange(clamp(drag.current.value + delta, min, max))
  }

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 48 : 16
    let next: number | null = null

    if (event.key === 'Home') next = min
    else if (event.key === 'End') next = max
    else if (orientation === 'vertical') {
      if (event.key === 'ArrowLeft') next = value - (invert ? -step : step)
      if (event.key === 'ArrowRight') next = value + (invert ? -step : step)
    } else {
      if (event.key === 'ArrowUp') next = value - (invert ? -step : step)
      if (event.key === 'ArrowDown') next = value + (invert ? -step : step)
    }

    if (next === null) return
    event.preventDefault()
    onChange(clamp(next, min, max))
  }

  const isVertical = orientation === 'vertical'

  return (
    <div
      role="separator"
      aria-orientation={isVertical ? 'vertical' : 'horizontal'}
      aria-label={label}
      aria-valuemin={Math.round(min)}
      aria-valuemax={Math.round(max)}
      aria-valuenow={Math.round(value)}
      aria-valuetext={`${Math.round(value)} piksler`}
      tabIndex={0}
      title={`${label} — dra, bruk piltastene, eller dobbeltklikk for standardstørrelse`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
      onDragStart={(event) => event.preventDefault()}
      className={`group relative z-20 shrink-0 touch-none bg-zinc-950 outline-none transition-colors hover:bg-lime-400/10 focus-visible:bg-lime-400/10 ${
        isVertical ? 'w-2 cursor-col-resize' : 'h-2 cursor-row-resize'
      }`}
    >
      <span
        aria-hidden
        className={`pointer-events-none absolute bg-zinc-800 transition-colors group-hover:bg-lime-400/60 group-focus-visible:bg-lime-400/70 ${
          isVertical
            ? 'inset-y-0 left-1/2 w-px -translate-x-1/2'
            : 'inset-x-0 top-1/2 h-px -translate-y-1/2'
        }`}
      />
    </div>
  )
}
