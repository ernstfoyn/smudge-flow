import { useRef } from 'react'
import { registry } from '../../nodes'
import type { Graph, GraphNode } from '../../engine/types'
import { nodeParamDefs, nodePorts } from '../../engine/graph'
import {
  SIGNAL_NODE_TYPE,
  drivableParams,
  driveSettings,
  isParamVisible,
} from '../../engine/drive'
import { CurveEditor } from './CurveEditor'
import { useGraphStore } from '../../state/useGraphStore'
import { usePlaybackStore } from '../../state/usePlaybackStore'
import { ParamField } from '../primitives/Fields'
import { CollapsibleSection } from '../primitives/CollapsibleSection'
import { TrailPad } from './TrailPad'
import { WAVEFORMS } from '../../engine/animation/lfo'
import { STACK_MODES, type StackMode } from '../../nodes/composite/stack'
import { PARAM_META, portMeta } from '../portStyle'

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
    <div className="flex min-w-0 flex-col gap-1">
      <span className="min-w-0 truncate text-[11px] uppercase tracking-wide text-zinc-400" title={label}>
        {label}
      </span>
      <div className="flex min-w-0 items-center gap-2">
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
          className="shrink-0 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800"
        >
          Velg fil
        </button>
        <span className="min-w-0 flex-1 truncate text-[10px] text-zinc-500">
          {filename || (value ? 'innlastet' : 'ingen fil')}
        </span>
      </div>
    </div>
  )
}

/** Tittel på en node, ut fra grafen. */
function nodeTitle(graph: Graph, id: string): string {
  return graph.nodes.find((n) => n.id === id)?.title ?? id
}

/** Etikett på en parameter. */
/**
 * «Styring»: signalene som beveger denne nodens parametere. Hver kobling har
 * sin egen styrke og kan styre alle parametere eller bare én.
 */
