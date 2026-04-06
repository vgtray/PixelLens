// PixelLens — Distance Measurer (click two elements to measure distance)

import { isPixelLensElement } from '@/lib/dom-utils'

type MeasureState = 'IDLE' | 'FIRST_SELECTED' | 'MEASURING'

export class DistanceMeasurer {
  private root: ShadowRoot
  private state: MeasureState = 'IDLE'
  private elementA: Element | null = null
  private elementB: Element | null = null
  private outlineA: HTMLDivElement | null = null
  private outlineB: HTMLDivElement | null = null
  private svgOverlay: SVGSVGElement | null = null
  private measureLabel: HTMLDivElement | null = null
  private guideH: HTMLDivElement | null = null
  private guideV: HTMLDivElement | null = null
  private enabled = false

  private onClick = (e: MouseEvent) => this.handleClick(e)
  private onScroll = () => this.updateVisuals()

  constructor(root: ShadowRoot) {
    this.root = root
  }

  enable(): void {
    if (this.enabled) return
    this.enabled = true
    document.addEventListener('click', this.onClick, true)
    window.addEventListener('scroll', this.onScroll, { passive: true })
    window.addEventListener('resize', this.onScroll, { passive: true })
  }

  destroy(): void {
    this.enabled = false
    document.removeEventListener('click', this.onClick, true)
    window.removeEventListener('scroll', this.onScroll)
    window.removeEventListener('resize', this.onScroll)
    this.reset()
  }

  private handleClick(e: MouseEvent): void {
    const target = e.target as Element
    if (!target || isPixelLensElement(target)) return

    e.preventDefault()
    e.stopPropagation()
    e.stopImmediatePropagation()

    if (this.state === 'IDLE') {
      this.elementA = target
      this.outlineA = this.createOutline(target)
      this.state = 'FIRST_SELECTED'
    } else if (this.state === 'FIRST_SELECTED') {
      this.elementB = target
      this.outlineB = this.createOutline(target)
      this.state = 'MEASURING'
      this.drawMeasurement()
    } else {
      // Click elsewhere: reset
      this.reset()
    }
  }

  private createOutline(el: Element): HTMLDivElement {
    const rect = el.getBoundingClientRect()
    const outline = document.createElement('div')
    outline.className = 'pixellens-measure-outline'
    outline.style.left = `${rect.left + window.scrollX}px`
    outline.style.top = `${rect.top + window.scrollY}px`
    outline.style.width = `${rect.width}px`
    outline.style.height = `${rect.height}px`
    this.root.appendChild(outline)
    return outline
  }

  private drawMeasurement(): void {
    if (!this.elementA || !this.elementB) return

    const rectA = this.elementA.getBoundingClientRect()
    const rectB = this.elementB.getBoundingClientRect()

    const centerAx = rectA.left + rectA.width / 2
    const centerAy = rectA.top + rectA.height / 2
    const centerBx = rectB.left + rectB.width / 2
    const centerBy = rectB.top + rectB.height / 2

    const distance = Math.round(Math.hypot(centerBx - centerAx, centerBy - centerAy))

    // SVG line with dash animation
    this.svgOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    this.svgOverlay.setAttribute('class', 'pixellens-measure-line')
    this.svgOverlay.style.cssText = `position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 2147483646;`

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
    line.setAttribute('x1', String(centerAx))
    line.setAttribute('y1', String(centerAy))
    line.setAttribute('x2', String(centerBx))
    line.setAttribute('y2', String(centerBy))
    line.setAttribute('stroke', '#EF4444')
    line.setAttribute('stroke-width', '1.5')
    line.setAttribute('stroke-dasharray', '6 4')

    // Dash offset animation
    const totalLen = Math.hypot(centerBx - centerAx, centerBy - centerAy)
    line.setAttribute('stroke-dashoffset', String(totalLen))

    const animate = document.createElementNS('http://www.w3.org/2000/svg', 'animate')
    animate.setAttribute('attributeName', 'stroke-dashoffset')
    animate.setAttribute('from', String(totalLen))
    animate.setAttribute('to', '0')
    animate.setAttribute('dur', '0.4s')
    animate.setAttribute('fill', 'freeze')
    line.appendChild(animate)

    this.svgOverlay.appendChild(line)
    this.root.appendChild(this.svgOverlay)

    // Distance label at midpoint
    const midX = (centerAx + centerBx) / 2
    const midY = (centerAy + centerBy) / 2

    this.measureLabel = document.createElement('div')
    this.measureLabel.className = 'pixellens-measure-label'
    this.measureLabel.textContent = `${distance}px`
    this.measureLabel.style.left = `${midX + window.scrollX + 8}px`
    this.measureLabel.style.top = `${midY + window.scrollY - 10}px`
    this.root.appendChild(this.measureLabel)

    // Guides — horizontal and vertical dashed lines
    const dx = Math.abs(centerBx - centerAx)
    const dy = Math.abs(centerBy - centerAy)

    if (dx > 4) {
      this.guideH = document.createElement('div')
      this.guideH.style.cssText = `position: fixed; height: 0; border-top: 1px dashed rgba(239,68,68,0.4); pointer-events: none; z-index: 2147483645;`
      this.guideH.style.left = `${Math.min(centerAx, centerBx)}px`
      this.guideH.style.top = `${centerAy}px`
      this.guideH.style.width = `${dx}px`
      this.root.appendChild(this.guideH)
    }

    if (dy > 4) {
      this.guideV = document.createElement('div')
      this.guideV.style.cssText = `position: fixed; width: 0; border-left: 1px dashed rgba(239,68,68,0.4); pointer-events: none; z-index: 2147483645;`
      this.guideV.style.left = `${centerBx}px`
      this.guideV.style.top = `${Math.min(centerAy, centerBy)}px`
      this.guideV.style.height = `${dy}px`
      this.root.appendChild(this.guideV)
    }
  }

  private updateVisuals(): void {
    if (this.state === 'MEASURING' && this.elementA && this.elementB) {
      this.clearVisuals()
      this.outlineA = this.createOutline(this.elementA)
      this.outlineB = this.createOutline(this.elementB)
      this.drawMeasurement()
    } else if (this.state === 'FIRST_SELECTED' && this.elementA) {
      this.outlineA?.remove()
      this.outlineA = this.createOutline(this.elementA)
    }
  }

  private clearVisuals(): void {
    this.outlineA?.remove()
    this.outlineB?.remove()
    this.svgOverlay?.remove()
    this.measureLabel?.remove()
    this.guideH?.remove()
    this.guideV?.remove()
    this.outlineA = null
    this.outlineB = null
    this.svgOverlay = null
    this.measureLabel = null
    this.guideH = null
    this.guideV = null
  }

  private reset(): void {
    this.clearVisuals()
    this.elementA = null
    this.elementB = null
    this.state = 'IDLE'
  }
}
