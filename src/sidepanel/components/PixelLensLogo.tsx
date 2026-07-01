interface PixelLensLogoProps {
  size?: number
  className?: string
}

/**
 * PixelLens brand mark — a lens / magnifier. Single source of truth so the
 * popup and the side panel can never drift into two different logos.
 *
 * Colours come from the accent tokens (via `currentColor` + a CSS var) rather
 * than hard-coded hex, so the one canonical accent stays canonical. Decorative:
 * always paired with the visible "PixelLens" wordmark, hence `aria-hidden`.
 */
export function PixelLensLogo({ size = 20, className }: PixelLensLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      fill="none"
      className={className}
      style={{ color: 'var(--color-panel-accent)' }}
      aria-hidden="true"
    >
      <circle cx="56" cy="56" r="24" stroke="currentColor" strokeWidth="6" />
      <line
        x1="73"
        y1="73"
        x2="100"
        y2="100"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <circle cx="56" cy="56" r="8" style={{ fill: 'var(--color-panel-accent-hover)' }} />
    </svg>
  )
}

export default PixelLensLogo
