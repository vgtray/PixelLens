// PixelLens — Background Service Worker

import { MessageType } from '@/types/messages'
import type { MessagePayloadMap } from '@/types/messages'

// Prevent side panel from opening on action click (we control it manually)
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false })

// Track inspect mode per tab
const activeTabState = new Map<number, boolean>()

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
      const tabId = sender.tab?.id
      if (tabId) {
        toggleInspect(tabId)
      } else {
        // Message from popup — query active tab
        chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
          if (tab?.id) toggleInspect(tab.id)
        })
      }
      sendResponse({ success: true })
      break
    }

    case MessageType.OPEN_SIDE_PANEL: {
      handleOpenSidePanel(sender)
      sendResponse({ success: true })
      break
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
      // Forward scan request to content script
      forwardToActiveTab(type, payload)
      sendResponse({ success: true })
      break
    }

    case MessageType.SCAN_PROGRESS:
    case MessageType.SCAN_COMPLETE: {
      // Forward scan results to the side panel
      chrome.runtime.sendMessage({ type, payload }).catch((err) => console.debug('[PixelLens]', err.message))
      sendResponse({ success: true })
      break
    }

    case MessageType.TOGGLE_GRID:
    case MessageType.TOGGLE_MEASURE: {
      forwardToActiveTab(type, payload)
      sendResponse({ success: true })
      break
    }

    case MessageType.GET_PREFERENCES: {
      chrome.storage.sync.get('pixellens_preferences', (result) => {
        sendResponse(result['pixellens_preferences'] || {
          colorFormat: 'hex',
          gridSize: 8,
          theme: 'dark',
        })
      })
      return true // async response
    }

    case MessageType.SET_PREFERENCES: {
      const prefs = payload as MessagePayloadMap[MessageType.SET_PREFERENCES]
      chrome.storage.sync.set({ pixellens_preferences: prefs.preferences })
      sendResponse({ success: true })
      break
    }
  }
})

async function toggleInspect(tabId: number) {
  const current = activeTabState.get(tabId) ?? false
  const next = !current
  activeTabState.set(tabId, next)

  // Update badge
  chrome.action.setBadgeText({
    text: next ? 'ON' : '',
    tabId,
  })
  chrome.action.setBadgeBackgroundColor({
    color: '#6366F1',
    tabId,
  })

  // Send toggle to content script
  chrome.tabs.sendMessage(tabId, {
    type: MessageType.TOGGLE_INSPECT,
    payload: { active: next },
  }).catch((err) => console.debug('[PixelLens]', err.message))

  // Open side panel when activating
  if (next) {
    chrome.sidePanel.open({ tabId }).catch((err) => console.debug('[PixelLens]', err.message))
  }
}

async function forwardToActiveTab(type: MessageType, payload: unknown) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type, payload }).catch((err) => console.debug('[PixelLens]', err.message))
  }
}

async function handleOpenSidePanel(sender: chrome.runtime.MessageSender) {
  const tabId = sender.tab?.id
  if (tabId) {
    chrome.sidePanel.open({ tabId }).catch((err) => console.debug('[PixelLens]', err.message))
  } else {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.id) {
      chrome.sidePanel.open({ tabId: tab.id }).catch((err) => console.debug('[PixelLens]', err.message))
    }
  }
}
