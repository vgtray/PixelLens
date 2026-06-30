import { useState, useEffect } from 'react'
import {
  MagnifyingGlass,
  Scan,
  ClockCounterClockwise,
  Keyboard,
  GearSix,
  MarkdownLogo,
  CircleNotch,
  Check,
} from '@phosphor-icons/react'
import { MessageType } from '@/types/messages'
import { sendMessage } from '@/lib/messaging'
import type { MarkdownResult } from '@/types/markdown'

type InspectStatus = 'idle' | 'active'
type MarkdownStatus = 'idle' | 'working' | 'done' | 'unsupported' | 'failed'

export function Popup() {
  const [status, setStatus] = useState<InspectStatus>('idle')
  const [currentUrl, setCurrentUrl] = useState('')
  const [mdStatus, setMdStatus] = useState<MarkdownStatus>('idle')

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab?.url) {
        try {
          setCurrentUrl(new URL(tab.url).hostname)
        } catch {
          setCurrentUrl(tab.url)
        }
      }
    })
  }, [])

  async function handleInspect() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.id) {
      const next = status === 'active' ? 'idle' : 'active'
      chrome.runtime.sendMessage({
        type: MessageType.TOGGLE_INSPECT,
        payload: { active: next === 'active' },
      })
      setStatus(next)
      if (next === 'active') window.close()
    }
  }

  async function handleScan() {
    chrome.runtime.sendMessage({
      type: MessageType.SCAN_PAGE,
      payload: undefined,
    })
    chrome.runtime.sendMessage({
      type: MessageType.OPEN_SIDE_PANEL,
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
    chrome.runtime.sendMessage({
      type: MessageType.OPEN_SIDE_PANEL,
      payload: undefined,
    })
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
          <svg width="20" height="20" viewBox="0 0 128 128" fill="none">
            <circle cx="56" cy="56" r="24" stroke="#6366F1" strokeWidth="6" />
            <line x1="73" y1="73" x2="100" y2="100" stroke="#6366F1" strokeWidth="6" strokeLinecap="round" />
            <circle cx="56" cy="56" r="8" fill="#818CF8" />
          </svg>
          <span className="popup-title">PixelLens</span>
        </div>
        {currentUrl && (
          <span className="popup-url">{currentUrl}</span>
        )}
      </header>

      {/* Status */}
      <div className="popup-status">
        <div className={`popup-status-dot ${status === 'active' ? 'active' : ''}`} />
        <span>{status === 'active' ? 'Inspecting' : 'Ready'}</span>
      </div>

      {/* Actions */}
      <div className="popup-actions">
        <button className="popup-btn popup-btn-primary" onClick={handleInspect}>
          <MagnifyingGlass size={18} weight="bold" />
          <span>{status === 'active' ? 'Stop Inspect' : 'Start Inspect'}</span>
        </button>

        <button className="popup-btn" onClick={handleScan}>
          <Scan size={18} weight="bold" />
          <span>Scan this page</span>
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
          <kbd>Ctrl+Shift+L</kbd>
        </div>
        <div className="popup-shortcut-row">
          <span>Open popup</span>
          <kbd>Ctrl+Shift+P</kbd>
        </div>
      </div>

      {/* Footer */}
      <footer className="popup-footer">
        <button className="popup-footer-btn" title="Settings">
          <GearSix size={16} weight="bold" />
        </button>
        <span className="popup-version">v1.0.0</span>
      </footer>
    </div>
  )
}
