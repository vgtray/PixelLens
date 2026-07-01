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
  FileZip,
  Prohibit,
  Database,
  TreeStructure,
  Lightning,
  Browser,
} from '@phosphor-icons/react'
import { usePanelStore } from '../store'
import { sendMessage } from '@/lib/messaging'
import { MessageType } from '@/types/messages'
import { copyToClipboard, downloadMarkdown } from '@/lib/export'
import { downloadCrawlZip } from '@/lib/crawl-zip'
import MarkdownPreview from '../components/MarkdownPreview'

// Le download contient TOUT le document ; la preview est tronquée au-delà de ce seuil
// pour ne pas faire ramer le panel (le document peut peser plusieurs Mo).
const PREVIEW_LIMIT = 60_000

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Libellé lisible d'une raison de skip pour le breakdown (`http-403` → `HTTP 403`).
// C'est ce qui dit à l'utilisateur POURQUOI une page a été ignorée.
function formatSkipReason(reason: string): string {
  if (reason.startsWith('http-')) return `HTTP ${reason.slice(5)}`
  switch (reason) {
    case 'robots':
      return 'robots.txt'
    case 'timeout':
      return 'timeout'
    case 'non-text':
      return 'non-text'
    case 'cross-origin':
      return 'off-site'
    case 'network':
      return 'network/CORS'
    case 'empty':
      return 'empty'
    default:
      return reason
  }
}

