import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useState, type CSSProperties } from 'react'
import { registry } from '../../nodes'
import { useGraphStore } from '../../state/useGraphStore'
import { useConnectionDrag } from '../../state/useConnectionDrag'
import { PARAM_PORT_PREFIX, nodeParamDefs, nodePorts } from '../../engine/graph'
import { DRIVE_PORT_ID, drivableParams, driveSettings, isParamVisible } from '../../engine/drive'
import type { PortDef } from '../../engine/types'
import { PARAM_META, paramPortCompatible, portMeta, valuePortsCompatible } from '../portStyle'

const CATEGORY_STYLE: Record<string, string> = {
  source: 'border-cyan-500/60 text-cyan-300',
  curve: 'border-blue-400/60 text-blue-300',
  modifier: 'border-fuchsia-500/60 text-fuchsia-300',
  composite: 'border-amber-500/60 text-amber-300',
  output: 'border-lime-500/60 text-lime-300',
}

const MAX_VISIBLE_PARAMS = 4

type PortState = 'idle' | 'origin' | 'compatible' | 'incompatible' | 'muted'

function stateClass(state: PortState): string {
  return state === 'idle' ? '' : `smudge-port--${state}`
}

function stateOpacity(state: PortState): string {
  return state === 'incompatible' || state === 'muted' ? 'opacity-35' : ''
}

function TypeChip({ label, color, title }: { label: string; color: string; title?: string }) {
  return (
    <span
      title={title}
      className="shrink-0 rounded border px-1 py-px text-[9px] font-semibold uppercase leading-none tracking-wide"
      style={{ color, borderColor: `${color}55`, backgroundColor: `${color}16` }}
    >
      {label}
    </span>
  )
}

function PortDot({
  id,
  side,
  state,
  color,
  multiple,
  title,
  label,
}: {
  id: string
  side: 'left' | 'right'
  state: PortState
  color: string
  multiple?: boolean
  title: string
  label: string
}) {
  const style: CSSProperties & { '--port-color': string } = {
    width: 11,
    height: 11,
    background: color,
    border: '2px solid #09090b',
    ...(side === 'left' ? { left: -12 } : { right: -12 }),
    '--port-color': color,
  }

  return (
    <Handle
      type={side === 'left' ? 'target' : 'source'}
      position={side === 'left' ? Position.Left : Position.Right}
      id={id}
      title={title}
      aria-label={`${title} — ${label}`}
      className={`smudge-port ${multiple ? 'smudge-port--multi' : ''} ${stateClass(state)}`}
      style={style}
    />
  )
}

/** Parameterinnganger er tall, men tegnes som en diamant på kortets venstre kant. */
function ParamHandle({ id, state, label }: { id: string; state: PortState; label: string }) {
  const style: CSSProperties & { '--port-color': string } = {
    width: 10,
    height: 10,
    left: -12,
    background: PARAM_META.color,
    border: '2px solid #09090b',
    '--port-color': PARAM_META.color,
  }

  return (
    <Handle
      type="target"
      position={Position.Left}
      id={id}
      title={`${PARAM_META.label} — ${PARAM_META.hint}`}
      aria-label={`${PARAM_META.label}: ${label}`}
      className={`smudge-port smudge-port--param ${stateClass(state)}`}
      style={style}
    />
  )
}

