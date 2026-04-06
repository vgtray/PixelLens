// PixelLens — Floating Toolbar (bottom of page, mode selector)

import React, { useRef, useEffect, useState, useCallback } from 'react'
import {
  MagnifyingGlass,
  Ruler,
  GridFour,
  Eyedropper,
  Scan,
} from '@phosphor-icons/react'
import gsap from 'gsap'

type ContentMode = 'off' | 'inspect' | 'measure' | 'grid'

interface FloatingToolbarProps {
  mode: ContentMode
  gridVisible: boolean
  onModeChange: (mode: ContentMode) => void
  onGridToggle: () => void
  onScan: () => void
}

const STORAGE_KEY = 'pixellens_toolbar_pos'

export function FloatingToolbar({
  mode,
  gridVisible,
  onModeChange,
  onGridToggle,
  onScan,
}: FloatingToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const dragOffset = useRef({ x: 0, y: 0 })

  // GSAP slide-up + fade-in on mount
  useEffect(() => {
    // Load saved position
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setPosition(JSON.parse(saved))
    } catch { /* ignore */ }

    const el = toolbarRef.current
    if (!el) return

    gsap.fromTo(
      el,
      { y: 30, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.4,
        ease: 'power3.out',
        delay: 0.05,
      },
    )
  }, [])

  // Save position on change
  useEffect(() => {
    if (position) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(position))
      } catch { /* ignore */ }
    }
  }, [position])

  // Drag handling
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (!toolbarRef.current) return
    const rect = toolbarRef.current.getBoundingClientRect()
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    setDragging(true)
  }, [])

  useEffect(() => {
    if (!dragging) return

    const onMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      })
    }

    const onMouseUp = () => setDragging(false)

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [dragging])

  const style: React.CSSProperties = position
    ? { left: position.x, top: position.y, transform: 'none' }
    : {}

  const buttons: {
    icon: React.ReactNode
    label: string
    active: boolean
    onClick: () => void
  }[] = [
    {
      icon: <MagnifyingGlass size={18} weight={mode === 'inspect' ? 'fill' : 'regular'} />,
      label: 'Inspect',
      active: mode === 'inspect',
      onClick: () => onModeChange('inspect'),
    },
    {
      icon: <Ruler size={18} weight={mode === 'measure' ? 'fill' : 'regular'} />,
      label: 'Measure',
      active: mode === 'measure',
      onClick: () => onModeChange('measure'),
    },
    {
      icon: <GridFour size={18} weight={gridVisible ? 'fill' : 'regular'} />,
      label: 'Grid',
      active: gridVisible,
      onClick: onGridToggle,
    },
    {
      icon: <Eyedropper size={18} weight="regular" />,
      label: 'Picker',
      active: false,
      onClick: () => {},
    },
    {
      icon: <Scan size={18} weight="regular" />,
      label: 'Scan',
      active: false,
      onClick: onScan,
    },
  ]

  return (
    <div
      ref={toolbarRef}
      onMouseDown={onMouseDown}
      style={{
        position: 'fixed',
        bottom: position ? 'auto' : '24px',
        left: position ? 'auto' : '50%',
        transform: position ? 'none' : 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '6px 8px',
        background: 'rgba(12, 12, 14, 0.90)',
        backdropFilter: 'blur(12px)',
        border: '1px solid #222225',
        borderRadius: '14px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        cursor: dragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        pointerEvents: 'auto',
        opacity: 0,
        willChange: 'transform, opacity',
        ...style,
      }}
    >
      {buttons.map((btn) => (
        <button
          key={btn.label}
          title={btn.label}
          onClick={(e) => {
            e.stopPropagation()
            btn.onClick()
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            border: 'none',
            cursor: 'pointer',
            background: btn.active ? '#6366F1' : 'transparent',
            color: btn.active ? '#fff' : '#7E7E85',
            transition: 'background 150ms ease, color 150ms ease',
          }}
          onMouseEnter={(e) => {
            if (!btn.active) {
              e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
              e.currentTarget.style.color = '#EDEDEF'
            }
          }}
          onMouseLeave={(e) => {
            if (!btn.active) {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = '#7E7E85'
            }
          }}
        >
          {btn.icon}
        </button>
      ))}
    </div>
  )
}
