import { useState, useRef, useEffect, useCallback } from 'react'
import { Export, Check } from '@phosphor-icons/react'
import gsap from 'gsap'
import { formatExport } from '@/lib/design-tokens'
import { copyToClipboard, downloadFile, generatePalettePNG } from '@/lib/export'
import type { DesignSystem, ExportFormat } from '@/types/design-system'

interface ExportButtonProps {
  designSystem: DesignSystem
  onExport?: (format: ExportFormat) => void
}

const EXPORT_OPTIONS: { format: ExportFormat; label: string }[] = [
  { format: 'css-variables', label: 'CSS Variables' },
  { format: 'tailwind', label: 'Tailwind Config' },
  { format: 'json', label: 'JSON Tokens' },
  { format: 'png', label: 'PNG Palette' },
]

const CONFETTI_COLORS = ['#6366F1', '#818CF8', '#22C55E', '#F59E0B']

function ExportButton({ designSystem, onExport }: ExportButtonProps) {
  const [open, setOpen] = useState(false)
  const [success, setSuccess] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const confettiContainerRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const spawnConfetti = useCallback(() => {
    const container = confettiContainerRef.current
    if (!container) return

    // Create 4 particle elements
    const particles = Array.from({ length: 4 }, () => {
      const el = document.createElement('span')
      el.style.cssText = `
        position: absolute;
        top: 0;
        left: 50%;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        pointer-events: none;
        background: ${CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]};
      `
      container.appendChild(el)
      return el
    })

    // Animate each particle with GSAP
    particles.forEach((el) => {
      const xDrift = (Math.random() - 0.5) * 60
      const yFly = -(Math.random() * 40 + 20)

      gsap.fromTo(
        el,
        { x: 0, y: 0, scale: 1, opacity: 1 },
        {
          x: xDrift,
          y: yFly,
          scale: 0,
          opacity: 0,
          duration: 0.5,
          ease: 'power2.out',
          onComplete: () => el.remove(),
        },
      )
    })
  }, [])

  const handleExport = async (format: ExportFormat) => {
    setOpen(false)

    if (format === 'png') {
      const blob = generatePalettePNG(designSystem.colors)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'palette.png'
      a.click()
      URL.revokeObjectURL(url)
    } else {
      const output = formatExport(designSystem, format)
      await copyToClipboard(output)
    }

    setSuccess(true)
    spawnConfetti()
    setTimeout(() => setSuccess(false), 1500)
    onExport?.(format)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:ring-panel-accent focus-visible:ring-offset-1 focus-visible:ring-offset-panel-bg ${
          success
            ? 'bg-success text-white'
            : 'bg-panel-accent text-white hover:bg-panel-accent-hover'
        }`}
      >
        {success ? <Check size={12} /> : <Export size={12} />}
        {success ? 'Done!' : 'Export'}
      </button>

      {/* Confetti container */}
      <div ref={confettiContainerRef} className="absolute top-0 left-0 w-full h-0 overflow-visible pointer-events-none" />

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full right-0 mt-1.5 w-44 bg-panel-surface border border-panel-border rounded-lg shadow-xl overflow-hidden z-20 toast-enter">
          {EXPORT_OPTIONS.map((opt) => (
            <button
              key={opt.format}
              onClick={() => handleExport(opt.format)}
              className="w-full px-3 py-2 text-left text-[11px] text-panel-text hover:bg-panel-accent/10 hover:text-panel-accent transition-colors duration-150"
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default ExportButton
