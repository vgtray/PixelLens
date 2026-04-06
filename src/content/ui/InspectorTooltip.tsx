// PixelLens — Inspector Tooltip (follows cursor during inspect mode)

import React from 'react'

interface TooltipData {
  tagName: string
  className: string
  width: number
  height: number
  x: number
  y: number
}

interface InspectorTooltipProps {
  data: TooltipData
}

export function InspectorTooltip({ data }: InspectorTooltipProps) {
  const label = data.className
    ? `${data.tagName}.${data.className.split(/\s+/)[0]}`
    : data.tagName

  const truncated = label.length > 35 ? label.slice(0, 35) + '...' : label

  return (
    <div
      style={{
        position: 'fixed',
        left: data.x + 12,
        top: data.y + 12,
        background: 'rgba(12, 12, 14, 0.95)',
        color: '#EDEDEF',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '11px',
        lineHeight: '16px',
        padding: '4px 8px',
        borderRadius: '6px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        pointerEvents: 'none',
        zIndex: 2147483647,
        whiteSpace: 'nowrap',
        opacity: 1,
        transition: 'opacity 100ms ease-out',
      }}
    >
      <span style={{ color: '#818CF8' }}>{truncated}</span>
      <span style={{ color: '#7E7E85', marginLeft: '8px' }}>
        {data.width} x {data.height}
      </span>
    </div>
  )
}
