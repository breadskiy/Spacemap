import { useState, useEffect, useRef, useCallback } from 'react'
import type { SpaceObject } from '../types/space'
import type { PlanData, PlanPoi, PlanCorner, PlanPanorama } from '../types/plan'
import { PanoramaViewerModal } from './PanoramaViewerModal'
import { apiGetPublicSpace, apiGetSpacePlan } from '../utils/api'
import { findNavRoute, tracePartialPath, getPointAlongPath, type PathResult } from '../utils/pathfinding'

interface ViewerViewProps {
  space: SpaceObject
  onBack: () => void
}

function hexToRgba(hex: string, alpha: number): string {
  let c = hex.replace('#', '')
  if (c.length === 3) c = c.split('').map(x => x + x).join('')
  const num = parseInt(c, 16)
  if (isNaN(num)) return `rgba(59, 130, 246, ${alpha})`
  const r = (num >> 16) & 255
  const g = (num >> 8) & 255
  const b = num & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// Категории меток
const POI_CATEGORIES: Record<string, { label: string; color: string; icon: string }> = {
  stand: { label: 'Стенд / Экспозиция', color: '#e30613', icon: '🏢' },
  expo: { label: 'Выставка / Арт', color: '#ec4899', icon: '🖼️' },
  cafe: { label: 'Кафе / Кофе', color: '#f59e0b', icon: '☕' },
  food: { label: 'Фудкорт', color: '#f97316', icon: '🍔' },
  shop: { label: 'Магазин / Мерч', color: '#3b82f6', icon: '🛍️' },
  stage: { label: 'Сцена / Зал', color: '#8b5cf6', icon: '🎤' },
  info: { label: 'Инфостойка', color: '#06b6d4', icon: 'ℹ️' },
  exit: { label: 'Вход / Выход', color: '#10b981', icon: '🚪' },
  wc: { label: 'Туалет (WC)', color: '#64748b', icon: '🚻' },
  atm: { label: 'Банкомат', color: '#0d9488', icon: '💳' },
  firstaid: { label: 'Медпункт', color: '#e11d48', icon: '🏥' }
}

export function ViewerView({ space, onBack }: ViewerViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Данные плана
  const [plan, setPlan] = useState<PlanData | null>(null)
  const [activeFloorId, setActiveFloorId] = useState<string>('')
  
  // Выбранная метка для просмотра карточки
  const [selectedPoi, setSelectedPoi] = useState<PlanPoi | null>(null)

  // Пошаговое построение маршрута пользователем:
  // 'idle' — обычный режим
  // 'pickA' — пользователь кликает на карте, чтобы поставить точку А
  // 'pickB' — пользователь кликает на карте, чтобы поставить точку Б
  const [routingStep, setRoutingStep] = useState<'idle' | 'pickA' | 'pickB'>('idle')
  const routingStepRef = useRef(routingStep)
  routingStepRef.current = routingStep

  // Установленные точки А и Б
  const [pointA, setPointA] = useState<{ x: number; y: number; name: string } | null>(null)
  const [pointB, setPointB] = useState<{ x: number; y: number; name: string } | null>(null)

  // Навигация и построение маршрута
  const [navRoute, setNavRoute] = useState<PathResult | null>(null)
  const [isNavigating, setIsNavigating] = useState(false)
  const [routeError, setRouteError] = useState<string | null>(null)

  // Анимационные ссылки
  const routeProgressRef = useRef(1)
  const dashOffsetRef = useRef(0)
  const walkerProgressRef = useRef(0)
  const animFrameRef = useRef<number | null>(null)
  const navRouteRef = useRef<PathResult | null>(null)
  const isNavigatingRef = useRef(false)
  navRouteRef.current = navRoute
  isNavigatingRef.current = isNavigating

  // Преобразования камеры
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 200, y: 350 })
  const [zoom, setZoom] = useState<number>(1.0)
  const [hoveredPoiId, setHoveredPoiId] = useState<string | null>(null)
  const [hoveredPanoId, setHoveredPanoId] = useState<string | null>(null)
  const [selectedPanorama, setSelectedPanorama] = useState<PlanPanorama | null>(null)

  const panRef = useRef(pan)
  const zoomRef = useRef(zoom)
  const minZoomRef = useRef(0.35)
  panRef.current = pan
  zoomRef.current = zoom

  // Загрузка плана из базы данных PostgreSQL с кэшем localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('spacemap_plan_' + space.id)
      if (raw) {
        const parsed: PlanData = JSON.parse(raw)
        if (parsed.floors && parsed.floors.length > 0) {
          setPlan(parsed)
          setActiveFloorId(parsed.floors[0].id)
        }
      }
    } catch (e) {
      console.warn('Could not read cached plan data', e)
    }

    // Загружаем с бэкенда
    const loadFromServer = async () => {
      try {
        const pub = await apiGetPublicSpace(space.id)
        if (pub?.plan?.floors && pub.plan.floors.length > 0) {
          setPlan(pub.plan)
          setActiveFloorId(pub.plan.floors[0].id)
          return
        }
      } catch (_) {
        try {
          const direct = await apiGetSpacePlan(space.id)
          if (direct?.floors && direct.floors.length > 0) {
            setPlan(direct)
            setActiveFloorId(direct.floors[0].id)
            return
          }
        } catch (_) {}
      }

      setPlan(prev => prev || {
        floors: [{
          id: 'floor-1',
          name: '1 этаж',
          level: 1,
          corners: [],
          walls: [],
          rooms: [],
          pois: [],
          panoramas: []
        }]
      })
      setActiveFloorId('floor-1')
    }

    loadFromServer()
  }, [space.id])

  const currentFloor = plan?.floors.find(f => f.id === activeFloorId) || plan?.floors[0]

  // Автоматическое центрирование и приближение так, чтобы весь план был отлично виден
  const fitToPlan = useCallback(() => {
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

    const w = maxX - minX || 500
    const h = maxY - minY || 400
    const paddingX = 100
    const paddingY = 90
    const availableW = Math.max(200, container.clientWidth - paddingX * 2)
    const availableH = Math.max(200, container.clientHeight - paddingY * 2)

    const scale = Math.min(availableW / w, availableH / h)
    // Оптимальный зум по дефолту, чтобы весь план здания был крупно и четко виден
    const fitZoom = Math.max(0.35, Math.min(scale, 2.5))
    // Ограничение на отдаление: не даем отдалиться мельче, чем комфортный обзор здания
    const minZoom = Math.max(0.25, fitZoom * 0.65)
    minZoomRef.current = minZoom

    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2

    setZoom(fitZoom)
    setPan({
      x: container.clientWidth / 2 - centerX * fitZoom,
      y: container.clientHeight / 2 + centerY * fitZoom
    })
  }, [currentFloor])

  useEffect(() => {
    fitToPlan()
    const timer = setTimeout(() => {
      fitToPlan()
    }, 60)
    return () => clearTimeout(timer)
  }, [fitToPlan])

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

  // Отрисовка холста (Стильный просмотр: чистый фон, БЕЗ ЗАКРАШЕННЫХ ОБЛАСТЕЙ)
  const draw = () => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const width = container.clientWidth
    const height = container.clientHeight

    // Полный сброс трансформации и очистка физического буфера
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Масштабируем контекст под HiDPI / Retina
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // 1. Стильный чистый фон
    ctx.save()
    ctx.fillStyle = '#f8fafc'
    ctx.fillRect(0, 0, width, height)

    // Тонкие едва заметные архитектурные точки (стиль чертежа / карты пространства)
    const dotSpacing = 28 * zoomRef.current
    if (dotSpacing >= 14) {
      ctx.fillStyle = '#e2e8f0'
      const startX = panRef.current.x % dotSpacing
      const startY = panRef.current.y % dotSpacing
      for (let x = startX; x < width; x += dotSpacing) {
        for (let y = startY; y < height; y += dotSpacing) {
          ctx.beginPath()
          ctx.arc(x, y, 1, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }
    ctx.restore()

    ctx.save()
    ctx.translate(panRef.current.x, panRef.current.y)
    ctx.scale(zoomRef.current, zoomRef.current)

    if (currentFloor) {
      const cornerMap = new Map(currentFloor.corners.map(c => [c.id, c]))

      // 2. ЗОНЫ И НАЗВАНИЯ КОМНАТ
      if (currentFloor.rooms && currentFloor.rooms.length > 0) {
        currentFloor.rooms.forEach(room => {
          const pts = room.corners.map(cid => cornerMap.get(cid)).filter(Boolean) as PlanCorner[]
          if (pts.length < 3) return

          const baseColor = room.color || '#3b82f6'

          // Отрисовка полупрозрачной цветной зоны комнаты
          ctx.save()
          ctx.beginPath()
          const p0 = worldToCanvas(pts[0].x, pts[0].y)
          ctx.moveTo(p0.x, p0.y)
          for (let i = 1; i < pts.length; i++) {
            const pi = worldToCanvas(pts[i].x, pts[i].y)
            ctx.lineTo(pi.x, pi.y)
          }
          ctx.closePath()

          ctx.fillStyle = hexToRgba(baseColor, 0.14)
          ctx.fill()

          ctx.strokeStyle = hexToRgba(baseColor, 0.5)
          ctx.lineWidth = 1.5 / zoomRef.current
          ctx.setLineDash([5, 5])
          ctx.stroke()
          ctx.setLineDash([])
          ctx.restore()

          // Название комнаты в центре зоны
          let cx = 0, cy = 0
          pts.forEach(p => { cx += p.x; cy += p.y })
          cx /= pts.length
          cy /= pts.length

          const centerPos = worldToCanvas(cx, cy)
          ctx.save()
          const fontSize = Math.max(10, 11 / zoomRef.current)
          ctx.font = `bold ${fontSize}px sans-serif`
          const text = room.name || 'Зона'
          const textW = ctx.measureText(text).width
          const badgeH = 20 / zoomRef.current
          const badgeW = textW + (16 / zoomRef.current)

          ctx.shadowColor = 'rgba(15, 23, 42, 0.08)'
          ctx.shadowBlur = 4 / zoomRef.current
          ctx.shadowOffsetY = 1 / zoomRef.current

          ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
          ctx.strokeStyle = hexToRgba(baseColor, 0.6)
          ctx.lineWidth = 1.2 / zoomRef.current
          ctx.beginPath()
          ctx.roundRect(centerPos.x - badgeW / 2, centerPos.y - badgeH / 2, badgeW, badgeH, 6 / zoomRef.current)
          ctx.fill()
          ctx.stroke()

          ctx.fillStyle = '#0f172a'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(text, centerPos.x, centerPos.y)
          ctx.restore()
        })
      }

      // 3. Архитектурные стены (глубокий стильный графит #0f172a)
      // Внешняя мягкая тень стен для объема
      ctx.save()
      ctx.strokeStyle = '#0f172a'
      ctx.lineWidth = 5.5 / zoomRef.current
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

      // 4. ВСЕ ТОЧКИ И МЕТКИ (POI) С НАЗВАНИЯМИ И ИКОНКАМИ
      currentFloor.pois.forEach(poi => {
        const pos = worldToCanvas(poi.x, poi.y)
        const isHovered = hoveredPoiId === poi.id
        const isSelected = selectedPoi?.id === poi.id
        const cat = POI_CATEGORIES[poi.category] || POI_CATEGORIES.stand

        ctx.save()

        // Тень маркера
        ctx.shadowColor = 'rgba(15, 23, 42, 0.12)'
        ctx.shadowBlur = (isHovered || isSelected ? 10 : 5) / zoomRef.current
        ctx.shadowOffsetY = 2 / zoomRef.current

        // Круглый значок точки
        const r = (isHovered || isSelected ? 12 : 9.5) / zoomRef.current
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

        // Плашка с названием POI показывается ТОЛЬКО при наведении или выборе
        if (isHovered || isSelected) {
          ctx.save()
          const fontSize = Math.max(10, 11 / zoomRef.current)
          ctx.font = `600 ${fontSize}px sans-serif`
          const text = `${cat.icon} ${poi.name}`
          const textW = ctx.measureText(text).width
          const badgeH = 19 / zoomRef.current
          const badgeY = pos.y + (17 / zoomRef.current)
          const badgeW = textW + (14 / zoomRef.current)

          // Фон плашки
          ctx.shadowColor = 'rgba(15, 23, 42, 0.08)'
          ctx.shadowBlur = 6 / zoomRef.current
          ctx.shadowOffsetY = 1 / zoomRef.current

          ctx.fillStyle = isSelected ? '#111113' : '#ffffff'
          ctx.strokeStyle = isSelected ? '#111113' : '#e2e8f0'
          ctx.lineWidth = 1 / zoomRef.current
          ctx.beginPath()
          ctx.roundRect(pos.x - badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH, 6 / zoomRef.current)
          ctx.fill()
          ctx.stroke()

          // Текст названия
          ctx.fillStyle = isSelected ? '#ffffff' : '#0f172a'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(text, pos.x, badgeY)
          ctx.restore()
        }
      })

      // 4.5. ПАНОРАМЫ 360° (КАМЕРЫ И ИНТЕРАКТИВНЫЙ ПРОСМОТР)
      if (currentFloor.panoramas && currentFloor.panoramas.length > 0) {
        currentFloor.panoramas.forEach(pano => {
          const pos = worldToCanvas(pano.x, pano.y)
          const isHovered = hoveredPanoId === pano.id
          const radius = (isHovered ? 14 : 11.5) / zoomRef.current

          ctx.save()

          // 1. Внешнее свечение / пульсирующее кольцо радара 360°
          ctx.beginPath()
          ctx.arc(pos.x, pos.y, (isHovered ? 23 : 17.5) / zoomRef.current, 0, Math.PI * 2)
          ctx.fillStyle = isHovered ? 'rgba(99, 102, 241, 0.32)' : 'rgba(99, 102, 241, 0.16)'
          ctx.fill()
          ctx.strokeStyle = isHovered ? 'rgba(99, 102, 241, 0.75)' : 'rgba(99, 102, 241, 0.35)'
          ctx.lineWidth = 1.5 / zoomRef.current
          ctx.stroke()

          // 2. Тень маркера
          ctx.beginPath()
          ctx.arc(pos.x, pos.y + 2 / zoomRef.current, radius + 1 / zoomRef.current, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(15, 23, 42, 0.22)'
          ctx.fill()

          // 3. Основной диск камеры (насыщенный индиго)
          ctx.beginPath()
          ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2)
          ctx.fillStyle = isHovered ? '#4338ca' : '#4f46e5'
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = 2.5 / zoomRef.current
          ctx.fill()
          ctx.stroke()

          // 4. Линза объектива
          const lensR = radius * 0.46
          ctx.beginPath()
          ctx.arc(pos.x, pos.y, lensR, 0, Math.PI * 2)
          ctx.fillStyle = '#1e1b4b'
          ctx.strokeStyle = '#c7d2fe'
          ctx.lineWidth = 1.2 / zoomRef.current
          ctx.fill()
          ctx.stroke()

          // Блик на линзе
          ctx.beginPath()
          ctx.arc(pos.x - lensR * 0.35, pos.y - lensR * 0.35, lensR * 0.28, 0, Math.PI * 2)
          ctx.fillStyle = '#ffffff'
          ctx.fill()

          // 5. Всегда видимая плашка с обозначением 360° под маркером
          ctx.save()
          const fontSize = Math.max(9, (isHovered ? 11 : 9.5) / zoomRef.current)
          ctx.font = `700 ${fontSize}px sans-serif`
          const labelText = isHovered ? `📸 360°: ${pano.name || 'Панорама'}` : '📸 360°'
          const textW = ctx.measureText(labelText).width
          const badgeH = (isHovered ? 21 : 16) / zoomRef.current
          const badgeY = pos.y + ((isHovered ? 23 : 18.5) / zoomRef.current)
          const badgeW = textW + ((isHovered ? 14 : 10) / zoomRef.current)

          ctx.shadowColor = 'rgba(15, 23, 42, 0.12)'
          ctx.shadowBlur = 4 / zoomRef.current
          ctx.shadowOffsetY = 1 / zoomRef.current

          ctx.fillStyle = isHovered ? '#1e1b4b' : '#ffffff'
          ctx.strokeStyle = isHovered ? '#6366f1' : '#c7d2fe'
          ctx.lineWidth = 1 / zoomRef.current
          ctx.beginPath()
          ctx.roundRect(pos.x - badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH, 5 / zoomRef.current)
          ctx.fill()
          ctx.stroke()

          ctx.fillStyle = isHovered ? '#ffffff' : '#4338ca'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(labelText, pos.x, badgeY)
          ctx.restore()

          ctx.restore()
        })
      }

      // 4.9. ЛИНИЯ МАРШРУТА С ОБХОДОМ СТЕН И ОТСТУПОМ
      const activeRoute = navRouteRef.current
      if (activeRoute && activeRoute.path.length >= 2) {
        const path = activeRoute.path
        const progress = isNavigatingRef.current ? routeProgressRef.current : 1

        ctx.save()
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'

        // 1. Внешнее мягкое неоновое свечение (halo)
        ctx.strokeStyle = 'rgba(227, 6, 19, 0.22)'
        ctx.lineWidth = 14 / zoomRef.current
        ctx.beginPath()
        tracePartialPath(ctx, path, progress, worldToCanvas)
        ctx.stroke()

        // 2. Основная яркая линия маршрута (фирменный TTK красный)
        ctx.strokeStyle = '#e30613'
        ctx.lineWidth = 5.5 / zoomRef.current
        ctx.beginPath()
        tracePartialPath(ctx, path, progress, worldToCanvas)
        ctx.stroke()

        // 3. Бегущие белые пунктирные штрихи направления движения
        if (progress > 0.05) {
          ctx.save()
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = 2.4 / zoomRef.current
          ctx.setLineDash([7 / zoomRef.current, 7 / zoomRef.current])
          ctx.lineDashOffset = -dashOffsetRef.current
          ctx.beginPath()
          tracePartialPath(ctx, path, progress, worldToCanvas)
          ctx.stroke()
          ctx.restore()
        }

        // 4. Узловые маркеры поворотов обхода стен
        if (progress >= 0.95 && path.length > 2) {
          for (let i = 1; i < path.length - 1; i++) {
            const pt = worldToCanvas(path[i].x, path[i].y)
            ctx.beginPath()
            ctx.arc(pt.x, pt.y, 3.5 / zoomRef.current, 0, Math.PI * 2)
            ctx.fillStyle = '#ffffff'
            ctx.fill()
            ctx.strokeStyle = '#e30613'
            ctx.lineWidth = 1.5 / zoomRef.current
            ctx.stroke()
          }
        }

        // 5. Анимированный идущий маркер (пульсирующая точка навигации)
        if (isNavigatingRef.current && progress >= 0.95) {
          const walker = getPointAlongPath(path, walkerProgressRef.current)
          if (walker) {
            const wPos = worldToCanvas(walker.x, walker.y)
            ctx.save()
            // Свечение пульсации
            ctx.beginPath()
            ctx.arc(wPos.x, wPos.y, 11 / zoomRef.current, 0, Math.PI * 2)
            ctx.fillStyle = 'rgba(227, 6, 19, 0.35)'
            ctx.fill()

            // Яркий белый диск с красным ободком
            ctx.beginPath()
            ctx.arc(wPos.x, wPos.y, 6.5 / zoomRef.current, 0, Math.PI * 2)
            ctx.fillStyle = '#ffffff'
            ctx.fill()
            ctx.strokeStyle = '#e30613'
            ctx.lineWidth = 2.5 / zoomRef.current
            ctx.stroke()

            // Центральная точка
            ctx.beginPath()
            ctx.arc(wPos.x, wPos.y, 2.5 / zoomRef.current, 0, Math.PI * 2)
            ctx.fillStyle = '#e30613'
            ctx.fill()
            ctx.restore()
          }
        }

        ctx.restore()
      }

      // 5. Маркер точки А (зеленый круг со стайлингом) — БЕЗ ЛИНИЙ И БЕЗ ТЕКСТОВ НАД НИМИ
      if (pointA) {
        const posA = worldToCanvas(pointA.x, pointA.y)
        ctx.save()
        // Внешнее пульсирующее кольцо
        ctx.beginPath()
        ctx.arc(posA.x, posA.y, 18 / zoomRef.current, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(16, 185, 129, 0.18)'
        ctx.fill()

        // Основной круг
        ctx.beginPath()
        ctx.arc(posA.x, posA.y, 12 / zoomRef.current, 0, Math.PI * 2)
        ctx.fillStyle = '#10b981'
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 2.5 / zoomRef.current
        ctx.fill()
        ctx.stroke()

        // Буква А внутри
        ctx.fillStyle = '#ffffff'
        ctx.font = `bold ${Math.max(10, 11 / zoomRef.current)}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('A', posA.x, posA.y)
        ctx.restore()
      }

      // 6. Маркер точки Б (красный круг ТТК) — БЕЗ ЛИНИЙ И БЕЗ ТЕКСТОВ НАД НИМИ
      if (pointB) {
        const posB = worldToCanvas(pointB.x, pointB.y)
        ctx.save()
        // Внешнее кольцо
        ctx.beginPath()
        ctx.arc(posB.x, posB.y, 18 / zoomRef.current, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(227, 6, 19, 0.18)'
        ctx.fill()

        // Основной круг
        ctx.beginPath()
        ctx.arc(posB.x, posB.y, 12 / zoomRef.current, 0, Math.PI * 2)
        ctx.fillStyle = '#e30613'
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 2.5 / zoomRef.current
        ctx.fill()
        ctx.stroke()

        // Буква Б внутри
        ctx.fillStyle = '#ffffff'
        ctx.font = `bold ${Math.max(10, 11 / zoomRef.current)}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('B', posB.x, posB.y)

        // Бейдж расстояния и времени над точкой B при построенном маршруте
        if (activeRoute) {
          const fontSize = Math.max(9, 10 / zoomRef.current)
          ctx.font = `bold ${fontSize}px sans-serif`
          const label = `🏁 ${activeRoute.distanceMeters} м (~${activeRoute.estimatedMinutes} мин)`
          const textW = ctx.measureText(label).width
          const badgeH = 18 / zoomRef.current
          const badgeY = posB.y - (20 / zoomRef.current)
          const badgeW = textW + (14 / zoomRef.current)

          ctx.shadowColor = 'rgba(15, 23, 42, 0.16)'
          ctx.shadowBlur = 4 / zoomRef.current
          ctx.shadowOffsetY = 1 / zoomRef.current

          ctx.fillStyle = '#0f172a'
          ctx.beginPath()
          ctx.roundRect(posB.x - badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH, 5 / zoomRef.current)
          ctx.fill()

          ctx.fillStyle = '#ffffff'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(label, posB.x, badgeY)
        }
        ctx.restore()
      }
    }

    ctx.restore()
  }

  // Ресайз холста с поддержкой HiDPI / Retina
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current
      const container = containerRef.current
      if (!canvas || !container) return
      const dpr = window.devicePixelRatio || 1
      const width = container.clientWidth
      const height = container.clientHeight
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      draw()
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    const observer = new ResizeObserver(handleResize)
    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => {
      window.removeEventListener('resize', handleResize)
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    draw()
  }, [pan, zoom, activeFloorId, selectedPoi, pointA, pointB, hoveredPoiId, hoveredPanoId, navRoute, isNavigating])

  // Анимационный цикл навигации по маршруту
  useEffect(() => {
    if (!isNavigating || !navRoute) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
        animFrameRef.current = null
      }
      return
    }

    let lastTime = performance.now()
    let progress = 0
    routeProgressRef.current = 0

    const animate = (now: number) => {
      const dt = Math.min(0.1, (now - lastTime) / 1000)
      lastTime = now

      // Линия маршрута плавно вычерчивается от старта к финишу (за ~0.7 сек)
      if (progress < 1) {
        progress = Math.min(1, progress + dt * 1.5)
        routeProgressRef.current = progress
      }

      // Бегущие пунктирные штрихи
      dashOffsetRef.current = (dashOffsetRef.current + dt * 26) % 30

      // Перемещение маркера пешехода по маршруту (цикл)
      if (progress >= 1) {
        walkerProgressRef.current = (walkerProgressRef.current + dt * 0.2) % 1
      }

      draw()
      animFrameRef.current = requestAnimationFrame(animate)
    }

    animFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
        animFrameRef.current = null
      }
    }
  }, [isNavigating, navRoute])

  // Интерактивные клики и перемещение
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

      // ПОСТРОЕНИЕ МАРШРУТА ПОЛЬЗОВАТЕЛЕМ (КЛИК НА КАРТЕ):
      if (routingStepRef.current === 'pickA') {
        const clickedPoi = currentFloor?.pois.find(p => Math.hypot(p.x - world.x, p.y - world.y) <= 22 / zoomRef.current)
        const nameA = clickedPoi ? clickedPoi.name : 'Точка А (Старт)'
        setPointA({ x: clickedPoi ? clickedPoi.x : Math.round(world.x), y: clickedPoi ? clickedPoi.y : Math.round(world.y), name: nameA })
        setNavRoute(null)
        setIsNavigating(false)
        setRouteError(null)
        setRoutingStep('pickB')
        return
      }

      if (routingStepRef.current === 'pickB') {
        const clickedPoi = currentFloor?.pois.find(p => Math.hypot(p.x - world.x, p.y - world.y) <= 22 / zoomRef.current)
        const nameB = clickedPoi ? clickedPoi.name : 'Точка Б (Финиш)'
        setPointB({ x: clickedPoi ? clickedPoi.x : Math.round(world.x), y: clickedPoi ? clickedPoi.y : Math.round(world.y), name: nameB })
        setNavRoute(null)
        setIsNavigating(false)
        setRouteError(null)
        setRoutingStep('idle')
        return
      }

      // В обычном режиме: клик по панораме или метке POI
      if (currentFloor) {
        // Клик по панораме 360° открывает интерактивный просмотр
        const clickedPano = currentFloor.panoramas?.find(p => Math.hypot(p.x - world.x, p.y - world.y) <= 22 / zoomRef.current)
        if (clickedPano) {
          setSelectedPanorama(clickedPano)
          return
        }

        const clickedPoi = currentFloor.pois.find(p => Math.hypot(p.x - world.x, p.y - world.y) <= 20 / zoomRef.current)
        if (clickedPoi) {
          setSelectedPoi(clickedPoi)
          return
        }
      }

      // Свободное панорамирование
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

      // Подсветка меток и панорам при наведении
      if (currentFloor) {
        const world = screenToWorld(sx, sy)
        const hovered = currentFloor.pois.find(p => Math.hypot(p.x - world.x, p.y - world.y) <= 20 / zoomRef.current)
        setHoveredPoiId(hovered ? hovered.id : null)

        const hoveredPano = currentFloor.panoramas?.find(p => Math.hypot(p.x - world.x, p.y - world.y) <= 22 / zoomRef.current)
        setHoveredPanoId(hoveredPano ? hoveredPano.id : null)

        canvas.style.cursor = (hovered || hoveredPano) ? 'pointer' : 'default'
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
      const newZoom = Math.min(Math.max(minZoomRef.current, zoomRef.current * factor), 4.0)

      setZoom(newZoom)
      setPan({
        x: sx - worldBefore.x * newZoom,
        y: sy + worldBefore.y * newZoom
      })
    }

    // Touch жесты для телефонов и планшетов
    let isTouchTap = false
    let touchStartX = 0
    let touchStartY = 0

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault()
      if (e.touches.length === 1) {
        const t = e.touches[0]
        const rect = canvas.getBoundingClientRect()
        const sx = t.clientX - rect.left
        const sy = t.clientY - rect.top
        touchStartX = sx
        touchStartY = sy
        isTouchTap = true

        isPanning = true
        panStart = { x: sx - panRef.current.x, y: sy - panRef.current.y }
      } else if (e.touches.length === 2) {
        isTouchTap = false
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
      e.preventDefault()
      if (e.touches.length === 1 && isPanning) {
        const t = e.touches[0]
        const rect = canvas.getBoundingClientRect()
        const sx = t.clientX - rect.left
        const sy = t.clientY - rect.top
        if (Math.hypot(sx - touchStartX, sy - touchStartY) > 8) {
          isTouchTap = false
        }
        setPan({
          x: sx - panStart.x,
          y: sy - panStart.y
        })
      } else if (e.touches.length === 2) {
        isTouchTap = false
        const t1 = e.touches[0]
        const t2 = e.touches[1]
        const rect = canvas.getBoundingClientRect()
        const midX = (t1.clientX + t2.clientX) / 2 - rect.left
        const midY = (t1.clientY + t2.clientY) / 2 - rect.top

        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
        if (touchStartDist > 0) {
          const factor = dist / touchStartDist
          const worldBefore = screenToWorld(midX, midY)
          const newZoom = Math.min(Math.max(minZoomRef.current, zoomRef.current * factor), 4.0)
          setZoom(newZoom)
          setPan({
            x: midX - worldBefore.x * newZoom,
            y: midY + worldBefore.y * newZoom
          })
        }
        touchStartDist = dist
      }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (isTouchTap && e.changedTouches.length === 1) {
        const t = e.changedTouches[0]
        const rect = canvas.getBoundingClientRect()
        const sx = t.clientX - rect.left
        const sy = t.clientY - rect.top
        const world = screenToWorld(sx, sy)

        // Построение маршрута тачем
        if (routingStepRef.current === 'pickA') {
          const clickedPoi = currentFloor?.pois.find(p => Math.hypot(p.x - world.x, p.y - world.y) <= 26 / zoomRef.current)
          const nameA = clickedPoi ? clickedPoi.name : 'Точка А (Старт)'
          setPointA({ x: clickedPoi ? clickedPoi.x : Math.round(world.x), y: clickedPoi ? clickedPoi.y : Math.round(world.y), name: nameA })
          setNavRoute(null)
          setIsNavigating(false)
          setRouteError(null)
          setRoutingStep('pickB')
          isPanning = false
          touchStartDist = 0
          return
        }

        if (routingStepRef.current === 'pickB') {
          const clickedPoi = currentFloor?.pois.find(p => Math.hypot(p.x - world.x, p.y - world.y) <= 26 / zoomRef.current)
          const nameB = clickedPoi ? clickedPoi.name : 'Точка Б (Финиш)'
          setPointB({ x: clickedPoi ? clickedPoi.x : Math.round(world.x), y: clickedPoi ? clickedPoi.y : Math.round(world.y), name: nameB })
          setNavRoute(null)
          setIsNavigating(false)
          setRouteError(null)
          setRoutingStep('idle')
          isPanning = false
          touchStartDist = 0
          return
        }

        if (currentFloor) {
          // Клик по панораме 360° на мобилке
          const clickedPano = currentFloor.panoramas?.find(p => Math.hypot(p.x - world.x, p.y - world.y) <= 26 / zoomRef.current)
          if (clickedPano) {
            setSelectedPanorama(clickedPano)
            isPanning = false
            touchStartDist = 0
            return
          }

          // Клик по POI на мобилке
          const clickedPoi = currentFloor.pois.find(p => Math.hypot(p.x - world.x, p.y - world.y) <= 26 / zoomRef.current)
          if (clickedPoi) {
            setSelectedPoi(clickedPoi)
            isPanning = false
            touchStartDist = 0
            return
          }
        }
      }

      isPanning = false
      touchStartDist = 0
      isTouchTap = false
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

  // Начать интерактивную установку маршрута
  const startRoutePicking = () => {
    setSelectedPoi(null)
    setNavRoute(null)
    setIsNavigating(false)
    setRouteError(null)
    setPointA(null)
    setPointB(null)
    setRoutingStep('pickA')
  }

  // Запуск построения маршрута с обходом препятствий
  const handleStartRoute = () => {
    if (!pointA || !pointB || !currentFloor) return
    setRouteError(null)

    // Запускаем поиск маршрута с безопасным отступом от стен (22 единицы)
    const result = findNavRoute(pointA, pointB, currentFloor.walls || [], currentFloor.corners || [], 22)

    if (!result || !result.success || result.path.length < 2) {
      setRouteError('Маршрут заблокирован стенами. Нет безопасного прохода между выбранными точками.')
      setNavRoute(null)
      setIsNavigating(false)
      return
    }

    setNavRoute(result)
    routeProgressRef.current = 0
    dashOffsetRef.current = 0
    walkerProgressRef.current = 0
    setIsNavigating(true)
  }

  // Остановка навигации
  const handleStopRoute = () => {
    setIsNavigating(false)
  }

  // Сброс маршрута
  const handleResetRoute = () => {
    setPointA(null)
    setPointB(null)
    setNavRoute(null)
    setIsNavigating(false)
    setRouteError(null)
    setRoutingStep('idle')
  }

  return (
    <div className="relative flex flex-col h-screen h-[100dvh] w-screen overflow-hidden bg-[#f8fafc] text-[#111113] select-none touch-none">
      {/* 1. Стильная верхняя шапка просмотра */}
      <header className="h-14 sm:h-16 shrink-0 bg-white/95 backdrop-blur-md border-b border-[#e9e9ec] px-3 sm:px-6 flex items-center justify-between z-30 shadow-xs">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#e9e9ec] bg-white text-xs font-semibold text-[#111113] hover:border-[#e30613] hover:text-[#e30613] transition shadow-2xs shrink-0 active:scale-95"
          >
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="hidden xs:inline">Назад</span>
          </button>

          <div className="h-4 w-px bg-[#e9e9ec] shrink-0" />

          <div className="min-w-0 truncate">
            <h1 className="text-xs sm:text-base font-extrabold text-[#111113] tracking-tight truncate max-w-[140px] xs:max-w-[200px] sm:max-w-md">
              {space.title}
            </h1>
            <p className="text-[11px] text-[#6b6b70] hidden sm:block">
              Интерактивная карта навигации посетителей
            </p>
          </div>
        </div>

        {/* Переключатель этажей */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {plan && plan.floors.length > 1 && (
            <div className="flex items-center gap-1 bg-[#f4f4f6] p-0.5 sm:p-1 rounded-full border border-[#e9e9ec] overflow-x-auto max-w-[140px] sm:max-w-none">
              {plan.floors.map(floor => (
                <button
                  key={floor.id}
                  onClick={() => {
                    setActiveFloorId(floor.id)
                    handleResetRoute()
                  }}
                  className={`px-2.5 sm:px-3 py-1 text-xs font-bold rounded-full transition shrink-0 ${
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
        </div>
      </header>

      {/* 2. ПАНЕЛЬ МАРШРУТА: ПОЛЬЗОВАТЕЛЬ САМ СТАВИТ ТОЧКУ А И ТОЧКУ Б */}
      <div className="absolute top-16 sm:top-20 left-3 right-3 sm:left-1/2 sm:-translate-x-1/2 sm:max-w-md z-20 pointer-events-auto">
        {/* А. Если режим выбора точки А */}
        {routingStep === 'pickA' && (
          <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-emerald-300 p-3.5 shadow-xl flex items-center justify-between gap-3 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2.5">
              <span className="size-6 rounded-full bg-emerald-500 text-white font-black text-xs flex items-center justify-center shrink-0 animate-pulse">
                A
              </span>
              <div>
                <div className="text-xs font-bold text-[#111113]">Выберите точку А (Старт)</div>
                <div className="text-[11px] text-[#6b6b70]">Кликните в любое место на плане или на метку</div>
              </div>
            </div>
            <button
              onClick={() => setRoutingStep('idle')}
              className="text-xs text-[#6b6b70] hover:text-[#111113] px-2 py-1 rounded-lg hover:bg-[#fafafa]"
            >
              Отмена
            </button>
          </div>
        )}

        {/* Б. Если режим выбора точки Б */}
        {routingStep === 'pickB' && (
          <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-red-300 p-3.5 shadow-xl flex items-center justify-between gap-3 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2.5">
              <span className="size-6 rounded-full bg-[#e30613] text-white font-black text-xs flex items-center justify-center shrink-0 animate-pulse">
                B
              </span>
              <div>
                <div className="text-xs font-bold text-[#111113]">Теперь выберите точку Б (Финиш)</div>
                <div className="text-[11px] text-[#6b6b70]">Кликните в нужное место на плане здания</div>
              </div>
            </div>
            <button
              onClick={() => setRoutingStep('idle')}
              className="text-xs text-[#6b6b70] hover:text-[#111113] px-2 py-1 rounded-lg hover:bg-[#fafafa]"
            >
              Отмена
            </button>
          </div>
        )}

        {/* В. Обычное состояние: кнопка «Построить маршрут» или статус уже выбранных точек */}
        {routingStep === 'idle' && (
          (pointA || pointB) ? (
            <div className="flex flex-col gap-2">
              <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-[#e9e9ec] p-2.5 sm:p-3 shadow-xl flex items-center justify-between gap-2.5 sm:gap-3">
                <div className="flex items-center gap-1.5 sm:gap-2 overflow-hidden text-xs flex-1 min-w-0">
                  {/* Точка А */}
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200 truncate">
                    <span className="size-4 rounded-full bg-emerald-500 text-white font-black text-[9px] flex items-center justify-center shrink-0">
                      A
                    </span>
                    <span className="font-semibold text-emerald-800 truncate max-w-[85px] sm:max-w-[120px]">
                      {pointA ? pointA.name : 'Не выбрана'}
                    </span>
                  </div>

                  <span className="text-[#9e9ea4] shrink-0">➔</span>

                  {/* Точка Б */}
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-red-50 border border-red-200 truncate">
                    <span className="size-4 rounded-full bg-[#e30613] text-white font-black text-[9px] flex items-center justify-center shrink-0">
                      B
                    </span>
                    <span className="font-semibold text-red-800 truncate max-w-[85px] sm:max-w-[120px]">
                      {pointB ? pointB.name : 'Не выбрана'}
                    </span>
                  </div>
                </div>

                {/* Действия: кнопка СТАРТ при двух точках либо выбор недостающей точки */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {pointA && pointB && (
                    !isNavigating ? (
                      <button
                        onClick={handleStartRoute}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white font-black text-xs shadow-md shadow-emerald-500/25 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                        title="Построить маршрут с безопасным отступом от стен"
                      >
                        <svg className="size-3.5 fill-current" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                        <span>Старт</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        {navRoute && (
                          <div className="hidden sm:flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg shadow-2xs">
                            <span>🚶</span>
                            <span>{navRoute.distanceMeters} м (~{navRoute.estimatedMinutes} мин)</span>
                          </div>
                        )}
                        <button
                          onClick={handleStopRoute}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 font-bold text-xs transition cursor-pointer"
                          title="Остановить движение"
                        >
                          <span className="size-2 rounded-full bg-amber-500 animate-ping" />
                          <span>Стоп</span>
                        </button>
                      </div>
                    )
                  )}

                  {(!pointA || !pointB) && (
                    <button
                      onClick={() => setRoutingStep(!pointA ? 'pickA' : 'pickB')}
                      className="px-2.5 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-xs hover:bg-indigo-100 transition cursor-pointer"
                    >
                      {!pointA ? '+ Точка А' : '+ Точка Б'}
                    </button>
                  )}

                  <button
                    onClick={startRoutePicking}
                    className="text-xs text-[#111113] hover:text-[#e30613] font-semibold px-2 py-1.5 rounded-lg hover:bg-[#fafafa] transition cursor-pointer"
                    title="Выбрать точки заново"
                  >
                    Переставить
                  </button>
                  <button
                    onClick={handleResetRoute}
                    className="size-7 rounded-lg text-[#6b6b70] hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition cursor-pointer"
                    title="Сбросить точки"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Уведомление, если проход заблокирован стенами */}
              {routeError && (
                <div className="bg-amber-50/95 backdrop-blur-md rounded-2xl border border-amber-300 p-2.5 px-3 shadow-lg flex items-center justify-between gap-2 text-xs text-amber-900 animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <span className="text-base">⚠️</span>
                    <span>{routeError}</span>
                  </div>
                  <button
                    onClick={() => setRouteError(null)}
                    className="text-amber-700 hover:text-amber-950 font-bold px-1.5 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Стильная главная кнопка "Построить маршрут" */
            <div className="flex justify-center">
              <button
                onClick={startRoutePicking}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/95 backdrop-blur-md border border-[#e9e9ec] text-xs font-bold text-[#111113] hover:border-[#e30613] hover:text-[#e30613] shadow-lg shadow-black/5 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <svg className="size-4 text-[#e30613]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                <span>Построить маршрут</span>
              </button>
            </div>
          )
        )}
      </div>

      {/* 3. Рабочая область стильного холста */}
      <main 
        ref={containerRef} 
        className={`flex-1 w-full h-full relative ${
          routingStep !== 'idle' ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
        }`}
      >
        <canvas ref={canvasRef} className="w-full h-full block" />

        

        {/* Кнопки зума справа снизу */}
        <div className="absolute bottom-24 sm:bottom-6 right-3 sm:right-6 flex flex-col gap-2 z-20">
          <button
            onClick={() => setZoom(prev => Math.min(prev * 1.25, 4.0))}
            className="size-11 sm:size-10 rounded-full bg-white border border-[#e9e9ec] shadow-lg flex items-center justify-center text-[#111113] hover:border-[#e30613] hover:text-[#e30613] transition active:scale-90 cursor-pointer"
            title="Приблизить"
          >
            <svg className="size-5 sm:size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button
            onClick={() => setZoom(prev => Math.max(prev / 1.25, minZoomRef.current))}
            className="size-11 sm:size-10 rounded-full bg-white border border-[#e9e9ec] shadow-lg flex items-center justify-center text-[#111113] hover:border-[#e30613] hover:text-[#e30613] transition active:scale-90 cursor-pointer"
            title="Отдалить (с ограничением)"
          >
            <svg className="size-5 sm:size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M20 12H4" />
            </svg>
          </button>
          <button
            onClick={fitToPlan}
            className="size-11 sm:size-10 rounded-full bg-white border border-[#e9e9ec] shadow-lg flex items-center justify-center text-[#111113] hover:border-[#e30613] hover:text-[#e30613] transition active:scale-90 cursor-pointer"
            title="Показать весь план"
          >
            <svg className="size-5 sm:size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
        </div>
      </main>

      {/* 4. Всплывающая карточка выбранной метки (POI) */}
      {selectedPoi && (
        <div className="absolute bottom-3 left-3 right-3 sm:bottom-6 sm:left-6 sm:right-auto sm:w-96 z-30 animate-in slide-in-from-bottom-4 duration-200">
          <div className="bg-white rounded-3xl border border-[#e9e9ec] p-4 sm:p-5 shadow-2xl relative">
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

            <h3 className="text-base sm:text-lg font-bold text-[#111113] mb-2 sm:mb-3">
              {selectedPoi.name}
            </h3>

            {/* Краткая информация / описание (если есть) */}
            {selectedPoi.description && (
              <div className="mb-3 p-2.5 sm:p-3 rounded-2xl bg-[#fafafa] border border-[#e9e9ec] text-xs text-[#6b6b70] leading-relaxed">
                {selectedPoi.description}
              </div>
            )}

            {/* Связанная 360° панорама стенда / комнаты (если есть) */}
            {(() => {
              const linkedPano = currentFloor?.panoramas?.find(p => {
                const poiRoom = selectedPoi.room_id || selectedPoi.roomId
                const panoRoom = p.room_id || p.roomId
                return (
                  Boolean(poiRoom && panoRoom && poiRoom === panoRoom) || 
                  Math.hypot(p.x - selectedPoi.x, p.y - selectedPoi.y) <= 140
                )
              })
              if (!linkedPano) return null
              return (
                <button
                  type="button"
                  onClick={() => setSelectedPanorama(linkedPano)}
                  className="mb-3 w-full p-2.5 rounded-2xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-semibold flex items-center justify-between transition cursor-pointer group active:scale-98"
                >
                  <span className="flex items-center gap-2 truncate">
                    <span className="text-sm">📸</span>
                    <span className="truncate">360°: {linkedPano.name}</span>
                  </span>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 bg-indigo-600 text-white rounded-full group-hover:bg-indigo-700 transition shrink-0">
                    Смотреть
                  </span>
                </button>
              )
            })()}

            {/* Кнопки быстрой установки точек А и Б */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setPointA({ x: selectedPoi.x, y: selectedPoi.y, name: selectedPoi.name })
                  setSelectedPoi(null)
                  setNavRoute(null)
                  setIsNavigating(false)
                  setRouteError(null)
                }}
                className="h-11 sm:h-10 rounded-full border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
              >
                <span>Отсюда (А)</span>
              </button>

              <button
                onClick={() => {
                  setPointB({ x: selectedPoi.x, y: selectedPoi.y, name: selectedPoi.name })
                  setSelectedPoi(null)
                  setNavRoute(null)
                  setIsNavigating(false)
                  setRouteError(null)
                }}
                className="h-11 sm:h-10 rounded-full bg-[#e30613] text-white hover:bg-[#c40511] font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-sm shadow-[#e30613]/25 active:scale-95"
              >
                <span>Сюда (Б)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно интерактивного 360° просмотра панорамы */}
      {selectedPanorama && (
        <PanoramaViewerModal
          panorama={selectedPanorama}
          roomName={currentFloor?.rooms?.find(r => r.id === selectedPanorama.room_id)?.name || 'Помещение'}
          floorName={currentFloor?.name || '1 этаж'}
          onClose={() => setSelectedPanorama(null)}
        />
      )}
    </div>
  )
}
