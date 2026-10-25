import { useRef, useState } from 'react'
import { useGraphStore } from '../../state/useGraphStore'
import { evaluator, renderServices } from '../../state/studio'
import { exportGraph } from '../../export/exportGraph'
import { HelpLink } from '../primitives/HelpLink'
import {
  ASPECT_PRESETS,
  OUTPUT_FORMATS,
  aspectPresetFor,
  clampOutputSize,
  dimensionsForAspect,
  resolveOutputFormat,
  type OutputFormat,
} from '../../export/outputFormat'

/**
 * Tallfelt for bredde/høyde. Brukeren kan skrive fritt; verdien klemmes og
 * lagres først ved Enter eller når feltet forlates. Escape angrer.
 */
function SizeInput({
  value,
  draft,
  onDraft,
  onCommit,
}: {
  value: number
  draft: string
  onDraft: (text: string) => void
  onCommit: (text: string) => void
}) {
  const cancelled = useRef(false)
  return (
    <input
      type="text"
      inputMode="numeric"
      value={draft === '' ? String(value) : draft}
      onFocus={(e) => {
        cancelled.current = false
        e.currentTarget.select()
      }}
      onChange={(e) => onDraft(e.target.value.replace(/[^0-9]/g, ''))}
      onBlur={(e) => {
        if (cancelled.current) {
          cancelled.current = false
          onDraft('')
          return
        }
        onCommit(e.currentTarget.value)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          cancelled.current = true
          e.currentTarget.blur()
        }
      }}
      className="w-20 rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-right tabular-nums text-zinc-100"
    />
  )
}

interface Status {
  kind: 'idle' | 'running' | 'done' | 'error'
  message: string
  progress: number
  url?: string
  extension?: string
}

