import { useState, useEffect, useRef } from 'react'
import type { SpaceObject } from '../types/space'
import type { PlanData, PlanFloor, PlanPoi } from '../types/plan'

interface ViewerViewProps {
  space: SpaceObject
  onBack: () => void
}

// Категории меток в фирменной эстетике
const POI_CATEGORIES: Record<string, { label: string; color: string; icon: string }> = {
  stand: { label: 'Экспозиция / Стенд', color: '#e30613', icon: '🏢' },
  expo: { label: 'Выставка / Арт', color: '#ec4899', icon: '🖼️' },
  cafe: { label: 'Кафе / Кофе', color: '#f59e0b', icon: '☕' },
  food: { label: 'Фудкорт', color: '#f97316', icon: '🍔' },
  shop: { label: 'Магазин / Мерч', color: '#3b82f6', icon: '🛍️' },
  stage: { label: 'Сцена / Зал', color: '#a855f7', icon: '🎤' },
  info: { label: 'Инфостойка', color: '#06b6d4', icon: 'ℹ️' },
  exit: { label: 'Вход / Выход', color: '#10b981', icon: '🚪' },
  wc: { label: 'Туалет (WC)', color: '#64748b', icon: '🚻' },
  atm: { label: 'Банкомат', color: '#14b8a6', icon: '💳' },
  firstaid: { label: 'Медпункт', color: '#e11d48', icon: '🏥' }
}

