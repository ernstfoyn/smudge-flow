import { nodeParamDefs } from '../../engine/graph'
import { useGraphStore } from '../../state/useGraphStore'
import { usePlaybackStore } from '../../state/usePlaybackStore'

interface Track {
  nodeId: string
  nodeTitle: string
  path: string
  label: string
  frames: number[]
}

/** Samler alle spor (node + parameter) som har keyframes. */
export function Timeline() {
  const graph = useGraphStore((s) => s.graph)
  const setKeyframe = useGraphStore((s) => s.setKeyframe)
  const removeKeyframe = useGraphStore((s) => s.removeKeyframe)
  const seek = usePlaybackStore((s) => s.seek)
  const toggle = usePlaybackStore((s) => s.toggle)
  const isPlaying = usePlaybackStore((s) => s.isPlaying)
  const frame = usePlaybackStore((s) => s.frame)
  const setSettings = useGraphStore((s) => s.setSettings)

  const { fps, frames, loop } = graph.settings

  const tracks: Track[] = []
  for (const node of graph.nodes) {
    const params = nodeParamDefs(node)
    for (const [path, keys] of Object.entries(node.tracks ?? {})) {
      if (!keys?.length) continue
      const param = params.find((p) => p.key === path)
      tracks.push({
        nodeId: node.id,
        nodeTitle: node.title,
        path,
        label: param?.label ?? path,
        frames: keys.map((k) => k.frame),
      })
    }
  }

  return (
    <div className="flex h-full min-w-0 flex-col gap-2 p-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-[11px]">
        <button
          type="button"
          onClick={toggle}
          className="rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-zinc-200 hover:bg-zinc-800"
        >
          {isPlaying ? 'Ⅱ Pause' : '▶ Spill'}
        </button>

        <label className="flex items-center gap-1 text-zinc-500">
          Frame
          <input
            type="number"
            min={0}
            max={frames - 1}
            value={frame}
            onChange={(e) => seek(Number(e.target.value))}
            className="w-16 rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-right tabular-nums text-zinc-100"
          />
        </label>

        <label className="flex items-center gap-1 text-zinc-500">
          FPS
          <input
            type="number"
            min={1}
            max={120}
            value={fps}
            onChange={(e) => setSettings({ fps: Math.max(1, Number(e.target.value)) })}
            className="w-16 rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-right tabular-nums text-zinc-100"
          />
        </label>

        <label className="flex items-center gap-1 text-zinc-500">
          Frames
          <input
            type="number"
            min={1}
            max={3600}
            value={frames}
            onChange={(e) => setSettings({ frames: Math.max(1, Number(e.target.value)) })}
            className="w-20 rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-right tabular-nums text-zinc-100"
          />
        </label>

        <label className="flex items-center gap-1 text-zinc-500">
          <input
            type="checkbox"
            checked={loop}
            onChange={(e) => setSettings({ loop: e.target.checked })}
            className="h-3.5 w-3.5 accent-lime-400"
          />
          Loop
        </label>

        <span className="ml-auto whitespace-nowrap tabular-nums text-zinc-500">
          {(frame / fps).toFixed(2)} / {(frames / fps).toFixed(2)} s
        </span>
      </div>

      <input
        type="range"
        min={0}
        max={Math.max(0, frames - 1)}
        value={frame}
        onChange={(e) => seek(Number(e.target.value))}
        className="h-1 w-full min-w-0 cursor-pointer accent-lime-400"
      />

      <div className="flex-1 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/60">
        {tracks.length === 0 && (
          <p className="p-3 text-[11px] text-zinc-600">
            Ingen keyframes ennå. Velg en node og trykk ◆ på en parameter.
          </p>
        )}

        {tracks.map((track) => (
          <div key={`${track.nodeId}:${track.path}`} className="border-b border-zinc-800/70 px-3 py-1.5 last:border-0">
            <div className="flex min-w-0 items-baseline justify-between gap-2">
              <span className="min-w-0 truncate text-[11px] text-zinc-300">
                {track.nodeTitle} <span className="text-zinc-500">· {track.label}</span>
              </span>
              <span className="shrink-0 whitespace-nowrap text-[10px] tabular-nums text-zinc-600">
                {track.frames.length} nøkkel
              </span>
            </div>

            <div className="relative mt-1 h-4 overflow-hidden rounded bg-zinc-900">
              {track.frames.map((f) => (
                <button
                  key={f}
                  type="button"
                  title={`Frame ${f} — klikk for å hoppe, dobbeltklikk for å slette`}
                  onClick={() => seek(f)}
                  onDoubleClick={() => removeKeyframe(track.nodeId, track.path, f)}
                  className="absolute top-0.5 h-3 w-1.5 -translate-x-1/2 rounded-sm bg-amber-400 hover:bg-amber-300"
                  style={{ left: `${(f / Math.max(1, frames - 1)) * 100}%` }}
                />
              ))}
              <div
                className="pointer-events-none absolute top-0 h-4 w-px bg-lime-400"
                style={{ left: `${(frame / Math.max(1, frames - 1)) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => {
          // Sett en keyframe på alle animerbare parametere i den valgte noden.
          const selected = useGraphStore.getState().selected
          if (!selected) return
          const node = useGraphStore.getState().graph.nodes.find((n) => n.id === selected)
          if (!node) return
          const params = nodeParamDefs(node)
          for (const p of params) {
            if (!p.animatable) continue
            setKeyframe(node.id, p.key, frame, node.params[p.key] ?? p.default)
          }
        }}
        className="max-w-full self-start whitespace-normal rounded border border-zinc-700 px-2 py-1 text-left text-[11px] text-zinc-300 hover:bg-zinc-800"
      >
        ◆ Keyframe alle parametere i valgt node
      </button>
    </div>
  )
}
