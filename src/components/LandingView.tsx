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
    <div className="flex flex-1 items-center justify-center min-h-[calc(100vh-4.5rem)] px-5 sm:px-8">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 py-6 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
        {/* Левая часть */}
        <div className="rise">
          <h1 className="text-[clamp(2.6rem,6.5vw,4.4rem)] font-extrabold leading-[1.03] tracking-tight text-[#111113]">
            Карта
            <br />
            <span className="text-[#e30613]">пространства</span>
          </h1>

          <p className="mt-5 max-w-[27rem] text-[15px] sm:text-[16px] leading-relaxed text-[#6b6b70]">
            Сервис для навигации внутри зданий и на мероприятиях. Посетители находят стенды и строят маршруты по 2D-плану и 360°-панорамам.
          </p>

          <div className="mt-8 flex items-center">
            {user ? (
              <button
                type="button"
                onClick={onOpenCreate}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-[#e30613] px-6 text-xs sm:text-sm font-semibold text-white hover:bg-[#c40511] transition-all shadow-md shadow-[#e30613]/25"
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
                className="inline-flex h-11 items-center gap-2 rounded-full bg-[#111113] px-6 text-xs sm:text-sm font-semibold text-white hover:bg-[#27272a] transition-all shadow-md shadow-black/10"
              >
                <span>Посмотреть мероприятия и планы</span>
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Правая часть — превью карты */}
        <div className="rise-late relative">
          <MapPreview />
        </div>
      </div>
    </div>
  )
}
