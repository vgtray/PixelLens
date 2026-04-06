import { toHex, toRgb, toHsl, isTransparent, clusterColors, classifyColors } from "/src/lib/colors.ts.js";
const COLOR_PROPS = ["color", "background-color", "border-color", "outline-color"];
const SKIP_VALUES = /* @__PURE__ */ new Set([
  "transparent",
  "rgba(0, 0, 0, 0)",
  "inherit",
  "initial",
  "currentcolor"
]);
export class ColorExtractor {
  extract(elements) {
    const freqMap = /* @__PURE__ */ new Map();
    for (const el of elements) {
      const computed = window.getComputedStyle(el);
      for (const prop of COLOR_PROPS) {
        const value = computed.getPropertyValue(prop);
        if (!value || SKIP_VALUES.has(value.toLowerCase())) continue;
        if (isTransparent(value)) continue;
        let hex;
        try {
          hex = toHex(value);
        } catch {
          continue;
        }
        freqMap.set(hex, (freqMap.get(hex) || 0) + 1);
      }
    }
    const rawColors = Array.from(freqMap.entries()).map(([hex, frequency]) => ({
      hex,
      frequency
    }));
    const clustered = clusterColors(rawColors, 5);
    const tokens = clustered.map((c) => ({
      name: "",
      hex: c.hex,
      rgb: toRgb(c.hex),
      hsl: toHsl(c.hex),
      frequency: c.frequency,
      category: "accent"
    }));
    return classifyColors(tokens);
  }
}
