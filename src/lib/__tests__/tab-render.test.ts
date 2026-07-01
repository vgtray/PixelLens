import { describe, it, expect, vi } from 'vitest'
import { renderPageInTab, type TabRenderDeps } from '../tab-render'
import type { MarkdownResult } from '@/types/markdown'

// --- Helpers ------------------------------------------------------------------------

const md = (title = 'Home', body = '# Home\n\nHello'): MarkdownResult => ({
  frontmatter: { title, url: 'https://spa.example/', capturedAt: 'now', wordCount: 2 },
  markdown: body,
  fullDocument: `---\n---\n\n${body}`,
  stats: { headings: 1, links: 0, images: 0, tables: 0, codeBlocks: 0 },
})

// Records the order of dep calls so we can assert create→wait→extract→links→remove.
function tracingDeps(over: Partial<TabRenderDeps> = {}): {
  deps: TabRenderDeps
  calls: string[]
  removed: number[]
} {
  const calls: string[] = []
  const removed: number[] = []
  const deps: TabRenderDeps = {
    createTab: async () => {
      calls.push('createTab')
      return 42
    },
    waitForComplete: async () => {
      calls.push('waitForComplete')
    },
    extractMarkdown: async () => {
      calls.push('extractMarkdown')
      return md()
    },
    collectLinks: async () => {
      calls.push('collectLinks')
      return ['https://spa.example/about']
    },
    removeTab: async (id) => {
      calls.push('removeTab')
      removed.push(id)
    },
    // Instant render delay so tests never wait on the real 1200ms.
    delay: () => Promise.resolve(),
    ...over,
  }
  return { deps, calls, removed }
}

// --- renderPageInTab ----------------------------------------------------------------

describe('renderPageInTab — happy path', () => {
  it('opens a tab, renders, extracts the rendered DOM, collects links, closes it', async () => {
    const { deps, removed } = tracingDeps()
    const out = await renderPageInTab('https://spa.example/', deps)

    expect(out).toEqual({
      ok: true,
      markdown: md(),
      links: ['https://spa.example/about'],
    })
    // Tab is always closed with the id returned by createTab (no orphan).
    expect(removed).toEqual([42])
  })

  it('runs the steps in order: create → wait → extract → links → remove', async () => {
    const { deps, calls } = tracingDeps()
    await renderPageInTab('https://spa.example/', deps)
    expect(calls).toEqual([
      'createTab',
      'waitForComplete',
      'extractMarkdown',
      'collectLinks',
      'removeTab',
    ])
  })

  it('passes the render delay through before extracting', async () => {
    const delay = vi.fn().mockResolvedValue(undefined)
    const { deps } = tracingDeps({ delay, renderDelayMs: 900 })
    await renderPageInTab('https://spa.example/', deps)
    expect(delay).toHaveBeenCalledWith(900)
  })
})

describe('renderPageInTab — skips & failures', () => {
  it('returns `empty` when the rendered DOM yields no markdown, and still closes the tab', async () => {
    const { deps, removed } = tracingDeps({ extractMarkdown: async () => undefined })
    const out = await renderPageInTab('https://spa.example/', deps)
    expect(out).toEqual({ ok: false, reason: 'empty' })
    expect(removed).toEqual([42])
  })

  it('returns `network` when a render step throws, and still closes the tab', async () => {
    const { deps, removed } = tracingDeps({
      waitForComplete: async () => {
        throw new Error('navigation failed')
      },
    })
    const out = await renderPageInTab('https://spa.example/', deps)
    expect(out).toEqual({ ok: false, reason: 'network' })
    expect(removed).toEqual([42]) // cleanup guaranteed on error
  })

  it('returns `timeout` when the page never finishes loading, and still closes the tab', async () => {
    // waitForComplete never resolves → the hard per-page timeout must win and close the tab.
    const { deps, removed } = tracingDeps({
      waitForComplete: () => new Promise<void>(() => {}),
      timeoutMs: 10,
    })
    const out = await renderPageInTab('https://spa.example/', deps)
    expect(out).toEqual({ ok: false, reason: 'timeout' })
    expect(removed).toEqual([42])
  })

  it('returns `network` and closes NO tab when the tab could not be created', async () => {
    const removeTab = vi.fn().mockResolvedValue(undefined)
    const { deps } = tracingDeps({
      createTab: async () => {
        throw new Error('cannot create tab')
      },
      removeTab,
    })
    const out = await renderPageInTab('https://spa.example/', deps)
    expect(out).toEqual({ ok: false, reason: 'network' })
    expect(removeTab).not.toHaveBeenCalled() // no tab id → nothing to clean up
  })

  it('degrades to no links (still ok) when link collection fails', async () => {
    const { deps } = tracingDeps({
      collectLinks: async () => {
        throw new Error('scripting blocked')
      },
    })
    const out = await renderPageInTab('https://spa.example/', deps)
    expect(out).toEqual({ ok: true, markdown: md(), links: [] })
  })
})
