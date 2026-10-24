import { CircleHelp } from 'lucide-react'
import { useHelpStore } from '../../state/useHelpStore'

/** Liten lenke som åpner hjelpevinduet på riktig kapittel. */
export function HelpLink({ topic, children }: { topic: string; children?: string }) {
  const show = useHelpStore((s) => s.show)
  return (
    <button
      type="button"
      onClick={() => show(topic)}
      className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[10px] text-sky-600 hover:bg-zinc-800 hover:text-sky-500"
    >
      <CircleHelp size={11} aria-hidden />
      {children ?? 'Hva er dette?'}
    </button>
  )
}
