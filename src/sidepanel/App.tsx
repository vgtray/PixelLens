import { useEffect, useMemo, useRef, useState } from 'react'
import {
  MagnifyingGlass,
  Scan,
  Palette,
  Export,
  ClockCounterClockwise,
  MarkdownLogo,
  GlobeHemisphereWest,
  GearSix,
  CircleHalf,
} from '@phosphor-icons/react'
import gsap from 'gsap'
import { usePanelStore, type PanelMode } from './store'
import { MessageType } from '@/types/messages'
import { getDesignSystems } from '@/lib/storage'
import { getHost } from '@/lib/url'
import InspectorView from './views/InspectorView'
import ScanView from './views/ScanView'
import DesignSystemView from './views/DesignSystemView'
import ExportView from './views/ExportView'
import HistoryView from './views/HistoryView'
import MarkdownView from './views/MarkdownView'
import CrawlView from './views/CrawlView'
import ContrastCheckerView from './views/ContrastCheckerView'
import SettingsView from './views/SettingsView'
import PixelLensLogo from './components/PixelLensLogo'
import CommandPalette, {
  createNavigationCommands,
  createContrastCommands,
  createCrawlZipCommands,
  isMacPlatform,
} from './components/CommandPalette'
import { prefersReducedMotion } from './reducedMotion'

const MAIN_TABS: { mode: PanelMode; label: string; icon: typeof MagnifyingGlass }[] = [
  { mode: 'inspect', label: 'Inspect', icon: MagnifyingGlass },
  { mode: 'scan', label: 'Scan', icon: Scan },
  { mode: 'design-system', label: 'Design System', icon: Palette },
]

const FOOTER_TABS: { mode: PanelMode; icon: typeof Export; label: string }[] = [
  { mode: 'contrast', icon: CircleHalf, label: 'Contrast checker' },
  { mode: 'export', icon: Export, label: 'Export' },
  { mode: 'markdown', icon: MarkdownLogo, label: 'Markdown' },
  { mode: 'crawl', icon: GlobeHemisphereWest, label: 'Crawl site' },
  { mode: 'history', icon: ClockCounterClockwise, label: 'History' },
  { mode: 'settings', icon: GearSix, label: 'Settings' },
]

