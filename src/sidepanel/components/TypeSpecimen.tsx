import { useState } from 'react'
import { Check, Copy } from '@phosphor-icons/react'
import { copyToClipboard } from '@/lib/export'
import type { TypographyToken } from '@/types/design-system'

interface TypeSpecimenProps {
  typography: TypographyToken
  variant?: number
}

function TypeSpecimen({ typography, variant }: TypeSpecimenProps) {
  const [copied, setCopied] = useState(false)
  const familyName = typography.fontFamily.split(',')[0].replace(/['"]/g, '').trim()
  const displayVariants = variant !== undefined ? [typography.variants[variant]] : typography.variants

  const handleCopy = async () => {
    await copyToClipboard(typography.fontFamily)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="p-2.5 rounded-lg bg-panel-surface border border-panel-border">
      {/* Preview text */}
      <p
        className="text-[16px] text-panel-text mb-2 truncate"
        style={{ fontFamily: typography.fontFamily }}
      >
        The quick brown fox jumps over
      </p>

      {/* Font family + copy */}
      <div className="flex items-center gap-1.5 mb-2">
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] font-mono text-panel-accent hover:text-panel-accent-hover transition-colors duration-150"
        >
          {copied ? <Check size={10} className="text-success" /> : <Copy size={10} />}
          {familyName}
        </button>
      </div>

      {/* Variants */}
      {displayVariants.filter(Boolean).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {displayVariants.filter(Boolean).map((v, i) => (
            <span
              key={i}
              className="text-[10px] font-mono text-panel-text-dim bg-panel-bg px-1.5 py-0.5 rounded"
            >
              {v.fontSize} / {v.fontWeight}
              {v.lineHeight !== 'normal' ? ` / ${v.lineHeight}` : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default TypeSpecimen
