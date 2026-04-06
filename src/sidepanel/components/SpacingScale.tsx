import type { SpacingToken } from '@/types/design-system'

interface SpacingScaleProps {
  spacings: SpacingToken[]
  baseUnit: number
}

function SpacingScale({ spacings, baseUnit }: SpacingScaleProps) {
  if (spacings.length === 0) {
    return <p className="text-[11px] text-panel-text-dim">No spacing values found</p>
  }

  const maxValue = Math.max(...spacings.map((s) => parseInt(s.value) || 0), 1)

  return (
    <div className="flex flex-col gap-1.5">
      {spacings.map((spacing) => {
        const numValue = parseInt(spacing.value) || 0
        const widthPercent = Math.max((numValue / maxValue) * 100, 4)
        const isBase = numValue === baseUnit

        return (
          <div
            key={spacing.value}
            className={`flex items-center gap-2.5 py-1 px-2 rounded-md ${isBase ? 'bg-panel-accent/10 border border-panel-accent/30' : ''}`}
          >
            <span className="text-[11px] font-mono text-panel-text w-10 shrink-0 text-right">
              {spacing.value}
            </span>
            <div className="flex-1 h-6 flex items-center">
              <div
                className="h-5 rounded-sm transition-all duration-300"
                style={{
                  width: `${widthPercent}%`,
                  backgroundColor: `color-mix(in srgb, var(--color-panel-accent) ${Math.max(30, 80 - (numValue / maxValue) * 50)}%, transparent)`,
                }}
              />
            </div>
            <span className="text-[10px] text-panel-text-dim w-8 shrink-0 text-right">
              {spacing.frequency}x
            </span>
            {isBase && (
              <span className="text-[9px] font-semibold text-panel-accent uppercase tracking-wider">
                BASE
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default SpacingScale
