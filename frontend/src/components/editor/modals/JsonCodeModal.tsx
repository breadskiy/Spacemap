import { useState, useEffect } from 'react'
import type { PlanData } from '../../../types/plan'
import { CloseIcon, CodeIcon } from '../EditorIcons'

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

  useEffect(() => {
    if (isOpen) {
      setJsonText(JSON.stringify(planData, null, 2))
      setError(null)
      setCopied(false)
    }
  }, [isOpen, planData])

  if (!isOpen) return null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Не удалось скопировать в буфер обмена')
    }
  }

  const handleApply = () => {
    try {
      const parsed = JSON.parse(jsonText)
      if (!parsed || !Array.isArray(parsed.floors)) {
        throw new Error('Некорректная структура JSON: отсутствует массив floors')
      }
      onApply(parsed)
      onClose()
    } catch (err: any) {
      setError(`Ошибка JSON: ${err.message || 'Неверный синтаксис'}`)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-2xl max-h-[90vh] rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl p-5 text-slate-200 flex flex-col overflow-hidden">
        
        {/* Шапка */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <CodeIcon className="size-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Редактор исходного JSON плана</h3>
              <p className="text-[11px] text-slate-400">Прямой доступ к геометрии и координатам</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-7 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition"
          >
            <CloseIcon className="size-4" />
          </button>
        </div>

        {error && (
          <div className="mb-3 px-3 py-2 rounded-xl bg-red-950/60 border border-red-800/80 text-xs text-red-300 shrink-0">
            {error}
          </div>
        )}

        {/* Текстовое поле JSON */}
        <div className="flex-1 min-h-[300px] relative rounded-xl border border-slate-800 overflow-hidden bg-slate-950">
          <textarea
            value={jsonText}
            onChange={e => {
              setJsonText(e.target.value)
              setError(null)
            }}
            spellCheck={false}
            className="w-full h-full p-4 bg-transparent font-mono text-xs text-emerald-400 resize-none focus:outline-none selection:bg-emerald-900 selection:text-white"
          />
        </div>

        {/* Действия */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800 mt-3 shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition flex items-center gap-1.5"
          >
            <span>{copied ? '✓ Скопировано!' : 'Копировать JSON'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-4 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow transition"
            >
              Применить изменения
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
