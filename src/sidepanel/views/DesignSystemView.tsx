import { useState } from 'react'
import { Palette, TextT, ArrowsOutSimple, Circle, Drop, Trash } from '@phosphor-icons/react'
import { usePanelStore } from '../store'
import ExportButton from '../components/ExportButton'
import ColorSwatch from '../components/ColorSwatch'
import ShadowPreview from '../components/ShadowPreview'
import type { DesignSystem } from '@/types/design-system'

function DesignSystemView() {
  const designSystem = usePanelStore((s) => s.designSystem)
  const setDesignSystem = usePanelStore((s) => s.setDesignSystem)
  const setMode = usePanelStore((s) => s.setMode)

  if (!designSystem) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-panel-surface border border-panel-border flex items-center justify-center">
          <Palette size={28} className="text-panel-text-dim" />
        </div>
        <div>
          <p className="text-[13px] font-medium text-panel-text mb-1">No design system yet</p>
          <p className="text-[11px] text-panel-text-dim leading-relaxed mb-4">
            Scan a page first to generate a design system
          </p>
          <button
            onClick={() => setMode('scan')}
            className="px-4 py-2 rounded-lg bg-panel-accent text-white text-[12px] font-medium hover:bg-panel-accent-hover transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-panel-accent focus-visible:ring-offset-2 focus-visible:ring-offset-panel-bg"
          >
            Go to Scan
          </button>
        </div>
      </div>
    )
  }

  const handleRemoveColor = (index: number) => {
    const updated: DesignSystem = {
      ...designSystem,
      colors: designSystem.colors.filter((_, i) => i !== index),
    }
    setDesignSystem(updated)
  }

  const handleRenameColor = (index: number, newName: string) => {
    const updated: DesignSystem = {
      ...designSystem,
      colors: designSystem.colors.map((c, i) => (i === index ? { ...c, name: newName } : c)),
    }
    setDesignSystem(updated)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with export */}
      <div className="shrink-0 px-3 py-2.5 border-b border-panel-border bg-panel-surface/50 flex items-center justify-between">
        <div>
          <p className="text-[12px] font-medium text-panel-text">{designSystem.metadata.title}</p>
          <p className="text-[10px] text-panel-text-dim font-mono truncate max-w-[180px]">
            {designSystem.metadata.url}
          </p>
        </div>
        <ExportButton designSystem={designSystem} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-5">
        {/* Colors */}
        <DSSection title="Palette" icon={<Palette size={14} />} count={designSystem.colors.length}>
          <div className="flex flex-col gap-2">
            {designSystem.colors.map((color, i) => (
              <div key={i} className="flex items-center gap-2 group">
                <ColorSwatch color={color.hex} size={28} />
                <EditableLabel
                  value={color.name}
                  onChange={(v) => handleRenameColor(i, v)}
                />
                <span className="text-[10px] font-mono text-panel-text-dim ml-auto">
                  {color.hex}
                </span>
                <button
                  onClick={() => handleRemoveColor(i)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 text-panel-text-dim hover:text-red-400 transition-all duration-150"
                  title="Remove"
                >
                  <Trash size={12} />
                </button>
              </div>
            ))}
          </div>
        </DSSection>

        {/* Typography */}
        <DSSection title="Type Scale" icon={<TextT size={14} />} count={designSystem.typography.length}>
          <div className="flex flex-col gap-3">
            {designSystem.typography.map((font) => (
              <div key={font.fontFamily} className="p-2.5 rounded-lg bg-panel-surface border border-panel-border">
                <p
                  className="text-[14px] text-panel-text mb-1 truncate"
                  style={{ fontFamily: font.fontFamily }}
                >
                  {font.fontFamily.split(',')[0].replace(/['"]/g, '')}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {font.variants.map((v, i) => (
                    <span key={i} className="text-[10px] font-mono text-panel-text-dim bg-panel-bg px-1.5 py-0.5 rounded">
                      {v.fontSize} / {v.fontWeight}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DSSection>

        {/* Spacing */}
        <DSSection title="Spacing" icon={<ArrowsOutSimple size={14} />} count={designSystem.spacing.length}>
          <div className="flex flex-wrap gap-2">
            {designSystem.spacing.map((s) => (
              <div key={s.value} className="flex items-center gap-1.5 bg-panel-surface border border-panel-border rounded px-2 py-1">
                <div
                  className="h-3 rounded-sm bg-panel-accent/40"
                  style={{ width: Math.min(parseInt(s.value) || 4, 48) }}
                />
                <span className="text-[11px] font-mono text-panel-text">{s.value}</span>
              </div>
            ))}
          </div>
        </DSSection>

        {/* Border Radius */}
        <DSSection title="Border Radius" icon={<Circle size={14} />} count={designSystem.borderRadius.length}>
          <div className="flex flex-wrap gap-2">
            {designSystem.borderRadius.map((br) => (
              <div key={br.value} className="flex items-center gap-2 bg-panel-surface border border-panel-border rounded px-2.5 py-1.5">
                <div
                  className="w-6 h-6 border-2 border-panel-accent"
                  style={{ borderRadius: br.value }}
                />
                <span className="text-[11px] font-mono text-panel-text">{br.value}</span>
              </div>
            ))}
          </div>
        </DSSection>

        {/* Shadows */}
        <DSSection title="Shadows" icon={<Drop size={14} />} count={designSystem.shadows.length}>
          <div className="grid grid-cols-2 gap-3">
            {designSystem.shadows.map((shadow, i) => (
              <ShadowPreview key={i} shadow={shadow} />
            ))}
          </div>
        </DSSection>
      </div>
    </div>
  )
}

function DSSection({
  title,
  icon,
  count,
  children,
}: {
  title: string
  icon: React.ReactNode
  count: number
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-panel-text-dim">{icon}</span>
        <h3 className="text-[12px] font-semibold text-panel-text">{title}</h3>
        <span className="text-[10px] text-panel-text-dim bg-panel-surface px-1.5 py-0.5 rounded-full">
          {count}
        </span>
      </div>
      {children}
    </section>
  )
}

function EditableLabel({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  if (editing) {
    return (
      <input
        className="text-[11px] font-medium text-panel-text bg-panel-bg border border-panel-border rounded px-1.5 py-0.5 w-24 focus:outline-none focus:border-panel-accent"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          onChange(draft)
          setEditing(false)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onChange(draft)
            setEditing(false)
          }
          if (e.key === 'Escape') setEditing(false)
        }}
        autoFocus
      />
    )
  }

  return (
    <button
      onClick={() => { setDraft(value); setEditing(true) }}
      className="text-[11px] font-medium text-panel-text hover:text-panel-accent transition-colors duration-150 truncate max-w-[100px] text-left"
      title="Click to rename"
    >
      {value || 'unnamed'}
    </button>
  )
}

export default DesignSystemView
