import { useRef } from 'react'
import { registry } from '../../nodes'
import type { Graph, GraphNode } from '../../engine/types'
import { nodeParamDefs, nodePorts } from '../../engine/graph'
import { useGraphStore } from '../../state/useGraphStore'
import { usePlaybackStore } from '../../state/usePlaybackStore'
import { ParamField } from '../primitives/Fields'
import { TrailPad } from './TrailPad'
import { WAVEFORMS } from '../../engine/animation/lfo'
import { STACK_MODES, type StackMode } from '../../nodes/composite/stack'

/** Filvelger som leser filen inn som data-URL. */
function FileField({
  label,
  value,
  filename,
  onChange,
}: {
  label: string
  value: string
  filename: string
  onChange: (dataUrl: string, filename: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex items-center gap-2">
      <span className="w-28 shrink-0 text-[11px] uppercase tracking-wide text-zinc-400">{label}</span>
      <input
        ref={inputRef}
        type="file"
        accept=".obj,text/plain"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0]
          if (!file) return
          const reader = new FileReader()
          reader.onload = () => onChange(String(reader.result ?? ''), file.name)
          reader.readAsDataURL(file)
          event.target.value = ''
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800"
      >
        Velg fil
      </button>
      <span className="min-w-0 flex-1 truncate text-[10px] text-zinc-500">
        {filename || (value ? 'innlastet' : 'ingen fil')}
      </span>
    </div>
  )
}

/** Tittel på en node, ut fra grafen. */
function nodeTitle(graph: Graph, id: string): string {
  return graph.nodes.find((n) => n.id === id)?.title ?? id
}

/** Etikett på en parameter. */
function paramLabel(node: GraphNode, key?: string): string {
  if (!key) return ''
  return nodeParamDefs(node).find((p) => p.key === key)?.label ?? key
}

