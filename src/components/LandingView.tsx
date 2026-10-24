import type { UserProfile } from '../types/auth'
import { MapPreview } from './MapPreview'

interface LandingViewProps {
  user: UserProfile | null
  onOpenCreate: () => void
  onNavigateToDashboard: () => void
}

export function LandingView({
  user,
  onOpenCreate,
  onNavigateToDashboard
}: LandingViewProps) {
  return (
    <div className="flex flex-1 items-center justify-center min-h-[calc(100vh-4rem)] px-4 sm:px-8 py-8 sm:py-12">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
        {/* Левая часть (Текст и действия) */}
        <div className="rise text-center lg:text-left flex flex-col items-center lg:items-start">
          <div className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11px] font-bold text-[#e30613] mb-4">
            <span className="size-1.5 rounded-full bg-[#e30613] animate-pulse" />
            Индор-навигация нового поколения
          </div>

          <h1 className="text-[clamp(2.2rem,7.5vw,4.4rem)] font-extrabold leading-[1.06] tracking-tight text-[#111113]">
            Карта
            <br className="hidden sm:inline" />{' '}
            <span className="text-[#e30613]">пространства</span>
          </h1>

          <p className="mt-4 max-w-[27rem] text-sm sm:text-base leading-relaxed text-[#6b6b70]">
            Сервис для навигации внутри зданий и на мероприятиях. Посетители находят стенды и строят маршруты по 2D-плану и 360°-панорамам.
          </p>

          <div className="mt-6 sm:mt-8 w-full sm:w-auto">
            {user ? (
              <button
                type="button"
                onClick={onOpenCreate}
                className="w-full sm:w-auto inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#e30613] px-7 text-sm font-bold text-white hover:bg-[#c40511] transition-all shadow-md shadow-[#e30613]/25 active:scale-[0.98]"
              >
                <span>Создать карту пространства</span>
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            ) : (
              <button
                type="button"
                onClick={onNavigateToDashboard}
                className="w-full sm:w-auto inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#111113] px-7 text-sm font-bold text-white hover:bg-[#27272a] transition-all shadow-md shadow-black/10 active:scale-[0.98]"
              >
                <span>Посмотреть мероприятия и планы</span>
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Правая часть — превью интерактивной карты */}
        <div className="rise-late relative w-full max-w-md lg:max-w-none mx-auto">
          <MapPreview />
        </div>
      </div>
    </div>
  )
}
