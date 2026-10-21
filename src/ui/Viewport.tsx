import { useEffect, useRef, useState } from 'react'
import { useGraphStore } from '../state/useGraphStore'
import { usePlaybackStore } from '../state/usePlaybackStore'
import { evaluator, renderServices } from '../state/studio'
import { registry } from '../nodes'

/**
 * Forhåndsvisningen.
 *
 * Kjører EVALUERINGSMOTOREN — ikke en egen renderer. Den tegner
 * nøyaktig det output-noden produserer, og bruker samme kode som eksporten.
 */
export function Viewport() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const graph = useGraphStore((s) => s.graph)
  const frame = usePlaybackStore((s) => s.frame)
  const [error, setError] = useState<string | null>(null)

  // Hold mutable tilstand utenfor React, slik at rAF-loopen ikke
  // trigger re-renders.
  const state = useRef({
    dirty: true,
    lastFrame: -1,
    token: 0,
    lastTime: 0,
  })

  // Ny graf → må evalueres på nytt.
  useEffect(() => {
    state.current.dirty = true
  }, [graph])

  // Renderstørrelsen følger grafens innstillinger, nedskalert i forhåndsvisning.
  // Eksporten setter størrelsen til full oppløsning (se exportGraph).
  const scale = Math.min(1, Math.max(0.25, graph.settings.previewScale ?? 1))
  useEffect(() => {
    renderServices.setSize(
      Math.max(16, Math.round(graph.settings.width * scale)),
      Math.max(16, Math.round(graph.settings.height * scale)),
    )
    state.current.dirty = true
  }, [graph.settings.width, graph.settings.height, scale])

  useEffect(() => {
    let raf = 0
    let alive = true

    const loop = async (now: number) => {
      if (!alive) return
      raf = requestAnimationFrame(loop)

      const delta = state.current.lastTime === 0 ? 0 : now - state.current.lastTime
      state.current.lastTime = now

      const playback = usePlaybackStore.getState()
      const current = useGraphStore.getState().graph

      playback.tick(
        current.settings.fps,
        current.settings.frames,
        delta,
        current.settings.loop,
      )

      const frame = usePlaybackStore.getState().frame
      const changed = frame !== state.current.lastFrame
      if (!changed && !state.current.dirty) return

      state.current.lastFrame = frame
      state.current.dirty = false

      const target = current.nodes.find((n) => n.type === 'output.viewport')
      if (!target) return

      const canvas = canvasRef.current
      if (!canvas) return
      // Lerretet er alltid full grafoppløsning; kilden tegnes nedskalert
      // og skaleres opp, slik at previewen blir raskere i store grafer.
      if (canvas.width !== current.settings.width) canvas.width = current.settings.width
      if (canvas.height !== current.settings.height) canvas.height = current.settings.height

      const token = ++state.current.token
      try {
        const outputs = await evaluator.evaluateFrame(current, frame, [target.id])
        if (!alive || token !== state.current.token) return

        const source = outputs.get(target.id)?.frame as CanvasImageSource | undefined
        const ctx = canvas.getContext('2d')!
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.globalAlpha = 1
        ctx.globalCompositeOperation = 'source-over'
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        if (source) ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
        setError(null)
      } catch (err) {
        if (alive) {
          const message = (err as Error)?.message ?? 'Ukjent feil under evaluering.'
          setError(message)
          console.error('[viewport]', err)
          state.current.dirty = true
        }
      }
    }

    raf = requestAnimationFrame(loop)
    return () => {
      alive = false
      cancelAnimationFrame(raf)
    }
  }, [])

  const aspect = graph.settings.width / graph.settings.height

  return (
    <div className="flex h-full w-full items-center justify-center bg-black/40 p-3">
      <div
        className="relative overflow-hidden rounded-xl border border-white/10 bg-black shadow-2xl"
        style={{ aspectRatio: `${aspect}`, maxHeight: '100%', width: aspect >= 1 ? '100%' : 'auto', maxWidth: '100%' }}
      >
        <canvas ref={canvasRef} className="block h-full w-full" />
      </div>

      {error && (
        <div className="absolute inset-x-4 top-16 rounded-lg border border-red-500/40 bg-red-950/80 p-3 text-[12px] leading-relaxed text-red-200 backdrop-blur">
          <strong className="mb-1 block text-[11px] uppercase tracking-widest text-red-300">
            Graffen kan ikke evalueres
          </strong>
          {error}
          <p className="mt-1.5 text-[11px] text-red-300/70">
            Nodekort med en rødd prikk mangler en påkrevd inngang.
          </p>
        </div>
      )}

      <div className="pointer-events-none absolute left-4 top-4 flex gap-2 text-[10px]">
        <span className="rounded bg-black/60 px-2 py-1 tabular-nums text-lime-300">
          frame {frame}
        </span>
        <span className="rounded bg-black/60 px-2 py-1 tabular-nums text-zinc-400">
          {graph.settings.width}×{graph.settings.height} @ {graph.settings.fps}fps
        </span>
        <span className="rounded bg-black/60 px-2 py-1 tabular-nums text-zinc-500">
          {registry.all().length} nodetyper
        </span>
      </div>
    </div>
  )
}
