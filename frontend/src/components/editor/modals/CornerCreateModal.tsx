import React, { useState, useEffect } from 'react'
import type { PlanCorner } from '../../../types/plan'
import { CloseIcon } from '../EditorIcons'

interface CornerCreateModalProps {
  isOpen: boolean
  defaultX: number
  defaultY: number
  corners: PlanCorner[]
  onClose: () => void
  onCreate: (x: number, y: number, connectWithCornerId?: string) => void
}

export function CornerCreateModal({
  isOpen,
  defaultX,
  defaultY,
  corners,
  onClose,
  onCreate
}: CornerCreateModalProps) {
  const [mode, setMode] = useState<'absolute' | 'relative'>('absolute')
  const [absX, setAbsX] = useState<number>(defaultX)
  const [absY, setAbsY] = useState<number>(defaultY)

  const [baseCornerId, setBaseCornerId] = useState<string>(corners[0]?.id || '')
  const [relDx, setRelDx] = useState<number>(100)
  const [relDy, setRelDy] = useState<number>(0)
  const [connectWall, setConnectWall] = useState<boolean>(true)

  useEffect(() => {
    setAbsX(defaultX)
    setAbsY(defaultY)
    if (corners.length > 0 && !baseCornerId) {
      setBaseCornerId(corners[0].id)
    }
  }, [defaultX, defaultY, corners, baseCornerId])

  if (!isOpen) return null

  const baseCorner = corners.find(c => c.id === baseCornerId)
  const finalX = mode === 'absolute' ? absX : (baseCorner ? baseCorner.x + relDx : relDx)
  const finalY = mode === 'absolute' ? absY : (baseCorner ? baseCorner.y + relDy : relDy)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === 'absolute') {
      onCreate(absX, absY)
    } else {
      onCreate(finalX, finalY, connectWall && baseCornerId ? baseCornerId : undefined)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-5 text-slate-200">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm border border-amber-500/30">
              •
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Создание точки (угла)</h3>
              <p className="text-[11px] text-slate-400">Точное позиционирование на декартовой сетке</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-7 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition"
          >
            <CloseIcon className="size-4" />
          </button>
        </div>

        {/* Переключатель режимов */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950/70 rounded-xl border border-slate-800 mb-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setMode('absolute')}
            className={`py-1.5 rounded-lg transition ${
              mode === 'absolute'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Абсолютные (X, Y)
          </button>
          <button
            type="button"
            onClick={() => setMode('relative')}
            className={`py-1.5 rounded-lg transition ${
              mode === 'relative'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
            disabled={corners.length === 0}
            title={corners.length === 0 ? 'Нет доступных точек для относительного смещения' : ''}
          >
            Относительные (dx, dy)
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'absolute' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Координата X (px)</label>
                <input
                  type="number"
                  step="1"
                  value={absX}
                  onChange={e => setAbsX(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Координата Y (px)</label>
                <input
                  type="number"
                  step="1"
                  value={absY}
                  onChange={e => setAbsY(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Базовая точка отсчета</label>
                <select
                  value={baseCornerId}
                  onChange={e => setBaseCornerId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                >
                  {corners.map(c => (
                    <option key={c.id} value={c.id}>
                      Точка [{c.id}] — X: {c.x}, Y: {c.y}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Смещение dx (px)</label>
                  <input
                    type="number"
                    step="1"
                    value={relDx}
                    onChange={e => setRelDx(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-amber-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Смещение dy (px)</label>
                  <input
                    type="number"
                    step="1"
                    value={relDy}
                    onChange={e => setRelDy(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-amber-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-950/50 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={connectWall}
                  onChange={e => setConnectWall(e.target.checked)}
                  className="rounded border-slate-700 text-amber-500 focus:ring-amber-500 bg-slate-900"
                />
                <span className="text-xs text-slate-300">Автоматически соединить стеной с базовой точкой</span>
              </label>
            </div>
          )}

          {/* Превью итоговых координат */}
          <div className="bg-slate-950/80 rounded-xl p-2.5 border border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400">Итоговые координаты:</span>
            <span className="font-mono font-bold text-amber-400">
              X: {finalX}, Y: {finalY}
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
              className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20 transition"
            >
              Создать точку
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
