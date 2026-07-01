// PixelLens — Background Service Worker

import { MessageType } from '@/types/messages'
import type { MessagePayloadMap } from '@/types/messages'
import { saveDesignSystem } from '@/lib/storage'

// Prevent side panel from opening on action click (we control it manually)
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false })

// Track inspect mode per tab
const activeTabState = new Map<number, boolean>()

// Bundled content-script path(s), read from the (built) manifest so they survive
// the bundler's output hashing. Used to re-inject the content script on tabs
// where the declarative injection never ran or was torn down by MV3.
const CONTENT_SCRIPT_FILES =
  (chrome.runtime.getManifest() as chrome.runtime.ManifestV3).content_scripts?.[0]?.js ?? []

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-inspect') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.id) {
      toggleInspect(tab.id)
    }
  }
})

interface IncomingMessage {
  type: MessageType
  payload: unknown
}

// Message routing between content script <-> side panel
chrome.runtime.onMessage.addListener((message: IncomingMessage, sender, sendResponse) => {
  const { type, payload } = message

  switch (type) {
    case MessageType.TOGGLE_INSPECT: {
      // toggleInspect now reports whether the content script actually received
      // the toggle (it fails on chrome://, the Web Store, the PDF viewer, …).
      // Relay that back so the popup can surface "Page not supported" instead of
      // a silent "ON" badge.
      const senderTabId = sender.tab?.id
      if (senderTabId) {
        toggleInspect(senderTabId).then((delivered) => sendResponse({ success: delivered }))
      } else {
        // Message from popup — query active tab.
        chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
          const delivered = tab?.id ? await toggleInspect(tab.id) : false
          sendResponse({ success: delivered })
        })
      }
      return true // async response
    }

    case MessageType.ELEMENT_SELECTED: {
      const tabId = sender.tab?.id
      if (tabId) {
        // Ensure side panel is open before forwarding
        chrome.sidePanel.open({ tabId }).catch((err) => console.debug('[PixelLens]', err.message))
        // Small delay to let React mount, then forward
        setTimeout(() => {
          chrome.runtime.sendMessage({
            type: MessageType.ELEMENT_SELECTED,
            payload,
          }).catch((err) => console.debug('[PixelLens]', err.message))
        }, 300)
      }
      sendResponse({ received: true })
      break
    }

    case MessageType.SCAN_PAGE: {
      // Make sure the content script is actually alive on the active tab before
      // forwarding — on a tab restored after a Chrome restart (or one that
      // pre-dates the extension being enabled) the declarative injection never
      // ran, so a plain forward would silently fail and the panel would look
      // dead. ensureContentScriptAndForward pings, re-injects if needed, then
      // forwards, and reports real delivery success back to the panel.
      ensureContentScriptAndForward(type, payload).then((delivered) => {
        sendResponse({ success: delivered })
      })
      return true // async response
    }

    case MessageType.SCAN_COMPLETE: {
      // SINGLE source of truth for persistence. A content-script broadcast reaches
      // BOTH the service worker AND the open side panel, so the worker must NOT
      // re-broadcast (the panel already listens directly) — doing so handled every
      // scan twice: duplicated in history and written twice to storage. Instead the
      // worker — always alive, even when the panel is closed — persists the scan
      // exactly once here; the panel merely updates its in-memory store on receipt.
      const { designSystem } = payload as MessagePayloadMap[MessageType.SCAN_COMPLETE]
      saveDesignSystem(designSystem)
        .then(() => sendResponse({ success: true }))
        .catch((err) => {
          console.debug('[PixelLens]', (err as Error).message)
          sendResponse({ success: false })
        })
      return true // keep the worker alive until the write settles
    }

    // SCAN_PROGRESS is intentionally NOT handled here: the content script broadcasts
    // it and the side panel listens directly (relaying it would double-deliver).

    case MessageType.EXTRACT_MARKDOWN: {
      // Route extraction to the active tab's content script and relay the result back.
      // Every path MUST call sendResponse, otherwise the UI-side promise rejects (MV3)
      // and the panel/popup shows a generic failure instead of "page not supported".
      // We answer `undefined` when there is no usable tab or the content script is
      // unreachable (chrome://, Web Store, PDF viewer, script not injected).
      chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
        if (!tab?.id) {
          sendResponse(undefined)
          return
        }
        try {
          const result = await chrome.tabs.sendMessage(tab.id, { type, payload })
          sendResponse(result)
        } catch (err) {
          console.debug('[PixelLens]', (err as Error).message)
          sendResponse(undefined)
        }
      })
      return true // async response
    }

    case MessageType.CRAWL_SITE: {
      // Same hardening as SCAN_PAGE: ping / re-inject the content script (MV3 may
      // have torn it down) before forwarding the crawl request, and report real
      // delivery so the panel can surface "page not supported" on chrome:// etc.
      // The content script runs the crawl and streams CRAWL_PROGRESS/CRAWL_COMPLETE.
      ensureContentScriptAndForward(type, payload).then((delivered) => {
        sendResponse({ success: delivered })
      })
      return true // async response
    }

    case MessageType.STOP_CRAWL: {
      // Relay the stop to the active tab's content script (the one running the crawl).
      ensureContentScriptAndForward(type, payload).then((delivered) => {
        sendResponse({ success: delivered })
      })
      return true // async response
    }

    // CRAWL_PROGRESS / CRAWL_COMPLETE are intentionally NOT handled here: the content
    // script broadcasts them and the side panel listens directly. Relaying them
    // through the worker would double-deliver the (potentially multi-MB) document.

    case MessageType.TOGGLE_GRID:
    case MessageType.TOGGLE_MEASURE: {
      // Same hardening as SCAN_PAGE: ping + re-inject the content script before
      // forwarding (MV3 may have torn it down or never injected it), and report
      // the real delivery result instead of swallowing the failure.
      ensureContentScriptAndForward(type, payload).then((delivered) => {
        sendResponse({ success: delivered })
      })
      return true // async response
    }
  }
})

