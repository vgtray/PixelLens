import { useEffect, useRef, useState } from 'react'
import {
  MagnifyingGlass,
  Scan,
  Palette,
  Export,
  ClockCounterClockwise,
} from '@phosphor-icons/react'
import gsap from 'gsap'
import { usePanelStore, type PanelMode } from './store'
import { MessageType } from '@/types/messages'
import InspectorView from './views/InspectorView'
import ScanView from './views/ScanView'
import DesignSystemView from './views/DesignSystemView'
import ExportView from './views/ExportView'
import HistoryView from './views/HistoryView'

const MAIN_TABS: { mode: PanelMode; label: string; icon: typeof MagnifyingGlass }[] = [
  { mode: 'inspect', label: 'Inspect', icon: MagnifyingGlass },
  { mode: 'scan', label: 'Scan', icon: Scan },
  { mode: 'design-system', label: 'Design System', icon: Palette },
]

const FOOTER_TABS: { mode: PanelMode; icon: typeof Export; label: string }[] = [
  { mode: 'export', icon: Export, label: 'Export' },
  { mode: 'history', icon: ClockCounterClockwise, label: 'History' },
]

function App() {
  const activeMode = usePanelStore((s) => s.activeMode)
  const setMode = usePanelStore((s) => s.setMode)
  const setInspectedElement = usePanelStore((s) => s.setInspectedElement)
  const setDesignSystem = usePanelStore((s) => s.setDesignSystem)
  const setScanProgress = usePanelStore((s) => s.setScanProgress)
  const addToHistory = usePanelStore((s) => s.addToHistory)

  const tabsRef = useRef<(HTMLButtonElement | null)[]>([])
  const indicatorRef = useRef<HTMLDivElement>(null)
  const isFirstRender = useRef(true)

  // GSAP sliding indicator
  useEffect(() => {
    const idx = MAIN_TABS.findIndex((t) => t.mode === activeMode)
    if (idx === -1) return
    const el = tabsRef.current[idx]
    const indicator = indicatorRef.current
    if (!el || !indicator) return

    if (isFirstRender.current) {
      gsap.set(indicator, { left: el.offsetLeft, width: el.offsetWidth })
      isFirstRender.current = false
    } else {
      gsap.to(indicator, {
        left: el.offsetLeft,
        width: el.offsetWidth,
        duration: 0.3,
        ease: 'power3.out',
      })
    }
  }, [activeMode])

  // Listen for Chrome runtime messages
  useEffect(() => {
    const listener = (
      message: { type: string; payload: unknown },
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response: unknown) => void,
    ) => {
      if (message.type === MessageType.ELEMENT_SELECTED) {
        const payload = message.payload as { element: import('@/types/inspection').InspectedElement }
        setInspectedElement(payload.element)
        setMode('inspect')
        sendResponse({ received: true })
      }

      if (message.type === MessageType.SCAN_PROGRESS) {
        const payload = message.payload as { progress: number; phase: string }
        setScanProgress({ percent: payload.progress, phase: payload.phase })
      }

      if (message.type === MessageType.SCAN_COMPLETE) {
        const payload = message.payload as { designSystem: import('@/types/design-system').DesignSystem }
        setDesignSystem(payload.designSystem)
        addToHistory(payload.designSystem)
        setScanProgress(null)
        setMode('scan')
        sendResponse({ received: true })
      }
    }

    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [setInspectedElement, setDesignSystem, setScanProgress, setMode, addToHistory])

  const renderView = () => {
    switch (activeMode) {
      case 'inspect':
        return <InspectorView />
      case 'scan':
        return <ScanView />
      case 'design-system':
        return <DesignSystemView />
      case 'export':
        return <ExportView />
      case 'history':
        return <HistoryView />
    }
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-panel-bg">
      {/* Header */}
      <header className="shrink-0 border-b border-panel-border px-3 pt-3 pb-0">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-5 h-5 rounded bg-panel-accent flex items-center justify-center">
            <span className="text-white text-[10px] font-semibold leading-none">P</span>
          </div>
          <h1 className="text-[16px] font-semibold text-panel-text tracking-tight">
            PixelLens
          </h1>
        </div>

        {/* Mode tabs with GSAP sliding indicator */}
        <nav className="relative flex gap-0">
          <div
            ref={indicatorRef}
            className="absolute bottom-0 h-[2px] bg-panel-accent rounded-full"
            style={{ willChange: 'left, width' }}
          />
          {MAIN_TABS.map((tab, i) => {
            const Icon = tab.icon
            const isActive = activeMode === tab.mode
            return (
              <button
                key={tab.mode}
                ref={(el) => { tabsRef.current[i] = el }}
                onClick={() => setMode(tab.mode)}
                className={`flex items-center gap-1.5 px-3 pb-2 pt-1 text-[12px] font-medium transition-colors duration-200 ${
                  isActive ? 'text-panel-text' : 'text-panel-text-dim hover:text-panel-text'
                }`}
              >
                <Icon size={14} weight={isActive ? 'bold' : 'regular'} />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        {renderView()}
      </main>

      {/* Footer */}
      <footer className="shrink-0 border-t border-panel-border px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          {FOOTER_TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeMode === tab.mode
            return (
              <button
                key={tab.mode}
                onClick={() => setMode(tab.mode)}
                className={`p-1.5 rounded-md transition-colors duration-200 ${
                  isActive
                    ? 'bg-panel-surface text-panel-accent'
                    : 'text-panel-text-dim hover:text-panel-text hover:bg-panel-surface'
                }`}
                title={tab.label}
              >
                <Icon size={16} weight={isActive ? 'fill' : 'regular'} />
              </button>
            )
          })}
        </div>
        <span className="text-[10px] text-panel-text-dim font-mono">v1.0.0</span>
      </footer>
    </div>
  )
}

export default App
