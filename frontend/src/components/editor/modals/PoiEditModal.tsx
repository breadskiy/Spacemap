import React, { useState, useEffect } from 'react'
import type { PlanPoi, PlanRoom } from '../../../types/plan'
import { POI_CATEGORIES } from '../../../types/editor'
import { CloseIcon, PoiIcon } from '../EditorIcons'

interface PoiEditModalProps {
  isOpen: boolean
  poi: PlanPoi | null
  defaultX: number
  defaultY: number
  rooms: PlanRoom[]
  onClose: () => void
  onSave: (poiData: {
    id?: string
    name: string
    category: string
    x: number
    y: number
    description?: string
    room_id?: string
  }) => void
}

export function PoiEditModal({
  isOpen,
  poi,
  defaultX,
  defaultY,
  rooms,
  onClose,
  onSave
}: PoiEditModalProps) {
  const [name, setName] = useState<string>('')
  const [category, setCategory] = useState<string>('stand')
  const [roomId, setRoomId] = useState<string>('')
  const [description, setDescription] = useState<string>('')

  useEffect(() => {
    if (poi) {
      setName(poi.name)
      setCategory(poi.category || 'stand')
      setRoomId(poi.room_id || '')
      setDescription(poi.description || '')
    } else {
      setName('')
      setCategory('stand')
      setRoomId('')
      setDescription('')
    }
  }, [poi, isOpen])

  if (!isOpen) return null

  const targetX = poi ? poi.x : defaultX
  const targetY = poi ? poi.y : defaultY

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      id: poi ? poi.id : undefined,
      name: name.trim() || 'Точка интереса',
      category,
      x: targetX,
      y: targetY,
      description: description.trim() || undefined,
      room_id: roomId || undefined
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-5 text-slate-200">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
              <PoiIcon className="size-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">
                {poi ? `Редактирование POI: ${poi.name}` : 'Новая точка интереса (POI)'}
              </h3>
              <p className="text-[11px] text-slate-400">Метка для посетителей и навигации</p>
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
              Название объекта / стенда
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Например: Стенд РЖД / ТТК, Кофейня, Гардероб"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-rose-500 focus:outline-none"
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Категория</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white focus:border-rose-500 focus:outline-none"
              >
                {Object.values(POI_CATEGORIES).map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Привязка к зоне</label>
              <select
                value={roomId}
                onChange={e => setRoomId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white focus:border-rose-500 focus:outline-none"
              >
                <option value="">Без привязки</option>
                {rooms.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Описание (необязательно)
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Краткая информация, расписание или особенности локации..."
              rows={2}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-rose-500 focus:outline-none resize-none"
            />
          </div>

          <div className="bg-slate-950/70 rounded-xl p-2.5 border border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400">Координаты на плане:</span>
            <span className="font-mono text-rose-400 font-bold">
              X: {targetX}, Y: {targetY}
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
              className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow transition"
            >
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
