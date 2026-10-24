import React, { useState, useEffect, useRef } from 'react'
import type { PlanPanorama, PlanFloor, PlanPanoramaHotspot } from '../../../types/plan'
import { POI_CATEGORIES } from '../../../types/editor'
import { CloseIcon, PanoIcon, TrashIcon, PlusIcon } from '../EditorIcons'

interface PanoramaEditModalProps {
  isOpen: boolean
  pano: PlanPanorama | null
  defaultX: number
  defaultY: number
  targetRoomId?: string
  floor: PlanFloor
  onClose: () => void
  onSave: (panoData: PlanPanorama) => void
  onDelete?: (panoId: string) => void
  onOpenViewer?: (pano: PlanPanorama) => void
}

export function PanoramaEditModal({
  isOpen,
  pano,
  defaultX,
  defaultY,
  targetRoomId,
  floor,
  onClose,
  onSave,
  onDelete,
  onOpenViewer
}: PanoramaEditModalProps) {
  const [mode, setMode] = useState<'single' | 'stitch'>('single')
  const [name, setName] = useState<string>('')
  const [roomId, setRoomId] = useState<string>('')
  const [imageData, setImageData] = useState<string>('')
  const [imageMeta, setImageMeta] = useState<{ name?: string; size?: number; width?: number; height?: number } | null>(null)

  // Сшивка 180° + 180°
  const [frame1, setFrame1] = useState<File | null>(null)
  const [frame2, setFrame2] = useState<File | null>(null)
  const [isStitching, setIsStitching] = useState<boolean>(false)
  const [stitchError, setStitchError] = useState<string | null>(null)

  // Хотспоты (POI внутри панорамы)
  const [hotspots, setHotspots] = useState<PlanPanoramaHotspot[]>([])
  const [isAddHsOpen, setIsAddHsOpen] = useState<boolean>(false)
  const [newHsTitle, setNewHsTitle] = useState<string>('')
  const [newHsCategory, setNewHsCategory] = useState<string>('stand')
  const [newHsYaw, setNewHsYaw] = useState<number>(0)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const frame1InputRef = useRef<HTMLInputElement | null>(null)
  const frame2InputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (pano) {
      setName(pano.name)
      setRoomId(pano.room_id || '')
      setImageData(pano.image_data || pano.image || '')
      setHotspots(pano.hotspots ? [...pano.hotspots] : [])
      setImageMeta({ name: 'Сохраненная панорама' })
    } else {
      const room = targetRoomId ? floor.rooms?.find(r => r.id === targetRoomId) : null
      setName(room ? `Панорама: ${room.name}` : `Панорама ${(floor.panoramas?.length || 0) + 1}`)
      setRoomId(targetRoomId || '')
      setImageData('')
      setHotspots([])
      setImageMeta(null)
    }
    setMode('single')
    setFrame1(null)
    setFrame2(null)
    setIsStitching(false)
    setStitchError(null)
    setIsAddHsOpen(false)
  }, [pano, targetRoomId, floor, isOpen])

  if (!isOpen) return null

  const targetX = pano ? pano.x : defaultX
  const targetY = pano ? pano.y : defaultY

  const handleProcessFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      const result = e.target?.result as string
      if (result) {
        setImageData(result)
        setImageMeta({
          name: file.name,
          size: file.size
        })
      }
    }
    reader.readAsDataURL(file)
  }

  const handleExecuteStitch = async () => {
    if (!frame1 || !frame2) {
      alert('Пожалуйста, выберите оба кадра по 180° (первая и вторая половина зала с перекрытием).')
      return
    }

    setIsStitching(true)
    setStitchError(null)

    try {
      const formData = new FormData()
      formData.append('frame1', frame1)
      formData.append('frame2', frame2)

      const response = await fetch('/api/stitch', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        let errText = 'Ошибка сервера при сшивке панорамы'
        try {
          const errJson = await response.json()
          if (errJson && errJson.message) errText = errJson.message
        } catch (_) {}
        throw new Error(errText)
      }

      const result = await response.json()
      if (result.status === 'ok' && result.image) {
        setImageData(result.image)
        setImageMeta({
          name: 'Сшитая 360° панорама (8K)',
          size: result.size,
          width: result.width || 8192,
          height: 1090
        })
        setMode('single')
      } else {
        throw new Error(result.message || 'Скрипт сшивки вернул пустой результат')
      }
    } catch (err: any) {
      console.error('Ошибка сшивки панорамы:', err)
      setStitchError(err.message || 'Ошибка сшивки панорамы')
    } finally {
      setIsStitching(false)
    }
  }

  const handleImportRoomPois = () => {
    if (!floor.pois || floor.pois.length === 0) {
      alert('На этом этаже еще нет созданных меток POI.')
      return
    }

    const roomPois = roomId
      ? floor.pois.filter(p => p.room_id === roomId)
      : floor.pois

    const targetList = roomPois.length > 0 ? roomPois : floor.pois
    let addedCount = 0

    const updated = [...hotspots]
    targetList.forEach(poi => {
      const exists = updated.some(h => h.name === poi.name)
      if (!exists) {
        // Декартов азимут направления от точки панорамы к POI
        const dx = poi.x - targetX
        const dy = poi.y - targetY // +Y вверх (Север = 0°)
        const yaw = Math.round((Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360)

        updated.push({
          id: `hs_${Math.floor(Math.random() * 100000)}`,
          name: poi.name,
          category: poi.category || 'stand',
          yaw,
          pitch: 0
        })
        addedCount++
      }
    })

    setHotspots(updated)
    if (addedCount === 0) {
      alert('Все точки из этой зоны уже добавлены.')
    }
  }

  const handleAddManualHs = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newHsTitle.trim()) return

    setHotspots(prev => [
      ...prev,
      {
        id: `hs_${Math.floor(Math.random() * 100000)}`,
        name: newHsTitle.trim(),
        category: newHsCategory,
        yaw: Math.max(0, Math.min(360, newHsYaw)),
        pitch: 0
      }
    ])
    setNewHsTitle('')
    setIsAddHsOpen(false)
  }

  const handleDeleteHs = (hsId: string) => {
    setHotspots(prev => prev.filter(h => h.id !== hsId))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const finalPano: PlanPanorama = {
      id: pano ? pano.id : `pano_${Math.floor(Math.random() * 100000)}`,
      name: name.trim() || 'Панорама 360°',
      x: targetX,
      y: targetY,
      image_data: imageData || undefined,
      image: imageData || undefined,
      room_id: roomId || undefined,
      hotspots
    }
    onSave(finalPano)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-2xl max-h-[92vh] rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl p-5 text-slate-200 flex flex-col overflow-hidden">
        
        {/* Шапка */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <PanoIcon className="size-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">
                {pano ? `Редактирование: ${pano.name}` : 'Создание 360° панорамы'}
              </h3>
              <p className="text-[11px] text-slate-400">Сферический фототур и привязка к помещению</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-7 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition"
          >
            <CloseIcon className="size-4" />
          </button>
        </div>

        {/* Скроллируемая область формы */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
          
          {/* Режимы панорамы: готовая 360 или сшивка */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setMode('single')}
              className={`py-1.5 rounded-lg font-semibold transition ${
                mode === 'single'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Одиночная 360° / Фото
            </button>
            <button
              type="button"
              onClick={() => setMode('stitch')}
              className={`py-1.5 rounded-lg font-semibold transition ${
                mode === 'stitch'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Сшивка из двух 180°
            </button>
          </div>

          {stitchError && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-800/80 text-red-300">
              {stitchError}
            </div>
          )}

          {/* Загрузка фото: режим 1 */}
          {mode === 'single' ? (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.heic,.heif"
                onChange={e => e.target.files?.[0] && handleProcessFile(e.target.files[0])}
                className="hidden"
              />

              {!imageData ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault()
                    if (e.dataTransfer.files?.[0]) handleProcessFile(e.dataTransfer.files[0])
                  }}
                  className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-2xl p-6 text-center cursor-pointer transition bg-slate-950/40 flex flex-col items-center justify-center gap-2 group"
                >
                  <div className="size-11 rounded-full bg-slate-800 group-hover:bg-indigo-600/30 text-slate-400 group-hover:text-indigo-400 flex items-center justify-center transition">
                    <PanoIcon className="size-6" />
                  </div>
                  <div>
                    <span className="font-semibold text-slate-300 block">
                      Нажмите для выбора панорамы или перетащите файл
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Поддерживаются JPG, PNG, HEIC (до 50 МБ)
                    </span>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-700 bg-slate-950/70 p-3 flex items-center gap-3">
                  <div className="w-28 h-16 rounded-xl overflow-hidden bg-black shrink-0 relative border border-slate-800">
                    <img src={imageData} alt="Превью" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-white text-xs block truncate">
                      {imageMeta?.name || 'Панорамное фото загружено'}
                    </span>
                    <span className="text-[10px] text-emerald-400 font-semibold block">
                      Готово к просмотру в 360°
                    </span>
                    <div className="flex items-center gap-2 mt-2">
                      {onOpenViewer && (
                        <button
                          type="button"
                          onClick={() => {
                            onOpenViewer({
                              id: pano?.id || 'temp',
                              name,
                              x: targetX,
                              y: targetY,
                              image_data: imageData,
                              room_id: roomId,
                              hotspots
                            })
                          }}
                          className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[11px] transition shadow"
                        >
                          Смотреть в 360°
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition border border-slate-700"
                      >
                        Заменить файл
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Режим сшивки из двух кадров 180° */
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
              <input
                ref={frame1InputRef}
                type="file"
                accept="image/*,.heic"
                onChange={e => e.target.files?.[0] && setFrame1(e.target.files[0])}
                className="hidden"
              />
              <input
                ref={frame2InputRef}
                type="file"
                accept="image/*,.heic"
                onChange={e => e.target.files?.[0] && setFrame2(e.target.files[0])}
                className="hidden"
              />

              <div className="grid grid-cols-2 gap-3">
                <div
                  onClick={() => frame1InputRef.current?.click()}
                  className={`p-3 rounded-xl border-2 border-dashed cursor-pointer text-center transition flex flex-col items-center justify-center gap-1.5 ${
                    frame1
                      ? 'border-emerald-500 bg-emerald-950/20'
                      : 'border-slate-700 hover:border-indigo-400 bg-slate-900/50'
                  }`}
                >
                  <PanoIcon className={`size-5 ${frame1 ? 'text-emerald-400' : 'text-slate-400'}`} />
                  <span className="font-semibold text-[11px] text-slate-200 truncate max-w-[150px]">
                    {frame1 ? frame1.name : 'Кадр 1 (180° лево)'}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {frame1 ? `${(frame1.size / 1024 / 1024).toFixed(1)} МБ · Заменить` : 'Нажмите для выбора'}
                  </span>
                </div>

                <div
                  onClick={() => frame2InputRef.current?.click()}
                  className={`p-3 rounded-xl border-2 border-dashed cursor-pointer text-center transition flex flex-col items-center justify-center gap-1.5 ${
                    frame2
                      ? 'border-emerald-500 bg-emerald-950/20'
                      : 'border-slate-700 hover:border-indigo-400 bg-slate-900/50'
                  }`}
                >
                  <PanoIcon className={`size-5 ${frame2 ? 'text-emerald-400' : 'text-slate-400'}`} />
                  <span className="font-semibold text-[11px] text-slate-200 truncate max-w-[150px]">
                    {frame2 ? frame2.name : 'Кадр 2 (180° право)'}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {frame2 ? `${(frame2.size / 1024 / 1024).toFixed(1)} МБ · Заменить` : 'Нажмите для выбора'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleExecuteStitch}
                disabled={!frame1 || !frame2 || isStitching}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {isStitching ? (
                  <>
                    <div className="size-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Сшивка панорамы в 8K (SIFT + RANSAC)...</span>
                  </>
                ) : (
                  <span>Выполнить сшивку 360° панорамы</span>
                )}
              </button>
            </div>
          )}

          {/* Метаданные */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Название точки обзора
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Зона / Помещение
              </label>
              <select
                value={roomId}
                onChange={e => setRoomId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="">Без привязки</option>
                {floor.rooms?.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Секция точек интереса (Hotspots) внутри сферы */}
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-200 block text-xs">
                  Метки и стенды внутри панорамы ({hotspots.length})
                </span>
                <span className="text-[10px] text-slate-400">
                  Интерактивные указатели при вращении 360°
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleImportRoomPois}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 text-[11px] font-semibold transition border border-slate-700"
                >
                  Импорт POI зоны
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddHsOpen(!isAddHsOpen)}
                  className="px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 text-[11px] font-semibold transition border border-indigo-500/40 flex items-center gap-1"
                >
                  <PlusIcon className="size-3" />
                  <span>Добавить</span>
                </button>
              </div>
            </div>

            {/* Форма ручного добавления маркера */}
            {isAddHsOpen && (
              <div className="p-3 rounded-xl bg-slate-900 border border-indigo-900/50 space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1">
                    <input
                      type="text"
                      placeholder="Название метки"
                      value={newHsTitle}
                      onChange={e => setNewHsTitle(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                    />
                  </div>
                  <div>
                    <select
                      value={newHsCategory}
                      onChange={e => setNewHsCategory(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                    >
                      {Object.values(POI_CATEGORIES).map(cat => (
                        <option key={cat.id} value={cat.id}>
                          {cat.icon} {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <input
                      type="number"
                      placeholder="Азимут (0-360°)"
                      value={newHsYaw}
                      onChange={e => setNewHsYaw(parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsAddHsOpen(false)}
                    className="px-2.5 py-0.5 rounded text-[11px] text-slate-400 hover:text-white"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={handleAddManualHs}
                    className="px-3 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px]"
                  >
                    Добавить
                  </button>
                </div>
              </div>
            )}

            {/* Список хотспотов */}
            {hotspots.length === 0 ? (
              <p className="text-[11px] text-slate-500 text-center py-2">
                В панораму еще не добавлены метки. Нажмите «Импорт POI зоны» для авто-расчета азимута.
              </p>
            ) : (
              <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                {hotspots.map(hs => {
                  const cat = POI_CATEGORIES[hs.category] || POI_CATEGORIES.stand
                  return (
                    <div
                      key={hs.id}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px]"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span style={{ color: cat.color }}>{cat.icon}</span>
                        <span className="font-semibold text-slate-200 truncate">{hs.name}</span>
                        <span className="font-mono text-[10px] text-slate-400">
                          {hs.yaw}° азимут
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteHs(hs.id)}
                        className="text-slate-500 hover:text-rose-400 transition"
                      >
                        <TrashIcon className="size-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="bg-slate-950/70 rounded-xl p-2.5 border border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400">Координаты камеры:</span>
            <span className="font-mono text-indigo-400 font-bold">
              X: {targetX}, Y: {targetY}
            </span>
          </div>

          {/* Кнопки действий */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <div>
              {pano && onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Удалить панораму "${pano.name}"?`)) {
                      onDelete(pano.id)
                      onClose()
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-950/30 border border-rose-900/40 transition"
                >
                  Удалить
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition"
              >
                Сохранить
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
