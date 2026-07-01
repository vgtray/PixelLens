import { useCallback, useState } from 'react'
import {
  GlobeHemisphereWest,
  WarningCircle,
  Copy,
  Check,
  DownloadSimple,
  Stop,
  ArrowClockwise,
  Files,
  Prohibit,
  Database,
  TreeStructure,
} from '@phosphor-icons/react'
import { usePanelStore } from '../store'
import { sendMessage } from '@/lib/messaging'
import { MessageType } from '@/types/messages'
import { copyToClipboard, downloadMarkdown } from '@/lib/export'
import MarkdownPreview from '../components/MarkdownPreview'

// Le download contient TOUT le document ; la preview est tronquée au-delà de ce seuil
// pour ne pas faire ramer le panel (le document peut peser plusieurs Mo).
const PREVIEW_LIMIT = 60_000

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function CrawlView() {
  const running = usePanelStore((s) => s.crawlRunning)
  const progress = usePanelStore((s) => s.crawlProgress)
  const result = usePanelStore((s) => s.crawlResult)
  const error = usePanelStore((s) => s.crawlError)
  const setRunning = usePanelStore((s) => s.setCrawlRunning)
  const setProgress = usePanelStore((s) => s.setCrawlProgress)
  const setResult = usePanelStore((s) => s.setCrawlResult)
  const setError = usePanelStore((s) => s.setCrawlError)
  const [copied, setCopied] = useState(false)

  const handleStart = useCallback(async () => {
    setRunning(true)
    setError(null)
    setResult(null)
    setProgress(null)
    try {
      // startUrl vide : le content script fait autorité et utilise location.href de
      // l'onglet courant (le panel n'a pas forcément accès à tab.url).
      const res = await sendMessage(MessageType.CRAWL_SITE, { startUrl: '' })
      if (!res?.success) {
        setRunning(false)
        setError('unsupported')
      }
      // Succès : la progression puis le document arrivent via CRAWL_PROGRESS/COMPLETE.
    } catch {
      setRunning(false)
      setError('failed')
    }
  }, [setRunning, setError, setResult, setProgress])

  const handleStop = useCallback(() => {
    // Annulation coopérative : le crawl finit la page en cours puis renvoie le document
    // partiel via CRAWL_COMPLETE (qui repasse running à false).
    sendMessage(MessageType.STOP_CRAWL, undefined).catch(() => {})
  }, [])

  // --- Running — crawl en cours -----------------------------------------------------
  if (running) {
    const done = progress?.done ?? 0
    const total = progress?.total ?? 0
    const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0
    return (
      <div className="flex flex-col items-center justify-center h-full gap-5 px-6 text-center">
        <div className="w-full max-w-[240px]">
          <div className="flex items-center justify-between mb-2 text-[11px] text-panel-text-dim font-mono">
            <span>
              {done}/{total || '…'} pages
            </span>
            <span>{percent}%</span>
          </div>
          <div className="h-2 rounded-full bg-panel-surface overflow-hidden">
            <div
              className="h-full rounded-full transition-[width] duration-300 ease-out"
              style={{
                width: `${percent}%`,
                background:
                  'linear-gradient(90deg, var(--color-panel-accent) 0%, #818CF8 50%, var(--color-panel-accent) 100%)',
              }}
            />
          </div>
          {progress?.currentUrl && (
            <p
              className="text-[10px] text-panel-text-dim text-center font-mono mt-2.5 truncate"
              title={progress.currentUrl}
            >
              {progress.currentUrl}
            </p>
          )}
          {progress && progress.skipped > 0 && (
            <p className="text-[10px] text-panel-text-dim text-center mt-1">
              {progress.skipped} skipped
            </p>
          )}
        </div>
        <button
          onClick={handleStop}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-panel-border text-panel-text text-[12px] font-medium hover:bg-panel-surface transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-panel-accent focus-visible:ring-offset-2 focus-visible:ring-offset-panel-bg"
        >
          <Stop size={14} weight="fill" />
          Stop
        </button>
      </div>
    )
  }

  // --- Error — page non supportée / échec -------------------------------------------
  if (error && !result) {
    const isUnsupported = error === 'unsupported'
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-panel-surface border border-panel-border flex items-center justify-center">
          <WarningCircle size={28} className="text-panel-text-dim" />
        </div>
        <div>
          <p className="text-[13px] font-medium text-panel-text mb-1">
            {isUnsupported ? 'Page not supported' : 'Crawl failed'}
          </p>
          <p className="text-[11px] text-panel-text-dim leading-relaxed mb-4">
            {isUnsupported
              ? 'Open a regular website to crawl it into Markdown.'
              : 'Something went wrong while crawling. Try again.'}
          </p>
          <button
            onClick={handleStart}
            className="px-4 py-2 rounded-lg bg-panel-accent text-white text-[12px] font-medium hover:bg-panel-accent-hover transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-panel-accent focus-visible:ring-offset-2 focus-visible:ring-offset-panel-bg"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  // --- Empty — rien encore crawlé ---------------------------------------------------
  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-panel-surface border border-panel-border flex items-center justify-center">
          <GlobeHemisphereWest size={28} className="text-panel-text-dim" />
        </div>
        <div>
          <p className="text-[13px] font-medium text-panel-text mb-1">Site to Markdown</p>
          <p className="text-[11px] text-panel-text-dim leading-relaxed mb-4">
            Crawl every same-origin page of this site into one big Markdown document for an
            AI — sitemap-first, falling back to following links (max 100 pages, depth 3).
          </p>
          <button
            onClick={handleStart}
            className="px-4 py-2 rounded-lg bg-panel-accent text-white text-[12px] font-medium hover:bg-panel-accent-hover transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-panel-accent focus-visible:ring-offset-2 focus-visible:ring-offset-panel-bg"
          >
            Crawl entire site
          </button>
          <p className="text-[10px] text-panel-text-dim/80 leading-relaxed mt-4">
            {"Reads each page's initial HTML — client-rendered SPAs may come out partial."}
          </p>
        </div>
      </div>
    )
  }

  // --- Done — document concaténé ----------------------------------------------------
  const { stats } = result
  const preview =
    result.document.length > PREVIEW_LIMIT
      ? result.document.slice(0, PREVIEW_LIMIT) +
        '\n\n…\n\n[Preview truncated — the downloaded .md contains all ' +
        stats.pageCount +
        ' pages]'
      : result.document

  const chips: { icon: typeof Files; value: string; label: string }[] = [
    { icon: Files, value: stats.pageCount.toLocaleString(), label: 'pages' },
    { icon: Prohibit, value: stats.skippedCount.toLocaleString(), label: 'skipped' },
    { icon: Database, value: formatBytes(stats.bytes), label: 'size' },
    { icon: TreeStructure, value: stats.discovery, label: 'discovery' },
  ]

  const handleCopy = async () => {
    await copyToClipboard(result.document)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleDownload = () => {
    downloadMarkdown(`${result.host}-site.md`, result.document)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Meta header */}
      <div className="shrink-0 px-3 py-3 border-b border-panel-border">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-panel-text truncate" title={result.host}>
              {result.host}
            </p>
            <div className="flex items-center gap-1 mt-0.5 text-panel-text-dim min-w-0">
              <GlobeHemisphereWest size={11} className="shrink-0" />
              <span className="text-[11px] font-mono truncate" title={result.startUrl}>
                {result.startUrl}
              </span>
            </div>
          </div>
          <button
            onClick={handleStart}
            aria-label="Crawl again"
            title="Crawl again"
            className="shrink-0 p-1.5 rounded-md text-panel-text-dim hover:text-panel-text hover:bg-panel-surface transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-panel-accent focus-visible:ring-offset-1 focus-visible:ring-offset-panel-bg"
          >
            <ArrowClockwise size={14} />
          </button>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {chips.map((chip) => {
            const Icon = chip.icon
            return (
              <span
                key={chip.label}
                title={`${chip.value} ${chip.label}`}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-panel-surface border border-panel-border text-[10px] text-panel-text-dim"
              >
                <Icon size={11} className="text-panel-text-dim" />
                <span className="text-panel-text font-mono">{chip.value}</span>
              </span>
            )
          })}
        </div>

        {stats.pageCount === 0 && (
          <p className="text-[10px] text-panel-text-dim mt-2 leading-relaxed">
            No pages could be converted — the site may be client-rendered or blocked by
            robots.txt.
          </p>
        )}
      </div>

      {/* Preview */}
      <div className="flex-1 min-h-0 p-3">
        <MarkdownPreview markdown={preview} />
      </div>

      {/* Actions */}
      <div className="shrink-0 p-3 border-t border-panel-border flex gap-2">
        <button
          onClick={handleCopy}
          disabled={stats.pageCount === 0}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-panel-accent focus-visible:ring-offset-2 focus-visible:ring-offset-panel-bg ${
            copied
              ? 'bg-success text-white'
              : 'bg-panel-accent text-white hover:bg-panel-accent-hover'
          }`}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied!' : 'Copy Markdown'}
        </button>
        <button
          onClick={handleDownload}
          disabled={stats.pageCount === 0}
          aria-label="Download Markdown file"
          className="px-3 py-2 rounded-lg border border-panel-border text-panel-text-dim text-[12px] font-medium hover:bg-panel-surface hover:text-panel-text transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-panel-accent focus-visible:ring-offset-2 focus-visible:ring-offset-panel-bg"
          title="Download .md"
        >
          <DownloadSimple size={14} />
        </button>
      </div>
    </div>
  )
}

export default CrawlView
