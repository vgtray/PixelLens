import { useState } from 'react'
import { Copy, DownloadSimple, FileCode } from '@phosphor-icons/react'
import { usePanelStore } from '../store'
import CSSBlock from '../components/CSSBlock'
import { formatExport } from '@/lib/design-tokens'
import { copyToClipboard, downloadFile } from '@/lib/export'
import type { ExportFormat } from '@/types/design-system'

const FORMATS: { id: ExportFormat; label: string; ext: string; mime: string }[] = [
  { id: 'css-variables', label: 'CSS Variables', ext: 'css', mime: 'text/css' },
  { id: 'tailwind', label: 'Tailwind', ext: 'js', mime: 'text/javascript' },
  { id: 'json', label: 'JSON', ext: 'json', mime: 'application/json' },
]

function ExportView() {
  const designSystem = usePanelStore((s) => s.designSystem)
  const setMode = usePanelStore((s) => s.setMode)
  const [format, setFormat] = useState<ExportFormat>('css-variables')
  const [copied, setCopied] = useState(false)

  if (!designSystem) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-panel-surface border border-panel-border flex items-center justify-center">
          <FileCode size={28} className="text-panel-text-dim" />
        </div>
        <div>
          <p className="text-[13px] font-medium text-panel-text mb-1">Nothing to export</p>
          <p className="text-[11px] text-panel-text-dim leading-relaxed mb-4">
            Scan a page first to generate exportable tokens
          </p>
          <button
            onClick={() => setMode('scan')}
            className="px-4 py-2 rounded-lg bg-panel-accent text-white text-[12px] font-medium hover:bg-panel-accent-hover transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-panel-accent focus-visible:ring-offset-2 focus-visible:ring-offset-panel-bg"
          >
            Go to Scan
          </button>
        </div>
      </div>
    )
  }

  const output = formatExport(designSystem, format)
  const currentFormat = FORMATS.find((f) => f.id === format)!

  const handleCopy = async () => {
    await copyToClipboard(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleDownload = () => {
    const filename = `design-tokens.${currentFormat.ext}`
    downloadFile(output, filename, currentFormat.mime)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Format selector */}
      <div className="shrink-0 px-3 py-3 border-b border-panel-border">
        <div className="flex gap-1 p-0.5 bg-panel-surface rounded-lg">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFormat(f.id)}
              className={`flex-1 py-1.5 text-[11px] font-medium rounded-md transition-all duration-200 ${
                format === f.id
                  ? 'bg-panel-accent text-white shadow-sm'
                  : 'text-panel-text-dim hover:text-panel-text'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Code preview */}
      <div className="flex-1 overflow-y-auto p-3">
        <CSSBlock
          code={output}
          language={format === 'json' ? 'json' : format === 'tailwind' ? 'js' : 'css'}
        />
      </div>

      {/* Actions */}
      <div className="shrink-0 p-3 border-t border-panel-border flex gap-2">
        <button
          onClick={handleCopy}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:ring-panel-accent focus-visible:ring-offset-2 focus-visible:ring-offset-panel-bg ${
            copied
              ? 'bg-success text-white'
              : 'bg-panel-accent text-white hover:bg-panel-accent-hover'
          }`}
        >
          <Copy size={14} />
          {copied ? 'Copied!' : 'Copy to Clipboard'}
        </button>
        <button
          onClick={handleDownload}
          className="px-3 py-2 rounded-lg border border-panel-border text-panel-text-dim text-[12px] font-medium hover:bg-panel-surface hover:text-panel-text transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-panel-accent focus-visible:ring-offset-2 focus-visible:ring-offset-panel-bg"
          title="Download"
        >
          <DownloadSimple size={14} />
        </button>
      </div>
    </div>
  )
}

export default ExportView
