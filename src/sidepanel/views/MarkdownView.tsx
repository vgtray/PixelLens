import { useCallback, useState } from 'react'
import {
  MarkdownLogo,
  CircleNotch,
  WarningCircle,
  ArrowClockwise,
  Globe,
  Copy,
  Check,
  DownloadSimple,
  TextAlignLeft,
  TextHOne,
  LinkSimple,
  Image as ImageIcon,
  Table,
  Code,
  Sparkle,
} from '@phosphor-icons/react'
import { usePanelStore } from '../store'
import { sendMessage } from '@/lib/messaging'
import { MessageType } from '@/types/messages'
import { copyToClipboard, downloadMarkdown } from '@/lib/export'
import { buildLlmBundle } from '@/lib/llm-bundle'
import type { MarkdownFrontmatter, MarkdownResult } from '@/types/markdown'
import MarkdownPreview from '../components/MarkdownPreview'
import StaleScanBanner from '../components/StaleScanBanner'
import { isDifferentHost } from '@/lib/url'

// Build a safe .md filename from the page title (fallback: hostname).
function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')
}

function deriveFilename(fm: MarkdownFrontmatter): string {
  const slug = slugify(fm.title ?? '')
  if (slug) return `${slug}.md`
  try {
    return `${new URL(fm.url).hostname.replace(/^www\./, '')}.md`
  } catch {
    return 'page.md'
  }
}

function displayHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function MarkdownView() {
  const result = usePanelStore((s) => s.markdownResult)
  const loading = usePanelStore((s) => s.markdownLoading)
  const error = usePanelStore((s) => s.markdownError)
  const setResult = usePanelStore((s) => s.setMarkdownResult)
  const setLoading = usePanelStore((s) => s.setMarkdownLoading)
  const setError = usePanelStore((s) => s.setMarkdownError)
  const designSystem = usePanelStore((s) => s.designSystem)
  const activeTabUrl = usePanelStore((s) => s.activeTabUrl)
  const [copied, setCopied] = useState(false)
  const [copiedLlm, setCopiedLlm] = useState(false)

  const handleGenerate = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const extracted: MarkdownResult | undefined = await sendMessage(
        MessageType.EXTRACT_MARKDOWN,
        undefined,
      )
      if (!extracted) {
        setResult(null)
        setError('unsupported')
      } else {
        setResult(extracted)
      }
    } catch {
      setError('failed')
    } finally {
      setLoading(false)
    }
  }, [setLoading, setError, setResult])

  // Loading — extraction in progress
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
        <CircleNotch size={28} className="text-panel-accent animate-spin" />
        <div>
          <p className="text-[13px] font-medium text-panel-text mb-1">Converting page</p>
          <p className="text-[11px] text-panel-text-dim leading-relaxed">
            Reading the document and building Markdown…
          </p>
        </div>
      </div>
    )
  }

  // Error — unsupported page or extraction failure
  if (error && !result) {
    const isUnsupported = error === 'unsupported'
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-panel-surface border border-panel-border flex items-center justify-center">
          <WarningCircle size={28} className="text-panel-text-dim" />
        </div>
        <div>
          <p className="text-[13px] font-medium text-panel-text mb-1">
            {isUnsupported ? 'Page not supported' : 'Conversion failed'}
          </p>
          <p className="text-[11px] text-panel-text-dim leading-relaxed mb-4">
            {isUnsupported
              ? 'Open a regular website to convert it to Markdown.'
              : 'Something went wrong while reading the page. Try again.'}
          </p>
          <button
            onClick={handleGenerate}
            className="px-4 py-2 rounded-lg bg-panel-accent text-white text-[12px] font-medium hover:bg-panel-accent-hover transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-panel-accent focus-visible:ring-offset-2 focus-visible:ring-offset-panel-bg"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  // Empty — nothing generated yet
  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-panel-surface border border-panel-border flex items-center justify-center">
          <MarkdownLogo size={28} className="text-panel-text-dim" />
        </div>
        <div>
          <p className="text-[13px] font-medium text-panel-text mb-1">Page to Markdown</p>
          <p className="text-[11px] text-panel-text-dim leading-relaxed mb-4">
            Convert the current page into clean Markdown — copy it or download a .md file
          </p>
          <button
            onClick={handleGenerate}
            className="px-4 py-2 rounded-lg bg-panel-accent text-white text-[12px] font-medium hover:bg-panel-accent-hover transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-panel-accent focus-visible:ring-offset-2 focus-visible:ring-offset-panel-bg"
          >
            Convert to Markdown
          </button>
        </div>
      </div>
    )
  }

  // Success — preview + meta + actions
  const { frontmatter: fm, stats } = result

  const chips: { icon: typeof TextHOne; value: number; label: string }[] = [
    { icon: TextAlignLeft, value: fm.wordCount, label: 'words' },
    { icon: TextHOne, value: stats.headings, label: 'headings' },
    { icon: LinkSimple, value: stats.links, label: 'links' },
    { icon: ImageIcon, value: stats.images, label: 'images' },
    { icon: Table, value: stats.tables, label: 'tables' },
    { icon: Code, value: stats.codeBlocks, label: 'code blocks' },
  ]

  let capturedLabel: string
  try {
    capturedLabel = new Date(fm.capturedAt).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    capturedLabel = fm.capturedAt
  }

  const handleCopy = async () => {
    await copyToClipboard(result.fullDocument)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleDownload = () => {
    downloadMarkdown(deriveFilename(fm), result.fullDocument)
  }

  const handleCopyLlm = async () => {
    const bundle = buildLlmBundle({ markdown: result, designSystem })
    await copyToClipboard(bundle)
    setCopiedLlm(true)
    setTimeout(() => setCopiedLlm(false), 1500)
  }

  // The persisted markdown result may be from a previously visited site; flag
  // it rather than presenting it as the current page's conversion.
  const stale = isDifferentHost(fm.url, activeTabUrl)

  return (
    <div className="flex flex-col h-full">
      {stale && (
        <StaleScanBanner scanUrl={fm.url} onRescan={handleGenerate} action="Convert" />
      )}
      {/* Meta header — frontmatter + stats */}
      <div className="shrink-0 px-3 py-3 border-b border-panel-border">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-panel-text truncate" title={fm.title}>
              {fm.title || 'Untitled'}
            </p>
            <div className="flex items-center gap-1 mt-0.5 text-panel-text-dim min-w-0">
              <Globe size={11} className="shrink-0" />
              <span className="text-[11px] font-mono truncate" title={fm.url}>
                {displayHost(fm.url)}
              </span>
            </div>
          </div>
          <button
            onClick={handleGenerate}
            aria-label="Regenerate"
            title="Regenerate"
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
                title={`${chip.value.toLocaleString()} ${chip.label}`}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-panel-surface border border-panel-border text-[10px] text-panel-text-dim"
              >
                <Icon size={11} className="text-panel-text-dim" />
                <span className="text-panel-text font-mono">{chip.value.toLocaleString()}</span>
              </span>
            )
          })}
        </div>

        {capturedLabel && (
          <p className="text-[10px] text-panel-text-dim mt-2 font-mono">{capturedLabel}</p>
        )}
      </div>

      {/* Preview */}
      <div className="flex-1 min-h-0 p-3">
        <MarkdownPreview markdown={result.markdown} />
      </div>

      {/* Actions */}
      <div className="shrink-0 p-3 border-t border-panel-border flex flex-col gap-2">
        {/* Hero action — the headline feature: one paste-ready document for an AI. */}
        <button
          onClick={handleCopyLlm}
          className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:ring-panel-accent focus-visible:ring-offset-2 focus-visible:ring-offset-panel-bg ${
            copiedLlm
              ? 'bg-success text-white'
              : 'bg-panel-accent text-white hover:bg-panel-accent-hover'
          }`}
        >
          {copiedLlm ? <Check size={14} /> : <Sparkle size={14} weight="fill" />}
          {copiedLlm ? 'Copied for LLM!' : 'Copy for LLM'}
        </button>
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:ring-panel-accent focus-visible:ring-offset-2 focus-visible:ring-offset-panel-bg ${
              copied
                ? 'bg-success text-white'
                : 'bg-panel-surface border border-panel-border text-panel-text hover:border-panel-accent'
            }`}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy Markdown'}
          </button>
          <button
            onClick={handleDownload}
            aria-label="Download Markdown file"
            className="px-3 py-2 rounded-lg border border-panel-border text-panel-text-dim text-[12px] font-medium hover:bg-panel-surface hover:text-panel-text transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-panel-accent focus-visible:ring-offset-2 focus-visible:ring-offset-panel-bg"
            title="Download .md"
          >
            <DownloadSimple size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default MarkdownView
