interface NavbarProps {
  currentTab: 'landing' | 'dashboard' | 'editor'
  onNavigate: (tab: 'landing' | 'dashboard') => void
}

export function Navbar({ currentTab, onNavigate }: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#e9e9ec] bg-white">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
        {/* Логотип слева */}
        <div 
          onClick={() => onNavigate('landing')}
          className="flex items-center gap-2 cursor-pointer select-none w-32"
        >
          <span className="grid size-8 place-items-center rounded-xl bg-[#e30613] text-white font-extrabold text-xs">
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

        {/* Пустой распорочный блок справа для идеального центрирования вкладок */}
        <div className="w-32 hidden sm:block" />
      </div>
    </header>
  )
}
