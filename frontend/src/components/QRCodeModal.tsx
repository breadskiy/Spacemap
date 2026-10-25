import { useState } from 'react'

interface QRCodeModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  url: string
}

export function QRCodeModal({ isOpen, onClose, title, url }: QRCodeModalProps) {
  const [copied, setCopied] = useState(false)
  const [qrImgError, setQrImgError] = useState(false)

  if (!isOpen) return null

  const handleCopy = () => {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-[#e9e9ec] text-[#111113]"
        onClick={e => e.stopPropagation()}
      >
        {/* Кнопка закрытия */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 p-2 rounded-full text-[#6b6b70] hover:text-[#111113] hover:bg-[#fafafa] transition-colors"
          aria-label="Закрыть"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Заголовок */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#e30613]/10 text-[#e30613] flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#e30613]">
              Карта опубликована
            </span>
            <h3 className="text-lg font-bold leading-tight text-[#111113]">
              {title}
            </h3>
          </div>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-[#6b6b70]">
          Посетители могут открыть интерактивный 2D-план и панорамы прямо в браузере телефона без установки приложений.
        </p>

        {/* Блок QR-кода */}
        <div className="my-6 flex flex-col items-center justify-center rounded-2xl border border-[#e9e9ec] bg-[#fafafa] p-6 text-center">
          <div className="relative p-3 bg-white rounded-2xl shadow-sm border border-[#e9e9ec]">
            {/* Настоящий сканируемый QR-код из бэкенда */}
            {!qrImgError ? (
              <img
                src={`/api/qr?url=${encodeURIComponent(url)}`}
                alt="QR Code"
                className="w-44 h-44 object-contain"
                onError={() => {
                  // Fallback на эндпоинт по ID или декоративный
                  setQrImgError(true)
                }}
              />
            ) : (
            <svg
              className="w-44 h-44"
              viewBox="0 0 160 160"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Фоновые элементы */}
              <rect width="160" height="160" fill="white" />
              
              {/* Угловые маркеры (Top-Left) */}
              <rect x="10" y="10" width="40" height="40" rx="6" stroke="#111113" strokeWidth="6" />
              <rect x="22" y="22" width="16" height="16" rx="3" fill="#e30613" />

              {/* Угловые маркеры (Top-Right) */}
              <rect x="110" y="10" width="40" height="40" rx="6" stroke="#111113" strokeWidth="6" />
              <rect x="122" y="22" width="16" height="16" rx="3" fill="#e30613" />

              {/* Угловые маркеры (Bottom-Left) */}
              <rect x="10" y="110" width="40" height="40" rx="6" stroke="#111113" strokeWidth="6" />
              <rect x="22" y="122" width="16" height="16" rx="3" fill="#e30613" />

              {/* Сетка данных (декоративный четкий паттерн QR) */}
              <g fill="#111113">
                <rect x="58" y="12" width="8" height="8" rx="2" />
                <rect x="74" y="12" width="12" height="8" rx="2" />
                <rect x="94" y="12" width="8" height="8" rx="2" />
                
                <rect x="58" y="28" width="16" height="8" rx="2" />
                <rect x="82" y="28" width="8" height="8" rx="2" />
                
                <rect x="58" y="44" width="8" height="16" rx="2" />
                <rect x="74" y="44" width="16" height="8" rx="2" />
                <rect x="98" y="44" width="8" height="8" rx="2" />

                {/* Центральная зона */}
                <rect x="12" y="58" width="8" height="16" rx="2" />
                <rect x="28" y="58" width="16" height="8" rx="2" />
                <rect x="52" y="58" width="8" height="8" rx="2" />
                <rect x="68" y="58" width="24" height="8" rx="2" />
                <rect x="100" y="58" width="16" height="8" rx="2" />
                <rect x="124" y="58" width="8" height="16" rx="2" />
                <rect x="140" y="58" width="8" height="8" rx="2" />

                <rect x="20" y="82" width="16" height="8" rx="2" />
                <rect x="44" y="74" width="8" height="16" rx="2" />
                <rect x="60" y="74" width="16" height="8" rx="2" />
                <rect x="84" y="82" width="16" height="8" rx="2" />
                <rect x="108" y="74" width="8" height="16" rx="2" />
                <rect x="124" y="82" width="24" height="8" rx="2" />

                {/* Нижняя зона */}
                <rect x="58" y="100" width="16" height="8" rx="2" />
                <rect x="82" y="100" width="8" height="16" rx="2" />
                <rect x="98" y="100" width="16" height="8" rx="2" />
                <rect x="122" y="100" width="26" height="8" rx="2" />

                <rect x="58" y="116" width="8" height="16" rx="2" />
                <rect x="74" y="124" width="16" height="8" rx="2" />
                <rect x="98" y="116" width="8" height="16" rx="2" />
                <rect x="114" y="124" width="16" height="8" rx="2" />
                <rect x="138" y="116" width="10" height="24" rx="2" />

                <rect x="58" y="140" width="24" height="8" rx="2" />
                <rect x="90" y="140" width="16" height="8" rx="2" />
                <rect x="114" y="140" width="16" height="8" rx="2" />
              </g>

              {/* Центр-лого */}
              <circle cx="80" cy="80" r="16" fill="white" stroke="#e9e9ec" strokeWidth="2" />
              <circle cx="80" cy="80" r="10" fill="#e30613" />
            </svg>
            )}
          </div>
          <span className="mt-2.5 text-[11px] font-medium text-[#6b6b70]">
            Наведите камеру смартфона для тестирования
          </span>
        </div>

        {/* Ссылка на карту */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[#6b6b70]">
            Публичная ссылка на карту:
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={url}
              className="flex-1 rounded-xl border border-[#e9e9ec] bg-[#fafafa] px-3.5 py-2.5 text-xs font-mono font-medium text-[#111113] focus:outline-none"
            />
            <button
              onClick={handleCopy}
              className={`shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                copied 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-[#e30613] hover:bg-[#c40511] text-white shadow-sm'
              }`}
            >
              {copied ? (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Скопировано!</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                  <span>Копировать</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Действия снизу */}
        <div className="mt-6 flex justify-end gap-2.5 pt-4 border-t border-[#e9e9ec]">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-[#e9e9ec] text-xs font-semibold text-[#111113] hover:bg-[#fafafa] transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  )
}
