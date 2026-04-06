// PixelLens — Content App (Shadow DOM React wrapper)

import React, { useState, useEffect, useCallback } from 'react'
import { createRoot } from 'react-dom/client'
import { FloatingToolbar } from './FloatingToolbar'
import { InspectorTooltip } from './InspectorTooltip'
import { sendMessage } from '@/lib/messaging'
import { MessageType } from '@/types/messages'

type ContentMode = 'off' | 'inspect' | 'measure' | 'grid'

interface TooltipData {
  tagName: string
  className: string
  width: number
  height: number
  x: number
  y: number
}

function ContentApp() {
  const [mode, setMode] = useState<ContentMode>('off')
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)
  const [gridVisible, setGridVisible] = useState(false)

  // Listen for mode changes from content/index.ts
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      setMode(detail.mode)
    }
    document.addEventListener('pixellens:mode-change', handler)
    return () => document.removeEventListener('pixellens:mode-change', handler)
  }, [])

  // Tooltip tracking on mousemove during inspect mode
  useEffect(() => {
    if (mode !== 'inspect') {
      setTooltip(null)
      return
    }

    const handler = (e: MouseEvent) => {
      const target = e.target as Element
      if (!target || isPixelLensElement(target)) {
        setTooltip(null)
        return
      }

      const rect = target.getBoundingClientRect()
      const className = target.className?.toString() || ''
      const truncated = className.length > 30 ? className.slice(0, 30) + '...' : className

      setTooltip({
        tagName: target.tagName.toLowerCase(),
        className: truncated,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        x: e.clientX,
        y: e.clientY,
      })
    }

    document.addEventListener('mousemove', handler, { passive: true })
    return () => document.removeEventListener('mousemove', handler)
  }, [mode])

  const handleModeChange = useCallback((newMode: ContentMode) => {
    if (newMode === mode) {
      // Toggle off
      setMode('off')
      sendMessage(MessageType.TOGGLE_INSPECT, { active: false })
      return
    }

    setMode(newMode)

    if (newMode === 'inspect') {
      sendMessage(MessageType.TOGGLE_INSPECT, { active: true })
    } else if (newMode === 'measure') {
      sendMessage(MessageType.TOGGLE_INSPECT, { active: false })
      sendMessage(MessageType.TOGGLE_MEASURE, { active: true })
    }
  }, [mode])

  const handleGridToggle = useCallback(() => {
    const next = !gridVisible
    setGridVisible(next)
    sendMessage(MessageType.TOGGLE_GRID, { visible: next })
  }, [gridVisible])

  const handleScan = useCallback(() => {
    sendMessage(MessageType.SCAN_PAGE, undefined)
  }, [])

  return (
    <>
      <FloatingToolbar
        mode={mode}
        gridVisible={gridVisible}
        onModeChange={handleModeChange}
        onGridToggle={handleGridToggle}
        onScan={handleScan}
      />
      {tooltip && <InspectorTooltip data={tooltip} />}
    </>
  )
}

function isPixelLensElement(el: Element): boolean {
  let node: Node | null = el
  while (node) {
    if ((node as HTMLElement).id === 'pixellens-host') return true
    node = node.parentNode
  }
  return false
}

export function mountContentApp(container: HTMLElement): void {
  const root = createRoot(container)
  root.render(<ContentApp />)
}
