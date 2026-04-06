// PixelLens — Design System Types

export type ColorCategory =
  | 'primary'
  | 'secondary'
  | 'neutral'
  | 'background'
  | 'text'
  | 'accent'

export interface ColorToken {
  name: string
  hex: string
  rgb: { r: number; g: number; b: number }
  hsl: { h: number; s: number; l: number }
  frequency: number
  category: ColorCategory
}

export interface TypographyVariant {
  fontSize: string
  fontWeight: string
  lineHeight: string
  letterSpacing: string
}

export interface TypographyToken {
  fontFamily: string
  variants: TypographyVariant[]
}

export interface SpacingToken {
  value: string
  frequency: number
  label: string
}

export interface ShadowParsed {
  x: string
  y: string
  blur: string
  spread: string
  color: string
}

export interface ShadowToken {
  value: string
  parsed: ShadowParsed
}

export interface BorderRadiusToken {
  value: string
  frequency: number
}

export interface DesignSystemMetadata {
  url: string
  title: string
  scannedAt: string
}

export interface DesignSystem {
  colors: ColorToken[]
  typography: TypographyToken[]
  spacing: SpacingToken[]
  shadows: ShadowToken[]
  borderRadius: BorderRadiusToken[]
  metadata: DesignSystemMetadata
}

export type ExportFormat = 'css-variables' | 'tailwind' | 'json' | 'png'
