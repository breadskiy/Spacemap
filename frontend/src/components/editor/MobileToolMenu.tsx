import React, { useState } from 'react'
import type { EditorTool } from '../../types/editor'
import {
  CursorIcon,
  PointIcon,
  WallIcon,
  RoomIcon,
  PoiIcon,
  PanoIcon,
  TrashIcon,
  CloseIcon
} from './EditorIcons'

interface MobileToolMenuProps {
  tool: EditorTool
  onSelectTool: (tool: EditorTool) => void
  statusHint?: string
  hasActiveAction?: boolean
  onCancelAction?: () => void
}

interface ToolItem {
  id: EditorTool
  label: string
  subtitle: string
  icon: (cls: string) => React.ReactNode
  badgeColor: string
}

const TOOLS: ToolItem[] = [
  {
    id: 'select',
    label: 'Курсор',
    subtitle: 'Перемещение плана и выбор объектов',
    icon: (cls) => <CursorIcon className={cls} />,
    badgeColor: 'bg-blue-500/20 text-blue-400 border-blue-500/30'
  },
  {
    id: 'corner',
    label: 'Точка / Угол',
    subtitle: 'Поставить новую точку на плане',
    icon: (cls) => <PointIcon className={cls} />,
    badgeColor: 'bg-red-500/20 text-red-400 border-red-500/30'
  },
  {
    id: 'wall',
    label: 'Стена',
    subtitle: 'Соединить точки прямой стеной',
    icon: (cls) => <WallIcon className={cls} />,
    badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
  },
  {
    id: 'room',
    label: 'Зона / Комната',
    subtitle: 'Объединить углы в контур помещения',
    icon: (cls) => <RoomIcon className={cls} />,
    badgeColor: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
  },
  {
    id: 'poi',
    label: 'Метка (POI)',
    subtitle: 'Стенд, вход, туалет, инфостойка',
    icon: (cls) => <PoiIcon className={cls} />,
    badgeColor: 'bg-rose-500/20 text-rose-400 border-rose-500/30'
  },
  {
    id: 'pano',
    label: 'Панорама 360°',
    subtitle: 'Точка кругового виртуального тура',
    icon: (cls) => <PanoIcon className={cls} />,
    badgeColor: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
  },
  {
    id: 'delete',
    label: 'Удаление',
    subtitle: 'Удалить объект кликом по нему',
    icon: (cls) => <TrashIcon className={cls} />,
    badgeColor: 'bg-rose-500/20 text-rose-400 border-rose-500/30'
  }
]

export function MobileToolMenu({
  tool,
  onSelectTool,
  statusHint,
  hasActiveAction = false,
  onCancelAction
}: MobileToolMenuProps) {
  const [isOpen, setIsOpen] = useState(false)

  const currentTool = TOOLS.find(t => t.id === tool) || TOOLS[0]

  return (
    <>
      {/* Плавающая нижняя плашка на мобильных устройствах */}
      <div className="sm:hidden fixed bottom-4 inset-x-3 z-30 flex flex-col items-center gap-2 pointer-events-none select-none">
        {/* Краткая подсказка текущего действия */}
        {statusHint && (
          <div className="max-w-xs bg-slate-900/95 backdrop-blur-md border border-slate-700/80 px-3 py-1 rounded-full text-[10px] text-slate-300 shadow-lg truncate flex items-center gap-1.5 pointer-events-auto">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="truncate">{statusHint}</span>
          </div>
        )}

        <div className="flex items-center gap-2 pointer-events-auto shadow-2xl">
          {/* Главная кнопка выбора инструмента */}
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="h-11 px-4 rounded-2xl bg-slate-900/95 border border-slate-700/90 text-white flex items-center gap-2.5 shadow-xl backdrop-blur-md active:scale-95 transition cursor-pointer"
          >
            <div className={`size-7 rounded-xl flex items-center justify-center border ${currentTool.badgeColor}`}>
              {currentTool.icon('size-4')}
            </div>
            <div className="text-left">
              <div className="text-xs font-bold leading-tight flex items-center gap-1">
                <span>{currentTool.label}</span>
                <span className="text-[10px] text-slate-400">▾</span>
              </div>
              <div className="text-[9px] text-slate-400 leading-tight">Инструменты</div>
            </div>
          </button>

          {/* Кнопка отмены активного действия (если строим стену или контур) */}
          {hasActiveAction && onCancelAction && (
            <button
              type="button"
              onClick={onCancelAction}
              className="h-11 px-3.5 rounded-2xl bg-rose-600/90 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-xl backdrop-blur-md active:scale-95 transition cursor-pointer"
              title="Отменить текущее построение"
            >
              <span>✕</span>
              <span>Отмена</span>
            </button>
          )}
        </div>
      </div>

      {/* Шторка (Bottom Sheet) со списком всех инструментов */}
      {isOpen && (
        <div 
          className="sm:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 select-none"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="w-full bg-slate-900 border-t border-slate-700 rounded-t-3xl p-4 sm:p-5 pb-8 shadow-2xl flex flex-col max-h-[82vh] overflow-hidden animate-in slide-in-from-bottom duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Хэндл шторки */}
            <div className="w-10 h-1 rounded-full bg-slate-700 mx-auto mb-3" />

            {/* Заголовок */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Выбор инструмента</h3>
                <p className="text-[11px] text-slate-400">Нажмите на инструмент для работы с планом</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="size-8 rounded-full bg-slate-800 border border-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
              >
                <CloseIcon className="size-4" />
              </button>
            </div>

            {/* Сетка инструментов */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 overflow-y-auto pr-0.5">
              {TOOLS.map(t => {
                const isActive = tool === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      onSelectTool(t.id)
                      setIsOpen(false)
                    }}
                    className={`p-3 rounded-2xl border text-left flex items-center gap-3 transition active:scale-98 cursor-pointer ${
                      isActive
                        ? 'bg-red-600/20 border-red-500 text-white shadow-md ring-1 ring-red-500/50'
                        : 'bg-slate-800/70 border-slate-700 text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <div className={`size-10 rounded-xl flex items-center justify-center border shrink-0 ${t.badgeColor}`}>
                      {t.icon('size-5')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold truncate">{t.label}</span>
                        {isActive && (
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-red-600 text-white shrink-0">
                            Выбран
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{t.subtitle}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
