import React, { useState, useEffect } from 'react'
import type { PlanRoom } from '../../../types/plan'
import { ROOM_COLOR_PRESETS } from '../../../types/editor'
import { CloseIcon, RoomIcon } from '../EditorIcons'

interface RoomEditModalProps {
  isOpen: boolean
  room: PlanRoom | null
  cornerIds: string[]
  onClose: () => void
  onSave: (roomData: { id?: string; name: string; color: string; corners: string[] }) => void
}

export function RoomEditModal({
  isOpen,
  room,
  cornerIds,
  onClose,
  onSave
}: RoomEditModalProps) {
  const [name, setName] = useState<string>('')
  const [color, setColor] = useState<string>('#3b82f6')

  useEffect(() => {
    if (room) {
      setName(room.name)
      setColor(room.color || '#3b82f6')
    } else {
      setName(`Комната ${Math.floor(Math.random() * 90 + 10)}`)
      setColor(ROOM_COLOR_PRESETS[Math.floor(Math.random() * ROOM_COLOR_PRESETS.length)])
    }
  }, [room, isOpen])

  if (!isOpen) return null

  const activeCorners = room ? room.corners : cornerIds

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      id: room ? room.id : undefined,
      name: name.trim() || 'Помещение',
      color,
      corners: activeCorners
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-5 text-slate-200">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
              <RoomIcon className="size-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">
                {room ? `Настройки зоны: ${room.name}` : 'Создание зоны / комнаты'}
              </h3>
              <p className="text-[11px] text-slate-400">
                Контур из {activeCorners.length} точек
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-7 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition"
          >
            <CloseIcon className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Название помещения / зоны
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Например: Главный зал, Стенд А1, Офис 204"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
              Цвет подсветки зоны
            </label>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              {ROOM_COLOR_PRESETS.map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setColor(preset)}
                  className={`size-6 rounded-full transition-transform ${
                    color.toLowerCase() === preset.toLowerCase()
                      ? 'scale-125 ring-2 ring-white shadow-md'
                      : 'hover:scale-110 opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: preset }}
                  title={preset}
                />
              ))}
            </div>

            <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-700">
              <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                className="size-6 rounded cursor-pointer bg-transparent border-0 p-0"
              />
              <input
                type="text"
                value={color}
                onChange={e => setColor(e.target.value)}
                className="bg-transparent text-xs font-mono text-slate-300 focus:outline-none uppercase w-24"
              />
            </div>
          </div>

          <div className="bg-slate-950/70 rounded-xl p-2.5 border border-slate-800 text-xs">
            <span className="text-slate-400">Углы контура: </span>
            <span className="font-mono text-cyan-400">
              {activeCorners.map(c => `[${c}]`).join(' ➔ ')}
            </span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow transition"
            >
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
