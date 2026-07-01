import { useEffect, useMemo, useRef } from 'react'
import { CircleHalf, Scan } from '@phosphor-icons/react'
import gsap from 'gsap'
import { usePanelStore } from '../store'
import { prefersReducedMotion } from '../reducedMotion'
import { buildContrastReport, formatRatio, type ContrastLevel } from '@/lib/contrast'

// Pill palette. Each level carries its own label text, so the verdict never
// relies on color alone (WCAG SC 1.4.1). Green = AAA, amber = AA-only, red = fail.
const LEVEL_STYLE: Record<ContrastLevel, { label: string; className: string }> = {
  AAA: { label: 'AAA', className: 'border-[#22C55E]/30 bg-[#22C55E]/12 text-[#4ADE80]' },
  AA: { label: 'AA', className: 'border-[#F59E0B]/30 bg-[#F59E0B]/12 text-[#FBBF24]' },
  fail: { label: 'Fail', className: 'border-[#EF4444]/30 bg-[#EF4444]/12 text-[#F87171]' },
}

function VerdictPill({ scope, level, ratio }: { scope: 'Normal' | 'Large'; level: ContrastLevel; ratio: number }) {
  const s = LEVEL_STYLE[level]
  const verdict = level === 'fail' ? 'fails WCAG' : `passes ${level}`
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${s.className}`}
      aria-label={`${scope} text: ${verdict}, ratio ${formatRatio(ratio)} to 1`}
    >
      <span className="opacity-70">{scope}</span>
      <span aria-hidden="true">·</span>
      <span className="font-semibold">{s.label}</span>
    </span>
  )
}

function ContrastCheckerView() {
  const designSystem = usePanelStore((s) => s.designSystem)
  const setMode = usePanelStore((s) => s.setMode)
  const listRef = useRef<HTMLDivElement>(null)

  const report = useMemo(
    () => (designSystem ? buildContrastReport(designSystem.colors) : []),
    [designSystem],
  )

  // Flatten every evaluated pair once for the summary strip.
  const summary = useMemo(() => {
    let total = 0
    let passAA = 0
    for (const pairing of report) {
      for (const fg of pairing.foregrounds) {
        total++
        if (fg.verdict.aaNormal) passAA++
      }
    }
    return { total, passAA }
  }, [report])

  // Staggered reveal of the background sections. Honors reduced motion by
  // snapping to the end state (no tween) via the shared helper.
  useEffect(() => {
    const root = listRef.current
    if (!root || report.length === 0) return
    const sections = root.querySelectorAll<HTMLElement>('[data-contrast-section]')
    if (sections.length === 0) return
    if (prefersReducedMotion()) {
      gsap.set(sections, { opacity: 1, y: 0 })
      return
    }
    const tween = gsap.fromTo(
      sections,
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out', stagger: 0.06 },
    )
    return () => {
      tween.kill()
    }
  }, [report])

  // --- Empty — no scan yet ----------------------------------------------------------
  if (!designSystem) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-panel-surface border border-panel-border flex items-center justify-center">
          <CircleHalf size={28} className="text-panel-text-dim" />
        </div>
        <div>
          <p className="text-[13px] font-medium text-panel-text mb-1">Check color contrast</p>
          <p className="text-[11px] text-panel-text-dim leading-relaxed mb-4">
            Scan a page first, then see which of its extracted colors meet WCAG AA / AAA
            contrast on each background.
          </p>
          <button
            onClick={() => setMode('scan')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-panel-accent text-white text-[12px] font-medium hover:bg-panel-accent-hover transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panel-accent focus-visible:ring-offset-2 focus-visible:ring-offset-panel-bg"
          >
            <Scan size={14} weight="bold" />
            Scan a page
          </button>
        </div>
      </div>
    )
  }

  // --- No usable colors -------------------------------------------------------------
  if (report.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-panel-surface border border-panel-border flex items-center justify-center">
          <CircleHalf size={28} className="text-panel-text-dim" />
        </div>
        <div>
          <p className="text-[13px] font-medium text-panel-text mb-1">Not enough colors</p>
          <p className="text-[11px] text-panel-text-dim leading-relaxed">
            This scan didn&rsquo;t yield enough distinct colors to evaluate contrast. Try
            scanning a richer page.
          </p>
        </div>
      </div>
    )
  }

  // --- Results ----------------------------------------------------------------------
  return (
    <div className="flex flex-col h-full">
      {/* Meta header + summary */}
      <div className="shrink-0 px-3 py-3 border-b border-panel-border">
        <div className="flex items-center gap-2">
          <CircleHalf size={16} weight="fill" className="text-panel-accent shrink-0" />
          <p className="text-[13px] font-medium text-panel-text truncate" title={designSystem.metadata.title}>
            Contrast · {designSystem.metadata.title || designSystem.metadata.url}
          </p>
        </div>
        <p className="text-[11px] text-panel-text-dim mt-1">
          <span className="text-panel-text font-mono">{summary.passAA}</span>/
          <span className="font-mono">{summary.total}</span> pairs pass AA for normal text
        </p>
      </div>

      {/* Pairings */}
      <div ref={listRef} className="flex-1 overflow-y-auto p-3 flex flex-col gap-5">
        {report.map((pairing) => (
          <section key={pairing.background.hex} data-contrast-section aria-label={`On background ${pairing.background.hex}`}>
            {/* Background surface header */}
            <div className="flex items-center gap-2 mb-2">
              <span
                className="w-5 h-5 rounded-md border border-panel-border shrink-0"
                style={{ background: pairing.background.hex }}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-panel-text-dim uppercase tracking-wider leading-none">
                  On background
                </p>
                <p className="text-[11px] font-mono text-panel-text truncate leading-tight mt-0.5">
                  {pairing.background.hex}
                </p>
              </div>
            </div>

            {/* Foreground rows */}
            <ul className="flex flex-col gap-1.5">
              {pairing.foregrounds.map((fg) => (
                <li
                  key={fg.token.hex}
                  className="rounded-lg bg-panel-surface border border-panel-border p-2"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="flex items-center justify-center w-10 h-10 rounded-md border border-panel-border shrink-0 text-[15px] font-semibold leading-none"
                      style={{ background: pairing.background.hex, color: fg.token.hex }}
                      aria-hidden="true"
                    >
                      Ag
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-mono text-panel-text truncate">{fg.token.hex}</p>
                      <p className="text-[10px] text-panel-text-dim capitalize truncate">
                        {fg.token.category}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[13px] font-mono text-panel-text tabular-nums">
                        {formatRatio(fg.verdict.ratio)}
                      </span>
                      <span className="text-[10px] text-panel-text-dim">:1</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <VerdictPill scope="Normal" level={fg.verdict.normalLevel} ratio={fg.verdict.ratio} />
                    <VerdictPill scope="Large" level={fg.verdict.largeLevel} ratio={fg.verdict.ratio} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}

export default ContrastCheckerView
