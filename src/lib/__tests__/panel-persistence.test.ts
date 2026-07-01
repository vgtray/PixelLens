import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { MarkdownResult } from '@/types/markdown'

// chrome.storage.local must exist BEFORE the store module is evaluated, because
// the Zustand `persist` middleware kicks off (async) hydration at import time.
// vi.hoisted runs before the hoisted imports, so we wire the mock here.
const { mockStore } = vi.hoisted(() => {
  const mockStore: Record<string, string> = {}
  ;(globalThis as unknown as { chrome: unknown }).chrome = {
    storage: {
      local: {
        get: (key: string) =>
          Promise.resolve(key in mockStore ? { [key]: mockStore[key] } : {}),
        set: (items: Record<string, string>) => {
          Object.assign(mockStore, items)
          return Promise.resolve()
        },
        remove: (key: string) => {
          delete mockStore[key]
          return Promise.resolve()
        },
      },
    },
  }
  return { mockStore }
})

import { usePanelStore } from '@/sidepanel/store'
import { PANEL_STATE_STORAGE_KEY } from '@/lib/storage'

const flush = () => new Promise<void>((r) => setTimeout(r, 0))

const mockMarkdown: MarkdownResult = {
  frontmatter: {
    title: 'Doc',
    url: 'https://example.com',
    capturedAt: '2026-06-30T00:00:00.000Z',
    wordCount: 2,
  },
  markdown: '# Hi',
  fullDocument: '---\ntitle: Doc\n---\n\n# Hi',
  stats: { headings: 1, links: 0, images: 0, tables: 0, codeBlocks: 0 },
}

describe('panel store persistence', () => {
  beforeEach(async () => {
    for (const k of Object.keys(mockStore)) delete mockStore[k]
    usePanelStore.setState({
      activeMode: 'inspect',
      colorFormat: 'hex',
      markdownResult: null,
      scanProgress: null,
      markdownLoading: false,
      markdownError: null,
      history: [],
      designSystem: null,
      inspectedElement: null,
    })
    await usePanelStore.persist.rehydrate()
  })

  it('persists durable UI state but never transient flags or history/designSystem', async () => {
    const s = usePanelStore.getState()
    s.setColorFormat('rgb')
    s.setMode('markdown')
    s.setMarkdownResult(mockMarkdown)
    // Transient + non-persisted state that must stay out of storage.
    s.setScanProgress({ percent: 50, phase: 'scanning' })
    s.setMarkdownLoading(true)
    await flush()

    const raw = mockStore[PANEL_STATE_STORAGE_KEY]
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw) as { state: Record<string, unknown> }

    expect(parsed.state.colorFormat).toBe('rgb')
    expect(parsed.state.activeMode).toBe('markdown')
    expect(parsed.state.markdownResult).toMatchObject({ markdown: '# Hi' })

    expect(parsed.state).not.toHaveProperty('scanProgress')
    expect(parsed.state).not.toHaveProperty('markdownLoading')
    expect(parsed.state).not.toHaveProperty('markdownError')
    expect(parsed.state).not.toHaveProperty('history')
    expect(parsed.state).not.toHaveProperty('designSystem')
  })

  it('round-trips durable state across a simulated panel remount', async () => {
    const s = usePanelStore.getState()
    s.setColorFormat('hsl')
    s.setMode('export')
    s.setMarkdownResult(mockMarkdown)
    await flush()

    // Simulate the panel being torn down and recreated. The real panel's JS
    // context dies, so storage keeps the last-persisted envelope; here we
    // snapshot it, wipe in-memory state, restore the snapshot (the wipe would
    // otherwise trigger a persist write that clobbers it), then rehydrate.
    const envelope = mockStore[PANEL_STATE_STORAGE_KEY]
    usePanelStore.setState({
      activeMode: 'inspect',
      colorFormat: 'hex',
      markdownResult: null,
    })
    mockStore[PANEL_STATE_STORAGE_KEY] = envelope
    await usePanelStore.persist.rehydrate()

    const after = usePanelStore.getState()
    expect(after.colorFormat).toBe('hsl')
    expect(after.activeMode).toBe('export')
    expect(after.markdownResult?.markdown).toBe('# Hi')
  })

  it('resets transient flags on rehydrate even if a legacy envelope carried them', async () => {
    // Craft an envelope that (wrongly) contains transient state, as an older
    // build might have written.
    mockStore[PANEL_STATE_STORAGE_KEY] = JSON.stringify({
      version: 0,
      state: {
        activeMode: 'history',
        colorFormat: 'rgb',
        markdownResult: mockMarkdown,
        scanProgress: { percent: 99, phase: 'stale' },
        markdownLoading: true,
        markdownError: 'stale error',
      },
    })

    await usePanelStore.persist.rehydrate()

    const after = usePanelStore.getState()
    // Durable fields restored...
    expect(after.activeMode).toBe('history')
    expect(after.colorFormat).toBe('rgb')
    // ...transient flags forced back to initial.
    expect(after.scanProgress).toBeNull()
    expect(after.markdownLoading).toBe(false)
    expect(after.markdownError).toBeNull()
  })

  it('starts with the hydration gate closed and opens it on rehydrate', async () => {
    // Fresh panel mount: in-memory defaults, gate closed.
    usePanelStore.setState({ activeMode: 'inspect', hasHydrated: false })
    // Persist a *footer* mode (history) as the last durable state. Written AFTER
    // setState so the persist write triggered by setState can't clobber it.
    mockStore[PANEL_STATE_STORAGE_KEY] = JSON.stringify({
      version: 0,
      state: { activeMode: 'history', colorFormat: 'hex', markdownResult: null },
    })
    expect(usePanelStore.getState().hasHydrated).toBe(false)

    await usePanelStore.persist.rehydrate()

    const after = usePanelStore.getState()
    // Gate opened AND the restored footer mode is applied in one shot, so the
    // panel can paint the right tab on first render without any interaction.
    expect(after.hasHydrated).toBe(true)
    expect(after.activeMode).toBe('history')
  })
})
