import { describe, expect, it } from 'vitest'
import { HELP_TOPICS, findTopic } from '../src/help/content'
import { useHelpStore } from '../src/state/useHelpStore'

describe('hjelpeinnhold', () => {
  it('har unike kapittel-id-er med tekst i alle felt', () => {
    const ids = HELP_TOPICS.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const topic of HELP_TOPICS) {
      expect(topic.title.trim()).not.toBe('')
      expect(topic.summary.trim()).not.toBe('')
      expect(topic.blocks.length).toBeGreaterThan(0)
      for (const block of topic.blocks) {
        if (block.type === 'p' || block.type === 'tip') expect(block.text.trim()).not.toBe('')
        if (block.type === 'ul' || block.type === 'steps') {
          expect(block.items.length).toBeGreaterThan(0)
          for (const item of block.items) expect(item.trim()).not.toBe('')
        }
        if (block.type === 'keys') {
          for (const item of block.items) expect(item.keys.trim()).not.toBe('')
        }
      }
    }
  })

  it('har kapitlene som lenkene i appen peker til', () => {
    for (const id of ['kom-i-gang', 'signaler-og-styring', 'eksport', 'feilsoking']) {
      expect(findTopic(id)).toBeDefined()
    }
    expect(findTopic('finnes-ikke')).toBeUndefined()
  })
})

describe('hjelpestatus', () => {
  it('åpner på valgt kapittel og lukker', () => {
    useHelpStore.setState({ open: false, topic: 'kom-i-gang' })
    useHelpStore.getState().show('eksport')
    expect(useHelpStore.getState()).toMatchObject({ open: true, topic: 'eksport' })
    useHelpStore.getState().close()
    expect(useHelpStore.getState().open).toBe(false)
  })

  it('veksler med toggle', () => {
    useHelpStore.setState({ open: false, topic: 'kom-i-gang' })
    useHelpStore.getState().toggle()
    expect(useHelpStore.getState().open).toBe(true)
    useHelpStore.getState().toggle()
    expect(useHelpStore.getState().open).toBe(false)
  })

  it('show uten argument beholder kapitlet', () => {
    useHelpStore.setState({ open: false, topic: 'animasjon' })
    useHelpStore.getState().show()
    expect(useHelpStore.getState().topic).toBe('animasjon')
  })
})
