import React, { useState, useRef } from 'react'
import type { EditorTool } from '../../types/editor'
import {
  CursorIcon,
  PointIcon,
  WallIcon,
  RoomIcon,
  PoiIcon,
  PanoIcon,
  TrashIcon,
  FloppyIcon,
  CheckIcon,
  FileImportIcon,
  DownloadIcon,
  CodeIcon
} from './EditorIcons'

interface EditorHeaderProps {
  tool: EditorTool
  onOpenHelp?: () => void
  onSelectTool: (tool: EditorTool) => void
  onSave: () => void
  onExportJson: () => void
  onImportJson: (file: File) => void
  onOpenJsonModal: () => void
  isDirty?: boolean
  isSaving?: boolean
  justSaved?: boolean
}

export function EditorHeader({
  tool,
  onSelectTool,
  onOpenHelp,
  onSave,
  onExportJson,
  onImportJson,
  onOpenJsonModal,
  isDirty: _isDirty = false,
  isSaving = false,
  justSaved = false
}: EditorHeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const toolButtons: { id: EditorTool; label: string; icon: React.ReactNode; hint: string }[] = [
    {
      id: 'select',
      label: 'Курсор',
      icon: <CursorIcon className="size-3.5 text-blue-400" />,
      hint: 'Выбор и перемещение объектов'
    },
    {
      id: 'corner',
      label: 'Точка',
      icon: <PointIcon className="size-3.5 text-red-500" />,
      hint: 'Поставить точку или переместить'
    },
    {
      id: 'wall',
      label: 'Стена',
      icon: <WallIcon className="size-3.5 text-emerald-400" />,
      hint: 'Соединить точки в стену'
    },
    {
      id: 'room',
      label: 'Зона',
      icon: <RoomIcon className="size-3.5 text-cyan-400" />,
      hint: 'Создать комнату / зону'
    },
    {
      id: 'poi',
      label: 'POI',
      icon: <PoiIcon className="size-3.5 text-rose-400" />,
      hint: 'Добавить точку интереса'
    },
    {
      id: 'pano',
      label: '360°',
      icon: <PanoIcon className="size-3.5 text-indigo-400" />,
      hint: 'Создать панораму 360°'
    },
    {
      id: 'delete',
      label: 'Удалить',
      icon: <TrashIcon className="size-3.5 text-rose-400" />,
      hint: 'Удалить кликом'
    }
  ]

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImportJson(e.target.files[0])
      e.target.value = ''
    }
  }

  return (
    <header className="bg-slate-800 border-b border-slate-700 h-12 shrink-0 px-3 flex items-center justify-between shadow-md z-20 flex-nowrap select-none gap-2">
      {/* Логотип и заголовок */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="bg-[#e30613] text-white rounded-lg font-black text-xs tracking-wider flex items-center justify-center size-7 shadow">
          ТТК
        </div>
        <div>
          <h1 className="text-xs font-bold text-white tracking-wide leading-tight">Редактор планов</h1>
          <p className="text-[10px] text-slate-400 leading-tight">2D-план этажей</p>
        </div>
      </div>

      {/* Панель инструментов: на ПК отображается в шапке, на мобилках вынесена в нижнее плавающее меню */}
      <div className="hidden sm:flex items-center bg-slate-900/90 p-0.5 rounded-xl border border-slate-700 gap-0.5 shrink-0">
        {toolButtons.map(tb => {
          const isActive = tool === tb.id
          return (
            <button
              key={tb.id}
              onClick={() => onSelectTool(tb.id)}
              className={`px-2.5 py-1 rounded-lg text-xs flex items-center gap-1.5 transition ${
                isActive
                  ? 'bg-red-600 text-white font-semibold shadow-md shadow-red-600/30'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
              title={tb.hint}
            >
              {tb.icon}
              <span className="hidden xl:inline">{tb.label}</span>
            </button>
          )
        })}
      </div>

      {/* Правая панель действий */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={onOpenHelp}
          className="hidden sm:flex bg-slate-700/80 hover:bg-slate-700 text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold items-center gap-1.5 transition border border-slate-600 cursor-pointer"
          title="Горячие клавиши и подсказки по инструментам"
        >
          <span className="flex items-center justify-center size-3.5 rounded-full bg-red-600/20 text-red-400 text-[10px] font-black border border-red-500/30">
            ?
          </span>
          <span className="hidden sm:inline">Подсказки</span>
        </button>

        <button
          onClick={onSave}
          disabled={isSaving}
          className="bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition border border-slate-600 cursor-pointer disabled:opacity-50"
          title="Сохранить"
        >
          {isSaving ? (
            <div className="size-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : justSaved ? (
            <CheckIcon className="size-3.5 text-emerald-400" />
          ) : (
            <FloppyIcon className="size-3.5 text-slate-300" />
          )}
          <span>{isSaving ? 'Сохранение...' : justSaved ? 'Сохранено' : 'Сохранить'}</span>
        </button>

        <label
          className="hidden sm:flex cursor-pointer bg-slate-700 hover:bg-slate-600 text-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-medium items-center gap-1.5 transition border border-slate-600"
          title="Импортировать JSON"
        >
          <FileImportIcon className="size-3.5 text-blue-400" />
          <span className="hidden lg:inline">Импорт</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>

        <button
          onClick={onExportJson}
          className="hidden sm:flex bg-slate-700 hover:bg-slate-600 text-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-medium items-center gap-1.5 transition border border-slate-600"
          title="Экспортировать JSON в файл"
        >
          <DownloadIcon className="size-3.5 text-emerald-400" />
          <span className="hidden lg:inline">Экспорт</span>
        </button>

        <button
          onClick={onOpenJsonModal}
          className="hidden sm:flex bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg text-xs font-medium items-center gap-1.5 transition border border-slate-600 cursor-pointer"
          title="Просмотреть и отредактировать исходный JSON-код плана"
        >
          <CodeIcon className="size-3.5 text-blue-400" />
          <span className="hidden lg:inline">JSON</span>
        </button>

        {/* Меню "•••" для мобильных экранов */}
        <div className="sm:hidden">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(prev => !prev)}
            className="size-8 rounded-lg bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-slate-200 border border-slate-600 flex items-center justify-center font-black text-xs active:scale-95 transition cursor-pointer"
            title="Меню дополнительных действий"
          >
            •••
          </button>

          {isMobileMenuOpen && (
            <div
              className="fixed inset-0 z-50 flex items-start justify-end p-3 pt-14 bg-black/50 backdrop-blur-xs select-none"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <div
                className="w-56 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-1.5 text-xs text-slate-200 animate-in fade-in zoom-in-95"
                onClick={e => e.stopPropagation()}
              >
                <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 border-b border-slate-800 mb-1 flex items-center justify-between">
                  <span>Дополнительно</span>
                  <button
                    type="button"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="size-5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center text-xs"
                  >
                    ✕
                  </button>
                </div>

                <label className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-slate-800 active:bg-slate-700 cursor-pointer transition">
                  <FileImportIcon className="size-4 text-blue-400 shrink-0" />
                  <span className="font-medium">Импортировать JSON</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={e => {
                      handleFileChange(e)
                      setIsMobileMenuOpen(false)
                    }}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => {
                    onExportJson()
                    setIsMobileMenuOpen(false)
                  }}
                  className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-slate-800 active:bg-slate-700 cursor-pointer transition"
                >
                  <DownloadIcon className="size-4 text-emerald-400 shrink-0" />
                  <span className="font-medium">Экспортировать JSON</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onOpenJsonModal()
                    setIsMobileMenuOpen(false)
                  }}
                  className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-slate-800 active:bg-slate-700 cursor-pointer transition"
                >
                  <CodeIcon className="size-4 text-blue-400 shrink-0" />
                  <span className="font-medium">Редактор JSON</span>
                </button>

                <div className="h-px bg-slate-800 my-1" />

                <button
                  type="button"
                  onClick={() => {
                    onOpenHelp?.()
                    setIsMobileMenuOpen(false)
                  }}
                  className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-slate-800 active:bg-slate-700 cursor-pointer transition text-slate-300"
                >
                  <span className="size-4 rounded-full bg-red-600/20 text-red-400 text-[10px] font-black border border-red-500/30 flex items-center justify-center shrink-0">?</span>
                  <span className="font-medium">Подсказки и клавиши</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
