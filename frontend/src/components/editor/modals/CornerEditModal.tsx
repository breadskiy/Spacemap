import React, { useState, useEffect } from 'react'
import type { PlanCorner } from '../../../types/plan'
import { CloseIcon, EditIcon } from '../EditorIcons'

interface CornerEditModalProps {
  isOpen: boolean
  corner: PlanCorner | null
  onClose: () => void
  onSave: (cornerId: string, x: number, y: number) => void
}

export function CornerEditModal({
  isOpen,
  corner,
  onClose,
  onSave
}: CornerEditModalProps) {
  const [x, setX] = useState<number>(0)
  const [y, setY] = useState<number>(0)

  useEffect(() => {
    if (corner) {
      setX(corner.x)
      setY(corner.y)
    }
  }, [corner])

  if (!isOpen || !corner) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(corner.id, x, y)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-5 text-slate-200">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center border border-red-500/30">
              <EditIcon className="size-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Редактирование точки [{corner.id}]</h3>
              <p className="text-[11px] text-slate-400">Изменение координат вершины</p>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Координата X</label>
              <input
                type="number"
                step="1"
                value={x}
                onChange={e => setX(parseInt(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-red-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Координата Y</label>
              <input
                type="number"
                step="1"
                value={y}
                onChange={e => setY(parseInt(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-red-500 focus:outline-none"
                required
              />
            </div>
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
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#e30613] hover:bg-[#c40511] text-white shadow transition"
            >
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
