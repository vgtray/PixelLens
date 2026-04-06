import type { BoxModel } from '@/types/inspection'

interface BoxModelVizProps {
  boxModel: BoxModel
  dimensions: { width: number; height: number }
}

function parseNum(val: string): string {
  const n = parseFloat(val)
  return isNaN(n) ? '0' : n === 0 ? '-' : String(Math.round(n))
}

function BoxModelViz({ boxModel, dimensions }: BoxModelVizProps) {
  return (
    <div className="flex items-center justify-center">
      {/* Margin */}
      <div className="relative p-3 border border-dashed border-orange-500/40 rounded bg-orange-500/5 min-w-[200px]">
        <Label text="margin" position="top-left" color="text-orange-400/70" />
        <Side val={parseNum(boxModel.margin.top)} position="top" />
        <Side val={parseNum(boxModel.margin.right)} position="right" />
        <Side val={parseNum(boxModel.margin.bottom)} position="bottom" />
        <Side val={parseNum(boxModel.margin.left)} position="left" />

        {/* Border */}
        <div className="relative p-3 border border-dashed border-blue-500/40 rounded bg-blue-500/5">
          <Label text="border" position="top-left" color="text-blue-400/70" />
          <Side val={parseNum(boxModel.border.top)} position="top" />
          <Side val={parseNum(boxModel.border.right)} position="right" />
          <Side val={parseNum(boxModel.border.bottom)} position="bottom" />
          <Side val={parseNum(boxModel.border.left)} position="left" />

          {/* Padding */}
          <div className="relative p-3 border border-dashed border-green-500/40 rounded bg-green-500/5">
            <Label text="padding" position="top-left" color="text-green-400/70" />
            <Side val={parseNum(boxModel.padding.top)} position="top" />
            <Side val={parseNum(boxModel.padding.right)} position="right" />
            <Side val={parseNum(boxModel.padding.bottom)} position="bottom" />
            <Side val={parseNum(boxModel.padding.left)} position="left" />

            {/* Content */}
            <div className="flex items-center justify-center py-2 px-4 bg-panel-accent/10 border border-panel-accent/30 rounded text-center">
              <span className="text-[11px] font-mono text-panel-accent">
                {dimensions.width} x {dimensions.height}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Label({ text, position, color }: { text: string; position: string; color: string }) {
  const posClass = position === 'top-left' ? 'top-0.5 left-1' : ''
  return (
    <span className={`absolute ${posClass} text-[8px] font-mono ${color} uppercase tracking-wider`}>
      {text}
    </span>
  )
}

function Side({ val, position }: { val: string; position: 'top' | 'right' | 'bottom' | 'left' }) {
  if (val === '-') return null

  const posMap = {
    top: 'top-0.5 left-1/2 -translate-x-1/2',
    right: 'right-0.5 top-1/2 -translate-y-1/2',
    bottom: 'bottom-0.5 left-1/2 -translate-x-1/2',
    left: 'left-0.5 top-1/2 -translate-y-1/2',
  }

  return (
    <span className={`absolute ${posMap[position]} text-[10px] font-mono text-panel-text-dim`}>
      {val}
    </span>
  )
}

export default BoxModelViz
