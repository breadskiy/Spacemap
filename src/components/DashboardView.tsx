import { useState } from 'react'
import type { SpaceObject } from '../types/space'
import type { UserProfile } from '../types/auth'
import { deleteSpace } from '../utils/storage'

interface DashboardViewProps {
  user: UserProfile | null
  spaces: SpaceObject[]
  onOpenCreate: () => void
  onOpenEditor: (space: SpaceObject) => void
  onOpenViewer: (space: SpaceObject) => void
  onOpenQR: (space: SpaceObject) => void
  onRefresh: () => void
}

export function DashboardView({
  user,
  spaces,
  onOpenCreate,
  onOpenEditor,
  onOpenViewer,
  onOpenQR,
  onRefresh
}: DashboardViewProps) {
  // Вкладки для авторизованного организатора: 'my' | 'all'
  const [activeTab, setActiveTab] = useState<'my' | 'all'>('my')
  const [searchQuery, setSearchQuery] = useState('')

  const handleDelete = (id: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm(`Удалить объект «${title}»?`)) {
      deleteSpace(id)
      onRefresh()
    }
  }

  // Фильтрация по поиску
  const displaySpaces = spaces.filter(space => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      space.title.toLowerCase().includes(q) ||
      space.categoryLabel.toLowerCase().includes(q) ||
      (space.address && space.address.toLowerCase().includes(q))
    )
  })

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-8 py-6 sm:py-8">
      {/* Шапка кабинета / каталога */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#e9e9ec] pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#111113]">
            {user ? 'Личный кабинет' : 'Мероприятия и планы зданий'}
          </h1>
          <p className="mt-1 text-xs text-[#6b6b70]">
            {user
              ? 'Управление своими пространствами и просмотр каталога'
              : 'Каталог общедоступных планов навигации мероприятий и пространств'}
          </p>
        </div>

        {/* Кнопка создания: доступна только авторизованным организаторам */}
        {user && (
          <button
            onClick={onOpenCreate}
            className="inline-flex h-10 sm:h-9 items-center justify-center gap-1.5 rounded-full bg-[#e30613] px-5 sm:px-4 text-xs font-bold sm:font-semibold text-white hover:bg-[#c40511] transition-colors shadow-sm shrink-0"
          >
            <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Создать объект</span>
          </button>
        )}
      </div>

      {/* Переключатель вкладок («Мои пространства» / «Все мероприятия») для авторизованных пользователей */}
      {user && (
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1 rounded-full border border-[#e9e9ec] bg-[#fafafa] p-1 text-xs font-semibold w-fit">
            <button
              onClick={() => setActiveTab('my')}
              className={`px-4 py-1.5 rounded-full transition-all ${
                activeTab === 'my'
                  ? 'bg-white text-[#111113] shadow-xs font-bold'
                  : 'text-[#6b6b70] hover:text-[#111113]'
              }`}
            >
              Мои карты ({spaces.length})
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-1.5 rounded-full transition-all ${
                activeTab === 'all'
                  ? 'bg-white text-[#111113] shadow-xs font-bold'
                  : 'text-[#6b6b70] hover:text-[#111113]'
              }`}
            >
              Все мероприятия ({spaces.length})
            </button>
          </div>

          {/* Поиск */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Поиск по названию или адресу..."
              className="w-full rounded-full border border-[#e9e9ec] bg-[#fafafa] px-3.5 py-1.5 pl-8 text-xs text-[#111113] placeholder-[#9e9ea4] focus:bg-white focus:border-[#e30613] focus:outline-none transition"
            />
            <svg className="absolute left-2.5 top-2.5 size-3.5 text-[#9e9ea4]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      )}

      {/* Поиск для неавторизованных посетителей */}
      {!user && spaces.length > 0 && (
        <div className="mt-6 relative w-full sm:max-w-md">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Найти мероприятие или здание..."
            className="w-full rounded-full border border-[#e9e9ec] bg-[#fafafa] px-4 py-2 pl-9 text-xs text-[#111113] placeholder-[#9e9ea4] focus:bg-white focus:border-[#e30613] focus:outline-none transition shadow-xs"
          />
          <svg className="absolute left-3 top-2.5 size-4 text-[#9e9ea4]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      )}

      {/* Если список пуст */}
      {spaces.length === 0 ? (
        <div className="mt-14 flex flex-col items-center justify-center rounded-3xl border border-dashed border-[#e9e9ec] bg-[#fafafa] p-12 text-center max-w-xl mx-auto">
          <div className="size-12 rounded-2xl bg-white border border-[#e9e9ec] text-[#6b6b70] flex items-center justify-center mb-3">
            <svg className="size-6 text-[#6b6b70]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-[#111113]">Список объектов пуст</h3>
          <p className="mt-1 text-xs text-[#6b6b70]">
            {user 
              ? 'Создайте первое здание или мероприятие, чтобы перейти к рисованию плана.' 
              : 'Организаторы пока не опубликовали планы помещений.'}
          </p>
          {user && (
            <button
              onClick={onOpenCreate}
              className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-full bg-[#e30613] px-4 text-xs font-semibold text-white hover:bg-[#c40511] transition-colors"
            >
              <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Создать объект</span>
            </button>
          )}
        </div>
      ) : displaySpaces.length === 0 ? (
        <div className="mt-12 text-center py-8 text-xs text-[#6b6b70]">
          По запросу «{searchQuery}» ничего не найдено.
        </div>
      ) : (
        /* Список карточек объектов */
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displaySpaces.map(space => {
            const isPublished = space.status === 'published'
            const isMyMode = user && activeTab === 'my'

            return (
              <div
                key={space.id}
                onClick={() => {
                  // Для гостей или в режиме "Все мероприятия" клик открывает просмотр!
                  if (!isMyMode) {
                    onOpenViewer(space)
                  } else {
                    onOpenEditor(space)
                  }
                }}
                className="group flex flex-col justify-between rounded-2xl border border-[#e9e9ec] bg-white p-5 transition-all hover:border-[#e30613]/50 cursor-pointer shadow-xs hover:shadow-md"
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
                  <span className="text-[11px] font-semibold text-[#6b6b70]">
                    {space.floorsCount} этаж
                  </span>

                  <div className="flex items-center gap-1.5">
                    {/* Кнопка "Смотреть" */}
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation()
                        onOpenViewer(space)
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-[#111113] bg-[#fafafa] hover:bg-[#e30613] hover:text-white border border-[#e9e9ec] transition"
                      title="Открыть светлую карту для просмотра"
                    >
                      <span>Смотреть</span>
                    </button>

                    {/* Дополнительные действия для владельца в режиме "Мои карты" */}
                    {isMyMode && (
                      <>
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation()
                            onOpenEditor(space)
                          }}
                          className="p-1.5 rounded-lg text-[#6b6b70] hover:text-[#e30613] hover:bg-[#fafafa] transition"
                          title="Редактировать стены и метки в конструкторе"
                        >
                          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>

                        {isPublished && (
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation()
                              onOpenQR(space)
                            }}
                            title="Ссылка и QR-код для посетителей"
                            className="p-1.5 rounded-lg text-[#6b6b70] hover:text-[#e30613] hover:bg-[#fafafa] transition"
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
                          className="p-1.5 rounded-lg text-[#6b6b70] hover:text-red-600 hover:bg-red-50 transition"
                        >
                          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </>
                    )}
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
