import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { chromeLocalStorage, PANEL_STATE_STORAGE_KEY } from '@/lib/storage'
import type { InspectedElement } from '@/types/inspection'
import type { DesignSystem } from '@/types/design-system'
import type { MarkdownResult } from '@/types/markdown'
import type { CrawlProgress, CrawlResult } from '@/types/crawl'

export type PanelMode =
  | 'inspect'
  | 'scan'
  | 'design-system'
  | 'export'
  | 'history'
  | 'markdown'
  | 'crawl'
  | 'settings'

export interface ScanProgress {
  percent: number
  phase: string
}

interface PanelState {
  activeMode: PanelMode
  inspectedElement: InspectedElement | null
  designSystem: DesignSystem | null
  scanProgress: ScanProgress | null
  colorFormat: 'hex' | 'rgb' | 'hsl'
  history: DesignSystem[]
  markdownResult: MarkdownResult | null
  markdownLoading: boolean
  markdownError: string | null
  // Crawl state — NEVER persisted (the result document can be megabytes). Always
  // starts fresh on a panel remount, so it can never rehydrate stuck "running".
  crawlRunning: boolean
  crawlProgress: CrawlProgress | null
  crawlResult: CrawlResult | null
  crawlError: string | null
  // True once `persist` has finished its async rehydration from
  // chrome.storage.local. The panel UI gates on this so it never paints the
  // default state first and then snaps to the restored one (see App.tsx).
  // Never persisted (excluded from `partialize`) — purely runtime state.
  hasHydrated: boolean

  setMode: (mode: PanelMode) => void
  setInspectedElement: (el: InspectedElement | null) => void
  setDesignSystem: (ds: DesignSystem | null) => void
  setScanProgress: (progress: ScanProgress | null) => void
  setColorFormat: (format: 'hex' | 'rgb' | 'hsl') => void
  setHistory: (history: DesignSystem[]) => void
  addToHistory: (ds: DesignSystem) => void
  clearHistory: () => void
  setMarkdownResult: (result: MarkdownResult | null) => void
  setMarkdownLoading: (loading: boolean) => void
  setMarkdownError: (error: string | null) => void
  setCrawlRunning: (running: boolean) => void
  setCrawlProgress: (progress: CrawlProgress | null) => void
  setCrawlResult: (result: CrawlResult | null) => void
  setCrawlError: (error: string | null) => void
  setHasHydrated: (hydrated: boolean) => void
}

export const usePanelStore = create<PanelState>()(
  persist(
    (set) => ({
      activeMode: 'inspect',
      inspectedElement: null,
      designSystem: null,
      scanProgress: null,
      colorFormat: 'hex',
      history: [],
      markdownResult: null,
      markdownLoading: false,
      markdownError: null,
      crawlRunning: false,
      crawlProgress: null,
      crawlResult: null,
      crawlError: null,
      hasHydrated: false,

      setMode: (mode) => set({ activeMode: mode }),
      setInspectedElement: (el) => set({ inspectedElement: el }),
      setDesignSystem: (ds) => set({ designSystem: ds }),
      setScanProgress: (progress) => set({ scanProgress: progress }),
      setColorFormat: (format) => set({ colorFormat: format }),
      setHistory: (history) => set({ history }),
      addToHistory: (ds) =>
        set((state) => ({ history: [ds, ...state.history].slice(0, 20) })),
      clearHistory: () => set({ history: [] }),
      setMarkdownResult: (result) => set({ markdownResult: result }),
      setMarkdownLoading: (loading) => set({ markdownLoading: loading }),
      setMarkdownError: (error) => set({ markdownError: error }),
      setCrawlRunning: (running) => set({ crawlRunning: running }),
      setCrawlProgress: (progress) => set({ crawlProgress: progress }),
      setCrawlResult: (result) => set({ crawlResult: result }),
      setCrawlError: (error) => set({ crawlError: error }),
      setHasHydrated: (hydrated) => set({ hasHydrated: hydrated }),
    }),
    {
      name: PANEL_STATE_STORAGE_KEY,
      storage: createJSONStorage(() => chromeLocalStorage),
      // Persist only durable UI state. Transient flags (scanProgress,
      // markdownLoading, markdownError) and the live inspectedElement are
      // intentionally omitted: they are never written to storage, so a
      // torn-down panel always rehydrates them at their initial value and can
      // never come back stuck in an "in progress" state. `history` and the
      // last `designSystem` are rebuilt at mount from `pixellens_scans`
      // (see App.tsx), the canonical scan store shared with the service worker.
      partialize: (state) => ({
        activeMode: state.activeMode,
        colorFormat: state.colorFormat,
        markdownResult: state.markdownResult,
      }),
      // Defence in depth: even if a legacy/partial envelope ever carried
      // transient flags, force them back to their initial value on rehydrate so
      // the panel can never come back stuck mid-scan or mid-conversion.
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<PanelState>),
        scanProgress: null,
        markdownLoading: false,
        markdownError: null,
      }),
      // Async storage means rehydration completes AFTER the first React paint.
      // Flip `hasHydrated` when it finishes (even on error, so the UI never
      // stays stuck on its loading gate) so the panel can render the restored
      // state in one shot instead of flashing the default state first.
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    },
  ),
)
