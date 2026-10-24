import { useState, useRef, useEffect } from 'react'
import type { UserProfile } from '../types/auth'

interface NavbarProps {
  currentTab: 'landing' | 'dashboard' | 'editor'
  onNavigate: (tab: 'landing' | 'dashboard') => void
  user: UserProfile | null
  onOpenAuth: (tab: 'login' | 'register') => void
  onOpenSettings: () => void
  onLogout: () => void
}

export function Navbar({
  currentTab,
  onNavigate,
  user,
  onOpenAuth,
  onOpenSettings,
  onLogout
}: NavbarProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Закрытие выпадающего меню при клике снаружи
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#e9e9ec] bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-8">
        {/* Логотип слева */}
        <div 
          onClick={() => onNavigate('landing')}
          className="flex items-center gap-2 cursor-pointer select-none"
        >
          <span className="grid size-8 place-items-center rounded-xl bg-[#e30613] text-white font-extrabold text-xs shadow-sm shadow-[#e30613]/25">
            ТТК
          </span>
          <span className="text-[17px] font-extrabold tracking-tight text-[#111113]">
            Space<span className="text-[#e30613]">Map</span>
          </span>
        </div>

        {/* Две аккуратные вкладки строго по центру */}
        <nav className="flex items-center gap-1 rounded-full border border-[#e9e9ec] bg-[#fafafa] p-1 text-xs font-semibold">
          <button
            onClick={() => onNavigate('landing')}
            className={`px-4 py-1.5 rounded-full transition-all ${
              currentTab === 'landing' 
                ? 'bg-white text-[#111113] shadow-sm font-bold' 
                : 'text-[#6b6b70] hover:text-[#111113]'
            }`}
          >
            Главная
          </button>
          <button
            onClick={() => onNavigate('dashboard')}
            className={`px-4 py-1.5 rounded-full transition-all ${
              currentTab === 'dashboard' 
                ? 'bg-white text-[#111113] shadow-sm font-bold' 
                : 'text-[#6b6b70] hover:text-[#111113]'
            }`}
          >
            Личный кабинет
          </button>
        </nav>

        {/* Правый блок: Кнопки Входа/Регистрации или Иконка Профиля */}
        <div className="flex items-center justify-end">
          {!user ? (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => onOpenAuth('login')}
                className="px-3 py-1.5 text-xs sm:text-sm font-semibold text-[#111113] hover:text-[#e30613] rounded-full transition-colors"
              >
                Войти
              </button>
              <button
                type="button"
                onClick={() => onOpenAuth('register')}
                className="px-3.5 sm:px-4 py-1.5 text-xs sm:text-sm font-semibold text-white bg-[#e30613] hover:bg-[#c40511] rounded-full transition-all shadow-sm shadow-[#e30613]/20"
              >
                Зарегистрироваться
              </button>
            </div>
          ) : (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 p-1.5 pr-2.5 rounded-full border border-[#e9e9ec] bg-[#fafafa] hover:bg-white hover:border-[#dcdce0] transition"
                title="Профиль и настройки"
              >
                {/* Аватарка */}
                <div className="size-7 rounded-full bg-[#e30613] text-white text-xs font-bold flex items-center justify-center">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-semibold text-[#111113] max-w-[100px] truncate hidden sm:inline">
                  {user.name}
                </span>
                {/* Иконка шестеренки/настроек */}
                <svg className="size-3.5 text-[#6b6b70]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>

              {/* Выпадающее меню профиля */}
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-[#e9e9ec] bg-white p-2 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-2 border-b border-[#f0f0f2]">
                    <div className="text-xs font-bold text-[#111113] truncate">
                      {user.name}
                    </div>
                    <div className="text-[11px] text-[#6b6b70] truncate">
                      {user.email}
                    </div>
                    {user.organization && (
                      <div className="mt-1 inline-block rounded-md bg-[#fafafa] border border-[#e9e9ec] px-1.5 py-0.5 text-[9px] font-semibold text-[#e30613]">
                        {user.organization}
                      </div>
                    )}
                  </div>

                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsDropdownOpen(false)
                        onOpenSettings()
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-[#111113] hover:bg-[#fafafa] hover:text-[#e30613] transition text-left"
                    >
                      <svg className="size-4 text-[#6b6b70]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>Настройки профиля</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsDropdownOpen(false)
                        onLogout()
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-red-600 hover:bg-red-50 transition text-left"
                    >
                      <svg className="size-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      <span>Выйти из аккаунта</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
