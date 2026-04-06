import { useEffect, useState } from 'react'
import { ClockCounterClockwise, Trash } from '@phosphor-icons/react'
import { usePanelStore } from '../store'
import { getDesignSystems } from '@/lib/storage'
import type { DesignSystem } from '@/types/design-system'

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function HistoryView() {
  const setDesignSystem = usePanelStore((s) => s.setDesignSystem)
  const setMode = usePanelStore((s) => s.setMode)
  const storeHistory = usePanelStore((s) => s.history)
  const clearHistory = usePanelStore((s) => s.clearHistory)
  const [history, setHistory] = useState<DesignSystem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDesignSystems()
      .then((scans) => {
        // Merge store history with storage, deduplicate by url+time
        const allScans = [...scans]
        for (const ds of storeHistory) {
          const exists = allScans.some(
            (s) => s.metadata.url === ds.metadata.url && s.metadata.scannedAt === ds.metadata.scannedAt,
          )
          if (!exists) allScans.push(ds)
        }
        allScans.sort(
          (a, b) => new Date(b.metadata.scannedAt).getTime() - new Date(a.metadata.scannedAt).getTime(),
        )
        setHistory(allScans)
      })
      .finally(() => setLoading(false))
  }, [storeHistory])

  const handleSelect = (ds: DesignSystem) => {
    setDesignSystem(ds)
    setMode('design-system')
  }

  const handleClear = () => {
    clearHistory()
    setHistory([])
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-[11px] text-panel-text-dim">Loading...</span>
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-panel-surface border border-panel-border flex items-center justify-center">
          <ClockCounterClockwise size={28} className="text-panel-text-dim" />
        </div>
        <div>
          <p className="text-[13px] font-medium text-panel-text mb-1">No scan history</p>
          <p className="text-[11px] text-panel-text-dim leading-relaxed">
            Your previous scans will appear here
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {history.map((ds, i) => (
          <button
            key={i}
            onClick={() => handleSelect(ds)}
            className="flex items-center gap-3 p-2.5 rounded-lg bg-panel-surface border border-panel-border hover:border-panel-accent/50 transition-colors duration-200 text-left group"
          >
            {/* Color preview circles */}
            <div className="flex -space-x-1.5 shrink-0">
              {ds.colors.slice(0, 5).map((c, ci) => (
                <div
                  key={ci}
                  className="w-5 h-5 rounded-full border-2 border-panel-surface"
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-panel-text truncate">
                {ds.metadata.title || 'Untitled'}
              </p>
              <p className="text-[10px] text-panel-text-dim font-mono truncate">
                {ds.metadata.url.replace(/^https?:\/\//, '').slice(0, 40)}
              </p>
            </div>

            {/* Time */}
            <span className="text-[10px] text-panel-text-dim shrink-0">
              {timeAgo(ds.metadata.scannedAt)}
            </span>
          </button>
        ))}
      </div>

      {/* Clear button */}
      <div className="shrink-0 p-3 border-t border-panel-border">
        <button
          onClick={handleClear}
          className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg border border-panel-border text-panel-text-dim text-[11px] font-medium hover:border-red-500/50 hover:text-red-400 transition-colors duration-200"
        >
          <Trash size={12} />
          Clear History
        </button>
      </div>
    </div>
  )
}

export default HistoryView
