import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { MarkdownResult } from '@/types/markdown'

// The service worker runs chrome.* calls at module-eval time. Wire a chrome mock via
// vi.hoisted so it exists before the SW module is imported. onUpdated/onRemoved capture
// their listeners so tests can fire the events by hand.
const mocks = vi.hoisted(() => {
  const updatedListeners: ((id: number, info: { status?: string }) => void)[] = []
  const removedListeners: ((id: number) => void)[] = []
  const tabsCreate = vi.fn()
  const tabsRemove = vi.fn()
  const tabsGet = vi.fn()
  const tabsSendMessage = vi.fn()
  const executeScript = vi.fn()
  ;(globalThis as unknown as { chrome: unknown }).chrome = {
    sidePanel: { setPanelBehavior: vi.fn() },
    commands: { onCommand: { addListener: vi.fn() } },
    runtime: {
      onMessage: { addListener: vi.fn() },
      sendMessage: vi.fn(),
      getManifest: () => ({ content_scripts: [{ js: ['content.js'] }] }),
    },
    tabs: {
      create: tabsCreate,
      remove: tabsRemove,
      get: tabsGet,
      sendMessage: tabsSendMessage,
      query: vi.fn(),
      onUpdated: {
        addListener: (f: (id: number, info: { status?: string }) => void) => updatedListeners.push(f),
        removeListener: (f: (id: number, info: { status?: string }) => void) => {
          const i = updatedListeners.indexOf(f)
          if (i >= 0) updatedListeners.splice(i, 1)
        },
      },
      onRemoved: {
        addListener: (f: (id: number) => void) => removedListeners.push(f),
        removeListener: (f: (id: number) => void) => {
          const i = removedListeners.indexOf(f)
          if (i >= 0) removedListeners.splice(i, 1)
        },
      },
    },
    scripting: { executeScript },
    storage: { sync: { get: vi.fn(), set: vi.fn() } },
    action: { setBadgeText: vi.fn(), setBadgeBackgroundColor: vi.fn() },
  }
  return {
    updatedListeners,
    removedListeners,
    tabsCreate,
    tabsRemove,
    tabsGet,
    tabsSendMessage,
    executeScript,
  }
})

import { realTabRenderDeps, waitForTabComplete } from '@/background/service-worker'
import { MessageType } from '@/types/messages'

const md: MarkdownResult = {
  frontmatter: { title: 'T', url: 'https://x.test/', capturedAt: 'now', wordCount: 1 },
  markdown: '# T',
  fullDocument: '---\n---\n\n# T',
  stats: { headings: 1, links: 0, images: 0, tables: 0, codeBlocks: 0 },
}

beforeEach(() => {
  mocks.tabsCreate.mockReset()
  mocks.tabsRemove.mockReset()
  mocks.tabsGet.mockReset()
  mocks.tabsSendMessage.mockReset()
  mocks.executeScript.mockReset()
  mocks.updatedListeners.length = 0
  mocks.removedListeners.length = 0
  vi.spyOn(console, 'debug').mockImplementation(() => {})
})

describe('realTabRenderDeps.createTab', () => {
  it('opens a BACKGROUND tab (active:false) and returns its id', async () => {
    mocks.tabsCreate.mockResolvedValue({ id: 77 })
    const id = await realTabRenderDeps.createTab('https://x.test/')
    expect(id).toBe(77)
    // active:false is the "never steals focus" guarantee.
    expect(mocks.tabsCreate).toHaveBeenCalledWith({ url: 'https://x.test/', active: false })
  })

  it('throws when the created tab has no id (so renderPageInTab reports network)', async () => {
    mocks.tabsCreate.mockResolvedValue({})
    await expect(realTabRenderDeps.createTab('https://x.test/')).rejects.toThrow()
  })
})

describe('waitForTabComplete', () => {
  it('resolves when onUpdated fires status=complete for the tab, then removes its listeners', async () => {
    mocks.tabsGet.mockResolvedValue({ status: 'loading' })
    const p = waitForTabComplete(5)
    mocks.updatedListeners.forEach((f) => f(5, { status: 'complete' }))
    await expect(p).resolves.toBeUndefined()
    expect(mocks.updatedListeners).toHaveLength(0)
    expect(mocks.removedListeners).toHaveLength(0)
  })

  it('ignores complete events for OTHER tabs', async () => {
    mocks.tabsGet.mockResolvedValue({ status: 'loading' })
    const p = waitForTabComplete(5)
    mocks.updatedListeners.forEach((f) => f(999, { status: 'complete' }))
    // Still pending → now fire the right tab.
    mocks.updatedListeners.forEach((f) => f(5, { status: 'complete' }))
    await expect(p).resolves.toBeUndefined()
  })

  it('resolves immediately when the tab is already complete at subscription time', async () => {
    mocks.tabsGet.mockResolvedValue({ status: 'complete' })
    await expect(waitForTabComplete(9)).resolves.toBeUndefined()
  })

  it('resolves when the tab is removed (lets an abandoned render settle)', async () => {
    mocks.tabsGet.mockResolvedValue({ status: 'loading' })
    const p = waitForTabComplete(3)
    mocks.removedListeners.forEach((f) => f(3))
    await expect(p).resolves.toBeUndefined()
  })
})

describe('realTabRenderDeps.extractMarkdown', () => {
  it('pings then requests EXTRACT_MARKDOWN and returns the rendered-DOM result', async () => {
    mocks.tabsSendMessage.mockImplementation((_id: number, msg: { type: MessageType }) =>
      msg.type === MessageType.PING ? Promise.resolve({ alive: true }) : Promise.resolve(md),
    )
    const out = await realTabRenderDeps.extractMarkdown(11)
    expect(out).toEqual(md)
    expect(mocks.tabsSendMessage).toHaveBeenCalledWith(11, {
      type: MessageType.EXTRACT_MARKDOWN,
      payload: undefined,
    })
  })

  it('returns undefined when the content script is unreachable and cannot be injected', async () => {
    mocks.tabsSendMessage.mockRejectedValue(new Error('Could not establish connection'))
    mocks.executeScript.mockRejectedValue(new Error('Cannot access a chrome:// URL'))
    expect(await realTabRenderDeps.extractMarkdown(12)).toBeUndefined()
  })
})

describe('realTabRenderDeps.collectLinks', () => {
  it('returns the hrefs collected from the rendered DOM', async () => {
    mocks.executeScript.mockResolvedValue([{ result: ['https://x.test/a', 'https://x.test/b'] }])
    const links = await realTabRenderDeps.collectLinks(4)
    expect(links).toEqual(['https://x.test/a', 'https://x.test/b'])
    expect(mocks.executeScript).toHaveBeenCalledWith(
      expect.objectContaining({ target: { tabId: 4 } }),
    )
  })

  it('degrades to [] when scripting is blocked', async () => {
    mocks.executeScript.mockRejectedValue(new Error('blocked'))
    expect(await realTabRenderDeps.collectLinks(4)).toEqual([])
  })
})

describe('realTabRenderDeps.removeTab', () => {
  it('closes the tab', async () => {
    mocks.tabsRemove.mockResolvedValue(undefined)
    await realTabRenderDeps.removeTab(8)
    expect(mocks.tabsRemove).toHaveBeenCalledWith(8)
  })
})
