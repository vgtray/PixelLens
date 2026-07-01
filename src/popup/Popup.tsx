import { useState, useEffect } from 'react'
import {
  MagnifyingGlass,
  Scan,
  ClockCounterClockwise,
  Keyboard,
  GearSix,
  MarkdownLogo,
  GlobeHemisphereWest,
  CircleNotch,
  Check,
} from '@phosphor-icons/react'
import { MessageType } from '@/types/messages'
import { sendMessage } from '@/lib/messaging'
import { setPanelInitialMode } from '@/lib/storage'
import type { MarkdownResult } from '@/types/markdown'
import PixelLensLogo from '@/sidepanel/components/PixelLensLogo'

type InspectStatus = 'idle' | 'active' | 'unsupported'
type MarkdownStatus = 'idle' | 'working' | 'done' | 'unsupported' | 'failed'

function isMac(): boolean {
  return typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent)
}

// Fallback labels matching the manifest suggested_key (mac override included),
// shown until chrome.commands.getAll() reports the real (possibly remapped) bindings.
function defaultShortcuts() {
  return isMac()
    ? { inspect: '⌘⇧L', popup: '⌘⇧P' }
    : { inspect: 'Ctrl+Shift+L', popup: 'Ctrl+Shift+P' }
}

export function Popup() {
  const [status, setStatus] = useState<InspectStatus>('idle')
  const [currentUrl, setCurrentUrl] = useState('')
  const [mdStatus, setMdStatus] = useState<MarkdownStatus>('idle')
  // The active tab id, captured on mount so the click handlers can call
  // chrome.sidePanel.open({ tabId }) synchronously — no awaited query is
  // allowed before the open() or Chrome drops the user gesture.
  const [tabId, setTabId] = useState<number | null>(null)
  const [shortcuts, setShortcuts] = useState(defaultShortcuts)

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab?.id != null) setTabId(tab.id)
      if (tab?.url) {
        try {
          setCurrentUrl(new URL(tab.url).hostname)
        } catch {
          setCurrentUrl(tab.url)
        }
      }
    })
  }, [])

  // Show the shortcuts actually bound (the user may remap them in
  // chrome://extensions/shortcuts); fall back to the manifest defaults.
  useEffect(() => {
    chrome.commands?.getAll?.((cmds) => {
      const find = (name: string) => cmds.find((c) => c.name === name)?.shortcut || ''
      const fallback = defaultShortcuts()
      setShortcuts({
        inspect: find('toggle-inspect') || fallback.inspect,
        popup: find('_execute_action') || fallback.popup,
      })
    })
  }, [])

  async function handleInspect() {
    const next: InspectStatus = status === 'active' ? 'idle' : 'active'
    // Await the background's real delivery result. On unsupported pages
    // (chrome://, Web Store, PDF viewer, …) the content script can't be reached,
    // so we surface "Page not supported" instead of flipping to an "ON" state —
    // mirroring the markdown `mdStatus` unsupported path.
    const res = await sendMessage(MessageType.TOGGLE_INSPECT, { active: next === 'active' })
    if (!res?.success) {
      setStatus('unsupported')
      setTimeout(() => setStatus('idle'), 2000)
      return
    }
    setStatus(next)
    if (next === 'active') window.close()
  }

  async function handleScan() {
    // Open the side panel DIRECTLY here: this click is the user gesture Chrome
    // requires for chrome.sidePanel.open(). The old OPEN_SIDE_PANEL hop to the
    // service worker ran the open() after an async message — outside the
    // gesture — so Chrome refused it and nothing opened. .catch() swallows the
    // rejection on pages where a side panel can't be shown (never throws).
    if (tabId != null) {
      chrome.sidePanel.open({ tabId }).catch(() => {})
    }
    // Land the panel on the Scan view (SCAN_COMPLETE also sets it, but this
    // shows scan progress right away instead of the last-used view).
    await setPanelInitialMode('scan')
    // Kick off the scan. The service worker pings / re-injects the content
    // script and forwards it, so this still works on tabs MV3 tore down.
    chrome.runtime.sendMessage({
      type: MessageType.SCAN_PAGE,
      payload: undefined,
    })
    window.close()
  }

  async function handleCopyMarkdown() {
    if (mdStatus === 'working') return
    setMdStatus('working')
    try {
      const result: MarkdownResult | undefined = await sendMessage(
        MessageType.EXTRACT_MARKDOWN,
        undefined,
      )
      if (!result) {
        // `undefined` = content script unreachable -> page not supported (aligns w/ side panel).
        setMdStatus('unsupported')
        setTimeout(() => setMdStatus('idle'), 2000)
        return
      }
      await navigator.clipboard.writeText(result.fullDocument)
      setMdStatus('done')
      setTimeout(() => setMdStatus('idle'), 1800)
    } catch {
      // A rejected promise is a genuine failure, not an unsupported page.
      setMdStatus('failed')
      setTimeout(() => setMdStatus('idle'), 2000)
    }
  }

  async function handleLastScan() {
    // Same gesture rule as handleScan: open synchronously here, never via a SW
    // message hop. App.tsx rebuilds the last design system from pixellens_scans
    // on mount, so routing the panel to the Design System view shows it.
    if (tabId != null) {
      chrome.sidePanel.open({ tabId }).catch(() => {})
    }
    await setPanelInitialMode('design-system')
    window.close()
  }

  async function handleCrawl() {
    // Same gesture rule as handleScan: open the panel synchronously here, then route
    // it to the Crawl view. We do NOT auto-start the crawl — the user confirms the
    // bounds by clicking "Crawl entire site" in the panel.
    if (tabId != null) {
      chrome.sidePanel.open({ tabId }).catch(() => {})
    }
    await setPanelInitialMode('crawl')
    window.close()
  }

  async function handleSettings() {
    // Same gesture rule as handleScan/handleLastScan: open the panel synchronously
    // here, never via a SW message hop, then route it to the Settings view.
    if (tabId != null) {
      chrome.sidePanel.open({ tabId }).catch(() => {})
    }
    await setPanelInitialMode('settings')
    window.close()
  }

  const mdLabel =
    mdStatus === 'working'
      ? 'Converting…'
      : mdStatus === 'done'
        ? 'Copied!'
        : mdStatus === 'unsupported'
          ? 'Page not supported'
          : mdStatus === 'failed'
            ? 'Conversion failed'
            : 'Copy as Markdown'

  return (
    <div className="popup">
      {/* Header */}
      <header className="popup-header">
        <div className="popup-logo">
          <PixelLensLogo size={20} />
          <span className="popup-title">PixelLens</span>
        </div>
        {currentUrl && (
          <span className="popup-url">{currentUrl}</span>
        )}
      </header>

      {/* Status */}
      <div className="popup-status">
        <div className={`popup-status-dot ${status === 'active' ? 'active' : ''}`} />
        <span>
          {status === 'active'
            ? 'Inspecting'
            : status === 'unsupported'
              ? 'Page not supported'
              : 'Ready'}
        </span>
      </div>

      {/* Actions */}
      <div className="popup-actions">
        <button className="popup-btn popup-btn-primary" onClick={handleInspect}>
          <MagnifyingGlass size={18} weight="bold" />
          <span>
            {status === 'active'
              ? 'Stop Inspect'
              : status === 'unsupported'
                ? 'Page not supported'
                : 'Start Inspect'}
          </span>
        </button>

        <button className="popup-btn" onClick={handleScan}>
          <Scan size={18} weight="bold" />
          <span>Scan this page</span>
        </button>

        <button className="popup-btn" onClick={handleCrawl}>
          <GlobeHemisphereWest size={18} weight="bold" />
          <span>Crawl site to Markdown</span>
        </button>

        <button
          className="popup-btn"
          onClick={handleCopyMarkdown}
          disabled={mdStatus === 'working'}
          style={
            mdStatus === 'done'
              ? { background: 'var(--color-success)', borderColor: 'var(--color-success)', color: '#fff' }
              : mdStatus === 'working'
                ? { opacity: 0.75 }
                : undefined
          }
        >
          {mdStatus === 'working' ? (
            <CircleNotch size={18} weight="bold" className="animate-spin" />
          ) : mdStatus === 'done' ? (
            <Check size={18} weight="bold" />
          ) : (
            <MarkdownLogo size={18} weight="bold" />
          )}
          <span>{mdLabel}</span>
        </button>

        <button className="popup-btn" onClick={handleLastScan}>
          <ClockCounterClockwise size={18} weight="bold" />
          <span>Last scan</span>
        </button>
      </div>

      {/* Shortcuts */}
      <div className="popup-shortcuts">
        <div className="popup-shortcuts-title">
          <Keyboard size={14} weight="bold" />
          <span>Shortcuts</span>
        </div>
        <div className="popup-shortcut-row">
          <span>Toggle inspect</span>
          <kbd>{shortcuts.inspect}</kbd>
        </div>
        <div className="popup-shortcut-row">
          <span>Open popup</span>
          <kbd>{shortcuts.popup}</kbd>
        </div>
      </div>

      {/* Footer */}
      <footer className="popup-footer">
        <button className="popup-footer-btn" aria-label="Settings" title="Settings" onClick={handleSettings}>
          <GearSix size={16} weight="bold" />
        </button>
        <span className="popup-version">v1.0.0</span>
      </footer>
    </div>
  )
}
