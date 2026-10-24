import { CloseIcon, InfoIcon, PanoIcon } from '../EditorIcons'

interface PanoramaHelpModalProps {
  isOpen: boolean
  onClose: () => void
}

export function PanoramaHelpModal({ isOpen, onClose }: PanoramaHelpModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-xl max-h-[90vh] rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl p-6 text-slate-200 flex flex-col overflow-hidden">
        
        {/* Шапка */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <PanoIcon className="size-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Инструкция: Создание 360° панорам</h3>
              <p className="text-xs text-slate-400">Съемка на смартфон и автоматическая сшивка</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition"
          >
            <CloseIcon className="size-4" />
          </button>
        </div>

        {/* Контент скроллируемый */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
          {/* Способ 1 */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
            <div className="flex items-center gap-2 mb-2">
              <span className="size-5 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-[10px]">
                1
              </span>
              <h4 className="font-bold text-sm text-indigo-300">Одиночная панорама (360° / Сфера)</h4>
            </div>
            <p className="text-slate-300 leading-relaxed mb-2">
              Если у вас уже есть готовая эквиректангулярная панорама (пропорции 2:1) со специализированной камеры (Insta360, Ricoh Theta) или снятая в режиме панорамы на смартфоне:
            </p>
            <ul className="list-disc list-inside text-slate-400 space-y-1 ml-1">
              <li>Выберите режим «Одиночная 360°».</li>
              <li>Перетащите файл (JPG, PNG или HEIC) в зону загрузки.</li>
              <li>Панорама сразу появится на плане и будет доступна для интерактивного 360° просмотра.</li>
            </ul>
          </div>

          {/* Способ 2 */}
          <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-900/40">
            <div className="flex items-center gap-2 mb-2">
              <span className="size-5 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-[10px]">
                2
              </span>
              <h4 className="font-bold text-sm text-emerald-300">Сшивка из двух кадров по 180° на смартфон</h4>
            </div>
            <p className="text-slate-300 leading-relaxed mb-3">
              Идеальный способ для быстрой оцифровки любого помещения обычным телефоном:
            </p>
            <div className="grid grid-cols-2 gap-2 text-[11px] mb-3">
              <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                <span className="font-bold text-emerald-400 block mb-1">Кадр 1:</span>
                Встаньте в центр комнаты, включите режим «Панорама» на телефоне и сделайте плавный оборот на 180° (слева направо).
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                <span className="font-bold text-emerald-400 block mb-1">Кадр 2:</span>
                Развернитесь на 180° и снимите вторую половину зала с небольшим перекрытием краев (20-30%).
              </div>
            </div>
            <div className="flex items-center gap-2 text-indigo-200 bg-indigo-900/30 p-2.5 rounded-xl border border-indigo-800/40">
              <InfoIcon className="size-4 shrink-0 text-indigo-400" />
              <span>Алгоритм SIFT + RANSAC автоматически соединит швы и выровняет горизонт в 8K!</span>
            </div>
          </div>

          {/* Хотспоты POI */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
            <div className="flex items-center gap-2 mb-2">
              <span className="size-5 rounded-full bg-rose-600 text-white font-bold flex items-center justify-center text-[10px]">
                3
              </span>
              <h4 className="font-bold text-sm text-rose-300">Точки интереса (POI) внутри панорамы</h4>
            </div>
            <p className="text-slate-300 leading-relaxed">
              В редакторе панорамы нажмите кнопку <strong className="text-white">«Импортировать POI комнаты»</strong> — все стенды, входы и точки из этой зоны будут спроецированы на 360° сферу с точным расчетом угла азимута (yaw).
            </p>
          </div>
        </div>

        {/* Футер */}
        <div className="pt-4 border-t border-slate-800 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition"
          >
            Понятно
          </button>
        </div>
      </div>
    </div>
  )
}
