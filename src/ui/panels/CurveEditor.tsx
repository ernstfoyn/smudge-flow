import { useRef } from 'react'
import { useGraphStore } from '../../state/useGraphStore'
import { usePlaybackStore } from '../../state/usePlaybackStore'
import {
  curveValue,
  fract,
  normalizePoints,
  type CurvePoint,
  type CurveParams,
  type CurveShape,
} from '../../engine/animation/curves'
import type { GraphNode } from '../../engine/types'
import { HelpLink } from '../primitives/HelpLink'

const W = 240
const H = 110
const PAD = 8
const SAMPLES = 160

const px = (x: number) => PAD + x * (W - PAD * 2)
const py = (y: number) => PAD + ((1 - y) / 2) * (H - PAD * 2)
const fromX = (clientX: number, rect: DOMRect) =>
  Math.min(0.999, Math.max(0, (((clientX - rect.left) / rect.width) * W - PAD) / (W - PAD * 2)))
const fromY = (clientY: number, rect: DOMRect) => {
  const v = ((clientY - rect.top) / rect.height) * H
  return Math.min(1, Math.max(-1, 1 - ((v - PAD) / (H - PAD * 2)) * 2))
}

const MIN_GAP = 0.01

/**
 * Viser én syklus av signalet, med en markør som følger avspillingen.
 * Er formen «Tegnet kurve», kan punktene dras, nye legges til ved å klikke
 * i feltet, og et punkt fjernes med dobbeltklikk.
 */
export function CurveEditor({ node }: { node: GraphNode }) {
  const setParam = useGraphStore((s) => s.setParam)
  const frames = useGraphStore((s) => s.graph.settings.frames)
  const frame = usePlaybackStore((s) => s.frame)
  const svgRef = useRef<SVGSVGElement>(null)
  const dragging = useRef<number | null>(null)

  const shape = String(node.params.shape ?? 'sine') as CurveShape
  const editable = shape === 'draw'
  const params = node.params as unknown as Partial<CurveParams>
  const points = normalizePoints(node.params.points)

  const path = Array.from({ length: SAMPLES + 1 }, (_, i) => {
    const x = i / SAMPLES
    return `${i === 0 ? 'M' : 'L'}${px(x).toFixed(1)},${py(curveValue(shape, x, params)).toFixed(1)}`
  }).join(' ')

  const speed = Math.max(1, Number(node.params.speed ?? 1))
  const cyclePos = fract((frame / Math.max(1, frames)) * speed + Number(node.params.phase ?? 0))
  const nowValue = curveValue(shape, cyclePos, params)

  const commit = (next: CurvePoint[]) => setParam(node.id, 'points', next)

  const onPlotDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!editable) return
    const rect = event.currentTarget.getBoundingClientRect()
    const point = { x: fromX(event.clientX, rect), y: fromY(event.clientY, rect) }
    const next = [...points, point].sort((a, b) => a.x - b.x)
    dragging.current = next.indexOf(point)
    event.currentTarget.setPointerCapture(event.pointerId)
    commit(next)
  }

  const onPointDown = (event: React.PointerEvent<SVGCircleElement>, index: number) => {
    if (!editable) return
    event.stopPropagation()
    dragging.current = index
    svgRef.current?.setPointerCapture(event.pointerId)
  }

  const onMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const index = dragging.current
    if (index === null || !editable) return
    const rect = event.currentTarget.getBoundingClientRect()
    const prev = points[index - 1]
    const next = points[index + 1]
    const x = Math.min(
      next ? next.x - MIN_GAP : 0.999,
      Math.max(prev ? prev.x + MIN_GAP : 0, fromX(event.clientX, rect)),
    )
    const y = fromY(event.clientY, rect)
    commit(points.map((p, i) => (i === index ? { x, y } : p)))
  }

  const onUp = (event: React.PointerEvent<SVGSVGElement>) => {
    dragging.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const removePoint = (index: number) => {
    if (points.length <= 2) return
    commit(points.filter((_, i) => i !== index))
  }

  /** Gjør dagens form om til punkter som kan justeres. */
  const drawFromShape = () => {
    const count = 8
    const sampled = Array.from({ length: count }, (_, i) => ({
      x: i / count,
      y: Math.round(curveValue(shape, i / count, params) * 100) / 100,
    }))
    setParam(node.id, 'points', sampled)
    setParam(node.id, 'shape', 'draw')
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className={`w-full touch-none rounded border border-zinc-800 bg-zinc-950 ${
          editable ? 'cursor-crosshair' : ''
        }`}
        onPointerDown={onPlotDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        role="img"
        aria-label="Kurveform for én syklus"
      >
        <line x1={PAD} x2={W - PAD} y1={py(0)} y2={py(0)} stroke="#27272a" strokeDasharray="3 3" />
        <line x1={PAD} x2={W - PAD} y1={py(1)} y2={py(1)} stroke="#1f1f23" />
        <line x1={PAD} x2={W - PAD} y1={py(-1)} y2={py(-1)} stroke="#1f1f23" />
        <path d={path} fill="none" stroke="#60a5fa" strokeWidth={1.8} pointerEvents="none" />

        <line
          x1={px(cyclePos)}
          x2={px(cyclePos)}
          y1={PAD}
          y2={H - PAD}
          stroke="#a3e635"
          strokeOpacity={0.5}
          pointerEvents="none"
        />
        <circle cx={px(cyclePos)} cy={py(nowValue)} r={3} fill="#a3e635" pointerEvents="none" />

        {editable &&
          points.map((p, index) => (
            <circle
              key={index}
              cx={px(p.x)}
              cy={py(p.y)}
              r={5}
              fill="#09090b"
              stroke="#93c5fd"
              strokeWidth={2}
              className="cursor-grab active:cursor-grabbing"
              onPointerDown={(event) => onPointDown(event, index)}
              onDoubleClick={() => removePoint(index)}
            />
          ))}
      </svg>

      <div className="flex items-center justify-between gap-2 text-[10px] text-zinc-500">
        <span>Én syklus · −1 til 1</span>
        {editable ? (
          <span className="flex items-center gap-2">
            Klikk: nytt punkt · dobbeltklikk: fjern
            <HelpLink topic="signaler-og-styring" />
          </span>
        ) : (
          <button
            type="button"
            onClick={drawFromShape}
            className="rounded border border-zinc-700 px-1.5 py-0.5 text-zinc-300 hover:bg-zinc-800"
          >
            Tegn selv
          </button>
        )}
      </div>
    </div>
  )
}
