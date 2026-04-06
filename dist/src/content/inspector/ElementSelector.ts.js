import { getFullComputedStyles, isPixelLensElement } from "/src/lib/dom-utils.ts.js";
import { sendMessage } from "/src/lib/messaging.ts.js";
import { MessageType } from "/src/types/messages.ts.js";
export class ElementSelector {
  root;
  enabled = false;
  onClick = (e) => this.handleClick(e);
  constructor(root) {
    this.root = root;
  }
  enable() {
    if (this.enabled) return;
    this.enabled = true;
    document.addEventListener("click", this.onClick, true);
  }
  destroy() {
    this.enabled = false;
    document.removeEventListener("click", this.onClick, true);
  }
  handleClick(e) {
    const target = e.target;
    if (!target || isPixelLensElement(target)) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    this.showPulseRing(target);
    const inspectedElement = getFullComputedStyles(target);
    sendMessage(MessageType.ELEMENT_SELECTED, { element: inspectedElement });
  }
  showPulseRing(el) {
    const rect = el.getBoundingClientRect();
    const ring = document.createElement("div");
    ring.className = "pixellens-pulse-ring";
    ring.style.left = `${rect.left + window.scrollX}px`;
    ring.style.top = `${rect.top + window.scrollY}px`;
    ring.style.width = `${rect.width}px`;
    ring.style.height = `${rect.height}px`;
    this.root.appendChild(ring);
    ring.addEventListener("animationend", () => ring.remove());
  }
}
