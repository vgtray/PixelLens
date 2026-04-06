import chroma from "/vendor/.vite-deps-chroma-js.js__v--10e64c58.js";
export function toHex(color) {
  try {
    return chroma(color).hex();
  } catch {
    return color;
  }
}
export function toRgb(color) {
  try {
    const [r, g, b] = chroma(color).rgb();
    return { r, g, b };
  } catch {
    return { r: 0, g: 0, b: 0 };
  }
}
export function toHsl(color) {
  try {
    const [h, s, l] = chroma(color).hsl();
    return {
      h: Math.round(isNaN(h) ? 0 : h),
      s: Math.round(s * 100),
      l: Math.round(l * 100)
    };
  } catch {
    return { h: 0, s: 0, l: 0 };
  }
}
export function deltaE(c1, c2) {
  try {
    return chroma.deltaE(c1, c2);
  } catch {
    return Infinity;
  }
}
export function getContrastRatio(fg, bg) {
  try {
    return chroma.contrast(fg, bg);
  } catch {
    return 0;
  }
}
export function isNeutral(color) {
  try {
    const [, s] = chroma(color).hsl();
    return s < 0.1;
  } catch {
    return false;
  }
}
export function isTransparent(color) {
  try {
    return chroma(color).alpha() === 0;
  } catch {
    return color === "transparent" || color === "rgba(0, 0, 0, 0)";
  }
}
export function clusterColors(colors, threshold = 5) {
  if (colors.length === 0) return [];
  const sorted = [...colors].sort((a, b) => b.frequency - a.frequency);
  const clusters = [];
  for (const color of sorted) {
    const existing = clusters.find((c) => deltaE(c.hex, color.hex) < threshold);
    if (existing) {
      existing.frequency += color.frequency;
    } else {
      clusters.push({ ...color });
    }
  }
  return clusters.sort((a, b) => b.frequency - a.frequency);
}
export function classifyColors(colors) {
  const sorted = [...colors].sort((a, b) => b.frequency - a.frequency);
  const neutrals = [];
  const chromatic = [];
  for (const color of sorted) {
    if (isNeutral(color.hex)) {
      neutrals.push(color);
    } else {
      chromatic.push(color);
    }
  }
  for (const color of neutrals) {
    const lightness = chroma(color.hex).luminance();
    if (lightness > 0.85) {
      color.category = "background";
    } else if (lightness < 0.15) {
      color.category = "text";
    } else {
      color.category = "neutral";
    }
  }
  chromatic.forEach((color, i) => {
    if (i === 0) {
      color.category = "primary";
    } else if (i === 1) {
      color.category = "secondary";
    } else {
      color.category = "accent";
    }
  });
  return [...chromatic, ...neutrals];
}
