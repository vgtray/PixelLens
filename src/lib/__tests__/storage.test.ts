import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock chrome.storage before importing the module
let mockStorage: Record<string, any> = {};

Object.defineProperty(globalThis, 'chrome', {
  value: {
    storage: {
      sync: {
        get: vi.fn((keys: string | string[]) => {
          if (typeof keys === 'string') {
            return Promise.resolve({ [keys]: mockStorage[keys] });
          }
          const result: Record<string, any> = {};
          for (const k of keys) {
            if (k in mockStorage) result[k] = mockStorage[k];
          }
          return Promise.resolve(result);
        }),
        set: vi.fn((items: Record<string, any>) => {
          Object.assign(mockStorage, items);
          return Promise.resolve();
        }),
      },
      local: {
        get: vi.fn((keys: string | string[]) => {
          if (typeof keys === 'string') {
            return Promise.resolve({ [keys]: mockStorage[keys] });
          }
          const result: Record<string, any> = {};
          for (const k of keys) {
            if (k in mockStorage) result[k] = mockStorage[k];
          }
          return Promise.resolve(result);
        }),
        set: vi.fn((items: Record<string, any>) => {
          Object.assign(mockStorage, items);
          return Promise.resolve();
        }),
      },
    },
  },
  writable: true,
});

import {
  getPreferences,
  setPreferences,
  saveDesignSystem,
  getDesignSystems,
  setPanelInitialMode,
  PANEL_STATE_STORAGE_KEY,
} from '../storage';
import type { DesignSystem } from '@/types/design-system';

const mockDS: DesignSystem = {
  colors: [],
  typography: [],
  spacing: [],
  shadows: [],
  borderRadius: [],
  metadata: { url: 'https://example.com', title: 'Test', scannedAt: '2026-01-01' },
};

describe('getPreferences / setPreferences', () => {
  beforeEach(() => {
    mockStorage = {};
  });

  it('returns default preferences when none stored', async () => {
    const prefs = await getPreferences();
    expect(prefs.colorFormat).toBe('hex');
    expect(prefs.gridSize).toBe(8);
    expect(prefs.theme).toBe('dark');
  });

  it('round-trips preferences correctly', async () => {
    await setPreferences({ colorFormat: 'rgb', gridSize: 4 });
    const prefs = await getPreferences();
    expect(prefs.colorFormat).toBe('rgb');
    expect(prefs.gridSize).toBe(4);
    expect(prefs.theme).toBe('dark'); // unchanged
  });
});

describe('saveDesignSystem / getDesignSystems', () => {
  beforeEach(() => {
    mockStorage = {};
  });

  it('saves and retrieves a design system', async () => {
    await saveDesignSystem(mockDS);
    const systems = await getDesignSystems();
    expect(systems).toHaveLength(1);
    expect(systems[0].metadata.url).toBe('https://example.com');
  });

  it('prepends new scans (newest first)', async () => {
    const ds1 = { ...mockDS, metadata: { ...mockDS.metadata, title: 'First' } };
    const ds2 = { ...mockDS, metadata: { ...mockDS.metadata, title: 'Second' } };
    await saveDesignSystem(ds1);
    await saveDesignSystem(ds2);
    const systems = await getDesignSystems();
    expect(systems[0].metadata.title).toBe('Second');
    expect(systems[1].metadata.title).toBe('First');
  });

  it('returns empty array when none stored', async () => {
    const systems = await getDesignSystems();
    expect(systems).toEqual([]);
  });
});

describe('setPanelInitialMode', () => {
  beforeEach(() => {
    mockStorage = {};
  });

  it('creates a fresh persist envelope when none exists', async () => {
    await setPanelInitialMode('history');
    const parsed = JSON.parse(mockStorage[PANEL_STATE_STORAGE_KEY]);
    expect(parsed.version).toBe(0);
    expect(parsed.state.activeMode).toBe('history');
  });

  it('patches activeMode while preserving other durable state and version', async () => {
    mockStorage[PANEL_STATE_STORAGE_KEY] = JSON.stringify({
      version: 0,
      state: { activeMode: 'inspect', colorFormat: 'rgb', markdownResult: { markdown: '# Hi' } },
    });
    await setPanelInitialMode('design-system');
    const parsed = JSON.parse(mockStorage[PANEL_STATE_STORAGE_KEY]);
    expect(parsed.version).toBe(0);
    expect(parsed.state.activeMode).toBe('design-system');
    // Sibling durable fields must survive the patch (the panel keeps colorFormat
    // and the last markdown result across the open).
    expect(parsed.state.colorFormat).toBe('rgb');
    expect(parsed.state.markdownResult).toMatchObject({ markdown: '# Hi' });
  });

  it('recovers from a corrupt envelope instead of throwing', async () => {
    mockStorage[PANEL_STATE_STORAGE_KEY] = 'not-json{';
    await expect(setPanelInitialMode('scan')).resolves.toBeUndefined();
    const parsed = JSON.parse(mockStorage[PANEL_STATE_STORAGE_KEY]);
    expect(parsed.state.activeMode).toBe('scan');
    expect(parsed.version).toBe(0);
  });
});
