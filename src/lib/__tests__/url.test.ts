import { describe, it, expect } from 'vitest'
import { getHost, isDifferentHost } from '@/lib/url'

describe('getHost', () => {
  it('returns the bare hostname, dropping a leading www.', () => {
    expect(getHost('https://www.example.com/path?q=1')).toBe('example.com')
    expect(getHost('https://example.com')).toBe('example.com')
    expect(getHost('https://sub.example.com/a')).toBe('sub.example.com')
  })

  it('returns null for empty / nullish / unparseable input', () => {
    expect(getHost(null)).toBeNull()
    expect(getHost(undefined)).toBeNull()
    expect(getHost('')).toBeNull()
    expect(getHost('not a url')).toBeNull()
  })
})

describe('isDifferentHost', () => {
  it('is true only when both hosts are known AND differ', () => {
    expect(isDifferentHost('https://a.com', 'https://b.com')).toBe(true)
    expect(isDifferentHost('https://www.a.com', 'https://a.com')).toBe(false)
    expect(isDifferentHost('https://a.com/x', 'https://a.com/y')).toBe(false)
  })

  it('never flags a mismatch when either host is unknown', () => {
    // Guards against a false "stale scan" banner when the active tab URL can't
    // be read (e.g. no host permission) or the data carries no URL.
    expect(isDifferentHost('https://a.com', null)).toBe(false)
    expect(isDifferentHost(null, 'https://a.com')).toBe(false)
    expect(isDifferentHost('https://a.com', 'chrome://newtab')).toBe(false)
    expect(isDifferentHost(undefined, undefined)).toBe(false)
  })
})
