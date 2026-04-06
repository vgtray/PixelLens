import { useState } from 'react'
import { Copy, Check } from '@phosphor-icons/react'
import { copyToClipboard } from '@/lib/export'

interface CSSBlockProps {
  code: string
  language?: 'css' | 'json' | 'js'
}

function highlightCSS(code: string): { html: string } {
  // Basic syntax highlighting via spans
  const escaped = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  const html = escaped
    // CSS property names
    .replace(
      /^(\s*)([\w-]+)(\s*:)/gm,
      '$1<span class="text-panel-text-dim">$2</span>$3',
    )
    // CSS values after colon
    .replace(
      /:\s*(.+?);/g,
      ': <span class="text-panel-text">$1</span>;',
    )
    // Selectors and braces
    .replace(
      /^([.#\w][\w\-.*#\[\]=~|^$:, ]*)\s*\{/gm,
      '<span class="text-panel-accent">$1</span> {',
    )
    // Strings
    .replace(
      /(".*?")/g,
      '<span class="text-panel-accent">$1</span>',
    )
    // Numbers
    .replace(
      /\b(\d+\.?\d*)(px|rem|em|%|vh|vw|s|ms)?\b/g,
      '<span class="text-amber-400">$1$2</span>',
    )

  return { html }
}

function CSSBlock({ code, language = 'css' }: CSSBlockProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await copyToClipboard(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const lines = code.split('\n')
  const { html } = language === 'css' ? highlightCSS(code) : { html: '' }

  return (
    <div className="relative rounded-lg bg-panel-surface border border-panel-border overflow-hidden">
      {/* Copy button */}
      <button
        onClick={handleCopy}
        className={`absolute top-2 right-2 p-1.5 rounded-md transition-all duration-200 z-10 ${
          copied
            ? 'bg-success/20 text-success'
            : 'bg-panel-bg/80 text-panel-text-dim hover:text-panel-text hover:bg-panel-bg'
        }`}
        title={copied ? 'Copied!' : 'Copy'}
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>

      {/* Code */}
      <div className="max-h-[300px] overflow-y-auto p-3 pr-10">
        {language === 'css' ? (
          <pre className="text-[11px] leading-[1.6] font-mono whitespace-pre-wrap break-all">
            <code dangerouslySetInnerHTML={{ __html: html }} />
          </pre>
        ) : (
          <pre className="text-[11px] leading-[1.6] font-mono whitespace-pre-wrap break-all">
            {lines.map((line, i) => (
              <div key={i} className="flex">
                <span className="text-panel-text-dim w-6 shrink-0 text-right mr-3 select-none">
                  {i + 1}
                </span>
                <span className="text-panel-text">{line}</span>
              </div>
            ))}
          </pre>
        )}
      </div>
    </div>
  )
}

export default CSSBlock
