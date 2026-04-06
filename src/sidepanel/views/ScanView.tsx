import { useState, useRef, useEffect } from 'react'
import { Play, Palette, TextT, ArrowsOutSimple, Drop } from '@phosphor-icons/react'
import gsap from 'gsap'
import { usePanelStore } from '../store'
import { sendMessage } from '@/lib/messaging'
import { MessageType } from '@/types/messages'
import ColorPalette from '../components/ColorPalette'
import TypeSpecimen from '../components/TypeSpecimen'
import SpacingScale from '../components/SpacingScale'
import ShadowPreview from '../components/ShadowPreview'

type ScanTab = 'colors' | 'fonts' | 'spacing' | 'shadows'

const TABS: { id: ScanTab; label: string; icon: typeof Palette }[] = [
  { id: 'colors', label: 'Colors', icon: Palette },
  { id: 'fonts', label: 'Fonts', icon: TextT },
  { id: 'spacing', label: 'Spacing', icon: ArrowsOutSimple },
  { id: 'shadows', label: 'Shadows', icon: Drop },
]

function ScanView() {
  const scanProgress = usePanelStore((s) => s.scanProgress)
  const designSystem = usePanelStore((s) => s.designSystem)
  const setMode = usePanelStore((s) => s.setMode)
  const [activeTab, setActiveTab] = useState<ScanTab>('colors')
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([])
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })
  const progressBarRef = useRef<HTMLDivElement>(null)
  const shimmerRef = useRef<gsap.core.Tween | null>(null)

  useEffect(() => {
    const idx = TABS.findIndex((t) => t.id === activeTab)
    const el = tabsRef.current[idx]
    if (!el) return
    setIndicatorStyle({ left: el.offsetLeft, width: el.offsetWidth })
  }, [activeTab])

  // GSAP: animate progress bar width + gradient shimmer
  useEffect(() => {
    const bar = progressBarRef.current
    if (!bar || !scanProgress) return

    gsap.to(bar, {
      width: `${scanProgress.percent}%`,
      duration: 0.3,
      ease: 'power2.out',
    })

    // Shimmer loop — only create once
    if (!shimmerRef.current) {
      shimmerRef.current = gsap.fromTo(
        bar,
        { backgroundPosition: '-200% 0' },
        {
          backgroundPosition: '200% 0',
          duration: 1.5,
          ease: 'none',
          repeat: -1,
        },
      )
    }

    return () => {
      if (shimmerRef.current) {
        shimmerRef.current.kill()
        shimmerRef.current = null
      }
    }
  }, [scanProgress])

  const handleStartScan = () => {
    sendMessage(MessageType.SCAN_PAGE, undefined)
  }

  // Scanning in progress
  if (scanProgress) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-5 px-6">
        <div className="w-full max-w-[220px]">
          <div className="h-2 rounded-full bg-panel-surface overflow-hidden">
            <div
              ref={progressBarRef}
              className="h-full rounded-full"
              style={{
                width: '0%',
                background:
                  'linear-gradient(90deg, var(--color-panel-accent) 0%, #818CF8 40%, var(--color-panel-accent) 60%, #818CF8 100%)',
                backgroundSize: '200% 100%',
              }}
            />
          </div>
          <p className="text-[11px] text-panel-text-dim text-center mt-2.5">
            {scanProgress.phase}
          </p>
          <p className="text-[10px] text-panel-text-dim text-center font-mono mt-1">
            {scanProgress.percent}%
          </p>
        </div>
      </div>
    )
  }

  // No scan results yet
  if (!designSystem) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-panel-surface border border-panel-border flex items-center justify-center">
          <Play size={28} className="text-panel-text-dim" />
        </div>
        <div>
          <p className="text-[13px] font-medium text-panel-text mb-1">Scan this page</p>
          <p className="text-[11px] text-panel-text-dim leading-relaxed mb-4">
            Extract colors, fonts, spacing, and shadows from the entire page
          </p>
          <button
            onClick={handleStartScan}
            className="px-4 py-2 rounded-lg bg-panel-accent text-white text-[12px] font-medium hover:bg-panel-accent-hover transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-panel-accent focus-visible:ring-offset-2 focus-visible:ring-offset-panel-bg"
          >
            Start Scan
          </button>
        </div>
      </div>
    )
  }

  // Scan results with tabs
  const renderTabContent = () => {
    switch (activeTab) {
      case 'colors':
        return <ColorPalette colors={designSystem.colors} />
      case 'fonts':
        return (
          <div className="flex flex-col gap-4">
            {designSystem.typography.map((font) => (
              <TypeSpecimen key={font.fontFamily} typography={font} />
            ))}
            {designSystem.typography.length === 0 && (
              <p className="text-[11px] text-panel-text-dim">No fonts found</p>
            )}
          </div>
        )
      case 'spacing':
        return (
          <SpacingScale
            spacings={designSystem.spacing}
            baseUnit={designSystem.spacing[0] ? parseInt(designSystem.spacing[0].value) || 8 : 8}
          />
        )
      case 'shadows':
        return (
          <div className="grid grid-cols-2 gap-3">
            {designSystem.shadows.map((shadow, i) => (
              <ShadowPreview key={i} shadow={shadow} />
            ))}
            {designSystem.shadows.length === 0 && (
              <p className="text-[11px] text-panel-text-dim col-span-2">No shadows found</p>
            )}
          </div>
        )
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Scan result tabs */}
      <nav className="relative flex border-b border-panel-border px-3 pt-1 shrink-0">
        <div
          className="absolute bottom-0 h-[2px] bg-panel-accent rounded-full transition-all duration-300 ease-out"
          style={{ left: indicatorStyle.left, width: indicatorStyle.width }}
        />
        {TABS.map((tab, i) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              ref={(el) => { tabsRef.current[i] = el }}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1 px-2.5 pb-2 pt-1 text-[11px] font-medium transition-colors duration-200 ${
                isActive ? 'text-panel-text' : 'text-panel-text-dim hover:text-panel-text'
              }`}
            >
              <Icon size={12} weight={isActive ? 'bold' : 'regular'} />
              {tab.label}
            </button>
          )
        })}
      </nav>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-3">
        {renderTabContent()}
      </div>

      {/* Generate DS button */}
      <div className="shrink-0 p-3 border-t border-panel-border">
        <button
          onClick={() => setMode('design-system')}
          className="w-full py-2 rounded-lg bg-panel-accent text-white text-[12px] font-medium hover:bg-panel-accent-hover transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-panel-accent focus-visible:ring-offset-2 focus-visible:ring-offset-panel-bg"
        >
          View Design System
        </button>
      </div>
    </div>
  )
}

export default ScanView
