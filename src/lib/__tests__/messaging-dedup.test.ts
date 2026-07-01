import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { DesignSystem } from '@/types/design-system'

// Le service worker execute des chrome.* au chargement du module (setPanelBehavior,
// getManifest, onMessage.addListener). On cable un mock chrome via vi.hoisted AVANT
// l'import du module, en capturant le listener onMessage et en mockant
// chrome.storage.local (utilise par saveDesignSystem, deplace cote SW).
const mocks = vi.hoisted(() => {
  const onMessageAddListener = vi.fn()
  const runtimeSendMessage = vi.fn(() => Promise.resolve())
  const localGet = vi.fn(() => Promise.resolve({}))
  const localSet = vi.fn((_items: Record<string, unknown>) => Promise.resolve())
  ;(globalThis as unknown as { chrome: unknown }).chrome = {
    sidePanel: { setPanelBehavior: vi.fn(), open: vi.fn(() => Promise.resolve()) },
    commands: { onCommand: { addListener: vi.fn() } },
    runtime: {
      onMessage: { addListener: onMessageAddListener },
      sendMessage: runtimeSendMessage,
      getManifest: () => ({ content_scripts: [{ js: ['content.js'] }] }),
    },
    tabs: { query: vi.fn(), sendMessage: vi.fn() },
    scripting: { executeScript: vi.fn() },
    storage: {
      sync: { get: vi.fn(), set: vi.fn() },
      local: { get: localGet, set: localSet },
    },
    action: { setBadgeText: vi.fn(), setBadgeBackgroundColor: vi.fn() },
  }
  return { onMessageAddListener, runtimeSendMessage, localGet, localSet }
})

import '@/background/service-worker'
import { MessageType } from '@/types/messages'

type Listener = (
  msg: { type: MessageType; payload: unknown },
  sender: chrome.runtime.MessageSender,
  sendResponse: (r: unknown) => void,
) => unknown

// Le SW enregistre son gros handler une fois au chargement du module.
const listener = mocks.onMessageAddListener.mock.calls[0][0] as Listener
const sender = {} as chrome.runtime.MessageSender
const flush = () => new Promise<void>((r) => setTimeout(r, 0))

const mockDS: DesignSystem = {
  colors: [],
  typography: [],
  spacing: [],
  shadows: [],
  borderRadius: [],
  metadata: { url: 'https://ex.com', title: 'T', scannedAt: '2026-07-01' },
}

beforeEach(() => {
  mocks.runtimeSendMessage.mockClear()
  mocks.localGet.mockClear()
  mocks.localSet.mockClear()
  mocks.localGet.mockResolvedValue({})
  vi.spyOn(console, 'debug').mockImplementation(() => {})
})

describe('service worker — dedup du messaging (une seule voie)', () => {
  it('ne re-broadcast PAS SCAN_COMPLETE (le panel ecoute en direct)', async () => {
    listener({ type: MessageType.SCAN_COMPLETE, payload: { designSystem: mockDS } }, sender, vi.fn())
    await flush()
    // Aucun relais runtime.sendMessage : sinon le panel traiterait le scan 2x.
    expect(mocks.runtimeSendMessage).not.toHaveBeenCalled()
  })

  it('persiste un scan termine exactement une fois, meme panel ferme', async () => {
    listener({ type: MessageType.SCAN_COMPLETE, payload: { designSystem: mockDS } }, sender, vi.fn())
    await flush()
    // saveDesignSystem centralise cote SW (toujours vivant) => un seul write.
    expect(mocks.localSet).toHaveBeenCalledTimes(1)
    const arg = mocks.localSet.mock.calls[0][0]
    expect(arg['pixellens_scans'] as unknown[]).toHaveLength(1)
  })

  it('ne traite PAS SCAN_PROGRESS (ni relais ni persistance)', async () => {
    listener({ type: MessageType.SCAN_PROGRESS, payload: { progress: 50, phase: 'x' } }, sender, vi.fn())
    await flush()
    expect(mocks.runtimeSendMessage).not.toHaveBeenCalled()
    expect(mocks.localSet).not.toHaveBeenCalled()
  })

  it('ne re-broadcast PAS CRAWL_COMPLETE (evite le double clonage du document)', async () => {
    listener(
      { type: MessageType.CRAWL_COMPLETE, payload: { result: { document: 'x' } } },
      sender,
      vi.fn(),
    )
    await flush()
    expect(mocks.runtimeSendMessage).not.toHaveBeenCalled()
  })

  it('ne re-broadcast PAS CRAWL_PROGRESS', async () => {
    listener(
      { type: MessageType.CRAWL_PROGRESS, payload: { done: 1, total: 2, currentUrl: 'u', skipped: 0 } },
      sender,
      vi.fn(),
    )
    await flush()
    expect(mocks.runtimeSendMessage).not.toHaveBeenCalled()
  })
})
