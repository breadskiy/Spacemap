import { useState } from 'react'
import type { SpaceObject } from '../types/space'
import { publishSpaceAsync } from '../utils/storage'
import { QRCodeModal } from './QRCodeModal'
import { FloorEditor } from './editor/FloorEditor'

interface EditorViewProps {
  space: SpaceObject
  onBack: () => void
  onUpdateSpace: (updated: SpaceObject) => void
}

export function EditorView({ space, onBack, onUpdateSpace }: EditorViewProps) {
  const [isQrOpen, setIsQrOpen] = useState(false)
  const [currentSpace, setCurrentSpace] = useState<SpaceObject>(space)

  const handleUpdate = (updated: SpaceObject) => {
    setCurrentSpace(updated)
    onUpdateSpace(updated)
  }

  const handlePublish = async () => {
    const updated = await publishSpaceAsync(currentSpace.id)
    if (updated) {
      setCurrentSpace(updated)
      onUpdateSpace(updated)
      setIsQrOpen(true)
    }
  }

  const isPublished = currentSpace.status === 'published'

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#111113]">
      {/* Верхняя панель управления объектом */}
      <header className="h-14 shrink-0 bg-white border-b border-[#e9e9ec] px-3 sm:px-4 flex items-center justify-between z-30 shadow-sm select-none">
        <div className="flex items-center gap-2 sm:gap-3 overflow-hidden">
          {/* Кнопка назад */}
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold text-[#111113] hover:bg-[#fafafa] border border-[#e9e9ec] transition-colors shrink-0"
            title="Вернуться в личный кабинет"
          >
            <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="hidden sm:inline">В кабинет</span>
          </button>

          <div className="h-4 w-px bg-[#e9e9ec] shrink-0" />

          {/* Информация об объекте */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <h2 className="text-xs sm:text-sm font-bold text-[#111113] truncate max-w-[120px] sm:max-w-xs md:max-w-md">
              {currentSpace.title}
            </h2>
            <span className="hidden md:inline-block rounded-md bg-[#fafafa] border border-[#e9e9ec] px-2 py-0.5 text-[10px] font-semibold text-[#6b6b70] shrink-0">
              {currentSpace.categoryLabel}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0 ${
                isPublished
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              <span className={`size-1.5 rounded-full ${isPublished ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span className="hidden xs:inline">{isPublished ? 'Опубликовано' : 'Черновик'}</span>
            </span>
          </div>
        </div>

        {/* Правая панель действий */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {isPublished && (
            <button
              onClick={() => setIsQrOpen(true)}
              className="inline-flex items-center gap-1.5 p-1.5 sm:px-3 sm:py-1.5 rounded-xl border border-[#e9e9ec] text-xs font-semibold text-[#111113] hover:bg-[#fafafa] transition-colors"
              title="Посмотреть QR-код и ссылку"
            >
              <svg className="size-4 sm:size-3.5 text-[#e30613]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              <span className="hidden sm:inline">QR и ссылка</span>
            </button>
          )}

          {/* Главная кнопка "Опубликовать" / "Обновить публикацию" */}
          <button
            onClick={handlePublish}
            className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-xl bg-[#e30613] hover:bg-[#c40511] text-xs font-bold text-white shadow-sm transition-all"
          >
            {isPublished && (
              <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            <span className="hidden sm:inline">{isPublished ? 'Обновить публикацию' : 'Опубликовать'}</span>
            <span className="sm:hidden">{isPublished ? 'Обновить' : 'Опубликовать'}</span>
          </button>
        </div>
      </header>

      {/* Нативный React-редактор планов этажей (без iframe) */}
      <main className="flex-1 w-full relative overflow-hidden bg-slate-900">
        <FloorEditor
          space={currentSpace}
          onBack={onBack}
          onUpdateSpace={handleUpdate}
        />
      </main>

      {/* Модальное окно публикации с QR-кодом */}
      <QRCodeModal
        isOpen={isQrOpen}
        onClose={() => setIsQrOpen(false)}
        title={currentSpace.title}
        url={currentSpace.publicUrl || `https://spacemap.ttk.ru/v/${currentSpace.id}`}
      />
    </div>
  )
}
