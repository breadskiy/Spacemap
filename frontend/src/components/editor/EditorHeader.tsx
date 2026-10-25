import React, { useRef } from 'react'
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
    <header className="bg-slate-800 border-b border-slate-700 h-12 shrink-0 px-3 flex items-center justify-between shadow-md z-20 flex-nowrap overflow-x-auto select-none gap-2">
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

      {/* Панель инструментов */}
      <div className="flex items-center bg-slate-900/90 p-0.5 rounded-xl border border-slate-700 gap-0.5 shrink-0">
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
              <span className="hidden sm:inline">{tb.label}</span>
            </button>
          )
        })}
      </div>

      {/* Сохранение / Импорт / Экспорт */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={onOpenHelp}
          className="bg-slate-700/80 hover:bg-slate-700 text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition border border-slate-600 cursor-pointer"
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
          className="cursor-pointer bg-slate-700 hover:bg-slate-600 text-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition border border-slate-600"
          title="Импортировать JSON"
        >
          <FileImportIcon className="size-3.5 text-blue-400" />
          <span className="hidden md:inline">Импорт</span>
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
          className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition border border-slate-600"
          title="Экспортировать JSON в файл"
        >
          <DownloadIcon className="size-3.5 text-emerald-400" />
          <span className="hidden md:inline">Экспорт</span>
        </button>

        <button
          onClick={onOpenJsonModal}
          className="bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition border border-slate-600 cursor-pointer"
          title="Просмотреть и отредактировать исходный JSON-код плана"
        >
          <CodeIcon className="size-3.5 text-blue-400" />
          <span className="hidden lg:inline">JSON</span>
        </button>
      </div>
    </header>
  )
}
