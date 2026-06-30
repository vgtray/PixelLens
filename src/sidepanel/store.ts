import { create } from 'zustand'
import type { InspectedElement } from '@/types/inspection'
import type { DesignSystem } from '@/types/design-system'
import type { MarkdownResult } from '@/types/markdown'

export type PanelMode = 'inspect' | 'scan' | 'design-system' | 'export' | 'history' | 'markdown'

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

  setMode: (mode: PanelMode) => void
  setInspectedElement: (el: InspectedElement | null) => void
  setDesignSystem: (ds: DesignSystem | null) => void
  setScanProgress: (progress: ScanProgress | null) => void
  setColorFormat: (format: 'hex' | 'rgb' | 'hsl') => void
  addToHistory: (ds: DesignSystem) => void
  clearHistory: () => void
  setMarkdownResult: (result: MarkdownResult | null) => void
  setMarkdownLoading: (loading: boolean) => void
  setMarkdownError: (error: string | null) => void
}

export const usePanelStore = create<PanelState>((set) => ({
  activeMode: 'inspect',
  inspectedElement: null,
  designSystem: null,
  scanProgress: null,
  colorFormat: 'hex',
  history: [],
  markdownResult: null,
  markdownLoading: false,
  markdownError: null,

  setMode: (mode) => set({ activeMode: mode }),
  setInspectedElement: (el) => set({ inspectedElement: el }),
  setDesignSystem: (ds) => set({ designSystem: ds }),
  setScanProgress: (progress) => set({ scanProgress: progress }),
  setColorFormat: (format) => set({ colorFormat: format }),
  addToHistory: (ds) =>
    set((state) => ({ history: [ds, ...state.history].slice(0, 20) })),
  clearHistory: () => set({ history: [] }),
  setMarkdownResult: (result) => set({ markdownResult: result }),
  setMarkdownLoading: (loading) => set({ markdownLoading: loading }),
  setMarkdownError: (error) => set({ markdownError: error }),
}))
