import { useEffect } from 'react'
import { X } from 'lucide-react'
import { HELP_TOPICS, findTopic, type HelpBlock } from '../help/content'
import { findExample } from '../help/examples'
import { useHelpStore } from '../state/useHelpStore'
import { useGraphStore } from '../state/useGraphStore'

export function HelpDialog() {
  const open = useHelpStore((s) => s.open)
  const topicId = useHelpStore((s) => s.topic)
  const show = useHelpStore((s) => s.show)
  const close = useHelpStore((s) => s.close)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  if (!open) return null
  const topic = findTopic(topicId) ?? HELP_TOPICS[0]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        className="flex h-[min(680px,90vh)] w-[min(920px,100%)] overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl"
      >
        <nav className="flex w-[200px] shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-zinc-800 bg-zinc-900/60 p-2">
          <p className="px-2 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
            Hjelp
          </p>
          {HELP_TOPICS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => show(item.id)}
              aria-current={item.id === topic.id ? 'page' : undefined}
              className={`rounded-md px-2 py-1.5 text-left text-[12px] transition ${
                item.id === topic.id
                  ? 'bg-lime-400/15 text-zinc-100'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
            >
              {item.title}
            </button>
          ))}
        </nav>

        <article className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-start justify-between gap-3 border-b border-zinc-800 px-5 py-3">
            <div className="min-w-0">
              <h2 id="help-title" className="text-[15px] font-semibold text-zinc-100">
                {topic.title}
              </h2>
              <p className="text-[11px] text-zinc-500">{topic.summary}</p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Lukk hjelp"
              className="shrink-0 rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            >
              <X size={16} />
            </button>
          </header>

          <div className="flex flex-col gap-3 overflow-y-auto px-5 py-4 text-[13px] leading-relaxed text-zinc-300">
            {topic.blocks.map((block, index) => (
              <Block key={index} block={block} />
            ))}
          </div>

          <footer className="flex items-center justify-between gap-3 border-t border-zinc-800 px-5 py-2 text-[11px] text-zinc-500">
            <span>Trykk ? eller Escape for å lukke.</span>
            <NextPrev currentId={topic.id} onGo={show} />
          </footer>
        </article>
      </div>
    </div>
  )
}

function NextPrev({ currentId, onGo }: { currentId: string; onGo: (id: string) => void }) {
  const index = HELP_TOPICS.findIndex((t) => t.id === currentId)
  const prev = HELP_TOPICS[index - 1]
  const next = HELP_TOPICS[index + 1]
  const button = 'rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800 disabled:opacity-30'
  return (
    <div className="flex gap-2">
      <button type="button" className={button} disabled={!prev} onClick={() => prev && onGo(prev.id)}>
        ← Forrige
      </button>
      <button type="button" className={button} disabled={!next} onClick={() => next && onGo(next.id)}>
        Neste →
      </button>
    </div>
  )
}

function Block({ block }: { block: HelpBlock }) {
  switch (block.type) {
    case 'p':
      return <p>{block.text}</p>
    case 'ul':
      return (
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )
    case 'steps':
      return (
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 marker:text-lime-400">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      )
    case 'keys':
      return (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          {block.items.map((item) => (
            <div key={item.keys} className="contents">
              <dt>
                <kbd className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 font-mono text-[11px] text-zinc-200">
                  {item.keys}
                </kbd>
              </dt>
              <dd className="text-zinc-400">{item.does}</dd>
            </div>
          ))}
        </dl>
      )
    case 'example':
      return <ExampleCard id={block.id} />
    case 'tip':
      return (
        <p className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-[12px] text-sky-200">
          {block.text}
        </p>
      )
  }
}

function ExampleCard({ id }: { id: string }) {
  const example = findExample(id)
  if (!example) return null

  const load = () => {
    const { graph, select, setGraph } = useGraphStore.getState()
    if (graph.nodes.length && !window.confirm(`Eksemplet «${example.title}» erstatter grafen du har nå. Fortsette?`)) {
      return
    }
    select(null)
    setGraph(example.build())
    useGraphStore.setState({ notice: `Eksempel lastet: «${example.title}». Trykk Angre for å gå tilbake.` })
    useHelpStore.getState().close()
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-lime-500/30 bg-lime-500/5 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-lime-700">Eksempel</p>
          <p className="text-[13px] font-semibold text-zinc-100">{example.title}</p>
        </div>
        <button
          type="button"
          onClick={load}
          className="shrink-0 rounded-md bg-lime-400 px-3 py-1.5 text-[12px] font-semibold text-black hover:bg-lime-500"
        >
          Prøv i grafen
        </button>
      </div>
      <p className="text-[12px] leading-relaxed text-zinc-400">{example.description}</p>
    </div>
  )
}
