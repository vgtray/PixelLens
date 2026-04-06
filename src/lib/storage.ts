// PixelLens — Chrome Storage Wrapper

import type { DesignSystem } from '@/types/design-system'
import type { Preferences } from '@/types/messages'

const PREFS_KEY = 'pixellens_preferences'
const SCANS_KEY = 'pixellens_scans'

const DEFAULT_PREFERENCES: Preferences = {
  colorFormat: 'hex',
  gridSize: 8,
  theme: 'dark',
}

export async function getPreferences(): Promise<Preferences> {
  const result = await chrome.storage.sync.get(PREFS_KEY)
  return { ...DEFAULT_PREFERENCES, ...result[PREFS_KEY] }
}

export async function setPreferences(prefs: Partial<Preferences>): Promise<void> {
  const current = await getPreferences()
  await chrome.storage.sync.set({
    [PREFS_KEY]: { ...current, ...prefs },
  })
}

export async function saveDesignSystem(ds: DesignSystem): Promise<void> {
  const result = await chrome.storage.local.get(SCANS_KEY)
  const scans: DesignSystem[] = result[SCANS_KEY] || []
  scans.unshift(ds)
  // Keep last 20 scans
  const trimmed = scans.slice(0, 20)
  await chrome.storage.local.set({ [SCANS_KEY]: trimmed })
}

export async function getDesignSystems(): Promise<DesignSystem[]> {
  const result = await chrome.storage.local.get(SCANS_KEY)
  return result[SCANS_KEY] || []
}

export async function getLatestDesignSystem(): Promise<DesignSystem | null> {
  const scans = await getDesignSystems()
  return scans[0] || null
}
