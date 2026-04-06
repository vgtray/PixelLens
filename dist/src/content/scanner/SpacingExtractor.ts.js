const SPACING_PROPS = [
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left"
];
export class SpacingExtractor {
  extract(elements) {
    const freqMap = /* @__PURE__ */ new Map();
    for (const el of elements) {
      const computed = window.getComputedStyle(el);
      for (const prop of SPACING_PROPS) {
        const raw = computed.getPropertyValue(prop);
        const px = parseFloat(raw);
        if (isNaN(px) || px === 0) continue;
        const rounded = this.roundSpacing(Math.abs(px));
        if (rounded === 0) continue;
        freqMap.set(rounded, (freqMap.get(rounded) || 0) + 1);
      }
    }
    const baseUnit = this.detectBaseUnit(freqMap);
    const multipliers = [0.5, 1, 1.5, 2, 3, 4, 6, 8, 12, 16];
    const scaleValues = new Set(multipliers.map((m) => Math.round(baseUnit * m)));
    const allValues = Array.from(freqMap.entries()).sort((a, b) => b[1] - a[1]);
    const tokens = [];
    const seen = /* @__PURE__ */ new Set();
    for (const scaleVal of scaleValues) {
      const freq = freqMap.get(scaleVal) || 0;
      if (freq > 0 && !seen.has(scaleVal)) {
        seen.add(scaleVal);
        tokens.push({
          value: `${scaleVal}px`,
          frequency: freq,
          label: this.getLabel(scaleVal, baseUnit)
        });
      }
    }
    for (const [val, freq] of allValues) {
      if (seen.has(val)) continue;
      if (tokens.length >= 16) break;
      seen.add(val);
      tokens.push({
        value: `${val}px`,
        frequency: freq,
        label: `space-${val}`
      });
    }
    tokens.sort((a, b) => parseFloat(a.value) - parseFloat(b.value));
    return tokens;
  }
  roundSpacing(px) {
    return Math.round(px / 2) * 2;
  }
  detectBaseUnit(freqMap) {
    const freq4 = freqMap.get(4) || 0;
    const freq8 = freqMap.get(8) || 0;
    let multOf8 = 0;
    let multOf4 = 0;
    let total = 0;
    for (const [val, freq] of freqMap) {
      total += freq;
      if (val % 8 === 0) multOf8 += freq;
      if (val % 4 === 0) multOf4 += freq;
    }
    if (total > 0 && multOf8 / total > 0.6) return 8;
    if (total > 0 && multOf4 / total > 0.6) return 4;
    return freq8 >= freq4 ? 8 : 4;
  }
  getLabel(value, base) {
    const ratio = value / base;
    if (ratio === 0.5) return `space-${base}-half`;
    if (ratio === 1) return `space-${base}`;
    if (ratio === 1.5) return `space-${base}-1half`;
    if (Number.isInteger(ratio)) return `space-${base}-x${ratio}`;
    return `space-${value}`;
  }
}
