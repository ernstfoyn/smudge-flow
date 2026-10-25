import { useEffect, useRef, useState } from 'react'
import { useGraphStore } from '../state/useGraphStore'
import { usePlaybackStore } from '../state/usePlaybackStore'
import { evaluator, lastOutputs, renderServices } from '../state/studio'
import { registry } from '../nodes'
import { HelpLink } from './primitives/HelpLink'
import { resolvePreviewTarget } from '../engine/preview'

/**
 * Forhåndsvisningen.
 *
 * Kjører EVALUERINGSMOTOREN — ikke en egen renderer. Den tegner
 * nøyaktig det output-noden produserer, og bruker samme kode som eksporten.
 */
export function Viewport() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const graph = useGraphStore((s) => s.graph)
  const preview = useGraphStore((s) => s.preview)
  const clearPreview = useGraphStore((s) => s.clearPreview)
  const frame = usePlaybackStore((s) => s.frame)
  const [error, setError] = useState<string | null>(null)

  // Hold mutable tilstand utenfor React, slik at rAF-loopen ikke
  // trigger re-renders.
  const state = useRef({
    dirty: true,
    lastFrame: -1,
    busy: false,
    lastTime: 0,
  })

  // Ny graf eller nytt forhåndsvisningsmål → må evalueres på nytt.
  useEffect(() => {
    state.current.dirty = true
  }, [graph, preview])

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

      const target = resolvePreviewTarget(current, useGraphStore.getState().preview)
      if (!target) return

      const canvas = canvasRef.current
      if (!canvas) return
      // Én evaluering om gangen. Startes en ny mens den forrige kjører, ville
      // hver ferdige ramme blitt forkastet — og 3D-grafer ville aldri tegnes.
      if (state.current.busy) {
        state.current.dirty = true
        return
      }

      state.current.lastFrame = frame
      state.current.dirty = false
      state.current.busy = true

      // Lerretet er alltid full grafoppløsning; kilden tegnes nedskalert
      // og skaleres opp, slik at previewen blir raskere i store grafer.
      if (canvas.width !== current.settings.width) canvas.width = current.settings.width
      if (canvas.height !== current.settings.height) canvas.height = current.settings.height

      try {
        const outputs = await evaluator.evaluateFrame(current, frame, [target.nodeId])
        if (!alive) return

        // Behold resultatet, så UI-en kan vise det (maleputen).
        for (const [id, output] of outputs) lastOutputs.set(id, output)

        const source = outputs.get(target.nodeId)?.[target.portId] as CanvasImageSource | undefined
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
      } finally {
        state.current.busy = false
      }
    }

    raf = requestAnimationFrame(loop)
    return () => {
      alive = false
      cancelAnimationFrame(raf)
    }
  }, [])

  const aspect = graph.settings.width / graph.settings.height
  const previewNode = preview ? graph.nodes.find((n) => n.id === preview.nodeId) : undefined

  return (
    <div className="flex h-full min-w-0 w-full items-center justify-center bg-[var(--stage-bg)] p-3">
      <div
        className="relative overflow-hidden rounded-xl border border-white/10 bg-black shadow-2xl"
        style={{ aspectRatio: `${aspect}`, maxHeight: '100%', width: aspect >= 1 ? '100%' : 'auto', maxWidth: '100%' }}
      >
        <canvas ref={canvasRef} className="block h-full w-full" />
      </div>

      {error && (
        <div className="absolute inset-x-4 top-4 max-h-[calc(100%-2rem)] overflow-y-auto rounded-lg border border-red-500/40 bg-red-950/80 p-3 text-[12px] leading-relaxed text-red-200 backdrop-blur">
          <strong className="mb-1 block text-[11px] uppercase tracking-widest text-red-300">
            Graffen kan ikke evalueres
          </strong>
          {error}
          <p className="mt-1.5 flex items-center gap-2 text-[11px] text-red-300/70">
            Nodekort med en rød prikk mangler en påkrevd inngang.
            <HelpLink topic="feilsoking" />
          </p>
        </div>
      )}

      {previewNode && (
        <div className="absolute bottom-4 left-4 z-10 flex max-w-[calc(100%-2rem)] items-center gap-2 rounded-lg border border-lime-500/40 bg-[var(--stage-badge)] px-2.5 py-1.5 text-[10px] text-zinc-300 shadow-lg backdrop-blur">
          <span className="text-zinc-500">Forhåndsviser</span>
          <span className="max-w-[12rem] truncate font-semibold text-lime-300">
            {previewNode.title}
          </span>
          <button
            type="button"
            onClick={clearPreview}
            className="rounded border border-zinc-600 px-1.5 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-800"
          >
            Tilbake
          </button>
        </div>
      )}

      <div className="pointer-events-none absolute left-4 top-4 flex max-w-[calc(100%-2rem)] flex-wrap gap-2 text-[10px]">
        <span className="rounded bg-[var(--stage-badge)] px-2 py-1 tabular-nums text-lime-300">
          frame {frame}
        </span>
        <span className="rounded bg-[var(--stage-badge)] px-2 py-1 tabular-nums text-zinc-400">
          {graph.settings.width}×{graph.settings.height} @ {graph.settings.fps}fps
        </span>
        <span className="hidden rounded bg-[var(--stage-badge)] px-2 py-1 tabular-nums text-zinc-500 sm:inline">
          {registry.all().length} nodetyper
        </span>
      </div>
    </div>
  )
}
