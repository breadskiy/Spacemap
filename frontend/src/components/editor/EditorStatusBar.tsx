import { ZoomInIcon, ZoomOutIcon, ResetViewIcon } from './EditorIcons'

interface EditorStatusBarProps {
  hint: string
  cursorCoords: { x: number; y: number }
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onResetView: () => void
}

export function EditorStatusBar({
  hint,
  cursorCoords,
  zoom,
  onZoomIn,
  onZoomOut,
  onResetView
}: EditorStatusBarProps) {
  return (
    <footer className="h-8 shrink-0 bg-slate-900 border-t border-slate-800 px-3 flex items-center justify-between text-[11px] text-slate-400 select-none z-10">
      {/* Подсказка текущего действия */}
      <div className="flex items-center gap-2 truncate mr-2">
        <span className="size-1.5 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
        <span className="truncate text-slate-300 font-medium">{hint}</span>
      </div>

      {/* Координаты и масштабирование */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="hidden sm:flex items-center gap-1 font-mono text-[10px] bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-slate-400">
          <span>X: <strong className="text-red-400">{Math.round(cursorCoords.x)}</strong></span>
          <span className="text-slate-600">|</span>
          <span>Y: <strong className="text-red-400">{Math.round(cursorCoords.y)}</strong></span>
        </div>

        <div className="flex items-center gap-1 bg-slate-950 px-1 py-0.5 rounded border border-slate-800">
          <span className="font-mono text-[10px] w-9 text-center text-slate-300">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={onZoomOut}
            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition"
            title="Отдалить (-)"
          >
            <ZoomOutIcon className="size-3" />
          </button>
          <button
            onClick={onZoomIn}
            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition"
            title="Приблизить (+)"
          >
            <ZoomInIcon className="size-3" />
          </button>
          <button
            onClick={onResetView}
            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition"
            title="Сбросить масштаб и центрировать"
          >
            <ResetViewIcon className="size-3" />
          </button>
        </div>
      </div>
    </footer>
  )
}
