import { describe, it, expect, beforeEach, vi } from 'vitest'

// The service worker runs chrome.* calls at module-eval time (setPanelBehavior,
// getManifest, addListener). Wire a chrome mock via vi.hoisted so it exists
// before the SW module is imported. getManifest reports a content script path
// so CONTENT_SCRIPT_FILES resolves to ['content.js'].
const mocks = vi.hoisted(() => {
  const tabsQuery = vi.fn()
  const tabsSendMessage = vi.fn()
  const executeScript = vi.fn()
  const setBadgeText = vi.fn()
  const setBadgeBackgroundColor = vi.fn()
  const sidePanelOpen = vi.fn(() => Promise.resolve())
  ;(globalThis as unknown as { chrome: unknown }).chrome = {
    sidePanel: { setPanelBehavior: vi.fn(), open: sidePanelOpen },
    commands: { onCommand: { addListener: vi.fn() } },
    runtime: {
      onMessage: { addListener: vi.fn() },
      sendMessage: vi.fn(),
      getManifest: () => ({ content_scripts: [{ js: ['content.js'] }] }),
    },
    tabs: { query: tabsQuery, sendMessage: tabsSendMessage },
    scripting: { executeScript },
    storage: { sync: { get: vi.fn(), set: vi.fn() } },
    action: { setBadgeText, setBadgeBackgroundColor },
  }
  return { tabsQuery, tabsSendMessage, executeScript, setBadgeText, setBadgeBackgroundColor, sidePanelOpen }
})

import { ensureContentScriptOnTab, toggleInspect } from '@/background/service-worker'
import { MessageType } from '@/types/messages'

beforeEach(() => {
  mocks.tabsQuery.mockReset()
  mocks.tabsSendMessage.mockReset()
  mocks.executeScript.mockReset()
  mocks.setBadgeText.mockReset()
  mocks.setBadgeBackgroundColor.mockReset()
  mocks.sidePanelOpen.mockReset()
  mocks.sidePanelOpen.mockResolvedValue(undefined)
  vi.spyOn(console, 'debug').mockImplementation(() => {})
})

describe('ensureContentScriptOnTab', () => {
  it('forwards directly when the content script is already alive', async () => {
    mocks.tabsSendMessage.mockImplementation((_tabId: number, msg: { type: MessageType }) =>
      msg.type === MessageType.PING ? Promise.resolve({ alive: true }) : Promise.resolve({}),
    )

    const ok = await ensureContentScriptOnTab(5, MessageType.TOGGLE_INSPECT, { active: true })

    expect(ok).toBe(true)
    expect(mocks.executeScript).not.toHaveBeenCalled()
    expect(mocks.tabsSendMessage).toHaveBeenCalledWith(5, {
      type: MessageType.TOGGLE_INSPECT,
      payload: { active: true },
    })
  })

  it('re-injects then forwards when the content script is missing', async () => {
    mocks.tabsSendMessage
      .mockRejectedValueOnce(new Error('Could not establish connection')) // PING
      .mockResolvedValueOnce({}) // TOGGLE_INSPECT
    mocks.executeScript.mockResolvedValue([])

    const ok = await ensureContentScriptOnTab(8, MessageType.TOGGLE_INSPECT, { active: true })

    expect(ok).toBe(true)
    expect(mocks.executeScript).toHaveBeenCalledWith({ target: { tabId: 8 }, files: ['content.js'] })
    expect(mocks.tabsSendMessage).toHaveBeenLastCalledWith(8, {
      type: MessageType.TOGGLE_INSPECT,
      payload: { active: true },
    })
  })

  it('returns false when injection is forbidden (e.g. chrome:// page)', async () => {
    mocks.tabsSendMessage.mockRejectedValue(new Error('Could not establish connection'))
    mocks.executeScript.mockRejectedValue(new Error('Cannot access a chrome:// URL'))

    const ok = await ensureContentScriptOnTab(2, MessageType.TOGGLE_INSPECT, { active: true })

    expect(ok).toBe(false)
    // Only the PING was attempted; the toggle was never forwarded.
    expect(mocks.tabsSendMessage).toHaveBeenCalledTimes(1)
  })
})

describe('toggleInspect badge gating', () => {
  it('sets the "ON" badge and opens the side panel only after confirmed delivery', async () => {
    mocks.tabsSendMessage.mockImplementation((_tabId: number, msg: { type: MessageType }) =>
      msg.type === MessageType.PING ? Promise.resolve({ alive: true }) : Promise.resolve({}),
    )

    const delivered = await toggleInspect(10)

    expect(delivered).toBe(true)
    expect(mocks.setBadgeText).toHaveBeenCalledWith({ text: 'ON', tabId: 10 })
    expect(mocks.sidePanelOpen).toHaveBeenCalledWith({ tabId: 10 })
  })

  it('does NOT set any badge when the page is unsupported (injection forbidden)', async () => {
    mocks.tabsSendMessage.mockRejectedValue(new Error('Could not establish connection'))
    mocks.executeScript.mockRejectedValue(new Error('Cannot access a chrome:// URL'))

    const delivered = await toggleInspect(11)

    expect(delivered).toBe(false)
    expect(mocks.setBadgeText).not.toHaveBeenCalled()
    expect(mocks.setBadgeBackgroundColor).not.toHaveBeenCalled()
    expect(mocks.sidePanelOpen).not.toHaveBeenCalled()
  })

  it('clears the badge (text: "") when toggling inspect back off on a live page', async () => {
    mocks.tabsSendMessage.mockImplementation((_tabId: number, msg: { type: MessageType }) =>
      msg.type === MessageType.PING ? Promise.resolve({ alive: true }) : Promise.resolve({}),
    )

    // First toggle -> ON, second toggle on the same tab -> OFF.
    await toggleInspect(12)
    mocks.setBadgeText.mockClear()
    const delivered = await toggleInspect(12)

    expect(delivered).toBe(true)
    expect(mocks.setBadgeText).toHaveBeenCalledWith({ text: '', tabId: 12 })
  })
})
