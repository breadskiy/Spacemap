import { useEffect, useState } from 'react'
import { MapPreview } from './MapPreview'

export function HeroScreen() {
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    if (!note) return
    const timer = window.setTimeout(() => setNote(null), 2600)
    return () => window.clearTimeout(timer)
  }, [note])

  return (
    <div className="flex min-h-svh flex-col bg-white">
      <header className="w-full">
        <div className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-[9px] bg-brand">
              <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden="true">
                <path
                  d="M12 3.6a4.9 4.9 0 0 1 4.9 4.9c0 3.4-3.9 8.4-4.7 9.2a.3.3 0 0 1-.4 0c-.8-.8-4.7-5.8-4.7-9.2A4.9 4.9 0 0 1 12 3.6Z"
                  fill="#fff"
                />
                <circle cx="12" cy="8.5" r="1.9" fill="#e30613" />
              </svg>
            </span>
            <span className="text-[17px] font-extrabold tracking-[-0.02em] text-ink">
              Space<span className="text-brand">Map</span>
            </span>
          </div>

          <button
            type="button"
            onClick={() => setNote('Кабинет организатора будет на следующем шаге')}
            className="inline-flex h-10 items-center rounded-full bg-brand px-4 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:px-5 sm:text-[14px]"
          >
            Организовать<span className="hidden sm:inline">&nbsp;мероприятие</span>
          </button>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-5 pb-14 pt-4 sm:px-8 lg:grid-cols-[1.02fr_1fr] lg:gap-16 lg:pb-20 lg:pt-0">
        <div className="rise">
          <p className="flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.16em] text-muted">
            <span className="size-1.5 rounded-full bg-brand" />
            Навигация внутри зданий
          </p>

          <h1 className="mt-5 text-[clamp(2.6rem,7.2vw,4.6rem)] font-extrabold leading-[1.03] tracking-[-0.035em] text-ink">
            Карта
            <br />
            пространства
          </h1>

          <p className="mt-6 max-w-[26rem] text-[16.5px] leading-[1.6] text-muted">
            Найдите нужное место и постройте маршрут по 2D-плану и
            360°-панорамам. Без установки и регистрации.
          </p>

          <button
            type="button"
            onClick={() => setNote('Демо-карта будет на следующем шаге')}
            className="group mt-8 inline-flex h-12 items-center gap-2.5 rounded-full bg-brand px-6 text-[15px] font-semibold text-white shadow-[0_14px_30px_-14px_rgba(227,6,19,0.85)] transition-colors hover:bg-brand-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Открыть карту
            <svg
              viewBox="0 0 20 20"
              className="size-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            >
              <path
                d="M4 10h11m0 0-4-4m4 4-4 4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <div className="rise-late">
          <MapPreview />
        </div>
      </main>

      {note && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-4 py-2 text-[13px] text-white shadow-lg"
        >
          {note}
        </div>
      )}
    </div>
  )
}
