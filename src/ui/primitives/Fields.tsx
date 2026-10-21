import type { ParamDef } from '../../engine/types'

interface BaseProps {
  label: string
  onChange: (value: unknown) => void
  disabled?: boolean
}

export function NumberField({
  label,
  def,
  value,
  onChange,
  disabled,
}: BaseProps & { def: ParamDef; value: number }) {
  const step = def.step ?? (def.type === 'int' ? 1 : 0.01)
  return (
    <label className="flex items-center gap-2">
      <span className="w-28 shrink-0 text-[11px] uppercase tracking-wide text-zinc-400">{label}</span>
      <input
        type="range"
        min={def.min}
        max={def.max}
        step={step}
        value={Number.isFinite(value) ? value : Number(def.default ?? 0)}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 flex-1 cursor-pointer appearance-none rounded bg-zinc-700 accent-lime-400 disabled:opacity-40"
      />
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        step={step}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-16 rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-right text-[11px] tabular-nums text-zinc-100 outline-none focus:border-lime-500 disabled:opacity-40"
      />
    </label>
  )
}

export function ColorField({
  label,
  value,
  onChange,
  disabled,
}: BaseProps & { value: string }) {
  return (
    <label className="flex items-center gap-2">
      <span className="w-28 shrink-0 text-[11px] uppercase tracking-wide text-zinc-400">{label}</span>
      <input
        type="color"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-10 cursor-pointer rounded border border-zinc-700 bg-transparent disabled:opacity-40"
      />
      <span className="text-[11px] tabular-nums text-zinc-400">{value}</span>
    </label>
  )
}

export function SelectField({
  label,
  def,
  value,
  onChange,
  disabled,
}: BaseProps & { def: ParamDef; value: string | number }) {
  return (
    <label className="flex items-center gap-2">
      <span className="w-28 shrink-0 text-[11px] uppercase tracking-wide text-zinc-400">{label}</span>
      <select
        value={String(value ?? def.default ?? '')}
        disabled={disabled}
        onChange={(e) => {
          const raw = e.target.value
          const match = def.options?.find((o) => String(o.value) === raw)
          onChange(match ? match.value : raw)
        }}
        className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[12px] text-zinc-100 outline-none focus:border-lime-500 disabled:opacity-40"
      >
        {def.options?.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function CheckField({
  label,
  value,
  onChange,
  disabled,
}: BaseProps & { value: boolean }) {
  return (
    <label className="flex items-center gap-2">
      <span className="w-28 shrink-0 text-[11px] uppercase tracking-wide text-zinc-400">{label}</span>
      <input
        type="checkbox"
        checked={!!value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-lime-400 disabled:opacity-40"
      />
    </label>
  )
}

export function TextField({
  label,
  value,
  onChange,
  disabled,
}: BaseProps & { value: string }) {
  return (
    <label className="flex items-center gap-2">
      <span className="w-28 shrink-0 text-[11px] uppercase tracking-wide text-zinc-400">{label}</span>
      <input
        type="text"
        value={value ?? ''}
        disabled={disabled}
        placeholder="https:// … eller last opp en fil"
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[12px] text-zinc-100 outline-none focus:border-lime-500 disabled:opacity-40"
      />
    </label>
  )
}

export function ParamField({
  def,
  value,
  onChange,
  disabled,
}: {
  def: ParamDef
  value: unknown
  onChange: (value: unknown) => void
  disabled?: boolean
}) {
  switch (def.type) {
    case 'number':
    case 'int':
      return (
        <NumberField
          label={def.label}
          def={def}
          value={Number(value ?? def.default)}
          onChange={onChange}
          disabled={disabled}
        />
      )
    case 'color':
      return (
        <ColorField label={def.label} value={String(value ?? def.default)} onChange={onChange} disabled={disabled} />
      )
    case 'enum':
      return (
        <SelectField
          label={def.label}
          def={def}
          value={(value ?? def.default) as string | number}
          onChange={onChange}
          disabled={disabled}
        />
      )
    case 'boolean':
      return (
        <CheckField label={def.label} value={!!value} onChange={onChange} disabled={disabled} />
      )
    case 'text':
    default:
      return (
        <TextField label={def.label} value={String(value ?? '')} onChange={onChange} disabled={disabled} />
      )
  }
}
