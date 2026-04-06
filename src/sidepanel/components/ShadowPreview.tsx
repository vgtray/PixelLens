import { useState } from 'react'
import { Check, Copy } from '@phosphor-icons/react'
import { copyToClipboard } from '@/lib/export'
import type { ShadowToken } from '@/types/design-system'

interface ShadowPreviewProps {
  shadow: ShadowToken
}

function ShadowPreview({ shadow }: ShadowPreviewProps) {
  const [copied, setCopied] = useState(false)

  const handleClick = async () => {
    await copyToClipboard(shadow.value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      onClick={handleClick}
      className="flex flex-col items-center gap-2 p-3 rounded-lg bg-panel-bg border border-panel-border hover:border-panel-accent/40 transition-all duration-200 group"
    >
      {/* Shadow preview box */}
      <div
        className="w-16 h-16 rounded-lg bg-panel-surface transition-transform duration-200 group-hover:scale-105"
        style={{ boxShadow: shadow.value }}
      />

      {/* Value */}
      <div className="flex items-center gap-1">
        {copied ? (
          <Check size={10} className="text-success" />
        ) : (
          <Copy size={10} className="text-panel-text-dim opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
        )}
        <span className={`text-[9px] font-mono truncate max-w-[100px] ${copied ? 'text-success' : 'text-panel-text-dim'}`}>
          {copied ? 'Copied!' : shadow.value}
        </span>
      </div>
    </button>
  )
}

export default ShadowPreview
