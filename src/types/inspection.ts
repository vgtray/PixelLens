// PixelLens — Inspection Types

export interface BoxModelSide {
  top: string
  right: string
  bottom: string
  left: string
}

export interface BoxModel {
  margin: BoxModelSide
  padding: BoxModelSide
  border: BoxModelSide
  content: { width: string; height: string }
}

export interface InspectedElement {
  tagName: string
  className: string
  id: string
  computedStyles: Record<string, string>
  boxModel: BoxModel
  rect: DOMRect | { top: number; left: number; width: number; height: number }
}

export interface ColorInfo {
  property: string
  value: string
  hex: string
  rgb: { r: number; g: number; b: number }
  hsl: { h: number; s: number; l: number }
}

export interface TypographyInfo {
  fontFamily: string
  fontSize: string
  fontWeight: string
  lineHeight: string
  letterSpacing: string
}

export interface EffectsInfo {
  boxShadow: string
  opacity: string
  backdropFilter: string
  borderRadius: string
}
