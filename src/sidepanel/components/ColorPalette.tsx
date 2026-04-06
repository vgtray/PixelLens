import type { ColorToken, ColorCategory } from '@/types/design-system'
import ColorSwatch from './ColorSwatch'

interface ColorPaletteProps {
  colors: ColorToken[]
}

const CATEGORY_ORDER: ColorCategory[] = ['primary', 'secondary', 'accent', 'neutral', 'background', 'text']
const CATEGORY_LABELS: Record<ColorCategory, string> = {
  primary: 'Primary',
  secondary: 'Secondary',
  accent: 'Accent',
  neutral: 'Neutrals',
  background: 'Backgrounds',
  text: 'Text',
}

function ColorPalette({ colors }: ColorPaletteProps) {
  // Group by category
  const grouped = new Map<ColorCategory, ColorToken[]>()
  for (const color of colors) {
    const cat = color.category
    if (!grouped.has(cat)) grouped.set(cat, [])
    grouped.get(cat)!.push(color)
  }

  // Sort each group by frequency
  for (const [, group] of grouped) {
    group.sort((a, b) => b.frequency - a.frequency)
  }

  const categories = CATEGORY_ORDER.filter((cat) => grouped.has(cat))

  if (colors.length === 0) {
    return <p className="text-[11px] text-panel-text-dim">No colors found</p>
  }

  return (
    <div className="flex flex-col gap-4">
      {categories.map((cat) => (
        <div key={cat}>
          <h4 className="text-[11px] font-medium text-panel-text-dim uppercase tracking-wider mb-2">
            {CATEGORY_LABELS[cat]}
          </h4>
          <div className="flex flex-wrap gap-2">
            {grouped.get(cat)!.map((color, i) => (
              <ColorSwatch key={i} color={color.hex} size={36} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default ColorPalette
