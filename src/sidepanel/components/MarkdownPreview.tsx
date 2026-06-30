interface MarkdownPreviewProps {
  markdown: string
}

// Raw GFM source preview — monospace, scrollable, faithful to what gets exported.
function MarkdownPreview({ markdown }: MarkdownPreviewProps) {
  return (
    <div className="h-full flex flex-col rounded-lg bg-panel-surface border border-panel-border overflow-hidden">
      <div className="flex-1 overflow-y-auto p-3">
        <pre className="text-[11px] leading-[1.7] font-mono whitespace-pre-wrap break-words text-panel-text/90 selection:bg-panel-accent/30">
          {markdown}
        </pre>
      </div>
    </div>
  )
}

export default MarkdownPreview