function DriveLinks({ node }: { node: GraphNode }) {
  const graph = useGraphStore((s) => s.graph)
  const setDrive = useGraphStore((s) => s.setDrive)
  const disconnect = useGraphStore((s) => s.disconnect)

  const edges = graph.edges.filter((e) => e.kind === 'drive' && e.target === node.id)
  if (!edges.length || node.type === 'group' || !registry.has(node.type)) return null

  const candidates = drivableParams(registry.get(node.type).params).filter((p) =>
    isParamVisible(p, node.params),
  )

  return (
    <CollapsibleSection
      id="inspector.drive"
      title="Styring"
      badge={edges.length}
      className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2"
    >
      <ul className="flex flex-col gap-2">
        {edges.map((edge) => {
          const settings = driveSettings(edge)
          const fixed = edge.targetPort.startsWith('param:')
          return (
            <li
              key={edge.id}
              className="flex min-w-0 flex-col gap-1.5 rounded border border-zinc-800 bg-zinc-950/60 p-2"
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: PARAM_META.color }}
                />
                <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-200">
                  {nodeTitle(graph, edge.source)}
                </span>
                <button
                  type="button"
                  title="Koble fra"
                  onClick={() => disconnect(edge.id)}
                  className="shrink-0 rounded px-1 text-[10px] text-red-400 hover:bg-red-950/40"
                >
                  ✕
                </button>
              </div>

              <label className="flex min-w-0 items-center gap-2 text-[11px] text-zinc-400">
                <span className="w-12 shrink-0">Styrer</span>
                {fixed ? (
                  <span className="min-w-0 flex-1 truncate text-zinc-200">
                    {paramLabel(node, settings.param ?? undefined)}
                  </span>
                ) : (
                  <select
                    value={settings.param ?? ''}
                    onChange={(e) => setDrive(edge.id, { param: e.target.value || null })}
                    className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[11px] text-zinc-100"
                  >
                    <option value="">Alle parametere</option>
                    {candidates.map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                )}
              </label>

              <label className="flex min-w-0 items-center gap-2 text-[11px] text-zinc-400">
                <span className="w-12 shrink-0">Styrke</span>
                <input
                  type="range"
                  min={-1}
                  max={1}
                  step={0.01}
                  value={settings.amount}
                  onChange={(e) => setDrive(edge.id, { amount: Number(e.target.value) })}
                  className="h-1 min-w-0 flex-1 accent-sky-400"
                />
                <span className="w-10 shrink-0 text-right tabular-nums text-zinc-300">
                  {Math.round(settings.amount * 100)} %
                </span>
              </label>
            </li>
          )
        })}
      </ul>

      <p className="mt-1.5 text-[10px] leading-relaxed text-zinc-600">
        Signalet svinger parameteren rundt verdien du har satt, over en andel av parameterens eget
        område. Negativ styrke snur bevegelsen. Flere signaler legges sammen.
      </p>
    </CollapsibleSection>
  )
}

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
  const editableParams = params.filter(
    (p) => p.type !== 'layers' && p.type !== 'curve' && isParamVisible(p, node.params),
  )

  /** Lagene som er koblet til en multiple-port, i tegnerrekkefølge. */
  const nodePortDefs = nodePorts(node)
  const layerPorts = nodePortDefs.inputs.filter((p) => p.multiple)
  const outputPorts = nodePortDefs.outputs

  /** Alle koblinger inn og ut av noden. */
  const incoming = graph.edges.filter((e) => e.target === node.id)
  const outgoing = graph.edges.filter((e) => e.source === node.id)

  if (isGroup) {
    return (
      <div className="flex min-w-0 flex-col gap-4 p-3">
        <header className="sticky top-0 z-20 -mx-3 -mt-3 flex flex-wrap items-start justify-between gap-2 border-b border-zinc-800 bg-zinc-950/95 px-3 py-2 backdrop-blur">
          <div className="min-w-[5rem] flex-1">
            <h2 className="truncate text-[13px] font-semibold text-zinc-100">{node.title}</h2>
            <p className="truncate text-[10px] text-zinc-500">
              Gruppe · {node.group?.nodes.length ?? 0} noder
            </p>
          </div>
          <button
            type="button"
            onClick={() => removeNode(node.id)}
            className="shrink-0 rounded border border-red-900/70 px-2 py-1 text-[11px] text-red-300 hover:bg-red-950/40"
          >
            Slett
          </button>
        </header>

        <p className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-2 text-[11px] leading-relaxed text-zinc-400">
          En gruppe er en gjenbrukbart behandlingsblokk. Koble andre kilder inn i
          inngangene, og kopier gruppen for å bruke samme behandling på nytt innhold.
        </p>

        <CollapsibleSection
          id="inspector.group.inputs"
          title="Eksponerte innganger"
          badge={node.group?.inputs.length ?? 0}
        >
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
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span
                        aria-hidden
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: portMeta(input.type).color }}
                      />
                      <span className="truncate text-zinc-300">{input.name}</span>
                    </span>
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
        </CollapsibleSection>

        <CollapsibleSection
          id="inspector.group.outputs"
          title="Eksponerte utganger"
          badge={node.group?.outputs.length ?? 0}
        >
          {node.group?.outputs.length ? (
            <ul className="flex flex-col gap-1">
              {node.group.outputs.map((output) => (
                <li
                  key={output.id}
                  className="flex items-center justify-between gap-1 rounded border border-zinc-800 bg-zinc-950/60 px-2 py-1 text-[11px] text-zinc-300"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span
                      aria-hidden
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: portMeta(output.type).color }}
                    />
                    <span className="truncate">{output.name}</span>
                  </span>
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
        </CollapsibleSection>

        {node.group && node.group.edges.length > 0 && (
          <CollapsibleSection
            id="inspector.group.edges"
            title="Interne koblinger"
            badge={node.group.edges.length}
          >
            <ul className="flex flex-col gap-1">
              {node.group.edges.map((edge) => {
                const sourceNode = node.group?.nodes.find((n) => n.id === edge.source)
                const sourcePort = sourceNode
                  ? nodePorts(sourceNode).outputs.find((p) => p.id === edge.sourcePort)
                  : undefined
                const color =
                  edge.kind === 'param'
                    ? PARAM_META.color
                    : sourcePort
                      ? portMeta(sourcePort.type).color
                      : '#71717a'
                const from = sourceNode?.title ?? edge.source
                const to = node.group?.nodes.find((n) => n.id === edge.target)?.title ?? edge.target
                return (
                  <li
                    key={edge.id}
                    className="flex items-center gap-1.5 rounded border border-zinc-800 bg-zinc-950/60 px-2 py-1 text-[11px]"
                  >
                    <span
                      aria-hidden
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: color }}
                    />
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
          </CollapsibleSection>
        )}

        <CollapsibleSection
          id="inspector.group.content"
          title="Innhold · eksponer porter"
          badge={node.group?.nodes.length ?? 0}
        >
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
                        <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-[10px] text-zinc-500">
                          <span
                            aria-hidden
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ background: portMeta(port.type).color }}
                          />
                          → {port.label}
                        </span>
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
                        <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-[10px] text-zinc-500">
                          <span
                            aria-hidden
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ background: portMeta(port.type).color }}
                          />
                          ← {port.label}
                        </span>
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
        </CollapsibleSection>

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
    <div className="flex min-w-0 flex-col gap-4 p-3">
      <header className="sticky top-0 z-20 -mx-3 -mt-3 flex flex-wrap items-start justify-between gap-2 border-b border-zinc-800 bg-zinc-950/95 px-3 py-2 backdrop-blur">
        <div className="min-w-[5rem] flex-1">
          <h2 className="truncate text-[13px] font-semibold text-zinc-100">{node.title}</h2>
          <p className="truncate text-[10px] text-zinc-500">{node.type}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => toggleNode(node.id)}
            className="shrink-0 rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800"
          >
            {node.enabled === false ? 'Aktiver' : 'Deaktiver'}
          </button>
          <button
            type="button"
            onClick={() => instantiate(node.id)}
            className="shrink-0 rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800"
            title="Lag kopi"
          >
            ⧉
          </button>
          <button
            type="button"
            onClick={() => removeNode(node.id)}
            className="shrink-0 rounded border border-red-900/70 px-2 py-1 text-[11px] text-red-300 hover:bg-red-950/40"
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

      {node.type === SIGNAL_NODE_TYPE && <CurveEditor node={node} />}

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
          <CollapsibleSection
            key={port.id}
            id={`inspector.layer.${port.id}`}
            title={port.label}
            badge={`${edges.length} ${layersParam ? 'lag' : 'elementer'}`}
            accent={portMeta(port.type).color}
            className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2"
          >
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
                        className={`min-w-0 flex-1 truncate text-[11px] ${
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
                      <div className="mt-1 flex min-w-0 items-center gap-1.5 pl-5">
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
                          className="h-1 w-16 min-w-0 shrink-0 accent-lime-400"
                          title="Dekkevne"
                        />
                        <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-zinc-500">
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
          </CollapsibleSection>
        )
      })}

      <DriveLinks node={node} />

      {node.type === 'modifier.trail' && <TrailPad nodeId={node.id} />}

      {/* Koblinger: en synlig måte å koble fra, uten å være avhengig av Delete-tasten. */}
      {incoming.length + outgoing.length > 0 && (
        <CollapsibleSection
          id="inspector.connections"
          title="Koblinger"
          badge={incoming.length + outgoing.length}
          className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2"
        >
          <ul className="flex flex-col gap-1">
            {incoming.map((edge) => {
              const sourceNode = graph.nodes.find((n) => n.id === edge.source)
              const sourcePort = sourceNode
                ? nodePorts(sourceNode).outputs.find((p) => p.id === edge.sourcePort)
                : undefined
              const color =
                edge.kind === 'param' || edge.kind === 'drive'
                  ? PARAM_META.color
                  : sourcePort
                    ? portMeta(sourcePort.type).color
                    : '#71717a'

              return (
                <li
                  key={edge.id}
                  className="flex items-center gap-1.5 rounded border border-zinc-800 bg-zinc-950/60 px-2 py-1 text-[11px]"
                >
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: color }}
                  />
                  <span className="min-w-0 flex-1 truncate text-zinc-300">
                    fra <span className="text-zinc-400">{nodeTitle(graph, edge.source)}</span>
                    {edge.kind === 'param' && (
                      <span className="ml-1 text-[10px]" style={{ color: PARAM_META.color }}>
                        → {paramLabel(node, edge.targetParam)} (parameter)
                      </span>
                    )}
                    {edge.kind === 'drive' && (
                      <span className="ml-1 text-[10px]" style={{ color: PARAM_META.color }}>
                        → {driveSettings(edge).param === null
                          ? 'Alle parametere'
                          : paramLabel(node, driveSettings(edge).param ?? undefined)}{' '}
                        · {Math.round(driveSettings(edge).amount * 100)} %
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
              )
            })}
            {outgoing.map((edge) => {
              const sourcePort = outputPorts.find((p) => p.id === edge.sourcePort)
              const color = sourcePort ? portMeta(sourcePort.type).color : '#71717a'
              return (
                <li
                  key={edge.id}
                  className="flex items-center gap-1.5 rounded border border-zinc-800 bg-zinc-950/60 px-2 py-1 text-[11px]"
                >
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: color }}
                  />
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
              )
            })}
          </ul>
          <p className="mt-1.5 text-[10px] leading-relaxed text-zinc-600">
            Du kan også merke en kobling i grafen og trykke Delete.
          </p>
        </CollapsibleSection>
      )}

      {editableParams.length > 0 ? (
        <CollapsibleSection
          id="inspector.params"
          title="Parametere"
          badge={editableParams.length}
          accent={PARAM_META.color}
          className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2"
          bodyClassName="flex flex-col gap-3"
        >
          {editableParams.map((p) => {
            const value = node.params[p.key] ?? p.default
            const lfo = node.lfo?.[p.key]
            const hasKeys = (node.tracks?.[p.key]?.length ?? 0) > 0

            return (
              <div key={p.key} className="flex min-w-0 flex-col gap-1.5">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="min-w-0 flex-1">
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
                  <div className="ml-1 flex min-w-0 flex-col gap-1.5 rounded-lg border border-lime-500/20 bg-lime-500/5 p-2">
                    <label className="flex min-w-0 items-center gap-2">
                      <span className="w-16 shrink-0 truncate text-[10px] uppercase tracking-wide text-zinc-500">Form</span>
                      <select
                        value={lfo.shape}
                        onChange={(e) =>
                          setLfo(node.id, p.key, { shape: e.target.value as typeof lfo.shape })
                        }
                        className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[11px] text-zinc-100"
                      >
                        {WAVEFORMS.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex min-w-0 items-center gap-2">
                      <span className="w-16 shrink-0 truncate text-[10px] uppercase tracking-wide text-zinc-500">Styrke</span>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={lfo.amount}
                        onChange={(e) => setLfo(node.id, p.key, { amount: Number(e.target.value) })}
                        className="h-1 min-w-0 flex-1 accent-lime-400"
                      />
                    </label>
                    <label className="flex min-w-0 items-center gap-2">
                      <span className="w-16 shrink-0 truncate text-[10px] uppercase tracking-wide text-zinc-500">Sykluser</span>
                      <input
                        type="range"
                        min={1}
                        max={8}
                        step={1}
                        value={lfo.cycles}
                        onChange={(e) => setLfo(node.id, p.key, { cycles: Number(e.target.value) })}
                        className="h-1 min-w-0 flex-1 accent-lime-400"
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
        </CollapsibleSection>
      ) : (
        <p className="text-[11px] text-zinc-500">Denne noden har ingen parametere.</p>
      )}
    </div>
  )
}
