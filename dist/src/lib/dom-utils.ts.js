export function isPixelLensElement(el) {
  let node = el;
  while (node) {
    if (node.id === "pixellens-host") return true;
    node = node.parentNode;
  }
  return false;
}
export function isElementVisible(el) {
  const style = window.getComputedStyle(el);
  if (style.display === "none") return false;
  if (style.visibility === "hidden") return false;
  if (style.opacity === "0") return false;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  return true;
}
export function getVisibleElements(root = document.body) {
  const elements = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
    acceptNode(node2) {
      const el = node2;
      if (!isElementVisible(el)) return NodeFilter.FILTER_REJECT;
      const tag = el.tagName.toLowerCase();
      if (tag === "script" || tag === "style" || tag === "noscript" || tag === "link" || tag === "meta") {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  let node;
  while (node = walker.nextNode()) {
    elements.push(node);
  }
  return elements;
}
function parseSides(computed, prefix) {
  return {
    top: computed.getPropertyValue(`${prefix}-top`),
    right: computed.getPropertyValue(`${prefix}-right`),
    bottom: computed.getPropertyValue(`${prefix}-bottom`),
    left: computed.getPropertyValue(`${prefix}-left`)
  };
}
export function getBoxModel(el) {
  const computed = window.getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  return {
    margin: parseSides(computed, "margin"),
    padding: parseSides(computed, "padding"),
    border: {
      top: computed.getPropertyValue("border-top-width"),
      right: computed.getPropertyValue("border-right-width"),
      bottom: computed.getPropertyValue("border-bottom-width"),
      left: computed.getPropertyValue("border-left-width")
    },
    content: {
      width: `${rect.width}px`,
      height: `${rect.height}px`
    }
  };
}
export function getFullComputedStyles(el) {
  const computed = window.getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  const styles = {};
  for (const prop of computed) {
    styles[prop] = computed.getPropertyValue(prop);
  }
  return {
    tagName: el.tagName.toLowerCase(),
    className: el.className?.toString() || "",
    id: el.id || "",
    computedStyles: styles,
    boxModel: getBoxModel(el),
    rect: {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height
    }
  };
}
export function getElementPath(el) {
  const parts = [];
  let current = el;
  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();
    if (current.id) {
      selector += `#${current.id}`;
      parts.unshift(selector);
      break;
    }
    if (current.className && typeof current.className === "string") {
      const classes = current.className.trim().split(/\s+/).slice(0, 2);
      if (classes.length > 0 && classes[0]) {
        selector += `.${classes.join(".")}`;
      }
    }
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (c) => c.tagName === current.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }
    parts.unshift(selector);
    current = current.parentElement;
  }
  return parts.join(" > ");
}
