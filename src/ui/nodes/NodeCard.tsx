import { Handle, Position, type NodeProps } from '@xyflow/react'
import { registry } from '../../nodes'
import { useGraphStore } from '../../state/useGraphStore'

const CATEGORY_STYLE: Record<string, string> = {
  source: 'border-cyan-500/60 text-cyan-300',
  modifier: 'border-fuchsia-500/60 text-fuchsia-300',
  composite: 'border-amber-500/60 text-amber-300',
  output: 'border-lime-500/60 text-lime-300',
}

export function NodeCard({ id, selected }: NodeProps) {
  const node = useGraphStore((s) => s.graph.nodes.find((n) => n.id === id))
  const edges = useGraphStore((s) => s.graph.edges)
  const select = useGraphStore((s) => s.select)

  if (!node) return null

  let def
  try {
    def = registry.get(node.type)
  } catch {
    return null
  }

  const style = CATEGORY_STYLE[def.category] ?? 'border-zinc-600 text-zinc-300'
  const layerCount = (portId: string) =>
    edges.filter((e) => e.target === id && e.targetPort === portId).length

  /** Påkrevde innganger som mangler en kant — markeres i kortet. */
  const missing = def.inputs.filter(
    (port) =>
      !port.optional &&
      !(port.multiple
        ? edges.some((e) => e.target === id && e.targetPort === port.id)
        : edges.some((e) => e.target === id && e.targetPort === port.id)),
  )

  return (
    <div
      onClick={() => select(id)}
      className={`min-w-[190px] rounded-xl border bg-zinc-900/95 shadow-xl backdrop-blur transition ${
        selected ? 'border-lime-400/80 ring-1 ring-lime-400/40' : 'border-zinc-700/70'
      } ${node.enabled === false ? 'opacity-50' : ''}`}
    >
      {def.inputs.map((port) => (
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
        </span>
        <span className={`rounded border px-1.5 py-0.5 text-[9px] uppercase tracking-wide ${style}`}>
          {def.category}
        </span>
      </header>

      <div className="flex flex-col gap-1 px-3 py-2">
        {def.inputs.map((port) => (
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
        {def.outputs.map((port) => (
          <div key={port.id} className="flex items-center justify-end gap-2 text-[10px] text-zinc-500">
            {port.label}
            <span className="h-1.5 w-1.5 rounded-full bg-lime-400" />
          </div>
        ))}
      </div>

      {def.outputs.map((port) => (
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
