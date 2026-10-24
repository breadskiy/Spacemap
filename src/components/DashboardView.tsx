import type { SpaceObject } from '../types/space'
import { deleteSpace } from '../utils/storage'

interface DashboardViewProps {
  spaces: SpaceObject[]
  onOpenCreate: () => void
  onOpenEditor: (space: SpaceObject) => void
  onOpenQR: (space: SpaceObject) => void
  onRefresh: () => void
}

export function DashboardView({
  spaces,
  onOpenCreate,
  onOpenEditor,
  onOpenQR,
  onRefresh
}: DashboardViewProps) {
  const handleDelete = (id: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm(`Удалить объект «${title}»?`)) {
      deleteSpace(id)
      onRefresh()
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
      {/* Шапка кабинета — чистый каркас */}
      <div className="flex items-center justify-between border-b border-[#e9e9ec] pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#111113]">
            Личный кабинет
          </h1>
          <p className="mt-1 text-xs text-[#6b6b70]">
            Список мероприятий и зданий
          </p>
        </div>

        {/* Средняя кнопка: отображается ТОЛЬКО если список не пуст */}
        {spaces.length > 0 && (
          <button
            onClick={onOpenCreate}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#e30613] px-4 text-xs font-semibold text-white hover:bg-[#c40511] transition-colors"
          >
            <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Создать объект</span>
          </button>
        )}
      </div>

      {/* Если список пуст — сухой чистый скелет */}
      {spaces.length === 0 ? (
        <div className="mt-14 flex flex-col items-center justify-center rounded-3xl border border-dashed border-[#e9e9ec] bg-[#fafafa] p-12 text-center max-w-xl mx-auto">
          <div className="size-12 rounded-2xl bg-white border border-[#e9e9ec] text-[#6b6b70] flex items-center justify-center mb-3">
            <svg className="size-6 text-[#6b6b70]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-[#111113]">Список объектов пуст</h3>
          <p className="mt-1 text-xs text-[#6b6b70]">
            Создайте первое здание или мероприятие, чтобы перейти к рисованию плана.
          </p>
          <button
            onClick={onOpenCreate}
            className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-full bg-[#e30613] px-4 text-xs font-semibold text-white hover:bg-[#c40511] transition-colors"
          >
            <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Создать объект</span>
          </button>
        </div>
      ) : (
        /* Список созданных пользователем объектов */
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {spaces.map(space => {
            const isPublished = space.status === 'published'

            return (
              <div
                key={space.id}
                onClick={() => onOpenEditor(space)}
                className="group flex flex-col justify-between rounded-2xl border border-[#e9e9ec] bg-white p-5 transition-all hover:border-[#e30613]/50 cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-md bg-[#fafafa] border border-[#e9e9ec] px-2 py-0.5 text-[10px] font-semibold text-[#6b6b70]">
                      {space.categoryLabel}
                    </span>

                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        isPublished
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      <span className={`size-1.5 rounded-full ${isPublished ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      {isPublished ? 'Опубликовано' : 'Черновик'}
                    </span>
                  </div>

                  <h3 className="mt-3 text-sm font-bold text-[#111113] group-hover:text-[#e30613] transition-colors line-clamp-1">
                    {space.title}
                  </h3>

                  {space.address && space.address !== 'Адрес не указан' && (
                    <p className="mt-1 text-xs text-[#6b6b70] line-clamp-1">
                      {space.address}
                    </p>
                  )}
                </div>

                <div className="mt-5 pt-3 border-t border-[#e9e9ec] flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#111113]">
                    {space.floorsCount} этаж
                  </span>

                  <div className="flex items-center gap-1">
                    {isPublished && (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation()
                          onOpenQR(space)
                        }}
                        title="Ссылка и QR-код"
                        className="p-1.5 rounded-lg text-[#6b6b70] hover:text-[#e30613] transition-colors"
                      >
                        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                        </svg>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={e => handleDelete(space.id, space.title, e)}
                      title="Удалить"
                      className="p-1.5 rounded-lg text-[#6b6b70] hover:text-red-600 transition-colors"
                    >
                      <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