export function NodeCard({ id, selected }: NodeProps) {
  const node = useGraphStore((s) => s.graph.nodes.find((n) => n.id === id))
  const edges = useGraphStore((s) => s.graph.edges)
  const select = useGraphStore((s) => s.select)
  const drag = useConnectionDrag((s) => s.drag)
  const [showAllParams, setShowAllParams] = useState(false)

  if (!node) return null

  const isGroup = node.type === 'group'
  const ports = isGroup
    ? nodePorts(node)
    : registry.has(node.type)
      ? nodePorts(node)
      : { inputs: [], outputs: [] }
  const paramDefs = nodeParamDefs(node)

  const style = isGroup
    ? 'border-violet-500/60 text-violet-300'
    : (CATEGORY_STYLE[registry.get(node.type)?.category ?? ''] ?? 'border-zinc-600 text-zinc-300')

  const layerCount = (portId: string) =>
    edges.filter((e) => e.target === id && e.targetPort === portId).length

  /** Påkrevde innganger som mangler en kant — markeres i kortet. */
  const missing = ports.inputs.filter(
    (port) => !port.optional && !edges.some((e) => e.target === id && e.targetPort === port.id),
  )

  const drivable = drivableParams(paramDefs).filter((p) => isParamVisible(p, node.params))
  /** Signaler som styrer hele noden via «Styring» (ikke via en enkelt diamant). */
  const signalEdges = edges.filter(
    (e) => e.kind === 'drive' && e.target === id && e.targetPort === DRIVE_PORT_ID,
  )
  const isDriven = (key: string) =>
    edges.some((e) => e.target === id && e.targetPort === `${PARAM_PORT_PREFIX}${key}`)
  // Koblede parametere vises alltid, ellers mister kanten håndtaket sitt.
  const visibleParams = drivable.filter(
    (p, index) => showAllParams || index < MAX_VISIBLE_PARAMS || isDriven(p.key),
  )
  const hiddenParams = drivable.length - visibleParams.length
  const canCollapse = showAllParams && drivable.length > MAX_VISIBLE_PARAMS

  /**
   * Koblingstilstand per port mens brukeren drar.
   *
   * - `compatible`: samme farge, kan slippes her.
   * - `incompatible`: feil type, dempes.
   * - `muted`: feil retning, eller samme node (selvkobling er ikke lov).
   * - `origin`: porten draget startet fra.
   */
  const inputState = (port: PortDef): PortState => {
    if (!drag) return 'idle'
    if (drag.nodeId === id) {
      return drag.direction === 'target' && drag.portId === port.id ? 'origin' : 'muted'
    }
    if (drag.direction !== 'source') return 'muted'
    return valuePortsCompatible(drag.type, port.type) ? 'compatible' : 'incompatible'
  }

  const paramState = (key: string): PortState => {
    if (!drag) return 'idle'
    const handleId = `${PARAM_PORT_PREFIX}${key}`
    if (drag.nodeId === id) {
      return drag.direction === 'target' && drag.portId === handleId ? 'origin' : 'muted'
    }
    if (drag.direction !== 'source') return 'muted'
    return paramPortCompatible(drag.type) ? 'compatible' : 'incompatible'
  }

  const driveState = (): PortState => {
    if (!drag) return 'idle'
    if (drag.nodeId === id) {
      return drag.direction === 'target' && drag.portId === DRIVE_PORT_ID ? 'origin' : 'muted'
    }
    if (drag.direction !== 'source') return 'muted'
    return paramPortCompatible(drag.type) ? 'compatible' : 'incompatible'
  }

  const outputState = (port: PortDef): PortState => {
    if (!drag) return 'idle'
    if (drag.nodeId === id) {
      return drag.direction === 'source' && drag.portId === port.id ? 'origin' : 'muted'
    }
    if (drag.direction !== 'target') return 'muted'
    return valuePortsCompatible(port.type, drag.type) ? 'compatible' : 'incompatible'
  }

  /** Demp hele kortet når det ikke har noen kompatible mål for draget. */
  let hasCompatibleTarget = true
  if (drag) {
    hasCompatibleTarget =
      drag.direction === 'source'
        ? ports.inputs.some((port) => valuePortsCompatible(drag.type, port.type)) ||
          (paramPortCompatible(drag.type) && drivable.length > 0)
        : ports.outputs.some((port) => valuePortsCompatible(port.type, drag.type))
  }
  const dimmed = !!drag && drag.nodeId !== id && !hasCompatibleTarget

  return (
    <div
      onClick={() => select(id)}
      className={`w-[232px] rounded-xl border bg-zinc-900/95 shadow-xl backdrop-blur transition ${
        selected ? 'border-lime-400/80 ring-1 ring-lime-400/40' : 'border-zinc-700/70'
      } ${
        node.enabled === false ? 'opacity-50' : dimmed ? 'opacity-45 saturate-50' : ''
      }`}
    >
      <header className="flex items-center justify-between gap-2 border-b border-zinc-800 px-3 py-2">
        <span className="flex min-w-0 items-center gap-1.5">
          {missing.length > 0 && (
            <span
              title={`Mangler inngang: ${missing.map((p) => p.label).join(', ')}`}
              className="h-2 w-2 shrink-0 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.9)]"
            />
          )}
          <span className="truncate text-[12px] font-semibold text-zinc-100">{node.title}</span>
          {isGroup && (
            <span className="shrink-0 rounded bg-violet-500/15 px-1 text-[9px] text-violet-300">
              {node.group?.nodes.length ?? 0} noder
            </span>
          )}
        </span>
        <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] uppercase tracking-wide ${style}`}>
          {isGroup ? 'gruppe' : (registry.get(node.type)?.category ?? '')}
        </span>
      </header>

      {(ports.inputs.length > 0 || ports.outputs.length > 0 || drivable.length > 0) && (
        <div className="flex flex-col gap-0.5 px-3 py-2">
          {ports.inputs.map((port) => {
            const state = inputState(port)
            const meta = portMeta(port.type)
            const count = port.multiple ? layerCount(port.id) : 0
            return (
              <div
                key={port.id}
                title={`${port.label} — ${meta.hint}${port.multiple ? ' · kan ha flere koblinger' : ''}`}
                className={`relative flex h-5 items-center gap-1.5 text-[10px] transition-opacity ${stateOpacity(state)}`}
              >
                <PortDot
                  id={port.id}
                  side="left"
                  state={state}
                  color={meta.color}
                  multiple={port.multiple}
                  title={`${meta.label} — ${meta.hint}`}
                  label={port.label}
                />
                <span
                  className={`min-w-0 truncate ${
                    state === 'compatible' ? 'text-zinc-100' : 'text-zinc-400'
                  }`}
                >
                  {port.label}
                </span>
                {port.optional && !port.multiple && (
                  <span className="shrink-0 text-[9px] text-zinc-600">valgfri</span>
                )}
                <span className="ml-auto flex shrink-0 items-center gap-1">
                  {port.multiple && (
                    <span
                      className="rounded bg-amber-400/10 px-1 text-[8px] tabular-nums text-amber-300/90"
                      title="Kan ha flere koblinger"
                    >
                      {count > 0 ? `${count} lag` : 'flere'}
                    </span>
                  )}
                  <TypeChip label={meta.label} color={meta.color} title={meta.hint} />
                </span>
              </div>
            )
          })}

          {drivable.length > 0 && (() => {
            const state = driveState()
            return (
              <div
                title="Styring — koble et signal hit. Velg styrke og parameter i Egenskaper."
                className={`relative flex h-5 items-center gap-1.5 text-[10px] transition-opacity ${stateOpacity(state)}`}
              >
                <PortDot
                  id={DRIVE_PORT_ID}
                  side="left"
                  state={state}
                  color={PARAM_META.color}
                  title="Styring — la et signal bevege parameterne på denne noden"
                  label="Styring"
                />
                <span
                  className={`min-w-0 truncate ${state === 'compatible' ? 'text-zinc-100' : 'text-zinc-400'}`}
                >
                  Styring
                </span>
                <span className="ml-auto shrink-0">
                  {signalEdges.length > 0 ? (
                    <span
                      className="rounded bg-sky-400/10 px-1 text-[9px] text-sky-300"
                      title={signalEdges
                        .map((e) => {
                          const d = driveSettings(e)
                          return `${d.param === null ? 'Alle' : d.param} · ${Math.round(d.amount * 100)} %`
                        })
                        .join('\n')}
                    >
                      {signalEdges.length === 1
                        ? (() => {
                            const d = driveSettings(signalEdges[0])
                            return `${d.param === null ? 'Alle' : '1 param.'} · ${Math.round(d.amount * 100)} %`
                          })()
                        : `${signalEdges.length} signaler`}
                    </span>
                  ) : (
                    <TypeChip
                      label="Tall"
                      color={PARAM_META.color}
                      title="Alle valgte parametere styres av denne verdien"
                    />
                  )}
                </span>
              </div>
            )
          })()}

          {(ports.inputs.length > 0 || drivable.length > 0) && ports.outputs.length > 0 && (
            <div className="my-1 h-px bg-zinc-800/70" />
          )}

          {ports.outputs.map((port) => {
            const state = outputState(port)
            const meta = portMeta(port.type)
            return (
              <div
                key={port.id}
                title={`${port.label} — ${meta.hint}`}
                className={`relative flex h-5 items-center justify-end gap-1.5 text-[10px] transition-opacity ${stateOpacity(state)}`}
              >
                <span
                  className={`min-w-0 truncate ${
                    state === 'compatible' ? 'text-zinc-100' : 'text-zinc-400'
                  }`}
                >
                  {port.label}
                </span>
                <TypeChip label={meta.label} color={meta.color} title={meta.hint} />
                <PortDot
                  id={port.id}
                  side="right"
                  state={state}
                  color={meta.color}
                  title={`${meta.label} — ${meta.hint}`}
                  label={port.label}
                />
              </div>
            )
          })}
        </div>
      )}

      {visibleParams.length > 0 && (
        <div className="border-t border-zinc-800/70 px-3 py-1.5">
          <div className="mb-0.5 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-widest text-zinc-600">
            <span
              aria-hidden
              className="h-1.5 w-1.5 rotate-45 rounded-[1px]"
              style={{ background: PARAM_META.color }}
            />
            Parametere
            <span className="ml-auto font-normal normal-case tracking-normal text-zinc-600">
              styres av Tall
            </span>
          </div>
          {visibleParams.map((p) => {
            const state = paramState(p.key)
            const driven = isDriven(p.key)
            return (
              <div
                key={p.key}
                title={`${p.label} — ${PARAM_META.hint}`}
                className={`relative flex h-5 items-center justify-between gap-2 pr-1 text-[10px] transition-opacity ${stateOpacity(state)}`}
              >
                <span className="min-w-0 truncate text-zinc-500">{p.label}</span>
                {driven && (
                  <span className="shrink-0 text-[9px] uppercase tracking-wide text-sky-300/80">
                    styrt
                  </span>
                )}
                <ParamHandle
                  id={`${PARAM_PORT_PREFIX}${p.key}`}
                  state={state}
                  label={p.label}
                />
              </div>
            )
          })}
          {(hiddenParams > 0 || canCollapse) && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                setShowAllParams((value) => !value)
              }}
              className="nodrag nopan mt-0.5 text-[9px] text-sky-300/80 hover:text-sky-200"
            >
              {showAllParams ? 'Vis færre parametere' : `Vis alle (+${hiddenParams} flere)`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