export function ViewerView({ space, onBack }: ViewerViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Данные плана
  const [plan, setPlan] = useState<PlanData | null>(null)
  const [activeFloorId, setActiveFloorId] = useState<string>('')
  
  // Выбранная метка
  const [selectedPoi, setSelectedPoi] = useState<PlanPoi | null>(null)

  // Точки маршрута А и Б (заглушка)
  const [pointA, setPointA] = useState<{ x: number; y: number; name: string } | null>(null)
  const [pointB, setPointB] = useState<{ x: number; y: number; name: string } | null>(null)

  // Преобразования холста
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 200, y: 350 })
  const [zoom, setZoom] = useState<number>(1.0)
  const [hoveredPoiId, setHoveredPoiId] = useState<string | null>(null)

  // Ссылки на актуальное состояние для событий мыши
  const panRef = useRef(pan)
  const zoomRef = useRef(zoom)
  panRef.current = pan
  zoomRef.current = zoom

  // Загрузка плана из localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('spacemap_plan_' + space.id)
      if (raw) {
        const parsed: PlanData = JSON.parse(raw)
        if (parsed.floors && parsed.floors.length > 0) {
          setPlan(parsed)
          setActiveFloorId(parsed.floors[0].id)
          return
        }
      }
    } catch (e) {
      console.warn('Could not read plan data', e)
    }

    // Если чертежа нет, создаем красивую базовую планировку по умолчанию
    const defaultFloor: PlanFloor = {
      id: 'floor-1',
      name: '1 этаж',
      level: 1,
      corners: [
        { id: '1', x: 60, y: 60 },
        { id: '2', x: 540, y: 60 },
        { id: '3', x: 540, y: 380 },
        { id: '4', x: 60, y: 380 },
        { id: '5', x: 280, y: 60 },
        { id: '6', x: 280, y: 380 }
      ],
      walls: [
        { id: 'w1', from: '1', to: '2', length: 480 },
        { id: 'w2', from: '2', to: '3', length: 320 },
        { id: 'w3', from: '3', to: '4', length: 480 },
        { id: 'w4', from: '4', to: '1', length: 320 },
        { id: 'w5', from: '5', to: '6', length: 320 }
      ],
      pois: [
        { id: 'p1', name: 'Главный вход', category: 'exit', x: 100, y: 80 },
        { id: 'p2', name: 'Стенд ТТК №1', category: 'stand', x: 180, y: 220 },
        { id: 'p3', name: 'Кофе-зона', category: 'cafe', x: 420, y: 280 },
        { id: 'p4', name: 'Главная сцена', category: 'stage', x: 420, y: 140 }
      ]
    }
    setPlan({ floors: [defaultFloor] })
    setActiveFloorId('floor-1')
  }, [space.id])

  const currentFloor = plan?.floors.find(f => f.id === activeFloorId) || plan?.floors[0]

  // Центрирование плана при открытии
  useEffect(() => {
    if (!currentFloor || !containerRef.current) return
    const container = containerRef.current
    const corners = currentFloor.corners
    if (!corners || corners.length === 0) return

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    corners.forEach(c => {
      if (c.x < minX) minX = c.x
      if (c.x > maxX) maxX = c.x
      if (c.y < minY) minY = c.y
      if (c.y > maxY) maxY = c.y
    })

    const w = maxX - minX || 400
    const h = maxY - minY || 300
    const availableW = container.clientWidth * 0.75
    const availableH = container.clientHeight * 0.75

    const fitZoom = Math.min(Math.max(0.4, Math.min(availableW / w, availableH / h)), 1.5)
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2

    setZoom(fitZoom)
    setPan({
      x: container.clientWidth / 2 - centerX * fitZoom,
      y: container.clientHeight / 2 + centerY * fitZoom
    })
  }, [activeFloorId, plan])

  // Координатные преобразования
  const screenToWorld = (sx: number, sy: number) => {
    return {
      x: (sx - panRef.current.x) / zoomRef.current,
      y: (panRef.current.y - sy) / zoomRef.current
    }
  }

  const worldToCanvas = (wx: number, wy: number) => {
    return { x: wx, y: -wy }
  }

  // Отрисовка холста (Светлая карта для посетителей)
  const draw = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Фоновая мягкая текстура сетки в светлом стиле ТТК
    ctx.save()
    ctx.fillStyle = '#f8fafc'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.translate(panRef.current.x, panRef.current.y)
    ctx.scale(zoomRef.current, zoomRef.current)

    if (currentFloor) {
      // 1. Заливка комнат (замкнутые циклы стен)
      const cornerMap = new Map(currentFloor.corners.map(c => [c.id, c]))
      
      // Поиск комнат
      if (currentFloor.corners.length >= 3 && currentFloor.walls.length >= 3) {
        ctx.save()
        ctx.fillStyle = '#ffffff'
        ctx.strokeStyle = '#e2e8f0'
        ctx.lineWidth = 1.5 / zoomRef.current
        ctx.shadowColor = 'rgba(15, 23, 42, 0.04)'
        ctx.shadowBlur = 12 / zoomRef.current

        // Рисуем многоугольник стен
        ctx.beginPath()
        const first = worldToCanvas(currentFloor.corners[0].x, currentFloor.corners[0].y)
        ctx.moveTo(first.x, first.y)
        for (let i = 1; i < currentFloor.corners.length; i++) {
          const pt = worldToCanvas(currentFloor.corners[i].x, currentFloor.corners[i].y)
          ctx.lineTo(pt.x, pt.y)
        }
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
        ctx.restore()
      }

      // 2. Стены (аккуратный графит #1e293b без строительных осей)
      ctx.save()
      ctx.strokeStyle = '#1e293b'
      ctx.lineWidth = 5 / zoomRef.current
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      currentFloor.walls.forEach(w => {
        const c1 = cornerMap.get(w.from)
        const c2 = cornerMap.get(w.to)
        if (!c1 || !c2) return

        const p1 = worldToCanvas(c1.x, c1.y)
        const p2 = worldToCanvas(c2.x, c2.y)

        ctx.beginPath()
        ctx.moveTo(p1.x, p1.y)
        ctx.lineTo(p2.x, p2.y)
        ctx.stroke()
      })
      ctx.restore()

      // 3. Метки (POI)
      currentFloor.pois.forEach(poi => {
        const pos = worldToCanvas(poi.x, poi.y)
        const isHovered = hoveredPoiId === poi.id
        const isSelected = selectedPoi?.id === poi.id
        const cat = POI_CATEGORIES[poi.category] || POI_CATEGORIES.stand

        ctx.save()

        // Тень маркера
        ctx.shadowColor = 'rgba(15, 23, 42, 0.15)'
        ctx.shadowBlur = (isHovered || isSelected ? 12 : 6) / zoomRef.current
        ctx.shadowOffsetY = 2 / zoomRef.current

        // Круг маркера
        const r = (isHovered || isSelected ? 12 : 9) / zoomRef.current
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2)
        ctx.fillStyle = cat.color
        ctx.fill()

        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 2.5 / zoomRef.current
        ctx.stroke()

        // Белая внутренняя точка
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, 3 / zoomRef.current, 0, Math.PI * 2)
        ctx.fillStyle = '#ffffff'
        ctx.fill()

        ctx.restore()

        // Плашка с названием
        ctx.save()
        const fontSize = Math.max(10, 11 / zoomRef.current)
        ctx.font = `600 ${fontSize}px sans-serif`
        const text = `${cat.icon} ${poi.name}`
        const textW = ctx.measureText(text).width
        const badgeH = 18 / zoomRef.current
        const badgeY = pos.y + (16 / zoomRef.current)

        ctx.fillStyle = isSelected ? '#111113' : 'rgba(255, 255, 255, 0.95)'
        ctx.strokeStyle = isSelected ? '#111113' : '#e2e8f0'
        ctx.lineWidth = 1 / zoomRef.current
        ctx.beginPath()
        ctx.roundRect(pos.x - textW / 2 - (6 / zoomRef.current), badgeY - badgeH / 2, textW + (12 / zoomRef.current), badgeH, 6 / zoomRef.current)
        ctx.fill()
        ctx.stroke()

        ctx.fillStyle = isSelected ? '#ffffff' : '#1e293b'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(text, pos.x, badgeY)
        ctx.restore()
      })

      // 4. Маркер точки А (зеленый флаг/круг) — БЕЗ ЛИНИЙ И БЕЗ НАДПИСЕЙ
      if (pointA) {
        const posA = worldToCanvas(pointA.x, pointA.y)
        ctx.save()
        // Внешнее зеленое кольцо
        ctx.beginPath()
        ctx.arc(posA.x, posA.y, 16 / zoomRef.current, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(16, 185, 129, 0.2)'
        ctx.fill()

        // Основной маркер А
        ctx.beginPath()
        ctx.arc(posA.x, posA.y, 11 / zoomRef.current, 0, Math.PI * 2)
        ctx.fillStyle = '#10b981'
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 2.5 / zoomRef.current
        ctx.fill()
        ctx.stroke()

        // Буква А внутри
        ctx.fillStyle = '#ffffff'
        ctx.font = `bold ${Math.max(9, 11 / zoomRef.current)}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('A', posA.x, posA.y)
        ctx.restore()
      }

      // 5. Маркер точки Б (красный круг ТТК) — БЕЗ ЛИНИЙ И БЕЗ НАДПИСЕЙ
      if (pointB) {
        const posB = worldToCanvas(pointB.x, pointB.y)
        ctx.save()
        // Внешнее красное кольцо
        ctx.beginPath()
        ctx.arc(posB.x, posB.y, 16 / zoomRef.current, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(227, 6, 19, 0.2)'
        ctx.fill()

        // Основной маркер Б
        ctx.beginPath()
        ctx.arc(posB.x, posB.y, 11 / zoomRef.current, 0, Math.PI * 2)
        ctx.fillStyle = '#e30613'
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 2.5 / zoomRef.current
        ctx.fill()
        ctx.stroke()

        // Буква Б внутри
        ctx.fillStyle = '#ffffff'
        ctx.font = `bold ${Math.max(9, 11 / zoomRef.current)}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('B', posB.x, posB.y)
        ctx.restore()
      }
    }

    ctx.restore()
  }

  // Обновление размера canvas
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current
      const container = containerRef.current
      if (!canvas || !container) return
      canvas.width = container.clientWidth
      canvas.height = container.clientHeight
      draw()
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    draw()
  }, [pan, zoom, activeFloorId, selectedPoi, pointA, pointB, hoveredPoiId])

  // Обработка кликов и перемещений мыши / тача
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let isPanning = false
    let panStart = { x: 0, y: 0 }
    let touchStartDist = 0

    const handleMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const world = screenToWorld(sx, sy)

      // Проверка клика по метке
      if (currentFloor) {
        const clickedPoi = currentFloor.pois.find(p => Math.hypot(p.x - world.x, p.y - world.y) <= 18 / zoomRef.current)
        if (clickedPoi) {
          setSelectedPoi(clickedPoi)
          return
        }
      }

      // Панорамирование
      isPanning = true
      panStart = { x: sx - panRef.current.x, y: sy - panRef.current.y }
    }

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top

      if (isPanning) {
        setPan({
          x: sx - panStart.x,
          y: sy - panStart.y
        })
        return
      }

      // Подсветка при наведении
      if (currentFloor) {
        const world = screenToWorld(sx, sy)
        const hovered = currentFloor.pois.find(p => Math.hypot(p.x - world.x, p.y - world.y) <= 18 / zoomRef.current)
        setHoveredPoiId(hovered ? hovered.id : null)
      }
    }

    const handleMouseUp = () => {
      isPanning = false
    }

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const worldBefore = screenToWorld(sx, sy)

      const factor = e.deltaY < 0 ? 1.15 : 0.85
      const newZoom = Math.min(Math.max(0.2, zoomRef.current * factor), 4.0)

      setZoom(newZoom)
      setPan({
        x: sx - worldBefore.x * newZoom,
        y: sy + worldBefore.y * newZoom
      })
    }

    // Touch жесты
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const t = e.touches[0]
        const rect = canvas.getBoundingClientRect()
        const sx = t.clientX - rect.left
        const sy = t.clientY - rect.top
        const world = screenToWorld(sx, sy)

        if (currentFloor) {
          const clickedPoi = currentFloor.pois.find(p => Math.hypot(p.x - world.x, p.y - world.y) <= 22 / zoomRef.current)
          if (clickedPoi) {
            setSelectedPoi(clickedPoi)
            return
          }
        }

        isPanning = true
        panStart = { x: sx - panRef.current.x, y: sy - panRef.current.y }
      } else if (e.touches.length === 2) {
        isPanning = true
        const t1 = e.touches[0]
        const t2 = e.touches[1]
        touchStartDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
        const midX = (t1.clientX + t2.clientX) / 2
        const midY = (t1.clientY + t2.clientY) / 2
        panStart = { x: midX - panRef.current.x, y: midY - panRef.current.y }
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1 && isPanning) {
        const t = e.touches[0]
        const rect = canvas.getBoundingClientRect()
        setPan({
          x: t.clientX - rect.left - panStart.x,
          y: t.clientY - rect.top - panStart.y
        })
      } else if (e.touches.length === 2) {
        e.preventDefault()
        const t1 = e.touches[0]
        const t2 = e.touches[1]
        const rect = canvas.getBoundingClientRect()
        const midX = (t1.clientX + t2.clientX) / 2 - rect.left
        const midY = (t1.clientY + t2.clientY) / 2 - rect.top

        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
        if (touchStartDist > 0) {
          const factor = dist / touchStartDist
          const worldBefore = screenToWorld(midX, midY)
          const newZoom = Math.min(Math.max(0.2, zoomRef.current * factor), 4.0)
          setZoom(newZoom)
          setPan({
            x: midX - worldBefore.x * newZoom,
            y: midY + worldBefore.y * newZoom
          })
        }
        touchStartDist = dist
      }
    }

    const handleTouchEnd = () => {
      isPanning = false
      touchStartDist = 0
    }

    canvas.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    canvas.addEventListener('wheel', handleWheel, { passive: false })

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false })
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false })
    canvas.addEventListener('touchend', handleTouchEnd)

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      canvas.removeEventListener('wheel', handleWheel)
      canvas.removeEventListener('touchstart', handleTouchStart)
      canvas.removeEventListener('touchmove', handleTouchMove)
      canvas.removeEventListener('touchend', handleTouchEnd)
    }
  }, [currentFloor])

  // Установка точки А
  const handleSetPointA = (poi: PlanPoi) => {
    setPointA({ x: poi.x, y: poi.y, name: poi.name })
    setSelectedPoi(null)
  }

  // Установка точки Б
  const handleSetPointB = (poi: PlanPoi) => {
    setPointB({ x: poi.x, y: poi.y, name: poi.name })
    setSelectedPoi(null)
  }

  // Сброс маршрута
  const handleResetRoute = () => {
    setPointA(null)
    setPointB(null)
  }

  return (
    <div className="relative flex flex-col h-screen w-screen overflow-hidden bg-[#fafafa] text-[#111113]">
      {/* 1. Верхняя панель навигации */}
      <header className="h-16 shrink-0 bg-white/95 backdrop-blur-md border-b border-[#e9e9ec] px-4 sm:px-6 flex items-center justify-between z-30 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#e9e9ec] bg-white text-xs font-semibold text-[#111113] hover:border-[#e30613] hover:text-[#e30613] transition"
          >
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Назад</span>
          </button>

          <div className="h-4 w-px bg-[#e9e9ec]" />

          <div>
            <h1 className="text-sm sm:text-base font-bold text-[#111113] truncate max-w-[180px] sm:max-w-md">
              {space.title}
            </h1>
            <p className="text-[11px] text-[#6b6b70] hidden sm:block">
              Интерактивная карта навигации посетителей
            </p>
          </div>
        </div>

        {/* Переключатель этажей (если их больше 1) */}
        {plan && plan.floors.length > 1 && (
          <div className="flex items-center gap-1 bg-[#f4f4f6] p-1 rounded-full border border-[#e9e9ec]">
            {plan.floors.map(floor => (
              <button
                key={floor.id}
                onClick={() => setActiveFloorId(floor.id)}
                className={`px-3 py-1 text-xs font-bold rounded-full transition ${
                  activeFloorId === floor.id
                    ? 'bg-white text-[#111113] shadow-xs'
                    : 'text-[#6b6b70] hover:text-[#111113]'
                }`}
              >
                {floor.name}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* 2. Плавающая панель маршрута (Точки А и Б — без линий, чистые заглушки) */}
      <div className="absolute top-20 left-4 right-4 sm:left-1/2 sm:-translate-x-1/2 sm:max-w-md z-20 pointer-events-auto">
        <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-[#e9e9ec] p-3 shadow-lg shadow-black/5 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-[#111113] flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-[#e30613]" />
              Маршрут по карте
            </span>
            {(pointA || pointB) && (
              <button
                onClick={handleResetRoute}
                className="text-[11px] text-[#6b6b70] hover:text-[#e30613] font-semibold transition"
              >
                Сбросить
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {/* Точка А */}
            <div className="flex items-center gap-2 p-2 rounded-xl bg-[#fafafa] border border-[#e9e9ec]">
              <span className="size-5 rounded-full bg-emerald-500 text-white font-black text-[10px] flex items-center justify-center shrink-0">
                A
              </span>
              <span className="truncate font-medium text-[#111113]">
                {pointA ? pointA.name : 'Откуда (А)'}
              </span>
            </div>

            {/* Точка Б */}
            <div className="flex items-center gap-2 p-2 rounded-xl bg-[#fafafa] border border-[#e9e9ec]">
              <span className="size-5 rounded-full bg-[#e30613] text-white font-black text-[10px] flex items-center justify-center shrink-0">
                B
              </span>
              <span className="truncate font-medium text-[#111113]">
                {pointB ? pointB.name : 'Куда (Б)'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Рабочая область холста */}
      <main ref={containerRef} className="flex-1 w-full h-full relative cursor-grab active:cursor-grabbing">
        <canvas ref={canvasRef} className="w-full h-full block" />

        {/* Кнопки зума справа снизу */}
        <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-20">
          <button
            onClick={() => setZoom(prev => Math.min(prev * 1.2, 4.0))}
            className="size-10 rounded-full bg-white border border-[#e9e9ec] shadow-md flex items-center justify-center text-[#111113] hover:border-[#e30613] hover:text-[#e30613] transition"
            title="Приблизить"
          >
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button
            onClick={() => setZoom(prev => Math.max(prev / 1.2, 0.2))}
            className="size-10 rounded-full bg-white border border-[#e9e9ec] shadow-md flex items-center justify-center text-[#111113] hover:border-[#e30613] hover:text-[#e30613] transition"
            title="Отдалить"
          >
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M20 12H4" />
            </svg>
          </button>
        </div>
      </main>

      {/* 4. Всплывающая карточка выбранной метки (POI) */}
      {selectedPoi && (
        <div className="absolute bottom-6 left-4 right-4 sm:left-6 sm:right-auto sm:w-96 z-30 animate-in slide-in-from-bottom-4 duration-200">
          <div className="bg-white rounded-3xl border border-[#e9e9ec] p-5 shadow-2xl relative">
            <button
              onClick={() => setSelectedPoi(null)}
              className="absolute top-4 right-4 size-7 rounded-full bg-[#fafafa] border border-[#e9e9ec] flex items-center justify-center text-[#6b6b70] hover:text-[#111113]"
            >
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">
                {POI_CATEGORIES[selectedPoi.category]?.icon || '🏢'}
              </span>
              <span className="text-[11px] font-bold text-[#6b6b70] uppercase tracking-wider">
                {POI_CATEGORIES[selectedPoi.category]?.label || 'Объект'}
              </span>
            </div>

            <h3 className="text-lg font-bold text-[#111113] mb-3">
              {selectedPoi.name}
            </h3>

            {/* Заглушка 360 панорамы */}
            <div className="mb-4 p-2.5 rounded-2xl bg-[#fafafa] border border-dashed border-[#e2e8f0] flex items-center justify-between">
              <span className="text-xs font-semibold text-[#6b6b70] flex items-center gap-1.5">
                <span className="text-xs">📸</span> 360° панорама стенда
              </span>
              <span className="text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                в разработке
              </span>
            </div>

            {/* Кнопки установки точек А и Б */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleSetPointA(selectedPoi)}
                className="h-10 rounded-full border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs flex items-center justify-center gap-1.5 transition"
              >
                <span>Отсюда (А)</span>
              </button>

              <button
                onClick={() => handleSetPointB(selectedPoi)}
                className="h-10 rounded-full bg-[#e30613] text-white hover:bg-[#c40511] font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-sm shadow-[#e30613]/25"
              >
                <span>Сюда (Б)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
