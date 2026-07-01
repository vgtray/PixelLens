import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import {
  MagnifyingGlass,
  Scan,
  Palette,
  Export,
  ClockCounterClockwise,
  MarkdownLogo,
  GlobeHemisphereWest,
  GearSix,
  type Icon,
} from '@phosphor-icons/react'
import type { PanelMode } from '../store'
import { prefersReducedMotion } from '../reducedMotion'

/**
 * One entry in the command palette.
 *
 * The registry is deliberately decoupled from the store: a command only carries
 * its presentation (`label`/`icon`/`group`/`keywords`) plus a `run` callback —
 * it doesn't know *how* the action is wired. That keeps it extensible.
 *
 * -- Adding commands from another feature -----------------------------------
 * Export a factory that returns `Command[]` (mirror `createNavigationCommands`
 * below) and spread its result into the `commands` array assembled in
 * `App.tsx`:
 *
 *   const commands = useMemo(
 *     () => [
 *       ...createNavigationCommands(setMode),
 *       ...createContrastCommands(setMode, ...),   // future feature
 *       ...createCrawlZipCommands(...),            // future feature
 *     ],
 *     [setMode],
 *   )
 *
 * `keywords` are extra fuzzy-search terms (synonyms/aliases) that widen matches
 * without cluttering the visible `label`. `group` drives the section headers
 * shown when the query is empty; add new groups to `GROUP_ORDER` to control
 * their position.
 */
export interface Command {
  id: string
  label: string
  icon: Icon
  group: string
  keywords?: string[]
  run: () => void
}

// Section order when no query is typed. Groups missing from this list fall to
// the end in first-seen (registry) order.
const GROUP_ORDER: string[] = ['Analyze', 'Convert', 'Workspace']

/**
 * The base registry: every panel destination, mapped to `setMode`. Grouped so
 * the flat 8-way navigation reads as a mental model (analyze / convert /
 * workspace) instead of a wall of icons.
 */
export function createNavigationCommands(setMode: (mode: PanelMode) => void): Command[] {
  const go = (mode: PanelMode) => () => setMode(mode)
  return [
    { id: 'nav-inspect', label: 'Inspect element', icon: MagnifyingGlass, group: 'Analyze', keywords: ['pick', 'cursor', 'hover', 'element'], run: go('inspect') },
    { id: 'nav-scan', label: 'Scan design system', icon: Scan, group: 'Analyze', keywords: ['analyze', 'extract', 'tokens'], run: go('scan') },
    { id: 'nav-design-system', label: 'Design system', icon: Palette, group: 'Analyze', keywords: ['palette', 'colors', 'fonts', 'spacing', 'shadows', 'tokens'], run: go('design-system') },
    { id: 'nav-markdown', label: 'Convert to Markdown', icon: MarkdownLogo, group: 'Convert', keywords: ['md', 'article', 'reader', 'content'], run: go('markdown') },
    { id: 'nav-crawl', label: 'Crawl site', icon: GlobeHemisphereWest, group: 'Convert', keywords: ['spider', 'multi-page', 'website', 'sitemap'], run: go('crawl') },
    { id: 'nav-export', label: 'Export tokens', icon: Export, group: 'Workspace', keywords: ['css', 'tailwind', 'json', 'download', 'variables'], run: go('export') },
    { id: 'nav-history', label: 'History', icon: ClockCounterClockwise, group: 'Workspace', keywords: ['recent', 'past', 'scans'], run: go('history') },
    { id: 'nav-settings', label: 'Settings', icon: GearSix, group: 'Workspace', keywords: ['preferences', 'config', 'options', 'theme'], run: go('settings') },
  ]
}

/** True on macOS/iOS so the shortcut hint shows the Command key instead of Ctrl. */
export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false
  const platform = navigator.platform || navigator.userAgent || ''
  return /mac|iphone|ipad|ipod/i.test(platform)
}

/**
 * Lightweight subsequence fuzzy matcher (no dependency). Returns a score where
 * higher is better, or -1 when `query` is not an ordered subsequence of `text`.
 * Rewards consecutive runs, matches at word boundaries, and shorter targets.
 */
function fuzzyScore(query: string, text: string): number {
  const t = text.toLowerCase()
  let ti = 0
  let score = 0
  let run = 0
  let prev = -2
  for (let qi = 0; qi < query.length; qi++) {
    const found = t.indexOf(query[qi], ti)
    if (found === -1) return -1
    run = found === prev + 1 ? run + 1 : 0
    score += 1 + run * 3
    if (found === 0 || t[found - 1] === ' ' || t[found - 1] === '-') score += 8
    prev = found
    ti = found + 1
  }
  return score - t.length * 0.05
}

/** Best fuzzy score for a command across its label and keywords. */
function scoreCommand(query: string, cmd: Command): number {
  const q = query.trim().toLowerCase()
  if (q === '') return 0
  let best = fuzzyScore(q, cmd.label)
  if (cmd.keywords) {
    for (const kw of cmd.keywords) {
      const s = fuzzyScore(q, kw)
      // Keyword hits count, but rank just below an equal-strength label hit.
      if (s >= 0) best = Math.max(best, s - 2)
    }
  }
  return best
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-panel-border bg-panel-bg px-1 py-0.5 font-mono text-[9px] not-italic leading-none text-panel-text-dim">
      {children}
    </kbd>
  )
}

const LISTBOX_ID = 'cmdpalette-listbox'
const optionId = (i: number) => `cmdpalette-option-${i}`

interface CommandPaletteProps {
  open: boolean
  commands: Command[]
  onClose: () => void
}

