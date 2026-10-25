import { useState, useEffect, useMemo, useRef } from 'react'
import type { PlanData } from '../../../types/plan'
import { CloseIcon, CodeIcon } from '../EditorIcons'
import { copyToClipboard } from '../../../utils/clipboard'

interface JsonCodeModalProps {
  isOpen: boolean
  planData: PlanData
  onClose: () => void
  onApply: (data: PlanData) => void
}

export function JsonCodeModal({
  isOpen,
  planData,
  onClose,
  onApply
}: JsonCodeModalProps) {
  const [jsonText, setJsonText] = useState<string>('')
  const [copied, setCopied] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const lineNumbersRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (isOpen) {
      setJsonText(JSON.stringify(planData, null, 2))
      setError(null)
      setCopied(false)
    }
  }, [isOpen, planData])

  // Подсчёт статистики геометрии
  const stats = useMemo(() => {
    try {
      const parsed = JSON.parse(jsonText)
      const floors = Array.isArray(parsed?.floors) ? parsed.floors : []
      const corners = floors.reduce((acc: number, f: any) => acc + (f?.corners?.length || 0), 0)
      const walls = floors.reduce((acc: number, f: any) => acc + (f?.walls?.length || 0), 0)
      const rooms = floors.reduce((acc: number, f: any) => acc + (f?.rooms?.length || 0), 0)
      const pois = floors.reduce((acc: number, f: any) => acc + (f?.pois?.length || 0), 0)
      const panoramas = floors.reduce((acc: number, f: any) => acc + (f?.panoramas?.length || 0), 0)
      return { valid: true, floors: floors.length, corners, walls, rooms, pois, panoramas }
    } catch {
      return { valid: false, floors: 0, corners: 0, walls: 0, rooms: 0, pois: 0, panoramas: 0 }
    }
  }, [jsonText])

  const lineCount = useMemo(() => {
    return Math.max(1, jsonText.split('\n').length)
  }, [jsonText])

  if (!isOpen) return null

  const handleCopy = async () => {
    const ok = await copyToClipboard(jsonText)
    if (ok) {
      setCopied(true)
      setError(null)
      setTimeout(() => setCopied(false), 2000)
    } else {
      setError('Не удалось скопировать в буфер обмена')
    }
  }

  const handleBeautify = () => {
    try {
      const parsed = JSON.parse(jsonText)
      setJsonText(JSON.stringify(parsed, null, 2))
      setError(null)
    } catch (err: any) {
      setError(`Ошибка форматирования: ${err.message}`)
    }
  }

  const handleMinify = () => {
    try {
      const parsed = JSON.parse(jsonText)
      setJsonText(JSON.stringify(parsed))
      setError(null)
    } catch (err: any) {
      setError(`Ошибка минификации: ${err.message}`)
    }
  }

  const handleDownload = () => {
    try {
      const blob = new Blob([jsonText], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `plan-data-${Date.now()}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      setError('Не удалось скачать файл')
    }
  }

  const handleApply = () => {
    try {
      const parsed = JSON.parse(jsonText)
      if (!parsed || !Array.isArray(parsed.floors)) {
        throw new Error('Некорректная структура: отсутствует массив floors')
      }
      onApply(parsed)
      onClose()
    } catch (err: any) {
      setError(`Ошибка JSON: ${err.message || 'Неверный синтаксис'}`)
    }
  }

  const handleScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
      onKeyDown={e => {
        if (e.key === 'Escape') onClose()
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleApply()
      }}
    >
      <div className="w-full max-w-4xl max-h-[92vh] rounded-3xl bg-[#0f1117] border border-[#232733] shadow-2xl p-4 sm:p-6 text-slate-200 flex flex-col overflow-hidden">
        
        {/* Шапка модального окна */}
        <div className="flex items-center justify-between border-b border-[#1f2430] pb-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
              <CodeIcon className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-white">Редактор JSON-структуры плана</h3>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                  CAD Schema
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Прямой доступ к векторной геометрии этажей, стен, комнат и POI</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition border border-transparent hover:border-slate-700"
          >
            <CloseIcon className="size-4" />
          </button>
        </div>

        {/* Панель статистики и инструментов */}
        <div className="py-2.5 flex flex-wrap items-center justify-between gap-2 shrink-0 border-b border-[#1f2430]/60">
          {/* Чипы статистики */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400">
              Этажей: <b className="text-white">{stats.floors}</b>
            </span>
            <span className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400">
              Точек: <b className="text-blue-400">{stats.corners}</b>
            </span>
            <span className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400">
              Стен: <b className="text-emerald-400">{stats.walls}</b>
            </span>
            <span className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400">
              Зон: <b className="text-cyan-400">{stats.rooms}</b>
            </span>
            <span className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400">
              POI: <b className="text-amber-400">{stats.pois}</b>
            </span>
            <span className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400">
              360°: <b className="text-indigo-400">{stats.panoramas}</b>
            </span>
          </div>

          {/* Действия форматирования */}
          <div className="flex items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={handleBeautify}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700 text-[11px] font-medium"
              title="Выровнять и структурировать с отступами"
            >
              Форматировать
            </button>
            <button
              type="button"
              onClick={handleMinify}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700 text-[11px] font-medium"
              title="Убрать пробелы и переносы"
            >
              Сжать
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700 text-[11px] font-medium"
              title="Сохранить файл на диск"
            >
              Скачать
            </button>
          </div>
        </div>

        {/* Уведомление об ошибке если есть */}
        {error && (
          <div className="my-2 px-3 py-2 rounded-xl bg-red-950/70 border border-red-800/80 text-xs text-red-300 shrink-0 flex items-center justify-between">
            <span className="truncate">{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-white text-xs font-bold ml-2">✕</button>
          </div>
        )}

        {/* Редактор кода с номерами строк */}
        <div className="flex-1 min-h-[360px] my-2 relative rounded-2xl border border-[#232733] overflow-hidden bg-[#0a0c10] flex">
          {/* Колонка номеров строк */}
          <div 
            ref={lineNumbersRef}
            className="w-12 py-3.5 pr-2 bg-[#0d0f14] border-r border-[#1f2430] text-right font-mono text-[11px] text-slate-600 select-none overflow-hidden leading-5"
          >
            {Array.from({ length: Math.min(lineCount, 5000) }, (_, i) => (
              <div key={i + 1}>{i + 1}</div>
            ))}
          </div>

          {/* Текстовая область */}
          <textarea
            ref={textareaRef}
            value={jsonText}
            onChange={e => {
              setJsonText(e.target.value)
              setError(null)
            }}
            onScroll={handleScroll}
            spellCheck={false}
            className="flex-1 p-3.5 bg-transparent font-mono text-[12px] text-slate-200 resize-none focus:outline-none selection:bg-blue-600/40 selection:text-white leading-5 tab-2 overflow-auto"
            placeholder="Вставьте JSON-структуру плана этажей..."
          />
        </div>

        {/* Статус валидности и кнопки */}
        <div className="flex items-center justify-between pt-3 border-t border-[#1f2430] shrink-0">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${
              stats.valid 
                ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60' 
                : 'bg-amber-950/60 text-amber-400 border border-amber-800/60'
            }`}>
              <span className={`size-1.5 rounded-full ${stats.valid ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              {stats.valid ? 'JSON корректен' : 'Синтаксическая ошибка'}
            </span>
            <span className="text-[11px] text-slate-500 hidden sm:inline">
              Ctrl+Enter для сохранения
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition flex items-center gap-1.5"
            >
              <span>{copied ? '✓ Скопировано!' : 'Копировать'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={!stats.valid}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow ${
                stats.valid
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20 cursor-pointer'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              Применить к плану
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
