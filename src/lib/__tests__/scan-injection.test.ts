import { describe, it, expect, beforeEach, vi } from 'vitest'

// The service worker runs chrome.* calls at module-eval time (setPanelBehavior,
// getManifest, addListener). Wire a chrome mock via vi.hoisted so it exists
// before the SW module is imported. getManifest reports a content script path
// so CONTENT_SCRIPT_FILES resolves to ['content.js'].
const mocks = vi.hoisted(() => {
  const tabsQuery = vi.fn()
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
    tabs: { query: tabsQuery, sendMessage: tabsSendMessage },
    scripting: { executeScript },
    storage: { sync: { get: vi.fn(), set: vi.fn() } },
    action: { setBadgeText: vi.fn(), setBadgeBackgroundColor: vi.fn() },
  }
  return { tabsQuery, tabsSendMessage, executeScript }
})

import {
  ensureContentScriptAndForward,
  pingContentScript,
} from '@/background/service-worker'
import { MessageType } from '@/types/messages'

beforeEach(() => {
  mocks.tabsQuery.mockReset()
  mocks.tabsSendMessage.mockReset()
  mocks.executeScript.mockReset()
  vi.spyOn(console, 'debug').mockImplementation(() => {})
})

describe('pingContentScript', () => {
  it('returns true when the content script answers alive', async () => {
    mocks.tabsSendMessage.mockResolvedValue({ alive: true })
    expect(await pingContentScript(1)).toBe(true)
  })

  it('returns false when there is no receiving end', async () => {
    mocks.tabsSendMessage.mockRejectedValue(new Error('Could not establish connection'))
    expect(await pingContentScript(1)).toBe(false)
  })
})

describe('ensureContentScriptAndForward', () => {
  it('forwards directly when the content script is already alive', async () => {
    mocks.tabsQuery.mockResolvedValue([{ id: 1 }])
    mocks.tabsSendMessage.mockImplementation((_tabId: number, msg: { type: MessageType }) =>
      msg.type === MessageType.PING ? Promise.resolve({ alive: true }) : Promise.resolve({}),
    )

    const ok = await ensureContentScriptAndForward(MessageType.SCAN_PAGE, undefined)

    expect(ok).toBe(true)
    expect(mocks.executeScript).not.toHaveBeenCalled()
    expect(mocks.tabsSendMessage).toHaveBeenCalledWith(1, {
      type: MessageType.SCAN_PAGE,
      payload: undefined,
    })
  })

  it('re-injects the content script then forwards when it is missing', async () => {
    mocks.tabsQuery.mockResolvedValue([{ id: 7 }])
    mocks.tabsSendMessage
      .mockRejectedValueOnce(new Error('Could not establish connection')) // PING
      .mockResolvedValueOnce({}) // SCAN_PAGE
    mocks.executeScript.mockResolvedValue([])

    const ok = await ensureContentScriptAndForward(MessageType.SCAN_PAGE, undefined)

    expect(ok).toBe(true)
    expect(mocks.executeScript).toHaveBeenCalledWith({
      target: { tabId: 7 },
      files: ['content.js'],
    })
    expect(mocks.tabsSendMessage).toHaveBeenLastCalledWith(7, {
      type: MessageType.SCAN_PAGE,
      payload: undefined,
    })
  })

  it('returns false when injection is not allowed (e.g. chrome:// page)', async () => {
    mocks.tabsQuery.mockResolvedValue([{ id: 2 }])
    mocks.tabsSendMessage.mockRejectedValue(new Error('Could not establish connection'))
    mocks.executeScript.mockRejectedValue(new Error('Cannot access a chrome:// URL'))

    const ok = await ensureContentScriptAndForward(MessageType.SCAN_PAGE, undefined)

    expect(ok).toBe(false)
    // Only the PING was attempted; the scan was never forwarded.
    expect(mocks.tabsSendMessage).toHaveBeenCalledTimes(1)
  })

  it('returns false when there is no active tab', async () => {
    mocks.tabsQuery.mockResolvedValue([])

    const ok = await ensureContentScriptAndForward(MessageType.SCAN_PAGE, undefined)

    expect(ok).toBe(false)
    expect(mocks.tabsSendMessage).not.toHaveBeenCalled()
    expect(mocks.executeScript).not.toHaveBeenCalled()
  })
})