/**
 * Command palette opened by the platform shortcut. Modal overlay (fixed within
 * the 320px panel), fuzzy search over every destination, full keyboard control
 * (up/down navigate, Enter run, Esc close), focus trap on the input, and the
 * ARIA combobox + listbox pattern. Entry animation is skipped under
 * `prefers-reduced-motion`.
 */
export function CommandPalette({ open, commands, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [entered, setEntered] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const reduce = prefersReducedMotion()

  // Filter + order. Empty query: everything, grouped by GROUP_ORDER (stable sort
  // preserves registry order within a group). Typed query: flat, best-first.
  const results = useMemo(() => {
    const q = query.trim()
    if (q === '') {
      const rank = (g: string) => {
        const i = GROUP_ORDER.indexOf(g)
        return i === -1 ? GROUP_ORDER.length : i
      }
      return [...commands].sort((a, b) => rank(a.group) - rank(b.group))
    }
    return commands
      .map((cmd) => ({ cmd, score: scoreCommand(q, cmd) }))
      .filter((r) => r.score >= 0)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.cmd)
  }, [commands, query])

  // Reset query + selection each time the palette opens.
  useEffect(() => {
    if (!open) return
    setQuery('')
    setActiveIndex(0)
    inputRef.current?.focus()
  }, [open])

  // Best match is always the default target as the query changes.
  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  // Entry transition: paint hidden, then flip on the next frame. Skipped (shown
  // immediately) when the user asked to reduce motion.
  useEffect(() => {
    if (!open) {
      setEntered(false)
      return
    }
    if (reduce) {
      setEntered(true)
      return
    }
    const raf = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(raf)
  }, [open, reduce])

  // Keep the active option scrolled into view during keyboard navigation.
  useEffect(() => {
    if (!open) return
    listRef.current
      ?.querySelector<HTMLElement>(`#${optionId(activeIndex)}`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])

  if (!open) return null

  const runCommand = (cmd: Command | undefined) => {
    if (!cmd) return
    cmd.run()
    onClose()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Escape':
        e.preventDefault()
        onClose()
        break
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex((i) => (results.length === 0 ? 0 : (i + 1) % results.length))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex((i) => (results.length === 0 ? 0 : (i - 1 + results.length) % results.length))
        break
      case 'Home':
        e.preventDefault()
        setActiveIndex(0)
        break
      case 'End':
        e.preventDefault()
        setActiveIndex(Math.max(0, results.length - 1))
        break
      case 'Enter':
        e.preventDefault()
        runCommand(results[activeIndex])
        break
      case 'Tab':
        // Only the input is focusable: keep focus trapped on it.
        e.preventDefault()
        inputRef.current?.focus()
        break
    }
  }

  const transition = reduce ? 'none' : 'opacity 150ms ease, transform 150ms ease'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-3 pt-12">
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
        style={{ opacity: entered ? 1 : 0, transition: reduce ? 'none' : 'opacity 150ms ease' }}
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={onKeyDown}
        className="relative w-full max-w-[300px] overflow-hidden rounded-xl border border-panel-border bg-panel-surface shadow-2xl shadow-black/60"
        style={{
          opacity: entered ? 1 : 0,
          transform: entered ? 'none' : 'translateY(-6px) scale(0.98)',
          transition,
        }}
      >
        {/* Search */}
        <div className="flex items-center gap-2 border-b border-panel-border px-3">
          <MagnifyingGlass size={15} className="shrink-0 text-panel-text-dim" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={LISTBOX_ID}
            aria-activedescendant={results.length > 0 ? optionId(activeIndex) : undefined}
            aria-autocomplete="list"
            aria-label="Search commands"
            placeholder="Search commands…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent py-3 text-[13px] text-panel-text placeholder:text-panel-text-dim focus:outline-none"
          />
        </div>

        {/* Results */}
        <ul
          ref={listRef}
          role="listbox"
          id={LISTBOX_ID}
          aria-label="Commands"
          className="max-h-[280px] overflow-y-auto py-1"
        >
          {results.length === 0 && (
            <li role="presentation" className="px-3 py-6 text-center text-[12px] text-panel-text-dim">
              No commands match “{query.trim()}”
            </li>
          )}
          {results.map((cmd, i) => {
            const CmdIcon = cmd.icon
            const isActive = i === activeIndex
            const showHeader = query.trim() === '' && cmd.group !== results[i - 1]?.group
            return (
              <Fragment key={cmd.id}>
                {showHeader && (
                  <li
                    role="presentation"
                    className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-panel-text-dim"
                  >
                    {cmd.group}
                  </li>
                )}
                <li
                  id={optionId(i)}
                  role="option"
                  aria-selected={isActive}
                  onMouseEnter={() => setActiveIndex(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => runCommand(cmd)}
                  className={`mx-1 flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] ${
                    isActive ? 'bg-panel-accent/15 text-panel-text' : 'text-panel-text-dim'
                  }`}
                >
                  <CmdIcon
                    size={16}
                    weight={isActive ? 'bold' : 'regular'}
                    className={isActive ? 'text-panel-accent' : ''}
                    aria-hidden="true"
                  />
                  <span className="flex-1 truncate">{cmd.label}</span>
                  {isActive && (
                    <span aria-hidden="true" className="font-mono text-[11px] text-panel-text-dim">
                      ↵
                    </span>
                  )}
                </li>
              </Fragment>
            )
          })}
        </ul>

        {/* Footer hints */}
        <div className="flex items-center justify-between border-t border-panel-border px-3 py-2 text-[10px] text-panel-text-dim">
          <span className="flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            navigate
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>↵</Kbd>
            select
            <Kbd>esc</Kbd>
            close
          </span>
        </div>
      </div>
    </div>
  )
}

export default CommandPalette
