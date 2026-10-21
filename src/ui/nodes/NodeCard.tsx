import { Handle, Position, type NodeProps } from '@xyflow/react'
import { registry } from '../../nodes'
import { useGraphStore } from '../../state/useGraphStore'
import { PARAM_PORT_PREFIX, nodeParamDefs, nodePorts } from '../../engine/graph'

const CATEGORY_STYLE: Record<string, string> = {
  source: 'border-cyan-500/60 text-cyan-300',
  modifier: 'border-fuchsia-500/60 text-fuchsia-300',
  composite: 'border-amber-500/60 text-amber-300',
  output: 'border-lime-500/60 text-lime-300',
}

const MAX_VISIBLE_PARAMS = 4

export function NodeCard({ id, selected }: NodeProps) {
  const node = useGraphStore((s) => s.graph.nodes.find((n) => n.id === id))
  const edges = useGraphStore((s) => s.graph.edges)
  const select = useGraphStore((s) => s.select)

  if (!node) return null

  const isGroup = node.type === 'group'
  const ports = isGroup ? nodePorts(node) : registry.has(node.type) ? nodePorts(node) : { inputs: [], outputs: [] }
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

  const drivable = paramDefs.filter(
    (p) => (p.type === 'number' || p.type === 'int') && p.animatable !== false,
  )
  const visibleParams = drivable.slice(0, MAX_VISIBLE_PARAMS)
  const hiddenParams = drivable.length - visibleParams.length

  return (
    <div
      onClick={() => select(id)}
      className={`min-w-[200px] rounded-xl border bg-zinc-900/95 shadow-xl backdrop-blur transition ${
        selected ? 'border-lime-400/80 ring-1 ring-lime-400/40' : 'border-zinc-700/70'
      } ${node.enabled === false ? 'opacity-50' : ''}`}
    >
      {ports.inputs.map((port) => (
        <Handle
          key={`in-${port.id}`}
          type="target"
          position={Position.Left}
          id={port.id}
          className={`!h-2 !w-2 !border-zinc-900 ${port.multiple ? '!bg-amber-400' : '!bg-zinc-400'}`}
        />
      ))}

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

      <div className="flex flex-col gap-1 px-3 py-2">
        {ports.inputs.map((port) => (
          <div key={port.id} className="flex items-center gap-2 text-[10px] text-zinc-500">
            <span
              className={`h-1.5 w-1.5 rounded-full ${port.multiple ? 'bg-amber-400' : 'bg-zinc-500'}`}
            />
            {port.label}
            {port.multiple && (
              <span className="rounded bg-amber-400/15 px-1 text-[9px] text-amber-300">
                {layerCount(port.id)} lag
              </span>
            )}
            {port.optional && !port.multiple && (
              <span className="text-[9px] text-zinc-600">valgfri</span>
            )}
          </div>
        ))}
        {ports.outputs.map((port) => (
          <div key={port.id} className="flex items-center justify-end gap-2 text-[10px] text-zinc-500">
            {port.label}
            <span className="h-1.5 w-1.5 rounded-full bg-lime-400" />
          </div>
        ))}
      </div>

      {visibleParams.length > 0 && (
        <div className="border-t border-zinc-800/70 px-3 py-1.5">
          {visibleParams.map((p) => {
            const driven = edges.some(
              (e) => e.kind === 'param' && e.target === id && e.targetParam === p.key,
            )
            return (
              <div key={p.key} className="flex items-center justify-between gap-2 py-0.5">
                <span className="truncate text-[10px] text-zinc-500">{p.label}</span>
                <Handle
                  type="target"
                  position={Position.Right}
                  id={`${PARAM_PORT_PREFIX}${p.key}`}
                  className={`!relative !h-2 !w-2 !border-zinc-900 ${
                    driven ? '!bg-fuchsia-400' : '!bg-zinc-600'
                  }`}
                  style={{ position: 'relative', right: 'auto', transform: 'none' }}
                />
              </div>
            )
          })}
          {hiddenParams > 0 && (
            <p className="pt-0.5 text-[9px] text-zinc-600">+{hiddenParams} flere parametere</p>
          )}
        </div>
      )}

      {ports.outputs.map((port) => (
        <Handle
          key={`out-${port.id}`}
          type="source"
          position={Position.Right}
          id={port.id}
          className="!h-2 !w-2 !border-zinc-900 !bg-lime-400"
        />
      ))}
    </div>
  )
}
