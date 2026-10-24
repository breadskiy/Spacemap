import { useState } from 'react'
import type { SpaceCategory, SpaceObject } from '../types/space'
import { createSpace } from '../utils/storage'

interface CreateSpaceModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: (newSpace: SpaceObject) => void
  userId?: string
}

export function CreateSpaceModal({ isOpen, onClose, onCreated, userId }: CreateSpaceModalProps) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<SpaceCategory>('conference')
  const [address, setAddress] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('Пожалуйста, укажите название мероприятия или здания')
      return
    }

    const created = createSpace({
      title,
      category,
      address,
      description,
      userId
    })

    // Сброс и возврат
    setTitle('')
    setAddress('')
    setDescription('')
    setError('')
    onCreated(created)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-[#e9e9ec] text-[#111113]"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-5 top-5 p-2 rounded-full text-[#6b6b70] hover:text-[#111113] hover:bg-[#fafafa] transition-colors"
          aria-label="Закрыть"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#e30613]/10 text-[#e30613] flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#e30613]">
              Новый объект
            </span>
            <h3 className="text-xl font-bold leading-tight text-[#111113]">
              Создание пространства
            </h3>
          </div>
        </div>

        <p className="mt-2 text-xs text-[#6b6b70]">
          Укажите основные сведения об объекте. После создания сразу откроется 2D-редактор стен и этажей.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {error && (
            <div className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-[#e30613] border border-red-200">
              {error}
            </div>
          )}

          {/* Название */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#111113]">
              Название мероприятия или здания <span className="text-[#e30613]">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Например: Форум «Транспорт Будущего 2026»"
              value={title}
              onChange={e => {
                setTitle(e.target.value)
                if (error) setError('')
              }}
              className="w-full rounded-xl border border-[#e9e9ec] bg-[#fafafa] px-3.5 py-2.5 text-xs text-[#111113] focus:border-[#e30613] focus:bg-white focus:outline-none transition-colors"
            />
          </div>

          {/* Категория */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#111113]">
              Тип объекта
            </label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as SpaceCategory)}
              className="w-full rounded-xl border border-[#e9e9ec] bg-[#fafafa] px-3.5 py-2.5 text-xs text-[#111113] focus:border-[#e30613] focus:bg-white focus:outline-none transition-colors"
            >
              <option value="conference">Конференция / Форум</option>
              <option value="exhibition">Выставка / Экспоцентр</option>
              <option value="office">Бизнес-центр / Офис</option>
              <option value="mall">Торговый комплекс</option>
              <option value="other">Другое пространство</option>
            </select>
          </div>

          {/* Адрес */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#111113]">
              Адрес / Локация
            </label>
            <input
              type="text"
              placeholder="г. Москва, ул. Примерная, д. 10"
              value={address}
              onChange={e => setAddress(e.target.value)}
              className="w-full rounded-xl border border-[#e9e9ec] bg-[#fafafa] px-3.5 py-2.5 text-xs text-[#111113] focus:border-[#e30613] focus:bg-white focus:outline-none transition-colors"
            />
          </div>

          {/* Описание */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#111113]">
              Краткое описание
            </label>
            <textarea
              rows={2}
              placeholder="План экспозиции, навигация по стендам и зонам отдыха..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full rounded-xl border border-[#e9e9ec] bg-[#fafafa] px-3.5 py-2.5 text-xs text-[#111113] focus:border-[#e30613] focus:bg-white focus:outline-none transition-colors resize-none"
            />
          </div>

          {/* Кнопки */}
          <div className="mt-6 flex justify-end gap-2.5 pt-4 border-t border-[#e9e9ec]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-[#e9e9ec] text-xs font-semibold text-[#6b6b70] hover:text-[#111113] hover:bg-[#fafafa] transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[#e30613] hover:bg-[#c40511] text-xs font-semibold text-white shadow-sm transition-colors flex items-center gap-1.5"
            >
              <span>Создать и открыть редактор</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
