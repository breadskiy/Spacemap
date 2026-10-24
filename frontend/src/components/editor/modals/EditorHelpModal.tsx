import { CloseIcon } from '../EditorIcons'

interface EditorHelpModalProps {
  isOpen: boolean
  onClose: () => void
}

export function EditorHelpModal({ isOpen, onClose }: EditorHelpModalProps) {
  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150 select-none"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl p-5 sm:p-6 text-slate-200 flex flex-col space-y-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Заголовок */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-xl bg-red-600/20 text-red-500 flex items-center justify-center text-sm font-bold border border-red-500/30">
              💡
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Быстрые подсказки</h3>
              <p className="text-[11px] text-slate-400">Справка по инструментам и горячим клавишам</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-7 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition"
          >
            <CloseIcon className="size-4" />
          </button>
        </div>

        {/* Список подсказок по инструментам */}
        <div className="space-y-2.5 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start gap-2.5">
            <span className="text-sm">📍</span>
            <div>
              <strong className="text-white">Точка:</strong> Клик по сетке создает точку. Удерживайте <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-red-400 font-mono text-[10px] border border-slate-700">Shift + ЛКМ</kbd> для быстрого спавна цепочки точек без окон.
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start gap-2.5">
            <span className="text-sm">🧱</span>
            <div>
              <strong className="text-white">Стена:</strong> Кликайте по точкам по очереди — строится <strong>непрерывная цепочка стен</strong>. Можно кликать прямо по пустой сетке: точка создастся автоматически. Для завершения нажмите <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] border border-slate-700">ПКМ</kbd> или <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] border border-slate-700">Esc</kbd>.
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start gap-2.5">
            <span className="text-sm">🔷</span>
            <div>
              <strong className="text-white">Зона (комната):</strong> Кликайте по углам контура, замкните на первой точке для формирования цветной зоны.
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start gap-2.5">
            <span className="text-sm">🖱</span>
            <div>
              <strong className="text-white">Навигация:</strong> Колесико мыши или щипок двумя пальцами на тачпаде зумирует плоскость. Зажатие колесика мыши (СКМ) перемещает карту.
            </div>
          </div>
        </div>

        {/* Кнопка закрытия */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-[#e30613] hover:bg-[#c40511] text-white transition shadow-sm"
          >
            Понятно
          </button>
        </div>
      </div>
    </div>
  )
}
