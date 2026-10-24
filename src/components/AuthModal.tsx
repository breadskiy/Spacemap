import { useState, useEffect } from 'react'
import type { UserProfile } from '../types/auth'

interface AuthModalProps {
  isOpen: boolean
  initialTab?: 'login' | 'register'
  onClose: () => void
  onSuccess: (user: UserProfile) => void
}

export function AuthModal({
  isOpen,
  initialTab = 'login',
  onClose,
  onSuccess
}: AuthModalProps) {
  const [tab, setTab] = useState<'login' | 'register'>(initialTab)

  // Поля формы
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [organization, setOrganization] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setTab(initialTab)
      setError('')
    }
  }, [isOpen, initialTab])

  // Закрытие по клавише Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const cleanEmail = email.trim()
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Пожалуйста, введите корректный email')
      return
    }

    if (password.length < 4) {
      setError('Пароль должен содержать минимум 4 символа')
      return
    }

    if (tab === 'register' && !name.trim()) {
      setError('Пожалуйста, укажите ваше имя или название организации')
      return
    }

    // Создаем объект пользователя
    const user: UserProfile = {
      id: `usr-${Date.now()}`,
      name: tab === 'register' ? name.trim() : (cleanEmail.split('@')[0] || 'Организатор'),
      email: cleanEmail,
      organization: organization.trim() || 'ТрансТелеКом / ТТК',
      role: 'Организатор пространства'
    }

    onSuccess(user)
    onClose()
  }

  // Быстрый демо-вход для презентации/хакатона
  const handleQuickDemo = () => {
    const demoUser: UserProfile = {
      id: 'usr-ttk-demo',
      name: 'Алексей Смирнов',
      email: 'organizer@ttk-events.ru',
      organization: 'АО «Компания ТрансТелеКом»',
      role: 'Главный координатор мероприятий'
    }
    onSuccess(demoUser)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Клик снаружи для закрытия */}
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-md rounded-3xl border border-[#e9e9ec] bg-white p-6 sm:p-8 shadow-2xl z-10 animate-in zoom-in-95 duration-200">
        {/* Кнопка закрытия */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 size-8 rounded-full bg-[#f4f4f6] text-[#6b6b70] hover:text-[#111113] hover:bg-[#e9e9ec] flex items-center justify-center transition"
          title="Закрыть"
        >
          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Заголовок */}
        <div className="flex items-center gap-2 mb-6">
          <span className="grid size-7 place-items-center rounded-lg bg-[#e30613] text-white font-extrabold text-[11px]">
            ТТК
          </span>
          <span className="text-base font-extrabold tracking-tight text-[#111113]">
            Space<span className="text-[#e30613]">Map</span> ID
          </span>
        </div>

        {/* Переключатель вкладок: Вход / Регистрация */}
        <div className="flex rounded-full bg-[#f4f4f6] p-1 text-xs font-semibold mb-6">
          <button
            type="button"
            onClick={() => {
              setTab('login')
              setError('')
            }}
            className={`flex-1 py-2 rounded-full transition-all ${
              tab === 'login'
                ? 'bg-white text-[#111113] shadow-sm font-bold'
                : 'text-[#6b6b70] hover:text-[#111113]'
            }`}
          >
            Вход
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('register')
              setError('')
            }}
            className={`flex-1 py-2 rounded-full transition-all ${
              tab === 'register'
                ? 'bg-white text-[#111113] shadow-sm font-bold'
                : 'text-[#6b6b70] hover:text-[#111113]'
            }`}
          >
            Регистрация
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-600 font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-[#111113] mb-1.5">
                Ваше имя или организация
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Иван Иванов или Event Agency"
                className="w-full rounded-xl border border-[#e9e9ec] bg-[#fafafa] px-3.5 py-2.5 text-xs text-[#111113] placeholder-[#9e9ea4] focus:bg-white focus:border-[#e30613] focus:outline-none transition"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#111113] mb-1.5">
              Электронная почта (Email)
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="example@ttk.ru"
              className="w-full rounded-xl border border-[#e9e9ec] bg-[#fafafa] px-3.5 py-2.5 text-xs text-[#111113] placeholder-[#9e9ea4] focus:bg-white focus:border-[#e30613] focus:outline-none transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#111113] mb-1.5">
              Пароль
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-[#e9e9ec] bg-[#fafafa] px-3.5 py-2.5 text-xs text-[#111113] placeholder-[#9e9ea4] focus:bg-white focus:border-[#e30613] focus:outline-none transition"
            />
          </div>

          {tab === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-[#111113] mb-1.5">
                Компания / Проект (необязательно)
              </label>
              <input
                type="text"
                value={organization}
                onChange={e => setOrganization(e.target.value)}
                placeholder="ТрансТелеКом / Экспоцентр"
                className="w-full rounded-xl border border-[#e9e9ec] bg-[#fafafa] px-3.5 py-2.5 text-xs text-[#111113] placeholder-[#9e9ea4] focus:bg-white focus:border-[#e30613] focus:outline-none transition"
              />
            </div>
          )}

          <button
            type="submit"
            className="w-full mt-2 h-10 rounded-full bg-[#e30613] text-xs font-bold text-white hover:bg-[#c40511] transition shadow-md shadow-[#e30613]/20"
          >
            {tab === 'login' ? 'Войти в личный кабинет' : 'Зарегистрироваться'}
          </button>
        </form>

        {/* Быстрый демо-вход для жюри/проверки */}
        <div className="mt-6 pt-5 border-t border-[#f0f0f2] text-center">
          <p className="text-[11px] text-[#8e8e93] mb-2.5">
            Для быстрой демонстрации работы:
          </p>
          <button
            type="button"
            onClick={handleQuickDemo}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#e9e9ec] bg-[#fafafa] px-4 py-1.5 text-xs font-semibold text-[#111113] hover:border-[#e30613] hover:text-[#e30613] transition"
          >
            <span>Вход в 1 клик (Организатор ТТК)</span>
            <svg className="size-3.5 text-[#e30613]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
