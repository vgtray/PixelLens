// PixelLens — Chrome Storage Wrapper

import type { DesignSystem } from '@/types/design-system'
import type { Preferences } from '@/types/messages'
import type { StateStorage } from 'zustand/middleware'

const PREFS_KEY = 'pixellens_preferences'
const SCANS_KEY = 'pixellens_scans'
const PANEL_STATE_KEY = 'pixellens_panel_state'

const DEFAULT_PREFERENCES: Preferences = {
  colorFormat: 'hex',
  gridSize: 8,
  theme: 'dark',
}

export async function getPreferences(): Promise<Preferences> {
  const result = await chrome.storage.sync.get(PREFS_KEY)
  const stored = result[PREFS_KEY] as Partial<Preferences> | undefined
  return { ...DEFAULT_PREFERENCES, ...stored }
}

export async function setPreferences(prefs: Partial<Preferences>): Promise<void> {
  const current = await getPreferences()
  await chrome.storage.sync.set({
    [PREFS_KEY]: { ...current, ...prefs },
  })
}

export async function saveDesignSystem(ds: DesignSystem): Promise<void> {
  const result = await chrome.storage.local.get(SCANS_KEY)
  const scans: DesignSystem[] = (result[SCANS_KEY] as DesignSystem[] | undefined) ?? []
  scans.unshift(ds)
  // Keep last 20 scans
  const trimmed = scans.slice(0, 20)
  await chrome.storage.local.set({ [SCANS_KEY]: trimmed })
}

export async function getDesignSystems(): Promise<DesignSystem[]> {
  const result = await chrome.storage.local.get(SCANS_KEY)
  return (result[SCANS_KEY] as DesignSystem[] | undefined) ?? []
}

export async function getLatestDesignSystem(): Promise<DesignSystem | null> {
  const scans = await getDesignSystems()
  return scans[0] || null
}

// --- Zustand persistence adapter ---
// MV3 side panels are torn down every time they close, wiping any in-memory
// store. This exposes chrome.storage.local as a Zustand `StateStorage` so the
// panel store can persist (and rehydrate) its durable UI state across remounts,
// using the same storage area the service worker already writes to.
export const PANEL_STATE_STORAGE_KEY = PANEL_STATE_KEY

export const chromeLocalStorage: StateStorage = {
  getItem: async (name) => {
    const result = await chrome.storage.local.get(name)
    return (result[name] as string | undefined) ?? null
  },
  setItem: async (name, value) => {
    await chrome.storage.local.set({ [name]: value })
  },
  removeItem: async (name) => {
    await chrome.storage.local.remove(name)
  },
}

// --- Side panel initial-view routing ---
// chrome.sidePanel.open() must run synchronously inside a user gesture, so the
// popup opens the panel right inside its click handler and can't ALSO await a
// message round-trip to tell the freshly-opened panel which view to show.
// Instead it patches `activeMode` directly in the SAME persisted envelope the
// panel's Zustand `persist` middleware rehydrates from on mount, so the panel
// paints straight onto that view (no flash, no message-timing guess). The popup
// write lands well before the panel's async rehydration getItem fires.
// `mode` mirrors the store's PanelMode union, declared as a literal here to
// avoid a storage <-> sidepanel import cycle.
export type PanelViewMode =
  | 'inspect'
  | 'scan'
  | 'design-system'
  | 'contrast'
  | 'export'
  | 'history'
  | 'markdown'
  | 'crawl'
  | 'settings'

export async function setPanelInitialMode(mode: PanelViewMode): Promise<void> {
  const result = await chrome.storage.local.get(PANEL_STATE_KEY)
  const raw = result[PANEL_STATE_KEY] as string | undefined
  let envelope: { state?: Record<string, unknown>; version?: number } = {}
  if (raw) {
    try {
      envelope = JSON.parse(raw) as { state?: Record<string, unknown>; version?: number }
    } catch {
      // Corrupt envelope: start clean. The store's `merge` backfills the rest
      // of the durable state from its defaults on rehydrate.
      envelope = {}
    }
  }
  await chrome.storage.local.set({
    [PANEL_STATE_KEY]: JSON.stringify({
      ...envelope,
      version: envelope.version ?? 0,
      state: { ...(envelope.state ?? {}), activeMode: mode },
    }),
  })
}
