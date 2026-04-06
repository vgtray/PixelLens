import { useState } from 'react'
import {
  CaretDown,
  Eyedropper,
  TextT,
  BoundingBox,
  Sparkle,
  Code,
  CursorClick,
} from '@phosphor-icons/react'
import { usePanelStore } from '../store'
import type { ColorInfo, TypographyInfo, EffectsInfo } from '@/types/inspection'
import ColorSwatch from '../components/ColorSwatch'
import TypeSpecimen from '../components/TypeSpecimen'
import BoxModelViz from '../components/BoxModelViz'
import ShadowPreview from '../components/ShadowPreview'
import CSSBlock from '../components/CSSBlock'
import { generateCSSBlock } from '@/lib/css-parser'
import { toHex, toRgb, toHsl } from '@/lib/colors'

// Extract color, typography, effects from computed styles
function extractColors(styles: Record<string, string>): ColorInfo[] {
  const colorProps = [
    'color', 'background-color', 'border-color',
    'border-top-color', 'border-right-color',
    'border-bottom-color', 'border-left-color',
  ]
  const colors: ColorInfo[] = []
  for (const prop of colorProps) {
    const value = styles[prop]
    if (!value || value === 'transparent' || value === 'rgba(0, 0, 0, 0)') continue
    colors.push({
      property: prop,
      value,
      hex: toHex(value),
      rgb: toRgb(value),
      hsl: toHsl(value),
    })
  }
  return colors
}

function extractTypography(styles: Record<string, string>): TypographyInfo {
  return {
    fontFamily: styles['font-family'] || '',
    fontSize: styles['font-size'] || '',
    fontWeight: styles['font-weight'] || '',
    lineHeight: styles['line-height'] || '',
    letterSpacing: styles['letter-spacing'] || '',
  }
}

function extractEffects(styles: Record<string, string>): EffectsInfo {
  return {
    boxShadow: styles['box-shadow'] || 'none',
    opacity: styles['opacity'] || '1',
    backdropFilter: styles['backdrop-filter'] || 'none',
    borderRadius: styles['border-radius'] || '0px',
  }
}

interface SectionProps {
  title: string
  icon: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}

function Section({ title, icon, defaultOpen = true, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border-b border-panel-border">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-2.5 text-left hover:bg-panel-surface transition-colors duration-150"
      >
        <span className="text-panel-text-dim">{icon}</span>
        <span className="text-[12px] font-medium text-panel-text flex-1">{title}</span>
        <CaretDown
          size={12}
          className={`text-panel-text-dim transition-transform duration-300 ${open ? '' : '-rotate-90'}`}
        />
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="px-3 pb-3">{children}</div>
        </div>
      </div>
    </div>
  )
}

function InspectorView() {
  const element = usePanelStore((s) => s.inspectedElement)

  if (!element) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-panel-surface border border-panel-border flex items-center justify-center">
          <CursorClick size={28} className="text-panel-text-dim" />
        </div>
        <div>
          <p className="text-[13px] font-medium text-panel-text mb-1">No element selected</p>
          <p className="text-[11px] text-panel-text-dim leading-relaxed">
            Click on any element on the page to inspect its styles
          </p>
        </div>
      </div>
    )
  }

  const colors = extractColors(element.computedStyles)
  const typo = extractTypography(element.computedStyles)
  const effects = extractEffects(element.computedStyles)
  const cssCode = generateCSSBlock(element.computedStyles)

  // Build element path string
  let elementPath = element.tagName
  if (element.id) elementPath += `#${element.id}`
  if (element.className) {
    const classes = element.className.split(/\s+/).filter(Boolean).slice(0, 3)
    if (classes.length) elementPath += `.${classes.join('.')}`
  }

  return (
    <div>
      {/* Element info bar */}
      <div className="px-3 py-2.5 border-b border-panel-border bg-panel-surface/50">
        <p className="font-mono text-[11px] text-panel-accent truncate">{elementPath}</p>
        <p className="font-mono text-[10px] text-panel-text-dim truncate mt-0.5">
          {Math.round(element.rect.width)} x {Math.round(element.rect.height)}px
        </p>
      </div>

      {/* Colors */}
      {colors.length > 0 && (
        <Section title="Colors" icon={<Eyedropper size={14} />}>
          <div className="flex flex-col gap-2">
            {colors.map((c) => (
              <div key={c.property} className="flex items-center gap-2.5">
                <ColorSwatch color={c.hex} size={24} />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-panel-text-dim">{c.property}</p>
                  <p className="text-[12px] font-mono text-panel-text truncate">{c.hex}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Typography */}
      <Section title="Typography" icon={<TextT size={14} />}>
        <TypeSpecimen
          typography={{
            fontFamily: typo.fontFamily,
            variants: [{
              fontSize: typo.fontSize,
              fontWeight: typo.fontWeight,
              lineHeight: typo.lineHeight,
              letterSpacing: typo.letterSpacing,
            }],
          }}
        />
      </Section>

      {/* Box Model */}
      <Section title="Box Model" icon={<BoundingBox size={14} />}>
        <BoxModelViz
          boxModel={element.boxModel}
          dimensions={{
            width: Math.round(element.rect.width),
            height: Math.round(element.rect.height),
          }}
        />
      </Section>

      {/* Effects */}
      <Section title="Effects" icon={<Sparkle size={14} />}>
        <div className="flex flex-col gap-2 text-[12px]">
          {effects.boxShadow !== 'none' && (
            <div>
              <p className="text-panel-text-dim text-[11px] mb-1">box-shadow</p>
              <ShadowPreview
                shadow={{
                  value: effects.boxShadow,
                  parsed: { x: '0', y: '0', blur: '0', spread: '0', color: '' },
                }}
              />
            </div>
          )}
          {effects.borderRadius !== '0px' && (
            <div className="flex justify-between">
              <span className="text-panel-text-dim">border-radius</span>
              <span className="font-mono">{effects.borderRadius}</span>
            </div>
          )}
          {effects.opacity !== '1' && (
            <div className="flex justify-between">
              <span className="text-panel-text-dim">opacity</span>
              <span className="font-mono">{effects.opacity}</span>
            </div>
          )}
          {effects.backdropFilter !== 'none' && (
            <div className="flex justify-between">
              <span className="text-panel-text-dim">backdrop-filter</span>
              <span className="font-mono text-[11px]">{effects.backdropFilter}</span>
            </div>
          )}
          {effects.boxShadow === 'none' &&
            effects.borderRadius === '0px' &&
            effects.opacity === '1' &&
            effects.backdropFilter === 'none' && (
              <p className="text-panel-text-dim text-[11px]">No effects</p>
            )}
        </div>
      </Section>

      {/* Raw CSS */}
      <Section title="CSS" icon={<Code size={14} />} defaultOpen={false}>
        <CSSBlock code={cssCode} language="css" />
      </Section>
    </div>
  )
}

export default InspectorView
