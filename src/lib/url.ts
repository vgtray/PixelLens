// PixelLens — URL helpers
//
// Small, dependency-free utilities for comparing where a scan/markdown result
// came from against the tab currently in front of the user, so the panel never
// presents another site's data as if it belonged to the active page.

// Normalise a URL to its bare hostname (drops a leading `www.`) for same-site
// comparisons. Returns null when the input isn't a parseable http(s) URL — e.g.
// an empty string, or a `chrome://`/extension page — so callers can treat the
// host as "unknown" rather than mistaking it for a real mismatch.
export function getHost(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    // Only http(s) pages are scannable; treat chrome://, about:, file:,
    // extension pages, etc. as "unknown" so the UI never flags a mismatch (or
    // offers a re-scan) on a page it can't act on.
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.hostname.replace(/^www\./, '') || null
  } catch {
    return null
  }
}

// True only when BOTH hosts are known AND differ. An unknown host on either
// side yields false, so the UI never flags a false "stale scan" mismatch (for
// instance when the active tab's URL can't be read without host permission).
export function isDifferentHost(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const ha = getHost(a)
  const hb = getHost(b)
  if (ha === null || hb === null) return false
  return ha !== hb
}