export function ExportPanel() {
  const graph = useGraphStore((s) => s.graph)
  const setSettings = useGraphStore((s) => s.setSettings)
  const setParam = useGraphStore((s) => s.setParam)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [status, setStatus] = useState<Status>({ kind: 'idle', message: 'Klar', progress: 0 })
  /** Skriveutkast for bredde/høyde: klemmes først når brukeren er ferdig. */
  const [sizeDraft, setSizeDraft] = useState<{ width: string; height: string }>({
    width: '',
    height: '',
  })
  /** null = bruk første lydnode, 'none' = ingen lyd, ellers valgt node. */
  const [audioChoice, setAudioChoice] = useState<string | null>(null)

  const exportNode = graph.nodes.find((n) => n.type === 'output.export')
  const target = exportNode ?? graph.nodes.find((n) => n.type === 'output.viewport')
  const format = resolveOutputFormat(exportNode?.params.format, graph.settings.exportFormat)
  const aspect = aspectPresetFor(graph.settings.width, graph.settings.height)
  const aspectPreset = ASPECT_PRESETS.find((preset) => preset.id === aspect)
  const duration = graph.settings.frames / graph.settings.fps
  const audioNodes = graph.nodes.filter((node) => node.type === 'source.audio')
  const audioNode =
    audioChoice === 'none'
      ? undefined
      : graph.nodes.find((node) => node.id === audioChoice) ?? audioNodes[0]
  const audioValue = audioNode?.id ?? 'none'

  const setFormat = (next: OutputFormat) => {
    setSettings({ exportFormat: next })
    if (exportNode) setParam(exportNode.id, 'format', next)
  }

  const applyAspect = (id: string) => {
    const preset = ASPECT_PRESETS.find((item) => item.id === id)
    if (!preset) return
    setSettings(dimensionsForAspect(preset.ratio, graph.settings.width, graph.settings.height))
  }

  const run = async () => {
    if (!target) {
      setStatus({ kind: 'error', message: 'Ingen output-node i grafen.', progress: 0 })
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setStatus({ kind: 'running', message: 'Eksporterer…', progress: 0 })

    try {
      // Evaluer motoren mot eksport-node-ID-en (eller viewport hvis ingen finnes).
      const outputNode = exportNode ?? target
      const result = await exportGraph({
        graph,
        evaluator,
        outputNodeId: outputNode.id,
        canvas,
        prefer: format,
        audio: audioNode
          ? {
              assetId:
                audioNode.params.sourceMode === 'url'
                  ? ''
                  : String(audioNode.params.assetId ?? ''),
              src:
                audioNode.params.sourceMode === 'url'
                  ? String(audioNode.params.src ?? '')
                  : '',
              loop: audioNode.params.loopAudio !== false,
            }
          : undefined,
        signal: controller.signal,
        render: renderServices,
        onProgress: (p, frame, total) =>
          setStatus({
            kind: 'running',
            message: `Frame ${frame} / ${total}`,
            progress: p,
          }),
      })

      const url = URL.createObjectURL(result.blob)
      const audioNote = audioNode
        ? result.audioIncluded
          ? ' · med lyd'
          : ' · uten lyd'
        : ''
      setStatus({
        kind: 'done',
        message: `Ferdig · ${result.duration.toFixed(2)} s · ${result.extension.toUpperCase()}${audioNote}`,
        progress: 1,
        url,
        extension: result.extension,
      })
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') {
        setStatus({ kind: 'idle', message: 'Eksport avbrutt.', progress: 0 })
        return
      }
      setStatus({ kind: 'error', message: (error as Error)?.message ?? 'Ukjent feil', progress: 0 })
    }
  }

  const cancel = () => {
    abortRef.current?.abort()
  }

  return (
    <div className="flex h-full min-w-0 flex-col gap-3 overflow-y-auto p-3">
      <section className="flex min-w-0 flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Format</h3>
          <HelpLink topic="eksport" />
        </div>

        <label className="flex min-w-0 items-center gap-2">
          <span className="w-20 shrink-0 text-[11px] text-zinc-400">Filformat</span>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as OutputFormat)}
            className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[12px] text-zinc-100"
          >
            {OUTPUT_FORMATS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-0 items-center gap-2">
          <span className="w-20 shrink-0 text-[11px] text-zinc-400">Bildeformat</span>
          <select
            value={aspect}
            onChange={(e) => applyAspect(e.target.value)}
            className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[12px] text-zinc-100"
          >
            {ASPECT_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
            {aspect === 'custom' && <option value="custom">Egendefinert</option>}
          </select>
        </label>

        <label className="flex min-w-0 items-center gap-2">
          <span className="w-20 shrink-0 text-[11px] text-zinc-400">Bredde</span>
          <SizeInput
            value={graph.settings.width}
            draft={sizeDraft.width}
            onDraft={(text) => setSizeDraft((d) => ({ ...d, width: text }))}
            onCommit={(text) => {
              setSettings({ width: clampOutputSize(Number(text), graph.settings.width) })
              setSizeDraft((d) => ({ ...d, width: '' }))
            }}
          />
        </label>

        <label className="flex min-w-0 items-center gap-2">
          <span className="w-20 shrink-0 text-[11px] text-zinc-400">Høyde</span>
          <SizeInput
            value={graph.settings.height}
            draft={sizeDraft.height}
            onDraft={(text) => setSizeDraft((d) => ({ ...d, height: text }))}
            onCommit={(text) => {
              setSettings({ height: clampOutputSize(Number(text), graph.settings.height) })
              setSizeDraft((d) => ({ ...d, height: '' }))
            }}
          />
        </label>

        <p className="text-[10px] leading-relaxed text-zinc-500">
          {graph.settings.width} × {graph.settings.height} px ·{' '}
          {aspectPreset?.label ?? 'Egendefinert'} · {graph.settings.fps} fps ·{' '}
          {graph.settings.frames} frames · {duration.toFixed(2)} s
        </p>
      </section>

      {audioNodes.length > 0 && (
        <section className="flex min-w-0 flex-col gap-2">
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
            Lyd
          </h3>
          <label className="flex min-w-0 items-center gap-2">
            <span className="w-20 shrink-0 text-[11px] text-zinc-400">Lydspor</span>
            <select
              value={audioValue}
              onChange={(event) => setAudioChoice(event.target.value)}
              className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[12px] text-zinc-100"
            >
              <option value="none">Ingen lyd</option>
              {audioNodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.title}
                </option>
              ))}
            </select>
          </label>
          <p className="text-[10px] leading-relaxed text-zinc-500">
            Velges et lydspor, muxes det inn i videoen. Lyden tilpasses videoens lengde og
            kan loopes.
          </p>
        </section>
      )}

      <section className="flex min-w-0 flex-col gap-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
          Forhåndsvisning
        </h3>
        <label className="flex min-w-0 items-center gap-2">
          <span className="w-20 shrink-0 text-[11px] text-zinc-400">Kvalitet</span>
          <select
            value={String(graph.settings.previewScale ?? 1)}
            onChange={(e) => setSettings({ previewScale: Number(e.target.value) })}
            className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[12px] text-zinc-100"
          >
            <option value="1">Full oppløsning (100 %)</option>
            <option value="0.5">Halv oppløsning (50 %)</option>
            <option value="0.25">Kvart oppløsning (25 %)</option>
          </select>
        </label>
        <p className="text-[10px] leading-relaxed text-zinc-600">
          Forhåndsvisningen kan tegnes i lavere oppløsning i store grafer.
          Eksporten bruker alltid full oppløsning.
        </p>
      </section>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={run}
          disabled={status.kind === 'running'}
          className="flex-1 rounded-lg bg-lime-400 px-3 py-2 text-[12px] font-semibold text-black transition hover:bg-lime-500 disabled:opacity-50"
        >
          ↓ Eksporter video
        </button>
        {status.kind === 'running' && (
          <button
            type="button"
            onClick={cancel}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-[12px] text-zinc-300 hover:bg-zinc-800"
          >
            Avbryt
          </button>
        )}
      </div>

      {status.kind === 'running' && (
        <div className="h-1 overflow-hidden rounded bg-zinc-800">
          <div
            className="h-full bg-lime-400 transition-[width]"
            style={{ width: `${Math.round(status.progress * 100)}%` }}
          />
        </div>
      )}

      <p
        className={`text-[11px] ${
          status.kind === 'error'
            ? 'text-red-300'
            : status.kind === 'done'
              ? 'text-lime-300'
              : 'text-zinc-500'
        }`}
        role="status"
      >
        {status.message}
      </p>

      {status.url && (
        <a
          href={status.url}
          download={`smudge-flow.${status.extension ?? 'mp4'}`}
          className="rounded-lg border border-lime-500/50 bg-lime-500/10 px-3 py-2 text-center text-[12px] text-lime-200 hover:bg-lime-500/20"
        >
          ↓ Last ned video
        </a>
      )}

      <canvas ref={canvasRef} className="hidden" />

      <p className="text-[10px] leading-relaxed text-zinc-600">
        Eksporten kjører SAMME evalueringsmotor som forhåndsvisningen, én frame om gangen,
        med eksplisitte tidsstempler. Derfor blir lengden eksakt {duration.toFixed(2)} s.
      </p>
    </div>
  )
}
