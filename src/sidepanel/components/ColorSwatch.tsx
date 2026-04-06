import { useState, useRef, useCallback } from 'react'
import { Check } from '@phosphor-icons/react'
import gsap from 'gsap'
import { copyToClipboard } from '@/lib/export'
import { usePanelStore } from '../store'

interface ColorSwatchProps {
  color: string
  size?: number
  showLabel?: boolean
  format?: 'hex' | 'rgb' | 'hsl'
}

function formatColor(hex: string, format: 'hex' | 'rgb' | 'hsl'): string {
  if (format === 'hex') return hex
  // Simple conversion for display
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  if (format === 'rgb') return `rgb(${r}, ${g}, ${b})`
  // HSL
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return `hsl(0, 0%, ${Math.round(l * 100)}%)`
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
  else if (max === gn) h = ((bn - rn) / d + 2) / 6
  else h = ((rn - gn) / d + 4) / 6
  return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`
}

function ColorSwatch({ color, size = 32, showLabel = false, format }: ColorSwatchProps) {
  const storeFormat = usePanelStore((s) => s.colorFormat)
  const activeFormat = format || storeFormat
  const [copied, setCopied] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const btnRef = useRef<HTMLButtonElement>(null)

  const displayValue = formatColor(color, activeFormat)

  const handleClick = async () => {
    await copyToClipboard(displayValue)
    setCopied(true)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setCopied(false), 1500)
  }

  const handleMouseEnter = useCallback(() => {
    setShowTooltip(true)
    if (btnRef.current) {
      gsap.to(btnRef.current, {
        scale: 1.15,
        duration: 0.25,
        ease: 'back.out(2)',
      })
    }
  }, [])

  const handleMouseLeave = useCallback(() => {
    setShowTooltip(false)
    if (btnRef.current) {
      gsap.to(btnRef.current, {
        scale: 1,
        duration: 0.2,
        ease: 'power2.out',
      })
    }
  }, [])

  return (
    <div className="relative inline-flex items-center gap-2">
      <button
        ref={btnRef}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="rounded-full border border-panel-border focus-visible:ring-2 focus-visible:ring-panel-accent focus-visible:ring-offset-1 focus-visible:ring-offset-panel-bg shrink-0"
        style={{
          width: size,
          height: size,
          backgroundColor: color,
          willChange: 'transform',
        }}
        title={displayValue}
      >
        {copied && (
          <span className="flex items-center justify-center w-full h-full">
            <Check size={size * 0.45} weight="bold" className="text-white drop-shadow-md" />
          </span>
        )}
      </button>

      {/* Tooltip */}
      {showTooltip && !copied && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-panel-bg border border-panel-border rounded text-[10px] font-mono text-panel-text whitespace-nowrap shadow-lg toast-enter z-10">
          {displayValue}
        </div>
      )}

      {/* Copied toast */}
      {copied && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-success/90 rounded text-[10px] font-medium text-white whitespace-nowrap shadow-lg toast-enter z-10">
          Copied!
        </div>
      )}

      {showLabel && (
        <span className="text-[11px] font-mono text-panel-text-dim">{displayValue}</span>
      )}
    </div>
  )
}

export default ColorSwatch
