import { useState } from 'react'
import { FlowCanvas } from './ui/FlowCanvas'
import { Viewport } from './ui/Viewport'
import { NodePalette } from './ui/panels/NodePalette'
import { Inspector } from './ui/panels/Inspector'
import { Timeline } from './ui/panels/Timeline'
import { ExportPanel } from './ui/panels/ExportPanel'
import { useGraphStore } from './state/useGraphStore'
import { usePlaybackStore } from './state/usePlaybackStore'
import { serializeGraph, deserializeGraph } from './engine/graph'

type LeftTab = 'palette' | 'inspector'
type BottomTab = 'timeline' | 'export'

export default function App() {
  const [leftTab, setLeftTab] = useState<LeftTab>('palette')
  const [bottomTab, setBottomTab] = useState<BottomTab>('timeline')
  const graph = useGraphStore((s) => s.graph)
  const setGraph = useGraphStore((s) => s.setGraph)
  const reset = useGraphStore((s) => s.reset)
  const toggle = usePlaybackStore((s) => s.toggle)
  const isPlaying = usePlaybackStore((s) => s.isPlaying)

  const save = () => {
    const blob = new Blob([serializeGraph(graph)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'smudge-flow.prosjekt.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const load = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      try {
        setGraph(deserializeGraph(await file.text()))
      } catch {
        alert('Kunne ikke lese prosjektfilen.')
      }
    }
    input.click()
  }

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="flex items-center gap-3 border-b border-zinc-800 bg-zinc-900/60 px-4 py-2">
        <h1 className="text-[13px] font-semibold tracking-tight">
          Smudge<span className="text-lime-400">Flow</span>
        </h1>
        <span className="rounded border border-zinc-700 px-2 py-0.5 text-[10px] uppercase tracking-widest text-zinc-500">
          nodebasert · dataflow
        </span>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1 text-[11px] text-zinc-200 hover:bg-zinc-800"
          >
            {isPlaying ? 'Ⅱ Pause' : '▶ Spill'}
          </button>
          <button
            type="button"
            onClick={save}
            className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1 text-[11px] text-zinc-200 hover:bg-zinc-800"
          >
            Lagre
          </button>
          <button
            type="button"
            onClick={load}
            className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1 text-[11px] text-zinc-200 hover:bg-zinc-800"
          >
            Åpne
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1 text-[11px] text-zinc-400 hover:bg-zinc-800"
          >
            Nullstill
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Venstre: palett + inspector */}
        <aside className="flex w-64 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950">
          <nav className="flex border-b border-zinc-800">
            {(
              [
                ['palette', 'Noder'],
                ['inspector', 'Egenskaper'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setLeftTab(id)}
                className={`flex-1 px-3 py-2 text-[11px] font-medium transition ${
                  leftTab === id
                    ? 'border-b-2 border-lime-400 text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {leftTab === 'palette' ? <NodePalette /> : <Inspector />}
          </div>
        </aside>

        {/* Midten: graf + preview + timeline */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1 border-b border-zinc-800">
            <FlowCanvas />
          </div>

          <section className="flex h-[46%] min-h-[280px] flex-col">
            <nav className="flex items-center gap-1 border-b border-zinc-800 bg-zinc-900/40 px-3 py-1.5">
              {(
                [
                  ['timeline', 'Timeline'],
                  ['export', 'Eksport'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setBottomTab(id)}
                  className={`rounded px-2.5 py-1 text-[11px] font-medium transition ${
                    bottomTab === id
                      ? 'bg-zinc-800 text-zinc-100'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>

            <div className="min-h-0 flex-1 overflow-hidden">
              {bottomTab === 'timeline' ? <Timeline /> : <ExportPanel />}
            </div>
          </section>
        </main>

        {/* Høyre: preview */}
        <aside className="flex w-[38%] min-w-[320px] shrink-0 flex-col border-l border-zinc-800 bg-zinc-950">
          <div className="border-b border-zinc-800 bg-zinc-900/40 px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              Forhåndsvisning
            </span>
          </div>
          <div className="relative min-h-0 flex-1">
            <Viewport />
          </div>
        </aside>
      </div>
    </div>
  )
}