export function Inspector() {
  const graph = useGraphStore((s) => s.graph)
  const selected = useGraphStore((s) => s.selected)
  const setParam = useGraphStore((s) => s.setParam)
  const resetParams = useGraphStore((s) => s.resetParams)
  const removeNode = useGraphStore((s) => s.removeNode)
  const toggleNode = useGraphStore((s) => s.toggleNode)
  const setLfo = useGraphStore((s) => s.setLfo)
  const setKeyframe = useGraphStore((s) => s.setKeyframe)
  const reorderInput = useGraphStore((s) => s.reorderInput)
  const setLayerSetting = useGraphStore((s) => s.setLayerSetting)
  const disconnect = useGraphStore((s) => s.disconnect)
  const ungroup = useGraphStore((s) => s.ungroup)
  const instantiate = useGraphStore((s) => s.instantiate)
  const exposeInput = useGraphStore((s) => s.exposeInput)
  const exposeOutput = useGraphStore((s) => s.exposeOutput)
  const unexposeInput = useGraphStore((s) => s.unexposeInput)
  const unexposeOutput = useGraphStore((s) => s.unexposeOutput)
  const disconnectGroupEdge = useGraphStore((s) => s.disconnectGroupEdge)
  const frame = usePlaybackStore((s) => s.frame)

  const node = graph.nodes.find((n) => n.id === selected)

  if (!node) {
    return (
      <div className="p-4 text-[12px] text-zinc-500">
        Velg en node i grafen for å redigere parametere, keyframes og LFO.
      </div>
    )
  }

  const isGroup = node.type === 'group'
  const def = isGroup ? null : registry.get(node.type)
  const params = def?.params ?? []

  /** Lagene som er koblet til en multiple-port, i tegnerrekkefølge. */
  const layerPorts = nodePorts(node).inputs.filter((p) => p.multiple)

  /** Alle koblinger inn og ut av noden. */
  const incoming = graph.edges.filter((e) => e.target === node.id)
  const outgoing = graph.edges.filter((e) => e.source === node.id)

  if (isGroup) {
    return (
      <div className="flex flex-col gap-4 p-3">
        <header className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-[13px] font-semibold text-zinc-100">{node.title}</h2>
            <p className="text-[10px] text-zinc-500">
              Gruppe · {node.group?.nodes.length ?? 0} noder
            </p>
          </div>
          <button
            type="button"
            onClick={() => removeNode(node.id)}
            className="rounded border border-red-900/70 px-2 py-1 text-[11px] text-red-300 hover:bg-red-950/40"
          >
            Slett
          </button>
        </header>

        <p className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-2 text-[11px] leading-relaxed text-zinc-400">
          En gruppe er en gjenbrukbart behandlingsblokk. Koble andre kilder inn i
          inngangene, og kopier gruppen for å bruke samme behandling på nytt innhold.
        </p>

        <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2">
          <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
            Eksponerte innganger
          </h3>
          {node.group?.inputs.length ? (
            <ul className="flex flex-col gap-1">
              {node.group.inputs.map((input) => {
                const count = graph.edges.filter(
                  (e) => e.target === node.id && e.targetPort === input.id,
                ).length
                return (
                  <li
                    key={input.id}
                    className="flex items-center justify-between gap-1 rounded border border-zinc-800 bg-zinc-950/60 px-2 py-1 text-[11px]"
                  >
                    <span className="truncate text-zinc-300">{input.name}</span>
                    <span className={count ? 'text-[10px] text-lime-300' : 'text-[10px] text-zinc-600'}>
                      {count ? `${count} koblet` : 'ikke koblet'}
                    </span>
                    <button
                      type="button"
                      title="Fjern inngang"
                      onClick={() => unexposeInput(node.id, input.id)}
                      className="rounded px-1 text-[10px] text-red-400 hover:bg-red-950/40"
                    >
                      ✕
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-[11px] text-zinc-600">
              Ingen eksponerte innganger. Eksponer en port under, så kan du koble
              hvilket som helst innhold inn i gruppen.
            </p>
          )}
        </section>

        <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2">
          <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
            Eksponerte utganger
          </h3>
          {node.group?.outputs.length ? (
            <ul className="flex flex-col gap-1">
              {node.group.outputs.map((output) => (
                <li
                  key={output.id}
                  className="flex items-center justify-between gap-1 rounded border border-zinc-800 bg-zinc-950/60 px-2 py-1 text-[11px] text-zinc-300"
                >
                  <span className="truncate">{output.name}</span>
                  <button
                    type="button"
                    title="Fjern utgang"
                    onClick={() => unexposeOutput(node.id, output.id)}
                    className="rounded px-1 text-[10px] text-red-400 hover:bg-red-950/40"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-zinc-600">Ingen eksponerte utganger.</p>
          )}
        </section>

        {node.group && node.group.edges.length > 0 && (
          <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2">
            <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              Interne koblinger
            </h3>
            <ul className="flex flex-col gap-1">
              {node.group.edges.map((edge) => {
                const from = node.group?.nodes.find((n) => n.id === edge.source)?.title ?? edge.source
                const to = node.group?.nodes.find((n) => n.id === edge.target)?.title ?? edge.target
                return (
                  <li
                    key={edge.id}
                    className="flex items-center gap-1.5 rounded border border-zinc-800 bg-zinc-950/60 px-2 py-1 text-[11px]"
                  >
                    <span className="min-w-0 flex-1 truncate text-zinc-400">
                      {from} → {to}
                    </span>
                    <button
                      type="button"
                      title="Koble fra"
                      onClick={() => disconnectGroupEdge(node.id, edge.id)}
                      className="shrink-0 rounded px-1 text-[10px] text-red-400 hover:bg-red-950/40"
                    >
                      ✕
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2">
          <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
            Innhold · eksponer porter
          </h3>
          <ul className="flex flex-col gap-1.5">
            {node.group?.nodes.map((inner) => {
              const ports = nodePorts(inner)
              const exposedIn = new Set(
                node.group?.inputs.map((i) => `${i.targetNode}.${i.targetPort}`),
              )
              const exposedOut = new Set(
                node.group?.outputs.map((o) => `${o.sourceNode}.${o.sourcePort}`),
              )
              return (
                <li key={inner.id} className="rounded border border-zinc-800 bg-zinc-950/60 p-1.5">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-[11px] text-zinc-300">{inner.title}</span>
                    <span className="text-[9px] text-zinc-600">{inner.type}</span>
                  </div>
                  <div className="mt-1 flex flex-col gap-1">
                    {ports.inputs.map((port) => (
                      <div key={port.id} className="flex items-center justify-between gap-1">
                        <span className="truncate text-[10px] text-zinc-500">→ {port.label}</span>
                        {exposedIn.has(`${inner.id}.${port.id}`) ? (
                          <span className="text-[9px] text-lime-400">eksponert</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => exposeInput(node.id, inner.id, port.id)}
                            className="rounded border border-zinc-700 px-1.5 py-0.5 text-[9px] text-zinc-400 hover:border-lime-500/60 hover:text-lime-300"
                          >
                            eksponer
                          </button>
                        )}
                      </div>
                    ))}
                    {ports.outputs.map((port) => (
                      <div key={port.id} className="flex items-center justify-between gap-1">
                        <span className="truncate text-[10px] text-zinc-500">← {port.label}</span>
                        {exposedOut.has(`${inner.id}.${port.id}`) ? (
                          <span className="text-[9px] text-lime-400">eksponert</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => exposeOutput(node.id, inner.id, port.id)}
                            className="rounded border border-zinc-700 px-1.5 py-0.5 text-[9px] text-zinc-400 hover:border-lime-500/60 hover:text-lime-300"
                          >
                            eksponer
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => instantiate(node.id)}
            className="rounded-lg bg-lime-400 px-3 py-1.5 text-[11px] font-semibold text-zinc-950 hover:bg-lime-300"
          >
            ⧉ Lag kopi
          </button>
          <button
            type="button"
            onClick={() => ungroup(node.id)}
            className="rounded border border-zinc-700 px-3 py-1.5 text-[11px] text-zinc-300 hover:bg-zinc-800"
          >
            Eksploder gruppe
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-3">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-[13px] font-semibold text-zinc-100">{node.title}</h2>
          <p className="text-[10px] text-zinc-500">{node.type}</p>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => toggleNode(node.id)}
            className="rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800"
          >
            {node.enabled === false ? 'Aktiver' : 'Deaktiver'}
          </button>
          <button
            type="button"
            onClick={() => instantiate(node.id)}
            className="rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800"
            title="Lag kopi"
          >
            ⧉
          </button>
          <button
            type="button"
            onClick={() => removeNode(node.id)}
            className="rounded border border-red-900/70 px-2 py-1 text-[11px] text-red-300 hover:bg-red-950/40"
          >
            Slett
          </button>
        </div>
      </header>

      {def?.description && (
        <p className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-2 text-[11px] leading-relaxed text-zinc-400">
          {def.description}
        </p>
      )}

      {layerPorts.map((port) => {
        const edges = graph.edges.filter((e) => e.target === node.id && e.targetPort === port.id)
        const layersParam = params.find((p) => p.type === 'layers')
        const settingsFor = (edgeId: string) => {
          const layers = (node.params[layersParam?.key ?? ''] ?? {}) as Record<
            string,
            { mode?: string; opacity?: number; visible?: boolean }
          >
          const own = layers[edgeId]
          return {
            mode: own?.mode ?? String(node.params.mode ?? 'normal'),
            opacity: own?.opacity ?? Number(node.params.opacity ?? 1),
            visible: own?.visible ?? true,
          }
        }

        return (
          <section key={port.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2">
            <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              {port.label} · {edges.length} {layersParam ? 'lag' : 'elementer'}
            </h3>

            {edges.length === 0 && (
              <p className="text-[11px] text-zinc-600">Ingen lag koblet ennå.</p>
            )}

            <ol className="flex flex-col gap-1">
              {edges.map((edge, index) => {
                const source = graph.nodes.find((n) => n.id === edge.source)
                const settings = settingsFor(edge.id)

                return (
                  <li
                    key={edge.id}
                    className="rounded border border-zinc-800 bg-zinc-950/60 px-2 py-1"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="w-4 text-[10px] tabular-nums text-zinc-600">
                        {index + 1}
                      </span>
                      <span
                        className={`flex-1 truncate text-[11px] ${
                          settings.visible ? 'text-zinc-300' : 'text-zinc-600 line-through'
                        }`}
                      >
                        {source?.title ?? edge.source}
                      </span>
                      {layersParam && (
                        <button
                          type="button"
                          title={settings.visible ? 'Skjul laget' : 'Vis laget'}
                          onClick={() =>
                            setLayerSetting(node.id, edge.id, { visible: !settings.visible })
                          }
                          className={`rounded px-1 text-[11px] ${
                            settings.visible
                              ? 'text-zinc-400 hover:bg-zinc-800'
                              : 'text-zinc-600 hover:bg-zinc-800'
                          }`}
                        >
                          {settings.visible ? '◉' : '○'}
                        </button>
                      )}
                      <button
                        type="button"
                        title="Flytt opp"
                        disabled={index === 0}
                        onClick={() => reorderInput(node.id, port.id, index, index - 1)}
                        className="rounded px-1 text-[10px] text-zinc-400 hover:bg-zinc-800 disabled:opacity-25"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        title="Flytt ned"
                        disabled={index === edges.length - 1}
                        onClick={() => reorderInput(node.id, port.id, index, index + 1)}
                        className="rounded px-1 text-[10px] text-zinc-400 hover:bg-zinc-800 disabled:opacity-25"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        title="Koble fra"
                        onClick={() => disconnect(edge.id)}
                        className="rounded px-1 text-[10px] text-red-400 hover:bg-red-950/40"
                      >
                        ✕
                      </button>
                    </div>

                    {layersParam && (
                      <div className="mt-1 flex items-center gap-1.5 pl-5">
                        <select
                          value={settings.mode}
                          onChange={(e) =>
                            setLayerSetting(node.id, edge.id, {
                              mode: e.target.value as StackMode,
                            })
                          }
                          className="min-w-0 flex-1 rounded border border-zinc-800 bg-zinc-900 px-1 py-0.5 text-[10px] text-zinc-300 outline-none focus:border-lime-500"
                        >
                          {STACK_MODES.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.01}
                          value={settings.opacity}
                          onChange={(e) =>
                            setLayerSetting(node.id, edge.id, {
                              opacity: Number(e.target.value),
                            })
                          }
                          className="h-1 w-16 accent-lime-400"
                          title="Dekkevne"
                        />
                        <span className="w-8 text-right text-[10px] tabular-nums text-zinc-500">
                          {settings.opacity.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </li>
                )
              })}
            </ol>

            <p className="mt-1.5 text-[10px] leading-relaxed text-zinc-600">
              {layersParam
                ? 'Lag 1 er bunnen. Hvert lag har egen modus, dekkevne og synlighet.'
                : 'Rekkefølgen er uten betydning for 3D (dybden avgjør), men brukes av gruppen.'}
            </p>
          </section>
        )
      })}

      {node.type === 'modifier.trail' && <TrailPad nodeId={node.id} />}

      {params.length === 0 && (
        <p className="text-[11px] text-zinc-500">Denne noden har ingen parametere.</p>
      )}

      {/* Koblinger: en synlig måte å koble fra, uten å være avhengig av Delete-tasten. */}
      {incoming.length + outgoing.length > 0 && (
        <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2">
          <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
            Koblinger
          </h3>
          <ul className="flex flex-col gap-1">
            {incoming.map((edge) => (
              <li
                key={edge.id}
                className="flex items-center gap-1.5 rounded border border-zinc-800 bg-zinc-950/60 px-2 py-1 text-[11px]"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-500" />
                <span className="min-w-0 flex-1 truncate text-zinc-300">
                  fra <span className="text-zinc-400">{nodeTitle(graph, edge.source)}</span>
                  {edge.kind === 'param' && (
                    <span className="ml-1 text-[10px] text-fuchsia-300">
                      → {paramLabel(node, edge.targetParam)} (parameter)
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  title="Koble fra"
                  onClick={() => disconnect(edge.id)}
                  className="shrink-0 rounded px-1 text-[10px] text-red-400 hover:bg-red-950/40"
                >
                  ✕
                </button>
              </li>
            ))}
            {outgoing.map((edge) => (
              <li
                key={edge.id}
                className="flex items-center gap-1.5 rounded border border-zinc-800 bg-zinc-950/60 px-2 py-1 text-[11px]"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-lime-400" />
                <span className="min-w-0 flex-1 truncate text-zinc-300">
                  til <span className="text-zinc-400">{nodeTitle(graph, edge.target)}</span>
                </span>
                <button
                  type="button"
                  title="Koble fra"
                  onClick={() => disconnect(edge.id)}
                  className="shrink-0 rounded px-1 text-[10px] text-red-400 hover:bg-red-950/40"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[10px] leading-relaxed text-zinc-600">
            Du kan også merke en kobling i grafen og trykke Delete.
          </p>
        </section>
      )}

      {params.filter((p) => p.type !== 'layers').map((p) => {
        const value = node.params[p.key] ?? p.default
        const lfo = node.lfo?.[p.key]
        const hasKeys = (node.tracks?.[p.key]?.length ?? 0) > 0

        return (
          <div key={p.key} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                {p.type === 'file' ? (
                  <FileField
                    label={p.label}
                    value={String(value ?? '')}
                    filename={String(node.params.filename ?? '')}
                    onChange={(dataUrl, filename) => {
                      setParam(node.id, p.key, dataUrl)
                      setParam(node.id, 'filename', filename)
                    }}
                  />
                ) : (
                  <ParamField
                    def={p}
                    value={value}
                    disabled={node.enabled === false}
                    onChange={(v) => setParam(node.id, p.key, v)}
                  />
                )}
              </div>

              {p.animatable && (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    title="Sett keyframe på nåværende frame"
                    onClick={() => setKeyframe(node.id, p.key, frame, value)}
                    className={`h-6 w-6 rounded border text-[10px] ${
                      hasKeys
                        ? 'border-amber-400 bg-amber-400/20 text-amber-300'
                        : 'border-zinc-700 text-zinc-500 hover:border-amber-400/60'
                    }`}
                  >
                    ◆
                  </button>
                  <button
                    type="button"
                    title="Automatisk animasjon (LFO)"
                    onClick={() => setLfo(node.id, p.key, { on: !lfo?.on })}
                    className={`h-6 w-6 rounded border text-[10px] ${
                      lfo?.on
                        ? 'border-lime-400 bg-lime-400/20 text-lime-300'
                        : 'border-zinc-700 text-zinc-500 hover:border-lime-400/60'
                    }`}
                  >
                    ∿
                  </button>
                </div>
              )}
            </div>

            {lfo?.on && (
              <div className="ml-1 flex flex-col gap-1.5 rounded-lg border border-lime-500/20 bg-lime-500/5 p-2">
                <label className="flex items-center gap-2">
                  <span className="w-24 text-[10px] uppercase tracking-wide text-zinc-500">Form</span>
                  <select
                    value={lfo.shape}
                    onChange={(e) =>
                      setLfo(node.id, p.key, { shape: e.target.value as typeof lfo.shape })
                    }
                    className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[11px] text-zinc-100"
                  >
                    {WAVEFORMS.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <span className="w-24 text-[10px] uppercase tracking-wide text-zinc-500">Styrke</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={lfo.amount}
                    onChange={(e) => setLfo(node.id, p.key, { amount: Number(e.target.value) })}
                    className="h-1 flex-1 accent-lime-400"
                  />
                </label>
                <label className="flex items-center gap-2">
                  <span className="w-24 text-[10px] uppercase tracking-wide text-zinc-500">Sykluser</span>
                  <input
                    type="range"
                    min={1}
                    max={8}
                    step={1}
                    value={lfo.cycles}
                    onChange={(e) => setLfo(node.id, p.key, { cycles: Number(e.target.value) })}
                    className="h-1 flex-1 accent-lime-400"
                  />
                </label>
              </div>
            )}
          </div>
        )
      })}

      <button
        type="button"
        onClick={() => resetParams(node.id)}
        className="self-start rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800"
      >
        Tilbakestill parametere
      </button>
    </div>
  )
}
