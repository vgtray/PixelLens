import { useEffect } from 'react'
import { Palette } from '@phosphor-icons/react'
import { usePanelStore } from '../store'
import { getPreferences, setPreferences } from '@/lib/storage'
import ColorSwatch from '../components/ColorSwatch'

type ColorFormat = 'hex' | 'rgb' | 'hsl'

const COLOR_FORMATS: { id: ColorFormat; label: string }[] = [
  { id: 'hex', label: 'HEX' },
  { id: 'rgb', label: 'RGB' },
  { id: 'hsl', label: 'HSL' },
]

// Brand accent — gives the live preview an on-page sample to format.
const PREVIEW_COLOR = '#6366F1'

function SettingsView() {
  // The store's colorFormat is the single source of truth the colour displays
  // (ColorSwatch in Inspect / Scan / Design System) read from, so driving the
  // control off it keeps this setting and every rendered colour in lockstep.
  const colorFormat = usePanelStore((s) => s.colorFormat)
  const setColorFormat = usePanelStore((s) => s.setColorFormat)

  // On open, adopt the canonical preference (chrome.storage.sync, where setPreferences
  // writes) into the panel store, so a value set elsewhere (popup / another device)
  // wins over the locally persisted panel envelope before we start editing.
  useEffect(() => {
    let cancelled = false
    getPreferences()
      .then((prefs) => {
        if (!cancelled) setColorFormat(prefs.colorFormat)
      })
      .catch((err) => console.error('[PixelLens]', err))
    return () => {
      cancelled = true
    }
  }, [setColorFormat])

  const handleColorFormat = (format: ColorFormat) => {
    // setColorFormat = immediate effect (re-renders every ColorSwatch) and persists
    // to the panel envelope. setPreferences mirrors it into the canonical sync prefs.
    setColorFormat(format)
    setPreferences({ colorFormat: format }).catch((err) => console.error('[PixelLens]', err))
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 space-y-5">
        <section>
          <div className="flex items-center gap-2 mb-1.5">
            <Palette size={14} weight="bold" className="text-panel-accent" />
            <h2 className="text-[12px] font-semibold text-panel-text">Color format</h2>
          </div>
          <p className="text-[11px] text-panel-text-dim leading-relaxed mb-3">
            How colours are shown across Inspect, Scan and Design System.
          </p>

          <div className="flex gap-1 p-0.5 bg-panel-surface rounded-lg">
            {COLOR_FORMATS.map((f) => (
              <button
                key={f.id}
                onClick={() => handleColorFormat(f.id)}
                aria-pressed={colorFormat === f.id}
                className={`flex-1 py-1.5 text-[11px] font-medium rounded-md transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panel-accent focus-visible:ring-offset-2 focus-visible:ring-offset-panel-bg ${
                  colorFormat === f.id
                    ? 'bg-panel-accent text-white shadow-sm'
                    : 'text-panel-text-dim hover:text-panel-text'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Live preview — reads the same store value as every colour display,
              so it updates the instant the format changes (proof the control is live). */}
          <div className="mt-3 flex items-center gap-3 p-2.5 rounded-lg bg-panel-surface border border-panel-border">
            <span className="text-[10px] uppercase tracking-wide text-panel-text-dim shrink-0">
              Preview
            </span>
            <ColorSwatch color={PREVIEW_COLOR} size={22} showLabel />
          </div>
        </section>
      </div>
    </div>
  )
}

export default SettingsView
