// PixelLens — DOM Utility Functions

import type { InspectedElement, BoxModel, BoxModelSide } from '@/types/inspection'

export function isPixelLensElement(el: Element): boolean {
  let node: Node | null = el
  while (node) {
    if ((node as HTMLElement).id === 'pixellens-host') return true
    node = node.parentNode
  }
  return false
}

export function isElementVisible(el: Element): boolean {
  const style = window.getComputedStyle(el)
  if (style.display === 'none') return false
  if (style.visibility === 'hidden') return false
  if (style.opacity === '0') return false

  const rect = el.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) return false

  return true
}

// Tags that never carry visual design tokens; rejecting them prunes their subtree.
const NON_VISUAL_TAGS = new Set([
  'script', 'style', 'noscript', 'link', 'meta', 'head', 'title', 'base', 'template',
])

// Decide how the TreeWalker should treat an element:
// - REJECT: prune the element AND its whole subtree (display:none / non-visual tags).
// - SKIP:   drop the element itself but KEEP walking its children. Used for nodes
//           that paint nothing yet may wrap visible descendants — visibility:hidden
//           (a child can re-declare visibility:visible), opacity:0, and above all
//           `display:contents` / zero-box wrappers (0x0 rect).
// - ACCEPT: collect the element and keep walking its children.
function classifyElement(el: Element): number {
  const tag = el.tagName.toLowerCase()
  if (NON_VISUAL_TAGS.has(tag)) return NodeFilter.FILTER_REJECT

  const style = window.getComputedStyle(el)
  if (style.display === 'none') return NodeFilter.FILTER_REJECT
  if (style.visibility === 'hidden' || style.opacity === '0') return NodeFilter.FILTER_SKIP

  const rect = el.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) return NodeFilter.FILTER_SKIP

  return NodeFilter.FILTER_ACCEPT
}

export function getVisibleElements(root: Element = document.documentElement): Element[] {
  const elements: Element[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) => classifyElement(node as Element),
  })

  // A TreeWalker never emits its own root node, so evaluate it explicitly.
  // With the root defaulting to <html>, this is what finally gets <html> and
  // <body> scanned — the page background + base typography live there.
  if (classifyElement(root) === NodeFilter.FILTER_ACCEPT) {
    elements.push(root)
  }

  let node: Node | null
  while ((node = walker.nextNode())) {
    elements.push(node as Element)
  }

  return elements
}

function parseSides(computed: CSSStyleDeclaration, prefix: string): BoxModelSide {
  return {
    top: computed.getPropertyValue(`${prefix}-top`),
    right: computed.getPropertyValue(`${prefix}-right`),
    bottom: computed.getPropertyValue(`${prefix}-bottom`),
    left: computed.getPropertyValue(`${prefix}-left`),
  }
}

export function getBoxModel(el: Element): BoxModel {
  const computed = window.getComputedStyle(el)
  const rect = el.getBoundingClientRect()

  return {
    margin: parseSides(computed, 'margin'),
    padding: parseSides(computed, 'padding'),
    border: {
      top: computed.getPropertyValue('border-top-width'),
      right: computed.getPropertyValue('border-right-width'),
      bottom: computed.getPropertyValue('border-bottom-width'),
      left: computed.getPropertyValue('border-left-width'),
    },
    content: {
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    },
  }
}

export function getFullComputedStyles(el: Element): InspectedElement {
  const computed = window.getComputedStyle(el)
  const rect = el.getBoundingClientRect()
  const styles: Record<string, string> = {}

  for (const prop of computed) {
    styles[prop] = computed.getPropertyValue(prop)
  }

  return {
    tagName: el.tagName.toLowerCase(),
    className: el.className?.toString() || '',
    id: el.id || '',
    computedStyles: styles,
    boxModel: getBoxModel(el),
    rect: {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    },
  }
}

export function getElementPath(el: Element): string {
  const parts: string[] = []
  let current: Element | null = el

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase()

    if (current.id) {
      selector += `#${current.id}`
      parts.unshift(selector)
      break
    }

    if (current.className && typeof current.className === 'string') {
      const classes = current.className.trim().split(/\s+/).slice(0, 2)
      if (classes.length > 0 && classes[0]) {
        selector += `.${classes.join('.')}`
      }
    }

    const parent = current.parentElement
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (c) => c.tagName === current!.tagName,
      )
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1
        selector += `:nth-of-type(${index})`
      }
    }

    parts.unshift(selector)
    current = current.parentElement
  }

  return parts.join(' > ')
}
