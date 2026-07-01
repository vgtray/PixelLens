import { WarningCircle, ArrowClockwise } from '@phosphor-icons/react'
import { getHost } from '@/lib/url'

interface StaleScanBannerProps {
  /** URL the currently displayed data was captured from. */
  scanUrl: string | null | undefined
  /** Re-run the scan / conversion for the page currently in front of the user. */
  onRescan: () => void
  /** Action verb for the button, e.g. "Scan" (default) or "Convert". */
  action?: string
}

// Non-destructive notice shown at the top of a view when the result on screen
// was captured from a different site than the tab the user is on. It never wipes
// the data — the user keeps the previous result and can one-click re-run for the
// current page, or navigate back to the original site to see it unflagged.
export default function StaleScanBanner({
  scanUrl,
  onRescan,
  action = 'Scan',
}: StaleScanBannerProps) {
  const host = getHost(scanUrl) ?? 'another page'
  return (
    <div
      role="status"
      className="flex items-center gap-2 shrink-0 px-3 py-2 border-b border-panel-accent/40 bg-panel-accent/10"
    >
      <WarningCircle size={15} weight="fill" className="shrink-0 text-panel-accent" />
      <p className="flex-1 min-w-0 text-[11px] leading-snug text-panel-text">
        Showing a previous scan of{' '}
        <span className="font-mono text-panel-text">{host}</span> — not the page
        you&apos;re on.
      </p>
      <button
        type="button"
        onClick={onRescan}
        className="shrink-0 flex items-center gap-1 rounded-md bg-panel-accent px-2 py-1 text-[11px] font-medium text-white transition-colors duration-200 hover:bg-panel-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panel-accent focus-visible:ring-offset-1 focus-visible:ring-offset-panel-bg"
      >
        <ArrowClockwise size={12} weight="bold" />
        {action} this page
      </button>
    </div>
  )
}
