import { useEffect, useState } from 'react'
import { FlowCanvas } from './ui/FlowCanvas'
import { Viewport } from './ui/Viewport'
import { NodePalette } from './ui/panels/NodePalette'
import { BlockLibrary } from './ui/panels/BlockLibrary'
import { Inspector } from './ui/panels/Inspector'
import { Timeline } from './ui/panels/Timeline'
import { ExportPanel } from './ui/panels/ExportPanel'
import { ResizeHandle } from './ui/primitives/ResizeHandle'
import { useElementSize, usePanelLayout } from './ui/usePanelLayout'
import { useGraphStore } from './state/useGraphStore'
import { useThemeStore } from './state/useThemeStore'
import { usePlaybackStore } from './state/usePlaybackStore'
import { serializeGraph, deserializeGraph } from './engine/graph'

type LeftTab = 'palette' | 'inspector' | 'blocks'
type BottomTab = 'timeline' | 'export'

export default function App() {
  const [leftTab, setLeftTab] = useState<LeftTab>('palette')
  const [bottomTab, setBottomTab] = useState<BottomTab>('timeline')
  const graph = useGraphStore((s) => s.graph)
  const setGraph = useGraphStore((s) => s.setGraph)
  const reset = useGraphStore((s) => s.reset)
  const notice = useGraphStore((s) => s.notice)
  const clearNotice = useGraphStore((s) => s.clearNotice)
  const toggle = usePlaybackStore((s) => s.toggle)
  const isPlaying = usePlaybackStore((s) => s.isPlaying)
  const undo = useGraphStore((s) => s.undo)
  const redo = useGraphStore((s) => s.redo)
  const canUndo = useGraphStore((s) => s.canUndo)
  const canRedo = useGraphStore((s) => s.canRedo)
  const undoLabel = useGraphStore((s) => s.undoLabel)
  const redoLabel = useGraphStore((s) => s.redoLabel)

  const [workspaceRef, workspace] = useElementSize<HTMLDivElement>()
  const { layout, limits, setPanel, resetPanel } = usePanelLayout(workspace)

  // Cmd/Ctrl+Z angrer, Cmd/Ctrl+Shift+Z gjør om.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey
      if (!meta) return
      const key = event.key.toLowerCase()
      if (key !== 'z' && key !== 'y') return

      const target = event.target as HTMLElement | null
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) {
        return
      }

      event.preventDefault()
      if (key === 'y' || event.shiftKey) redo()
      else undo()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [undo, redo])

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
            onClick={undo}
            disabled={!canUndo}
            title={undoLabel ? `Angre: ${undoLabel} (Cmd+Z)` : 'Ingenting å angre'}
            className="rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800 disabled:opacity-30"
          >
            ↶
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            title={redoLabel ? `Gjør om: ${redoLabel} (Cmd+Shift+Z)` : 'Ingenting å gjøre om'}
            className="rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800 disabled:opacity-30"
          >
            ↷
          </button>
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
          <ThemeToggle />
        </div>
      </header>

      {notice && (
        <div className="flex items-center gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-[12px] text-amber-200">
          <span className="flex-1">{notice}</span>
          <button
            type="button"
            onClick={clearNotice}
            className="rounded border border-amber-500/40 px-2 py-0.5 text-[11px] hover:bg-amber-500/20"
          >
            Lukk
          </button>
        </div>
      )}

      <div ref={workspaceRef} className="flex min-h-0 flex-1 overflow-hidden">
        {/* Venstre: palett + inspector */}
        <aside
          className="flex min-w-0 shrink-0 flex-col bg-zinc-950"
          style={{ width: layout.left }}
        >
          <nav className="flex border-b border-zinc-800">
            {(
              [
                ['palette', 'Noder'],
                ['inspector', 'Egenskaper'],
                ['blocks', 'Blokker'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setLeftTab(id)}
                className={`min-w-0 flex-1 truncate px-2 py-2 text-[11px] font-medium transition ${
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
            {leftTab === 'palette' && <NodePalette />}
            {leftTab === 'inspector' && <Inspector />}
            {leftTab === 'blocks' && <BlockLibrary />}
          </div>
        </aside>

        <ResizeHandle
          orientation="vertical"
          value={layout.left}
          min={limits.left.min}
          max={limits.left.max}
          label="Juster venstre panel"
          onChange={(value) => setPanel('left', value)}
          onReset={() => resetPanel('left')}
        />

        {/* Midten: graf + preview + timeline */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <FlowCanvas />
          </div>

          <ResizeHandle
            orientation="horizontal"
            value={layout.bottom}
            min={limits.bottom.min}
            max={limits.bottom.max}
            invert
            label="Juster bunnpanelet"
            onChange={(value) => setPanel('bottom', value)}
            onReset={() => resetPanel('bottom')}
          />

          <section
            className="flex min-h-0 shrink-0 flex-col overflow-hidden"
            style={{ height: layout.bottom }}
          >
            <nav className="flex shrink-0 items-center gap-1 border-b border-zinc-800 bg-zinc-900/40 px-3 py-1.5">
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

        <ResizeHandle
          orientation="vertical"
          value={layout.right}
          min={limits.right.min}
          max={limits.right.max}
          invert
          label="Juster forhåndsvisningen"
          onChange={(value) => setPanel('right', value)}
          onReset={() => resetPanel('right')}
        />

        {/* Høyre: preview */}
        <aside
          className="flex min-w-0 shrink-0 flex-col bg-zinc-950"
          style={{ width: layout.right }}
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-800 bg-zinc-900/40 px-3 py-2">
            <span className="truncate text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              Forhåndsvisning
            </span>
            <span className="shrink-0 text-[9px] tabular-nums text-zinc-600">
              {layout.right}px
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

function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme)
  const toggle = useThemeStore((s) => s.toggle)
  const next = theme === 'dark' ? 'lyst' : 'mørkt'
  return (
    <button
      type="button"
      onClick={toggle}
      title={`Bytt til ${next} tema`}
      aria-label={`Bytt til ${next} tema`}
      className="rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[12px] text-zinc-400 hover:bg-zinc-800"
    >
      {theme === 'dark' ? '☀' : '☾'}
    </button>
  )
}
