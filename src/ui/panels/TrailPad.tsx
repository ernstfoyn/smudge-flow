import { useCallback, useEffect, useRef, useState } from 'react'
import { useGraphStore } from '../../state/useGraphStore'
import { lastOutputs } from '../../state/studio'

/**
 * Malepute for trail-laget.
 *
 * Puten viser lagets nåværende resultat. Dra over den for å stemple —
 * akkurat som i den gamle appen, men stemplene lagres som DATA i noden,
 * ikke i et lerret. Derfor er laget deterministisk og eksporterbart.
 */
export function TrailPad({ nodeId }: { nodeId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const last = useRef<{ u: number; v: number } | null>(null)
  const [version, setVersion] = useState(0)

  const addStamp = useGraphStore((s) => s.addStamp)
  const clearStamps = useGraphStore((s) => s.clearStamps)
  const params = useGraphStore(
    (s) => s.graph.nodes.find((n) => n.id === nodeId)?.params,
  )

  const stamps = Array.isArray(params?.stamps) ? params.stamps : []
  const brush = Number(params?.brush ?? 0.28)
  const spacing = Number(params?.spacing ?? 0.2)

  // Tegn det siste evaluerte resultatet inn i puten.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const source = lastOutputs.get(nodeId)?.out as HTMLCanvasElement | undefined

    canvas.width = source?.width ?? 512
    canvas.height = source?.height ?? 512

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (source) {
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
    } else {
      ctx.fillStyle = '#0b0b12'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#52525b'
      ctx.font = '12px system-ui'
      ctx.textAlign = 'center'
      ctx.fillText('Koble et bilde inn for å male', canvas.width / 2, canvas.height / 2)
    }
  }, [nodeId, version, stamps.length])

  /** Peke-posisjon → UV i lerretet. */
  const toUv = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const aspect = canvas.width / canvas.height

    // Lerrtet vises med «contain» i en firkantet boks.
    let cw = rect.width
    let ch = rect.height
    if (aspect > 1) ch = rect.width / aspect
    else cw = rect.height * aspect
    const ox = (rect.width - cw) / 2
    const oy = (rect.height - ch) / 2

    const u = (event.clientX - rect.left - ox) / cw
    const v = 1 - (event.clientY - rect.top - oy) / ch
    if (u < -0.2 || u > 1.2 || v < -0.2 || v > 1.2) return null
    return { u: Math.min(1, Math.max(0, u)), v: Math.min(1, Math.max(0, v)) }
  }, [])

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const uv = toUv(event)
      if (!uv) return
      event.currentTarget.setPointerCapture(event.pointerId)
      drawing.current = true
      last.current = uv
      addStamp(nodeId, uv.u, uv.v, true)
      setVersion((v) => v + 1)
    },
    [addStamp, nodeId, toUv],
  )

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawing.current) return
      const uv = toUv(event)
      if (!uv) return

      const from = last.current
      last.current = uv
      if (!from) return

      // Stempler langs streken, med avstand = pensel × avstand.
      const dx = uv.u - from.u
      const dy = uv.v - from.v
      const distance = Math.hypot(dx, dy)
      const steps = Math.max(1, Math.round(distance / Math.max(0.01, brush * spacing)))

      for (let i = 1; i <= steps; i++) {
        const t = i / steps
        addStamp(nodeId, from.u + dx * t, from.v + dy * t, false)
      }
      setVersion((v) => v + 1)
    },
    [addStamp, brush, nodeId, spacing, toUv],
  )

  const onPointerUp = useCallback(() => {
    drawing.current = false
    last.current = null
  }, [])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-zinc-500">
          Malepute · {stamps.length} stempler
        </span>
        <button
          type="button"
          onClick={() => {
            clearStamps(nodeId)
            setVersion((v) => v + 1)
          }}
          className="rounded border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-400 hover:bg-zinc-800"
        >
          Tørk
        </button>
      </div>

      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="aspect-square w-full cursor-crosshair touch-none rounded-lg border border-zinc-800 bg-zinc-950"
      />

      <p className="text-[10px] leading-relaxed text-zinc-600">
        Dra over puten for å stemple bildet. Stemplene lagres i noden, så laget
        kan kopieres, animeres og eksporteres som andre data.
      </p>
    </div>
  )
}
