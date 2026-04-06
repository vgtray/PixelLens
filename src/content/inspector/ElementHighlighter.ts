// PixelLens — Element Highlighter (hover overlay for padding/margin/content)

import { getBoxModel, isPixelLensElement } from '@/lib/dom-utils'

interface OverlayElements {
  content: HTMLDivElement
  paddingTop: HTMLDivElement
  paddingRight: HTMLDivElement
  paddingBottom: HTMLDivElement
  paddingLeft: HTMLDivElement
  marginTop: HTMLDivElement
  marginRight: HTMLDivElement
  marginBottom: HTMLDivElement
  marginLeft: HTMLDivElement
  badge: HTMLDivElement
}

export class ElementHighlighter {
  private root: ShadowRoot
  private overlays: OverlayElements | null = null
  private container: HTMLDivElement | null = null
  private currentElement: Element | null = null
  private rafId: number | null = null
  private enabled = false

  private onMouseOver = (e: MouseEvent) => this.handleMouseOver(e)
  private onMouseOut = () => this.handleMouseOut()
  private onScroll = () => this.update()

  constructor(root: ShadowRoot) {
    this.root = root
  }

  enable(): void {
    if (this.enabled) return
    this.enabled = true
    this.createOverlays()
    document.addEventListener('mouseover', this.onMouseOver, true)
    document.addEventListener('mouseout', this.onMouseOut, true)
    window.addEventListener('scroll', this.onScroll, { passive: true })
    window.addEventListener('resize', this.onScroll, { passive: true })
  }

  destroy(): void {
    this.enabled = false
    document.removeEventListener('mouseover', this.onMouseOver, true)
    document.removeEventListener('mouseout', this.onMouseOut, true)
    window.removeEventListener('scroll', this.onScroll)
    window.removeEventListener('resize', this.onScroll)
    if (this.rafId !== null) cancelAnimationFrame(this.rafId)
    this.container?.remove()
    this.container = null
    this.overlays = null
    this.currentElement = null
  }

  private createOverlays(): void {
    this.container = document.createElement('div')
    this.container.style.cssText = 'position: absolute; top: 0; left: 0; pointer-events: none;'

    const make = (className: string): HTMLDivElement => {
      const div = document.createElement('div')
      div.className = className
      div.style.opacity = '0'
      this.container!.appendChild(div)
      return div
    }

    this.overlays = {
      content: make('pixellens-overlay-content'),
      paddingTop: make('pixellens-overlay-padding'),
      paddingRight: make('pixellens-overlay-padding'),
      paddingBottom: make('pixellens-overlay-padding'),
      paddingLeft: make('pixellens-overlay-padding'),
      marginTop: make('pixellens-overlay-margin'),
      marginRight: make('pixellens-overlay-margin'),
      marginBottom: make('pixellens-overlay-margin'),
      marginLeft: make('pixellens-overlay-margin'),
      badge: make('pixellens-badge'),
    }

    this.root.appendChild(this.container)
  }

  private handleMouseOver(e: MouseEvent): void {
    const target = e.target as Element
    if (!target || target === document.documentElement || target === document.body) return
    // Ignore our own overlays
    if (isPixelLensElement(target)) return

    this.currentElement = target
    this.update()
  }

  private handleMouseOut(): void {
    this.currentElement = null
    this.hideOverlays()
  }

  private update(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId)
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null
      if (!this.currentElement || !this.overlays) return
      this.positionOverlays(this.currentElement)
    })
  }

  private positionOverlays(el: Element): void {
    if (!this.overlays) return

    const rect = el.getBoundingClientRect()
    const boxModel = getBoxModel(el)

    const mt = parseFloat(boxModel.margin.top) || 0
    const mr = parseFloat(boxModel.margin.right) || 0
    const mb = parseFloat(boxModel.margin.bottom) || 0
    const ml = parseFloat(boxModel.margin.left) || 0

    const pt = parseFloat(boxModel.padding.top) || 0
    const pr = parseFloat(boxModel.padding.right) || 0
    const pb = parseFloat(boxModel.padding.bottom) || 0
    const pl = parseFloat(boxModel.padding.left) || 0

    const bt = parseFloat(boxModel.border.top) || 0
    const br = parseFloat(boxModel.border.right) || 0
    const bb = parseFloat(boxModel.border.bottom) || 0
    const bl = parseFloat(boxModel.border.left) || 0

    const scrollX = window.scrollX
    const scrollY = window.scrollY

    // Content area (inside padding + border)
    const contentX = rect.left + scrollX + bl + pl
    const contentY = rect.top + scrollY + bt + pt
    const contentW = rect.width - bl - br - pl - pr
    const contentH = rect.height - bt - bb - pt - pb

    this.setRect(this.overlays.content, contentX, contentY, Math.max(0, contentW), Math.max(0, contentH))

    // Padding overlays (4 strips around content)
    // Top padding
    this.setRect(this.overlays.paddingTop, rect.left + scrollX + bl, rect.top + scrollY + bt, rect.width - bl - br, pt)
    // Right padding
    this.setRect(this.overlays.paddingRight, rect.left + scrollX + rect.width - br - pr, rect.top + scrollY + bt + pt, pr, Math.max(0, contentH))
    // Bottom padding
    this.setRect(this.overlays.paddingBottom, rect.left + scrollX + bl, rect.top + scrollY + rect.height - bb - pb, rect.width - bl - br, pb)
    // Left padding
    this.setRect(this.overlays.paddingLeft, rect.left + scrollX + bl, rect.top + scrollY + bt + pt, pl, Math.max(0, contentH))

    // Margin overlays (4 strips outside border)
    // Top margin
    this.setRect(this.overlays.marginTop, rect.left + scrollX - ml, rect.top + scrollY - mt, rect.width + ml + mr, mt)
    // Right margin
    this.setRect(this.overlays.marginRight, rect.left + scrollX + rect.width, rect.top + scrollY, mr, rect.height)
    // Bottom margin
    this.setRect(this.overlays.marginBottom, rect.left + scrollX - ml, rect.top + scrollY + rect.height, rect.width + ml + mr, mb)
    // Left margin
    this.setRect(this.overlays.marginLeft, rect.left + scrollX - ml, rect.top + scrollY, ml, rect.height)

    // Badge: show dimensions at top-right corner of the element
    const w = Math.round(rect.width)
    const h = Math.round(rect.height)
    this.overlays.badge.textContent = `${w} × ${h}`
    this.setRect(this.overlays.badge, rect.left + scrollX + rect.width + 4, rect.top + scrollY - 2, NaN, NaN)
    this.overlays.badge.style.width = 'auto'
    this.overlays.badge.style.height = 'auto'

    // Show all
    this.showOverlays()
  }

  private setRect(el: HTMLDivElement, x: number, y: number, w: number, h: number): void {
    el.style.left = `${x}px`
    el.style.top = `${y}px`
    if (!isNaN(w)) el.style.width = `${w}px`
    if (!isNaN(h)) el.style.height = `${h}px`
  }

  private showOverlays(): void {
    if (!this.overlays) return
    for (const el of Object.values(this.overlays)) {
      el.style.opacity = '1'
    }
  }

  private hideOverlays(): void {
    if (!this.overlays) return
    for (const el of Object.values(this.overlays)) {
      el.style.opacity = '0'
    }
  }
}
