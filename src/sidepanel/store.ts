import { create } from 'zustand'
import type { InspectedElement } from '@/types/inspection'
import type { DesignSystem } from '@/types/design-system'

export type PanelMode = 'inspect' | 'scan' | 'design-system' | 'export' | 'history'

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

  setMode: (mode: PanelMode) => void
  setInspectedElement: (el: InspectedElement | null) => void
  setDesignSystem: (ds: DesignSystem | null) => void
  setScanProgress: (progress: ScanProgress | null) => void
  setColorFormat: (format: 'hex' | 'rgb' | 'hsl') => void
  addToHistory: (ds: DesignSystem) => void
  clearHistory: () => void
}

export const usePanelStore = create<PanelState>((set) => ({
  activeMode: 'inspect',
  inspectedElement: null,
  designSystem: null,
  scanProgress: null,
  colorFormat: 'hex',
  history: [],

  setMode: (mode) => set({ activeMode: mode }),
  setInspectedElement: (el) => set({ inspectedElement: el }),
  setDesignSystem: (ds) => set({ designSystem: ds }),
  setScanProgress: (progress) => set({ scanProgress: progress }),
  setColorFormat: (format) => set({ colorFormat: format }),
  addToHistory: (ds) =>
    set((state) => ({ history: [ds, ...state.history].slice(0, 20) })),
  clearHistory: () => set({ history: [] }),
}))
