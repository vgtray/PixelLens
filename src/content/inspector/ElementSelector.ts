// PixelLens — Element Selector (click to select and capture computed styles)

import { getFullComputedStyles, isPixelLensElement } from '@/lib/dom-utils'
import { sendMessage } from '@/lib/messaging'
import { MessageType } from '@/types/messages'

export class ElementSelector {
  private root: ShadowRoot
  private enabled = false

  private onClick = (e: MouseEvent) => this.handleClick(e)

  constructor(root: ShadowRoot) {
    this.root = root
  }

  enable(): void {
    if (this.enabled) return
    this.enabled = true
    document.addEventListener('click', this.onClick, true)
  }

  destroy(): void {
    this.enabled = false
    document.removeEventListener('click', this.onClick, true)
  }

  private handleClick(e: MouseEvent): void {
    const target = e.target as Element
    if (!target || isPixelLensElement(target)) return

    // Prevent default navigation/action
    e.preventDefault()
    e.stopPropagation()
    e.stopImmediatePropagation()

    // Pulse ring animation on the clicked element
    this.showPulseRing(target)

    // Capture full computed styles
    const inspectedElement = getFullComputedStyles(target)

    // Send to background → side panel
    sendMessage(MessageType.ELEMENT_SELECTED, { element: inspectedElement })
  }

  private showPulseRing(el: Element): void {
    const rect = el.getBoundingClientRect()
    const ring = document.createElement('div')
    ring.className = 'pixellens-pulse-ring'
    ring.style.left = `${rect.left + window.scrollX}px`
    ring.style.top = `${rect.top + window.scrollY}px`
    ring.style.width = `${rect.width}px`
    ring.style.height = `${rect.height}px`

    this.root.appendChild(ring)

    ring.addEventListener('animationend', () => ring.remove())
  }
}
