import { useState, useEffect } from 'react'
import type { UserProfile } from '../types/auth'

interface ProfileSettingsModalProps {
  isOpen: boolean
  user: UserProfile | null
  onClose: () => void
  onUpdate: (updated: UserProfile) => void
  onLogout: () => void
}

export function ProfileSettingsModal({
  isOpen,
  user,
  onClose,
  onUpdate,
  onLogout
}: ProfileSettingsModalProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [organization, setOrganization] = useState('')
  const [savedSuccess, setSavedSuccess] = useState(false)

  useEffect(() => {
    if (user && isOpen) {
      setName(user.name)
      setEmail(user.email)
      setOrganization(user.organization || '')
      setSavedSuccess(false)
    }
  }, [user, isOpen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !user) return null

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    const updated: UserProfile = {
      ...user,
      name: name.trim() || user.name,
      organization: organization.trim() || 'ТрансТелеКом'
    }
    onUpdate(updated)
    setSavedSuccess(true)
    setTimeout(() => {
      setSavedSuccess(false)
      onClose()
    }, 900)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-md rounded-3xl border border-[#e9e9ec] bg-white p-6 sm:p-8 shadow-2xl z-10 animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 size-8 rounded-full bg-[#f4f4f6] text-[#6b6b70] hover:text-[#111113] hover:bg-[#e9e9ec] flex items-center justify-center transition"
          title="Закрыть"
        >
          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="size-12 rounded-2xl bg-[#e30613] text-white font-extrabold text-lg flex items-center justify-center shadow-md shadow-[#e30613]/25">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="text-base font-extrabold text-[#111113]">
              Настройки профиля
            </h3>
            <p className="text-xs text-[#6b6b70]">
              {user.role || 'Организатор пространства'}
            </p>
          </div>
        </div>

        {savedSuccess && (
          <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-700 font-semibold flex items-center gap-2">
            <svg className="size-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Изменения успешно сохранены!</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#111113] mb-1.5">
              Имя профиля
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full rounded-xl border border-[#e9e9ec] bg-[#fafafa] px-3.5 py-2.5 text-xs text-[#111113] focus:bg-white focus:border-[#e30613] focus:outline-none transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#111113] mb-1.5">
              Email аккаунта (не редактируется)
            </label>
            <input
              type="email"
              disabled
              value={email}
              className="w-full rounded-xl border border-[#e9e9ec] bg-[#f0f0f2] px-3.5 py-2.5 text-xs text-[#6b6b70] cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#111113] mb-1.5">
              Организация / Компания
            </label>
            <input
              type="text"
              value={organization}
              onChange={e => setOrganization(e.target.value)}
              className="w-full rounded-xl border border-[#e9e9ec] bg-[#fafafa] px-3.5 py-2.5 text-xs text-[#111113] focus:bg-white focus:border-[#e30613] focus:outline-none transition"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="submit"
              className="flex-1 h-10 rounded-full bg-[#e30613] text-xs font-bold text-white hover:bg-[#c40511] transition shadow-md shadow-[#e30613]/20"
            >
              Сохранить
            </button>
            <button
              type="button"
              onClick={() => {
                onClose()
                onLogout()
              }}
              className="h-10 px-4 rounded-full border border-red-200 text-xs font-bold text-red-600 hover:bg-red-50 transition"
              title="Выйти из учетной записи"
            >
              Выйти
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