// Exported for unit tests (badge is only set on confirmed delivery).
export async function toggleInspect(tabId: number): Promise<boolean> {
  const current = activeTabState.get(tabId) ?? false
  const next = !current

  // Ping + re-inject before claiming the toggle worked. On pages where injection
  // is forbidden (chrome://, Web Store, PDF viewer, …) delivery fails: we must
  // NOT flip the per-tab state nor light up the "ON" badge, and we report the
  // failure so the caller can tell the user the page is not supported.
  const delivered = await ensureContentScriptOnTab(tabId, MessageType.TOGGLE_INSPECT, {
    active: next,
  })
  if (!delivered) return false

  activeTabState.set(tabId, next)

  // Badge reflects the (now confirmed) live state.
  chrome.action.setBadgeText({ text: next ? 'ON' : '', tabId })
  chrome.action.setBadgeBackgroundColor({ color: '#6366F1', tabId })

  // Open side panel when activating.
  if (next) {
    chrome.sidePanel.open({ tabId }).catch((err) => console.debug('[PixelLens]', err.message))
  }
  return true
}

// Ensures a live content script on a SPECIFIC tab (re-injecting if MV3 tore it
// down), then forwards the message. Returns whether it was actually delivered.
// This is the shared primitive behind both the active-tab helper below and the
// per-tab inspect toggle.
export async function ensureContentScriptOnTab(
  tabId: number,
  type: MessageType,
  payload: unknown,
): Promise<boolean> {
  if (!(await pingContentScript(tabId))) {
    if (!(await injectContentScript(tabId))) return false
  }
  try {
    await chrome.tabs.sendMessage(tabId, { type, payload })
    return true
  } catch (err) {
    console.debug('[PixelLens]', (err as Error).message)
    return false
  }
}

// Returns true when the content script answers a PING on this tab.
export async function pingContentScript(tabId: number): Promise<boolean> {
  try {
    const res = await chrome.tabs.sendMessage(tabId, { type: MessageType.PING, payload: undefined })
    return (res as { alive?: boolean } | undefined)?.alive === true
  } catch {
    // No receiving end => content script not present on this tab.
    return false
  }
}

// Programmatically (re)injects the content script. Returns false on pages where
// injection is not allowed (chrome://, Web Store, PDF viewer, etc.).
export async function injectContentScript(tabId: number): Promise<boolean> {
  if (CONTENT_SCRIPT_FILES.length === 0) return false
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: CONTENT_SCRIPT_FILES })
    return true
  } catch (err) {
    console.debug('[PixelLens]', (err as Error).message)
    return false
  }
}

// Ensures a live content script on the active tab (re-injecting if MV3 tore it
// down), then forwards the message. Returns whether it was actually delivered.
export async function ensureContentScriptAndForward(
  type: MessageType,
  payload: unknown,
): Promise<boolean> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) return false
  return ensureContentScriptOnTab(tab.id, type, payload)
}
