import { getBoxModel, isPixelLensElement } from "/src/lib/dom-utils.ts.js";
export class ElementHighlighter {
  root;
  overlays = null;
  container = null;
  currentElement = null;
  rafId = null;
  enabled = false;
  onMouseOver = (e) => this.handleMouseOver(e);
  onMouseOut = () => this.handleMouseOut();
  onScroll = () => this.update();
  constructor(root) {
    this.root = root;
  }
  enable() {
    if (this.enabled) return;
    this.enabled = true;
    this.createOverlays();
    document.addEventListener("mouseover", this.onMouseOver, true);
    document.addEventListener("mouseout", this.onMouseOut, true);
    window.addEventListener("scroll", this.onScroll, { passive: true });
    window.addEventListener("resize", this.onScroll, { passive: true });
  }
  destroy() {
    this.enabled = false;
    document.removeEventListener("mouseover", this.onMouseOver, true);
    document.removeEventListener("mouseout", this.onMouseOut, true);
    window.removeEventListener("scroll", this.onScroll);
    window.removeEventListener("resize", this.onScroll);
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.container?.remove();
    this.container = null;
    this.overlays = null;
    this.currentElement = null;
  }
  createOverlays() {
    this.container = document.createElement("div");
    this.container.style.cssText = "position: absolute; top: 0; left: 0; pointer-events: none;";
    const make = (className) => {
      const div = document.createElement("div");
      div.className = className;
      div.style.opacity = "0";
      this.container.appendChild(div);
      return div;
    };
    this.overlays = {
      content: make("pixellens-overlay-content"),
      paddingTop: make("pixellens-overlay-padding"),
      paddingRight: make("pixellens-overlay-padding"),
      paddingBottom: make("pixellens-overlay-padding"),
      paddingLeft: make("pixellens-overlay-padding"),
      marginTop: make("pixellens-overlay-margin"),
      marginRight: make("pixellens-overlay-margin"),
      marginBottom: make("pixellens-overlay-margin"),
      marginLeft: make("pixellens-overlay-margin"),
      badge: make("pixellens-badge")
    };
    this.root.appendChild(this.container);
  }
  handleMouseOver(e) {
    const target = e.target;
    if (!target || target === document.documentElement || target === document.body) return;
    if (isPixelLensElement(target)) return;
    this.currentElement = target;
    this.update();
  }
  handleMouseOut() {
    this.currentElement = null;
    this.hideOverlays();
  }
  update() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      if (!this.currentElement || !this.overlays) return;
      this.positionOverlays(this.currentElement);
    });
  }
  positionOverlays(el) {
    if (!this.overlays) return;
    const rect = el.getBoundingClientRect();
    const boxModel = getBoxModel(el);
    const mt = parseFloat(boxModel.margin.top) || 0;
    const mr = parseFloat(boxModel.margin.right) || 0;
    const mb = parseFloat(boxModel.margin.bottom) || 0;
    const ml = parseFloat(boxModel.margin.left) || 0;
    const pt = parseFloat(boxModel.padding.top) || 0;
    const pr = parseFloat(boxModel.padding.right) || 0;
    const pb = parseFloat(boxModel.padding.bottom) || 0;
    const pl = parseFloat(boxModel.padding.left) || 0;
    const bt = parseFloat(boxModel.border.top) || 0;
    const br = parseFloat(boxModel.border.right) || 0;
    const bb = parseFloat(boxModel.border.bottom) || 0;
    const bl = parseFloat(boxModel.border.left) || 0;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const contentX = rect.left + scrollX + bl + pl;
    const contentY = rect.top + scrollY + bt + pt;
    const contentW = rect.width - bl - br - pl - pr;
    const contentH = rect.height - bt - bb - pt - pb;
    this.setRect(this.overlays.content, contentX, contentY, Math.max(0, contentW), Math.max(0, contentH));
    this.setRect(this.overlays.paddingTop, rect.left + scrollX + bl, rect.top + scrollY + bt, rect.width - bl - br, pt);
    this.setRect(this.overlays.paddingRight, rect.left + scrollX + rect.width - br - pr, rect.top + scrollY + bt + pt, pr, Math.max(0, contentH));
    this.setRect(this.overlays.paddingBottom, rect.left + scrollX + bl, rect.top + scrollY + rect.height - bb - pb, rect.width - bl - br, pb);
    this.setRect(this.overlays.paddingLeft, rect.left + scrollX + bl, rect.top + scrollY + bt + pt, pl, Math.max(0, contentH));
    this.setRect(this.overlays.marginTop, rect.left + scrollX - ml, rect.top + scrollY - mt, rect.width + ml + mr, mt);
    this.setRect(this.overlays.marginRight, rect.left + scrollX + rect.width, rect.top + scrollY, mr, rect.height);
    this.setRect(this.overlays.marginBottom, rect.left + scrollX - ml, rect.top + scrollY + rect.height, rect.width + ml + mr, mb);
    this.setRect(this.overlays.marginLeft, rect.left + scrollX - ml, rect.top + scrollY, ml, rect.height);
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    this.overlays.badge.textContent = `${w} × ${h}`;
    this.setRect(this.overlays.badge, rect.left + scrollX + rect.width + 4, rect.top + scrollY - 2, NaN, NaN);
    this.overlays.badge.style.width = "auto";
    this.overlays.badge.style.height = "auto";
    this.showOverlays();
  }
  setRect(el, x, y, w, h) {
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    if (!isNaN(w)) el.style.width = `${w}px`;
    if (!isNaN(h)) el.style.height = `${h}px`;
  }
  showOverlays() {
    if (!this.overlays) return;
    for (const el of Object.values(this.overlays)) {
      el.style.opacity = "1";
    }
  }
  hideOverlays() {
    if (!this.overlays) return;
    for (const el of Object.values(this.overlays)) {
      el.style.opacity = "0";
    }
  }
}
