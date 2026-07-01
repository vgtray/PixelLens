/**
 * True when the OS asks to minimise non-essential motion.
 *
 * Read at call time (never cached) so a mid-session change to the system
 * setting is honoured. Used to short-circuit GSAP tweens to their end state —
 * GSAP animates inline values with rAF, so the global
 * `@media (prefers-reduced-motion: reduce)` CSS block can't reach it; the JS
 * guard does. Pure leaf util shared by the side panel and the in-page toolbar.
 */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}