// Fast (fetch server HTML) vs Full (navigate each page in a real background tab so the
// JS runs, then capture the RENDERED DOM). Full is the fix for JS-rendered SPAs whose
// initial HTML is an empty shell. Local UI state — passed in the CRAWL_SITE payload.
function RenderModeToggle({
  value,
  onChange,
}: {
  value: 'fast' | 'full'
  onChange: (v: 'fast' | 'full') => void
}) {
  return (
    <div
      role="group"
      aria-label="Render mode"
      className="flex items-center gap-1 p-0.5 rounded-lg bg-panel-surface border border-panel-border"
    >
      {(
        [
          { value: 'fast', label: 'Fast', icon: Lightning },
          { value: 'full', label: 'Full', icon: Browser },
        ] as const
      ).map(({ value: v, label, icon: Icon }) => {
        const isActive = value === v
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            aria-pressed={isActive}
            title={v === 'fast' ? 'Fetch server HTML (fast)' : 'Render in a real browser tab (handles SPAs)'}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[11px] font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panel-accent focus-visible:ring-offset-1 focus-visible:ring-offset-panel-bg ${
              isActive ? 'bg-panel-accent text-white' : 'text-panel-text-dim hover:text-panel-text'
            }`}
          >
            <Icon size={13} weight={isActive ? 'fill' : 'regular'} />
            {label}
          </button>
        )
      })}
    </div>
  )
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
  const exportMode = usePanelStore((s) => s.crawlExportMode)
  const setExportMode = usePanelStore((s) => s.setCrawlExportMode)
  const respectRobots = usePanelStore((s) => s.crawlRespectRobots)
  const setRespectRobots = usePanelStore((s) => s.setCrawlRespectRobots)
  const [copied, setCopied] = useState(false)
  // Render mode is LOCAL (not persisted in the store): Fast (fetch) vs Full (real tab).
  const [renderMode, setRenderMode] = useState<'fast' | 'full'>('fast')
  // Mode the currently-shown result was crawled with — drives the "empty → try Full" hint.
  const [resultMode, setResultMode] = useState<'fast' | 'full'>('fast')

  const handleStart = useCallback(async () => {
    setRunning(true)
    setError(null)
    setResult(null)
    setProgress(null)
    // Fige le mode utilisé pour CE crawl : le résultat qui reviendra sera jugé (hint
    // empty→Full) selon ce mode, même si l'utilisateur bascule le toggle entre-temps.
    setResultMode(renderMode)
    try {
      // startUrl vide : le content script fait autorité et utilise location.href de
      // l'onglet courant (le panel n'a pas forcément accès à tab.url).
      const res = await sendMessage(MessageType.CRAWL_SITE, {
        startUrl: '',
        respectRobots,
        renderMode,
      })
      if (!res?.success) {
        setRunning(false)
        setError('unsupported')
      }
      // Succès : la progression puis le document arrivent via CRAWL_PROGRESS/COMPLETE.
    } catch {
      setRunning(false)
      setError('failed')
    }
  }, [setRunning, setError, setResult, setProgress, respectRobots, renderMode])

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
          <div className="mt-4 flex flex-col gap-1.5">
            <span className="text-[10px] text-panel-text-dim uppercase tracking-wide">Render</span>
            <RenderModeToggle value={renderMode} onChange={setRenderMode} />
          </div>
          <p className="text-[10px] text-panel-text-dim/80 leading-relaxed mt-4">
            {renderMode === 'fast'
              ? "Fast reads each page's initial HTML — client-rendered SPAs may come out partial."
              : 'Full opens each page in a real background tab so the JS runs, then captures the rendered DOM. Slower, but handles SPAs.'}
          </p>
        </div>
      </div>
    )
  }

  // --- Done — document concaténé ----------------------------------------------------
  const { stats } = result
  // Breakdown lisible des raisons de skip (trié par nombre décroissant). RÉVÈLE
  // pourquoi le crawl skippe — la donnée manquante de la version précédente.
  const reasonEntries = (Object.entries(result.skippedReasons) as [string, number | undefined][])
    .map(([reason, n]) => [reason, n ?? 0] as const)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
  const robotsSkipped = result.skippedReasons.robots ?? 0
  // Empty conversions in FAST mode are the signal that the site is JS-rendered → suggest Full.
  const emptySkipped = result.skippedReasons.empty ?? 0
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
    if (exportMode === 'zip') {
      // Multi-file archive: one .md per page + a linking index.md.
      downloadCrawlZip(result)
    } else {
      downloadMarkdown(`${result.host}-site.md`, result.document)
    }
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

        {reasonEntries.length > 0 && (
          <p className="text-[10px] text-panel-text-dim mt-2 leading-relaxed">
            <span className="text-panel-text">{stats.skippedCount.toLocaleString()}</span> skipped:{' '}
            {reasonEntries.map(([reason, n]) => `${n} ${formatSkipReason(reason)}`).join(' · ')}
          </p>
        )}

        {respectRobots && robotsSkipped > 0 && (
          <p className="text-[10px] text-panel-accent/90 mt-1.5 leading-relaxed">
            {robotsSkipped.toLocaleString()} blocked by robots.txt — turn off “Respect
            robots.txt” below and crawl again to include them.
          </p>
        )}

        {resultMode === 'fast' && emptySkipped > 0 && (
          <p className="text-[10px] text-panel-accent/90 mt-1.5 leading-relaxed">
            {emptySkipped.toLocaleString()} empty page{emptySkipped === 1 ? '' : 's'} — this site
            renders with JavaScript. Switch “Render” to <span className="font-medium">Full</span>{' '}
            below and crawl again.
          </p>
        )}

        {stats.pageCount === 0 && stats.skippedCount === 0 && (
          <p className="text-[10px] text-panel-text-dim mt-2 leading-relaxed">
            No pages could be converted — the site may be client-rendered (its initial HTML
            is empty).
          </p>
        )}
      </div>

      {/* Preview */}
      <div className="flex-1 min-h-0 p-3">
        <MarkdownPreview markdown={preview} />
      </div>

      {/* Actions */}
      <div className="shrink-0 p-3 border-t border-panel-border flex flex-col gap-2">
        {/* Render mode — Fast (fetch) vs Full (real browser tab). Takes effect on the next
            crawl (Crawl again). Full is the fix for JS-rendered SPAs. */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-panel-text-dim shrink-0">Render</span>
          <div className="w-[140px]">
            <RenderModeToggle value={renderMode} onChange={setRenderMode} />
          </div>
        </div>

        {/* Respect robots.txt — ON by default (safe). Turn OFF to include pages that
            robots.txt blocks: this is a human converting pages they can already see,
            not an indexing crawler. Takes effect on the next crawl (Crawl again). */}
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="text-[11px] text-panel-text-dim">Respect robots.txt</span>
          <button
            type="button"
            role="switch"
            aria-checked={respectRobots}
            aria-label="Respect robots.txt"
            onClick={() => setRespectRobots(!respectRobots)}
            className={`relative h-4 w-7 shrink-0 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panel-accent focus-visible:ring-offset-1 focus-visible:ring-offset-panel-bg ${
              respectRobots ? 'bg-panel-accent' : 'bg-panel-border'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white transition-transform duration-200 ${
                respectRobots ? 'translate-x-3' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Export format — single concatenated .md vs a multi-file .zip. Additive:
            Copy always yields the single document; only the download shape changes. */}
        <div
          role="group"
          aria-label="Download format"
          className="flex items-center gap-1 p-0.5 rounded-lg bg-panel-surface border border-panel-border"
        >
          {([
            { value: 'single', label: '1 file', icon: Files },
            { value: 'zip', label: 'ZIP', icon: FileZip },
          ] as const).map(({ value, label, icon: Icon }) => {
            const isActive = exportMode === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => setExportMode(value)}
                aria-pressed={isActive}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[11px] font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panel-accent focus-visible:ring-offset-1 focus-visible:ring-offset-panel-bg ${
                  isActive
                    ? 'bg-panel-accent text-white'
                    : 'text-panel-text-dim hover:text-panel-text'
                }`}
              >
                <Icon size={13} weight={isActive ? 'fill' : 'regular'} />
                {label}
              </button>
            )
          })}
        </div>

        <div className="flex gap-2">
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
            aria-label={exportMode === 'zip' ? 'Download ZIP archive' : 'Download Markdown file'}
            className="px-3 py-2 rounded-lg border border-panel-border text-panel-text-dim text-[12px] font-medium hover:bg-panel-surface hover:text-panel-text transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-panel-accent focus-visible:ring-offset-2 focus-visible:ring-offset-panel-bg"
            title={exportMode === 'zip' ? 'Download .zip' : 'Download .md'}
          >
            <DownloadSimple size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default CrawlView