function App() {
  const activeMode = usePanelStore((s) => s.activeMode)
  const hasHydrated = usePanelStore((s) => s.hasHydrated)
  const setMode = usePanelStore((s) => s.setMode)
  const setInspectedElement = usePanelStore((s) => s.setInspectedElement)
  const setDesignSystem = usePanelStore((s) => s.setDesignSystem)
  const setScanProgress = usePanelStore((s) => s.setScanProgress)
  const setScanError = usePanelStore((s) => s.setScanError)
  const addToHistory = usePanelStore((s) => s.addToHistory)
  const setCrawlProgress = usePanelStore((s) => s.setCrawlProgress)
  const setCrawlResult = usePanelStore((s) => s.setCrawlResult)
  const setCrawlRunning = usePanelStore((s) => s.setCrawlRunning)
  const setCrawlExportMode = usePanelStore((s) => s.setCrawlExportMode)
  const setActiveTabUrl = usePanelStore((s) => s.setActiveTabUrl)
  const activeTabUrl = usePanelStore((s) => s.activeTabUrl)
  const history = usePanelStore((s) => s.history)

  const tabsRef = useRef<(HTMLButtonElement | null)[]>([])
  const indicatorRef = useRef<HTMLDivElement>(null)
  const isFirstRender = useRef(true)

  // Command palette: transient, LOCAL state only — it is an accelerator, never
  // part of the persisted panel envelope.
  const [paletteOpen, setPaletteOpen] = useState(false)
  const commands = useMemo(
    () => [
      ...createNavigationCommands(setMode),
      ...createContrastCommands(setMode),
      ...createCrawlZipCommands(setMode, setCrawlExportMode),
    ],
    [setMode, setCrawlExportMode],
  )
  const shortcutLabel = isMacPlatform() ? '⌘K' : 'Ctrl K'

  // Global ⌘K / Ctrl+K toggles the palette from anywhere in the panel.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // On mount (every time the side panel is opened — MV3 tears it down on close),
  // restore the durable state that lives outside the persisted panel envelope
  // and clear any transient flag so the UI never rehydrates stuck "in progress".
  useEffect(() => {
    // Wait for the async persist rehydration to finish first. Running before it
    // would (a) read the not-yet-restored default state and (b) trigger persist
    // writes that race with — and can clobber — the envelope being read back.
    if (!hasHydrated) return
    const store = usePanelStore.getState()
    store.setScanProgress(null)
    store.setScanError(null)
    store.setMarkdownLoading(false)
    store.setMarkdownError(null)

    // Rebuild scan history + last result from the canonical scan store shared
    // with the service worker (pixellens_scans), so returning to the panel
    // keeps the previous scan instead of resetting to the empty state.
    let cancelled = false
    getDesignSystems()
      .then((scans) => {
        if (cancelled || scans.length === 0) return
        const s = usePanelStore.getState()
        if (s.history.length === 0) s.setHistory(scans)
        if (!s.designSystem) s.setDesignSystem(scans[0])
      })
      .catch((err) => console.error('[PixelLens]', err))
    return () => {
      cancelled = true
    }
  }, [hasHydrated])

  // Track the URL of the tab currently in front of the user so the views can
  // tell whether a restored scan/markdown belongs to the page on screen (see
  // StaleScanBanner). Reading tab.url relies on the activeTab grant from the
  // action click that opened the panel; a tab the extension has no host access
  // to reports url=undefined, in which case we store null (unknown) and the
  // views won't flag a false mismatch. Runs on mount, then follows tab switches
  // and in-tab navigations (incl. SPA route changes) while the panel stays open.
  useEffect(() => {
    let cancelled = false
    const readActiveTab = async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (!cancelled) setActiveTabUrl(tab?.url ?? null)
      } catch {
        if (!cancelled) setActiveTabUrl(null)
      }
    }
    void readActiveTab()
    const onActivated = () => void readActiveTab()
    const onUpdated = (
      _tabId: number,
      changeInfo: chrome.tabs.OnUpdatedInfo,
      tab: chrome.tabs.Tab,
    ) => {
      // React only to a URL change on the *active* tab — a full navigation or an
      // SPA route push both surface here. Ignore background-tab churn.
      if (tab.active && changeInfo.url) void readActiveTab()
    }
    chrome.tabs.onActivated.addListener(onActivated)
    chrome.tabs.onUpdated.addListener(onUpdated)
    return () => {
      cancelled = true
      chrome.tabs.onActivated.removeListener(onActivated)
      chrome.tabs.onUpdated.removeListener(onUpdated)
    }
  }, [setActiveTabUrl])

  // Reconcile the shown design system with the active tab. When we know the host
  // on screen, prefer the most recent scan of THAT host — so switching to (or
  // reopening on) a previously scanned site restores its scan instead of
  // whatever was scanned last globally. If nothing matches we leave the current
  // scan in place and the stale-scan banner flags the host mismatch. Skipped
  // while the active URL is unknown, so it can never wrongly override the scan.
  useEffect(() => {
    if (!hasHydrated) return
    const activeHost = getHost(activeTabUrl)
    if (!activeHost) return
    const current = usePanelStore.getState().designSystem
    // Already showing a scan of the active host → nothing to do.
    if (current && getHost(current.metadata.url) === activeHost) return
    const match = history.find((d) => getHost(d.metadata.url) === activeHost)
    if (match) usePanelStore.getState().setDesignSystem(match)
  }, [hasHydrated, activeTabUrl, history])

  // GSAP sliding indicator. `hasHydrated` is a dependency so the indicator is
  // (re)positioned on the very paint where the restored activeMode lands, not a
  // stale default — and never left stuck on the wrong tab after rehydration.
  useEffect(() => {
    const indicator = indicatorRef.current
    if (!indicator) return

    const idx = MAIN_TABS.findIndex((t) => t.mode === activeMode)
    if (idx === -1) {
      // Footer modes (export/markdown/history) have no main-nav tab: hide the
      // indicator instead of leaving it glued to a main tab (notably "Inspect"
      // right after a rehydration that restored a footer mode). Keep
      // isFirstRender untouched so the first main tab still snaps cleanly.
      gsap.set(indicator, { opacity: 0 })
      return
    }

    const el = tabsRef.current[idx]
    if (!el) return

    if (isFirstRender.current) {
      gsap.set(indicator, { left: el.offsetLeft, width: el.offsetWidth, opacity: 1 })
      isFirstRender.current = false
    } else if (prefersReducedMotion()) {
      // Reduced motion: snap the indicator to the new tab instead of sliding.
      gsap.set(indicator, { left: el.offsetLeft, width: el.offsetWidth, opacity: 1 })
    } else {
      gsap.set(indicator, { opacity: 1 })
      gsap.to(indicator, {
        left: el.offsetLeft,
        width: el.offsetWidth,
        duration: 0.3,
        ease: 'power3.out',
      })
    }
  }, [activeMode, hasHydrated])

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
        return
      }

      if (message.type === MessageType.SCAN_PROGRESS) {
        const payload = message.payload as { progress: number; phase: string }
        setScanProgress({ percent: payload.progress, phase: payload.phase })
        sendResponse({ received: true })
        return
      }

      if (message.type === MessageType.SCAN_COMPLETE) {
        const payload = message.payload as { designSystem: import('@/types/design-system').DesignSystem }
        setDesignSystem(payload.designSystem)
        addToHistory(payload.designSystem)
        setScanProgress(null)
        setScanError(null)
        setMode('scan')
        // Persistence is centralised in the service worker (always alive = source of
        // truth, works even when this panel is closed), so the scan is saved exactly
        // once. The panel only mirrors it into its in-memory store here.
        sendResponse({ received: true })
        return
      }

      if (message.type === MessageType.SCAN_ERROR) {
        // Scan crashed in the content script. Drop the spinner and surface an error
        // so the panel never hangs, symmetric to Markdown/Crawl.
        setScanProgress(null)
        setScanError('Something went wrong scanning this page.')
        setMode('scan')
        sendResponse({ received: true })
        return
      }

      if (message.type === MessageType.CRAWL_PROGRESS) {
        setCrawlProgress(message.payload as import('@/types/crawl').CrawlProgress)
        sendResponse({ received: true })
        return
      }

      if (message.type === MessageType.CRAWL_COMPLETE) {
        const { result } = message.payload as { result: import('@/types/crawl').CrawlResult }
        setCrawlResult(result)
        setCrawlProgress(null)
        setCrawlRunning(false)
        setMode('crawl')
        sendResponse({ received: true })
        return
      }
    }

    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [setInspectedElement, setDesignSystem, setScanProgress, setScanError, setMode, addToHistory, setCrawlProgress, setCrawlResult, setCrawlRunning])

  // Until the async persist rehydration completes we don't know the real
  // activeMode/markdown state yet. Show a minimal on-brand loader rather than
  // painting the default state and snapping to the restored one a frame later.
  if (!hasHydrated) {
    return (
      <div className="flex items-center justify-center h-screen bg-panel-bg">
        <PixelLensLogo size={24} className="animate-pulse" />
      </div>
    )
  }

  const renderView = () => {
    switch (activeMode) {
      case 'inspect':
        return <InspectorView />
      case 'scan':
        return <ScanView />
      case 'design-system':
        return <DesignSystemView />
      case 'contrast':
        return <ContrastCheckerView />
      case 'export':
        return <ExportView />
      case 'history':
        return <HistoryView />
      case 'markdown':
        return <MarkdownView />
      case 'crawl':
        return <CrawlView />
      case 'settings':
        return <SettingsView />
    }
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-panel-bg">
      {/* Header */}
      <header className="shrink-0 border-b border-panel-border px-3 pt-3 pb-0">
        <div className="flex items-center gap-2 mb-3">
          <PixelLensLogo size={20} />
          <h1 className="text-[16px] font-semibold text-panel-text tracking-tight">
            PixelLens
          </h1>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label="Open command palette"
            title="Command palette"
            className="ml-auto flex items-center gap-1 rounded-md border border-panel-border px-1.5 py-1 font-mono text-[10px] leading-none text-panel-text-dim transition-colors hover:border-panel-text-dim hover:text-panel-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panel-accent focus-visible:ring-offset-1 focus-visible:ring-offset-panel-bg"
          >
            {shortcutLabel}
          </button>
        </div>

        {/* Mode tabs with GSAP sliding indicator */}
        <nav className="relative flex gap-0">
          <div
            ref={indicatorRef}
            className="absolute bottom-0 h-[2px] bg-panel-accent rounded-full"
            style={{ willChange: 'left, width', opacity: 0 }}
          />
          {MAIN_TABS.map((tab, i) => {
            const Icon = tab.icon
            const isActive = activeMode === tab.mode
            return (
              <button
                key={tab.mode}
                ref={(el) => { tabsRef.current[i] = el }}
                onClick={() => setMode(tab.mode)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-1.5 px-3 pb-2 pt-1 text-[12px] font-medium rounded-md transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panel-accent focus-visible:ring-offset-2 focus-visible:ring-offset-panel-bg ${
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
                aria-label={tab.label}
                aria-current={isActive ? 'page' : undefined}
                className={`p-1.5 rounded-md transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panel-accent focus-visible:ring-offset-1 focus-visible:ring-offset-panel-bg ${
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

      <CommandPalette
        open={paletteOpen}
        commands={commands}
        onClose={() => setPaletteOpen(false)}
      />
    </div>
  )
}

export default App
