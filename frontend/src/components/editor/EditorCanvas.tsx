import { useRef, useEffect, useCallback } from 'react'
import type { PlanFloor, PlanCorner, PlanRoom, PlanPoi, PlanPanorama } from '../../types/plan'
import type { EditorTool, PanZoomState } from '../../types/editor'

interface EditorCanvasProps {
  floor: PlanFloor | undefined
  tool: EditorTool
  panZoom: PanZoomState
  onPanZoomChange: (pz: PanZoomState) => void
  selectedCornerId: string | null
  selectedWallId: string | null
  selectedRoomId: string | null
  selectedPoiId: string | null
  selectedPanoId: string | null
  onSelectCorner: (id: string | null) => void
  onSelectWall: (id: string | null) => void
  onSelectRoom: (id: string | null) => void
  onSelectPoi: (id: string | null) => void
  onSelectPano: (id: string | null) => void
  onCornerMove: (cornerId: string, x: number, y: number) => void
  onPoiMove: (poiId: string, x: number, y: number) => void
  onPanoMove: (panoId: string, x: number, y: number) => void
  onCreateWall: (fromCornerId: string, toCornerId: string) => void
  onDeleteCorner: (cornerId: string) => void
  onDeleteWall: (wallId: string) => void
  onDeleteRoom: (roomId: string) => void
  onDeletePoi: (poiId: string) => void
  onDeletePano: (panoId: string) => void
  onFastCreateCorner: (x: number, y: number) => void
  onFastCreateWallCorner?: (x: number, y: number, connectFromId?: string | null) => string
  onOpenCornerCreateModal: (x: number, y: number) => void
  onOpenCornerEditModal: (corner: PlanCorner) => void
  onOpenRoomCreateModal: (cornerIds: string[]) => void
  onOpenRoomEditModal: (room: PlanRoom) => void
  onOpenPoiCreateModal: (x: number, y: number) => void
  onOpenPoiEditModal: (poi: PlanPoi) => void
  onOpenPanoCreateModal: (x: number, y: number, roomId?: string) => void
  onOpenPanoViewerModal: (pano: PlanPanorama) => void
  onCursorMove: (coords: { x: number; y: number }) => void
  onStatusHintChange: (hint: string) => void
}

function hexToRgba(hex: string, alpha = 0.2): string {
  let c = hex.replace('#', '')
  if (c.length === 3) c = c.split('').map(x => x + x).join('')
  const num = parseInt(c, 16)
  if (isNaN(num)) return `rgba(59, 130, 246, ${alpha})`
  const r = (num >> 16) & 255
  const g = (num >> 8) & 255
  const b = num & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function snap(val: number, step = 20): number {
  return Math.round(val / step) * step
}

function calcDist(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  return Math.round(Math.hypot(p2.x - p1.x, p2.y - p1.y))
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2
  if (l2 === 0) return Math.hypot(px - x1, py - y1)
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)))
}

function getRoomCenter(room: PlanRoom, floor: PlanFloor): { x: number; y: number } {
  if (!room.corners || room.corners.length === 0) return { x: 0, y: 0 }
  let sumX = 0
  let sumY = 0
  let count = 0
  room.corners.forEach(cid => {
    const c = floor.corners.find(pt => pt.id === cid)
    if (c) {
      sumX += c.x
      sumY += c.y
      count++
    }
  })
  return count > 0 ? { x: sumX / count, y: sumY / count } : { x: 0, y: 0 }
}

export function EditorCanvas({
  floor,
  tool,
  panZoom,
  onPanZoomChange,
  selectedCornerId,
  selectedWallId,
  selectedRoomId,
  selectedPoiId,
  selectedPanoId,
  onSelectCorner,
  onSelectWall,
  onSelectRoom,
  onSelectPoi,
  onSelectPano,
  onCornerMove,
  onPoiMove,
  onPanoMove,
  onCreateWall,
  onDeleteCorner,
  onDeleteWall,
  onDeleteRoom,
  onDeletePoi,
  onDeletePano,
  onFastCreateCorner,
  onFastCreateWallCorner,
  onOpenCornerCreateModal,
  onOpenCornerEditModal,
  onOpenRoomCreateModal,
  onOpenRoomEditModal,
  onOpenPoiCreateModal,
  onOpenPoiEditModal,
  onOpenPanoCreateModal,
  onOpenPanoViewerModal,
  onCursorMove,
  onStatusHintChange
}: EditorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const panZoomRef = useRef(panZoom)
  panZoomRef.current = panZoom
  const toolRef = useRef(tool)
  toolRef.current = tool

  useEffect(() => {
    interStateRef.current.wallStartCornerId = null
    interStateRef.current.roomDraftCorners = []
  }, [tool])

  // Внутреннее интерактивное состояние
  const interStateRef = useRef({
    isPanning: false,
    panStart: { x: 0, y: 0 },
    isDraggingCorner: false,
    isDraggingPoi: false,
    isDraggingPano: false,
    draggedId: null as string | null,
    dragStartMouse: { x: 0, y: 0 },
    hasDragged: false,
    mouseWorld: { x: 0, y: 0 },
    hoverCornerId: null as string | null,
    hoverWallId: null as string | null,
    hoverRoomId: null as string | null,
    hoverPoiId: null as string | null,
    hoverPanoId: null as string | null,
    wallStartCornerId: null as string | null,
    roomDraftCorners: [] as string[]
  })

  // Координатные преобразования (Декартова плоскость: +X вправо, +Y вверх)
  const screenToWorld = useCallback(
    (sx: number, sy: number) => {
      return {
        x: (sx - panZoom.pan.x) / panZoom.zoom,
        y: (panZoom.pan.y - sy) / panZoom.zoom
      }
    },
    [panZoom]
  )

  const worldToCanvas = useCallback((wx: number, wy: number) => {
    return {
      x: wx,
      y: -wy
    }
  }, [])

  // Поиск объектов под курсором
  const findCornerAt = useCallback(
    (wx: number, wy: number, threshold?: number) => {
      if (!floor || !floor.corners) return null
      const th = threshold ?? 14 / panZoom.zoom
      return floor.corners.find(c => Math.hypot(c.x - wx, c.y - wy) <= th) || null
    },
    [floor, panZoom.zoom]
  )

  const findWallAt = useCallback(
    (wx: number, wy: number, threshold?: number) => {
      if (!floor || !floor.walls) return null
      const th = threshold ?? 10 / panZoom.zoom
      return (
        floor.walls.find(w => {
          const c1 = floor.corners.find(c => c.id === w.from)
          const c2 = floor.corners.find(c => c.id === w.to)
          if (!c1 || !c2) return false
          return distToSegment(wx, wy, c1.x, c1.y, c2.x, c2.y) <= th
        }) || null
      )
    },
    [floor, panZoom.zoom]
  )

  const findRoomAt = useCallback(
    (wx: number, wy: number) => {
      if (!floor || !floor.rooms) return null
      return (
        floor.rooms.find(room => {
          const center = getRoomCenter(room, floor)
          return Math.hypot(wx - center.x, wy - center.y) <= 45 / panZoom.zoom
        }) || null
      )
    },
    [floor, panZoom.zoom]
  )

  const findPoiAt = useCallback(
    (wx: number, wy: number, threshold?: number) => {
      if (!floor || !floor.pois) return null
      const th = threshold ?? 14 / panZoom.zoom
      return floor.pois.find(p => Math.hypot(p.x - wx, p.y - wy) <= th) || null
    },
    [floor, panZoom.zoom]
  )

  const findPanoAt = useCallback(
    (wx: number, wy: number, threshold?: number) => {
      if (!floor || !floor.panoramas) return null
      const th = threshold ?? 16 / panZoom.zoom
      return floor.panoramas.find(p => Math.hypot(p.x - wx, p.y - wy) <= th) || null
    },
    [floor, panZoom.zoom]
  )

  // Главный цикл отрисовки Canvas
  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const { pan, zoom } = panZoom
    const inter = interStateRef.current

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    ctx.save()
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.translate(pan.x, pan.y)
    ctx.scale(zoom, zoom)

    const w = canvas.width / dpr
    const h = canvas.height / dpr

    // 1. Декартова координатная сетка
    const step = 20
    const majorStep = 100
    const minX = -pan.x / zoom
    const maxX = (w - pan.x) / zoom
    const maxY = pan.y / zoom
    const minY = (pan.y - h) / zoom

    const startGridX = Math.floor(minX / step) * step
    const endGridX = Math.ceil(maxX / step) * step
    const startGridY = Math.floor(minY / step) * step
    const endGridY = Math.ceil(maxY / step) * step

    // Мелкая сетка (20px)
    ctx.beginPath()
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.5)'
    ctx.lineWidth = 1 / zoom
    for (let x = startGridX; x <= endGridX; x += step) {
      if (x % majorStep !== 0) {
        ctx.moveTo(x, -minY)
        ctx.lineTo(x, -maxY)
      }
    }
    for (let y = startGridY; y <= endGridY; y += step) {
      if (y % majorStep !== 0) {
        ctx.moveTo(minX, -y)
        ctx.lineTo(maxX, -y)
      }
    }
    ctx.stroke()

    // Крупная сетка (100px)
    ctx.beginPath()
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.7)'
    ctx.lineWidth = 1.2 / zoom
    for (let x = Math.floor(minX / majorStep) * majorStep; x <= endGridX; x += majorStep) {
      ctx.moveTo(x, -minY)
      ctx.lineTo(x, -maxY)
    }
    for (let y = Math.floor(minY / majorStep) * majorStep; y <= endGridY; y += majorStep) {
      ctx.moveTo(minX, -y)
      ctx.lineTo(maxX, -y)
    }
    ctx.stroke()

    // Архитектурные узловые точки привязки (Snap Points) на пересечениях сетки
    if (zoom >= 0.7) {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.4)'
      const dotRadius = Math.max(1, 1.2 / zoom)
      for (let x = startGridX; x <= endGridX; x += step) {
        for (let y = startGridY; y <= endGridY; y += step) {
          ctx.beginPath()
          ctx.arc(x, -y, dotRadius, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    // Главные оси (X - красная, Y - зеленая)
    ctx.beginPath()
    ctx.strokeStyle = '#ef4444'
    ctx.lineWidth = 2 / zoom
    ctx.moveTo(minX, 0)
    ctx.lineTo(maxX, 0)
    ctx.stroke()

    ctx.beginPath()
    ctx.strokeStyle = '#10b981'
    ctx.lineWidth = 2 / zoom
    ctx.moveTo(0, -minY)
    ctx.lineTo(0, -maxY)
    ctx.stroke()

    // Стрелочки и метки +X / +Y
    ctx.fillStyle = '#ef4444'
    ctx.font = `bold ${Math.max(10, 11 / zoom)}px sans-serif`
    ctx.textAlign = 'right'
    ctx.textBaseline = 'bottom'
    ctx.fillText('+X →', maxX - 10 / zoom, -5 / zoom)

    ctx.fillStyle = '#10b981'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText('↑ +Y', 6 / zoom, -maxY + 10 / zoom)

    // Засечки чисел на осях
    ctx.font = `${Math.max(9, 10 / zoom)}px monospace`
    ctx.fillStyle = '#94a3b8'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    for (let x = Math.floor(minX / majorStep) * majorStep; x <= endGridX; x += majorStep) {
      if (x !== 0) ctx.fillText(x.toString(), x, 5 / zoom)
    }
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    for (let y = Math.floor(minY / majorStep) * majorStep; y <= endGridY; y += majorStep) {
      if (y !== 0) ctx.fillText(y.toString(), -6 / zoom, -y)
    }
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'bottom'
    ctx.fillText('0,0', -4 / zoom, -4 / zoom)

    if (floor) {
      // 2. Комнаты и зоны
      floor.rooms?.forEach(room => {
        const pts = room.corners
          .map(cid => floor.corners.find(c => c.id === cid))
          .filter(Boolean) as PlanCorner[]
        if (pts.length < 3) return

        const isHovered = inter.hoverRoomId === room.id
        const isSelected = selectedRoomId === room.id
        const baseColor = room.color || '#3b82f6'

        ctx.save()
        ctx.fillStyle =
          isHovered && tool === 'delete'
            ? 'rgba(244, 63, 94, 0.25)'
            : hexToRgba(baseColor, isHovered || isSelected ? 0.25 : 0.12)

        ctx.beginPath()
        const first = worldToCanvas(pts[0].x, pts[0].y)
        ctx.moveTo(first.x, first.y)
        for (let i = 1; i < pts.length; i++) {
          const p = worldToCanvas(pts[i].x, pts[i].y)
          ctx.lineTo(p.x, p.y)
        }
        ctx.closePath()
        ctx.fill()

        ctx.strokeStyle =
          isHovered && tool === 'delete'
            ? '#f43f5e'
            : hexToRgba(baseColor, isHovered || isSelected ? 0.8 : 0.4)
        ctx.lineWidth = (isHovered || isSelected ? 2.5 : 1.5) / zoom
        ctx.setLineDash([4, 4])
        ctx.stroke()
        ctx.setLineDash([])
        ctx.restore()

        // Бейдж названия комнаты
        const center = getRoomCenter(room, floor)
        const canvasCenter = worldToCanvas(center.x, center.y)

        ctx.save()
        const fontSize = Math.max(10, 12 / zoom)
        ctx.font = `bold ${fontSize}px sans-serif`
        const textWidth = ctx.measureText(room.name).width
        const paddingX = 8 / zoom
        const badgeH = 20 / zoom
        const badgeW = textWidth + paddingX * 2 + 14 / zoom

        ctx.fillStyle = isHovered || isSelected ? '#1e293b' : 'rgba(15, 23, 42, 0.9)'
        ctx.strokeStyle = isHovered || isSelected ? '#38bdf8' : baseColor
        ctx.lineWidth = (isHovered || isSelected ? 2 : 1.2) / zoom

        ctx.beginPath()
        ctx.roundRect(
          canvasCenter.x - badgeW / 2,
          canvasCenter.y - badgeH / 2,
          badgeW,
          badgeH,
          6 / zoom
        )
        ctx.fill()
        ctx.stroke()

        ctx.beginPath()
        ctx.fillStyle = baseColor
        ctx.arc(
          canvasCenter.x - badgeW / 2 + paddingX + 3 / zoom,
          canvasCenter.y,
          3.5 / zoom,
          0,
          Math.PI * 2
        )
        ctx.fill()

        ctx.fillStyle = isHovered || isSelected ? '#ffffff' : '#f1f5f9'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(room.name, canvasCenter.x - badgeW / 2 + paddingX + 10 / zoom, canvasCenter.y)
        ctx.restore()
      })

      // 2.1. Предпросмотр создаваемой комнаты (Room Draft)
      if (tool === 'room' && inter.roomDraftCorners.length > 0) {
        const pts = inter.roomDraftCorners
          .map(cid => floor.corners.find(c => c.id === cid))
          .filter(Boolean) as PlanCorner[]
        if (pts.length > 0) {
          ctx.save()
          ctx.strokeStyle = '#06b6d4'
          ctx.lineWidth = 2.5 / zoom
          ctx.setLineDash([5, 5])

          ctx.beginPath()
          const first = worldToCanvas(pts[0].x, pts[0].y)
          ctx.moveTo(first.x, first.y)
          for (let i = 1; i < pts.length; i++) {
            const p = worldToCanvas(pts[i].x, pts[i].y)
            ctx.lineTo(p.x, p.y)
          }

          const curPos = worldToCanvas(inter.mouseWorld.x, inter.mouseWorld.y)
          ctx.lineTo(curPos.x, curPos.y)
          ctx.stroke()
          ctx.setLineDash([])

          // Подсветка первой точки для замыкания
          ctx.beginPath()
          ctx.strokeStyle = '#22d3ee'
          ctx.fillStyle = 'rgba(6, 182, 212, 0.4)'
          ctx.lineWidth = 3 / zoom
          ctx.arc(first.x, first.y, 14 / zoom, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
          ctx.restore()
        }
      }

      // 3. Стены
      floor.walls?.forEach(w => {
        const c1 = floor.corners.find(c => c.id === w.from)
        const c2 = floor.corners.find(c => c.id === w.to)
        if (!c1 || !c2) return

        const p1 = worldToCanvas(c1.x, c1.y)
        const p2 = worldToCanvas(c2.x, c2.y)
        const isHovered = inter.hoverWallId === w.id
        const isSelected = selectedWallId === w.id
        const isDeleteMode = tool === 'delete' || tool === 'wall'

        ctx.beginPath()
        ctx.strokeStyle =
          (isHovered || isSelected) && isDeleteMode
            ? '#f43f5e'
            : isHovered || isSelected
            ? '#60a5fa'
            : '#cbd5e1'
        ctx.lineWidth = (isHovered || isSelected ? 6 : 4) / zoom
        ctx.lineCap = 'round'
        ctx.moveTo(p1.x, p1.y)
        ctx.lineTo(p2.x, p2.y)
        ctx.stroke()

        if (isHovered || isSelected) {
          const midX = (p1.x + p2.x) / 2
          const midY = (p1.y + p2.y) / 2
          const text = `${w.length || calcDist(c1, c2)} px`

          ctx.save()
          ctx.font = `bold ${Math.max(10, 11 / zoom)}px sans-serif`
          const tw = ctx.measureText(text).width
          const padX = 5 / zoom
          const bh = 14 / zoom

          ctx.fillStyle = '#1e293b'
          ctx.strokeStyle = '#38bdf8'
          ctx.lineWidth = 1 / zoom

          ctx.beginPath()
          ctx.roundRect(midX - tw / 2 - padX, midY - bh / 2, tw + padX * 2, bh, 3 / zoom)
          ctx.fill()
          ctx.stroke()

          ctx.fillStyle = '#38bdf8'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(text, midX, midY)
          ctx.restore()
        }
      })

      // 4. Предпросмотр возводимой стены (Wall Draft)
      if (tool === 'wall' && inter.wallStartCornerId) {
        const startCorner = floor.corners.find(c => c.id === inter.wallStartCornerId)
        if (startCorner) {
          const scPos = worldToCanvas(startCorner.x, startCorner.y)
          const curPos = worldToCanvas(inter.mouseWorld.x, inter.mouseWorld.y)

          ctx.beginPath()
          ctx.setLineDash([6, 6])
          ctx.strokeStyle = '#10b981'
          ctx.lineWidth = 3 / zoom
          ctx.moveTo(scPos.x, scPos.y)
          ctx.lineTo(curPos.x, curPos.y)
          ctx.stroke()
          ctx.setLineDash([])

          const tempDist = calcDist(startCorner, inter.mouseWorld)
          const midX = (scPos.x + curPos.x) / 2
          const midY = (scPos.y + curPos.y) / 2
          const text = `${tempDist} px`

          ctx.save()
          ctx.font = `bold ${Math.max(10, 11 / zoom)}px sans-serif`
          const tw = ctx.measureText(text).width
          const padX = 5 / zoom
          const bh = 14 / zoom

          ctx.fillStyle = '#064e3b'
          ctx.strokeStyle = '#10b981'
          ctx.lineWidth = 1 / zoom
          ctx.beginPath()
          ctx.roundRect(midX - tw / 2 - padX, midY - bh / 2, tw + padX * 2, bh, 3 / zoom)
          ctx.fill()
          ctx.stroke()

          ctx.fillStyle = '#a7f3d0'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(text, midX, midY)
          ctx.restore()
        }
      }

      // 5. Углы (точки)
      floor.corners?.forEach(c => {
        const pos = worldToCanvas(c.x, c.y)
        const isSelected = selectedCornerId === c.id
        const isHovered = inter.hoverCornerId === c.id
        const isWallStart = inter.wallStartCornerId === c.id

        const radius = (isSelected || isHovered || isWallStart ? 8 : 6) / zoom

        ctx.beginPath()
        ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2)

        if (isWallStart) {
          ctx.fillStyle = '#10b981'
          ctx.strokeStyle = '#ecfdf5'
        } else if (tool === 'delete' && isHovered) {
          ctx.fillStyle = '#f43f5e'
          ctx.strokeStyle = '#ffe4e6'
        } else if (isSelected || isHovered) {
          ctx.fillStyle = '#e30613'
          ctx.strokeStyle = '#ffffff'
        } else {
          ctx.fillStyle = '#111113'
          ctx.strokeStyle = '#ffffff'
        }

        ctx.lineWidth = 2 / zoom
        ctx.fill()
        ctx.stroke()

        if (isHovered || isSelected) {
          ctx.save()
          const textTitle = c.id
          const textCoords = `(${c.x}, ${c.y})`
          const fontSize = Math.max(9, 10 / zoom)
          ctx.font = `bold ${fontSize}px monospace`
          const widthTitle = ctx.measureText(textTitle).width
          ctx.font = `${fontSize}px monospace`
          const widthCoords = ctx.measureText(textCoords).width
          const totalWidth = widthTitle + widthCoords + 10 / zoom
          const badgeH = 15 / zoom
          const badgeX = pos.x
          const badgeY = pos.y - radius - 12 / zoom

          ctx.fillStyle = 'rgba(30, 41, 59, 0.95)'
          ctx.strokeStyle = isSelected ? '#e30613' : '#334155'
          ctx.lineWidth = 1 / zoom

          ctx.beginPath()
          ctx.roundRect(badgeX - totalWidth / 2, badgeY - badgeH / 2, totalWidth, badgeH, 4 / zoom)
          ctx.fill()
          ctx.stroke()

          ctx.font = `bold ${fontSize}px monospace`
          ctx.fillStyle = isSelected ? '#ef4444' : '#f87171'
          ctx.textAlign = 'left'
          ctx.textBaseline = 'middle'
          const startTextX = badgeX - totalWidth / 2 + 5 / zoom
          ctx.fillText(textTitle, startTextX, badgeY)

          ctx.font = `${fontSize}px monospace`
          ctx.fillStyle = '#94a3b8'
          ctx.fillText(textCoords, startTextX + widthTitle + 4 / zoom, badgeY)
          ctx.restore()
        }
      })

      // 6. Точки интереса (POI)
      floor.pois?.forEach(poi => {
        const pos = worldToCanvas(poi.x, poi.y)
        const isSelected = selectedPoiId === poi.id
        const isHovered = inter.hoverPoiId === poi.id
        const radius = (isSelected || isHovered ? 9 : 7) / zoom

        ctx.save()
        ctx.beginPath()
        ctx.arc(pos.x, pos.y + 2 / zoom, radius + 2 / zoom, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
        ctx.fill()

        ctx.beginPath()
        ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2)
        ctx.fillStyle = isSelected || isHovered ? '#f43f5e' : '#fb7185'
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = (isSelected || isHovered ? 2.5 : 2) / zoom
        ctx.fill()
        ctx.stroke()

        ctx.beginPath()
        ctx.arc(pos.x, pos.y, radius * 0.4, 0, Math.PI * 2)
        ctx.fillStyle = '#ffffff'
        ctx.fill()

        if (isHovered || isSelected) {
          const fullText = poi.name
          const fontSize = Math.max(9, 11 / zoom)
          ctx.font = `600 ${fontSize}px sans-serif`
          const tw = ctx.measureText(fullText).width
          const padX = 6 / zoom
          const bh = 16 / zoom
          const bw = tw + padX * 2
          const bx = pos.x
          const by = pos.y - radius - 10 / zoom

          ctx.fillStyle = '#1e293b'
          ctx.strokeStyle = '#fb7185'
          ctx.lineWidth = 1 / zoom

          ctx.beginPath()
          ctx.roundRect(bx - bw / 2, by - bh / 2, bw, bh, 4 / zoom)
          ctx.fill()
          ctx.stroke()

          ctx.fillStyle = '#fecdd3'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(fullText, bx, by)
        }
        ctx.restore()
      })

      // 7. Панорамы 360°
      floor.panoramas?.forEach(pano => {
        const pos = worldToCanvas(pano.x, pano.y)
        const isSelected = selectedPanoId === pano.id
        const isHovered = inter.hoverPanoId === pano.id
        const radius = (isSelected || isHovered ? 12 : 10) / zoom

        ctx.save()
        if (isSelected || isHovered) {
          ctx.beginPath()
          ctx.arc(pos.x, pos.y, radius + 4 / zoom, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(99, 102, 241, 0.35)'
          ctx.fill()
        }

        ctx.beginPath()
        ctx.arc(pos.x, pos.y + 2 / zoom, radius + 1 / zoom, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
        ctx.fill()

        ctx.beginPath()
        ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2)
        ctx.fillStyle = isSelected || isHovered ? '#6366f1' : '#4f46e5'
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = (isSelected || isHovered ? 2.5 : 2) / zoom
        ctx.fill()
        ctx.stroke()

        const lensR = radius * 0.45
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, lensR, 0, Math.PI * 2)
        ctx.fillStyle = '#1e1b4b'
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1.2 / zoom
        ctx.fill()
        ctx.stroke()

        ctx.beginPath()
        ctx.arc(pos.x - lensR * 0.35, pos.y - lensR * 0.35, lensR * 0.25, 0, Math.PI * 2)
        ctx.fillStyle = '#a5b4fc'
        ctx.fill()

        if (isHovered || isSelected) {
          const fullText = `📷 ${pano.name}`
          const fontSize = Math.max(9, 11 / zoom)
          ctx.font = `600 ${fontSize}px sans-serif`
          const tw = ctx.measureText(fullText).width
          const padX = 6 / zoom
          const bh = 16 / zoom
          const bw = tw + padX * 2
          const bx = pos.x
          const by = pos.y - radius - 10 / zoom

          ctx.fillStyle = '#1e1b4b'
          ctx.strokeStyle = '#818cf8'
          ctx.lineWidth = 1 / zoom

          ctx.beginPath()
          ctx.roundRect(bx - bw / 2, by - bh / 2, bw, bh, 4 / zoom)
          ctx.fill()
          ctx.stroke()

          ctx.fillStyle = '#c7d2fe'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(fullText, bx, by)
        }
        ctx.restore()
      })
    }

    ctx.restore()
  }, [
    floor,
    tool,
    panZoom,
    selectedCornerId,
    selectedWallId,
    selectedRoomId,
    selectedPoiId,
    selectedPanoId,
    worldToCanvas
  ])

  // Автоматический ресайз холста
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const handleResize = () => {
      const dpr = window.devicePixelRatio || 1
      const w = container.clientWidth
      const h = container.clientHeight
      if (w > 0 && h > 0) {
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
        canvas.style.width = `${w}px`
        canvas.style.height = `${h}px`
        render()
      }
    }

    handleResize()
    const observer = new ResizeObserver(handleResize)
    observer.observe(container)
    window.addEventListener('resize', handleResize)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', handleResize)
    }
  }, [render])

  // Перерисовка при изменении геометрии
  useEffect(() => {
    render()
  }, [render])

  // Обработчики событий мыши
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas || !floor) return

    const rect = canvas.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const world = screenToWorld(sx, sy)
    const inter = interStateRef.current

    // Панорамирование колесиком или Shift+ЛКМ
    // Быстрый спавн точек при зажатом Shift
    if (e.button === 0 && e.shiftKey && tool === 'corner') {
      onFastCreateCorner(snap(world.x), snap(world.y))
      return
    }

    // Панорамирование средней кнопкой мыши
    if (e.button === 1) {
      inter.isPanning = true
      inter.panStart = { x: sx - panZoom.pan.x, y: sy - panZoom.pan.y }
      canvas.style.cursor = 'grabbing'
      return
    }

    if (e.button !== 0) return

    const clickedCorner = findCornerAt(world.x, world.y)
    const clickedWall = findWallAt(world.x, world.y)
    const clickedRoom = findRoomAt(world.x, world.y)
    const clickedPoi = findPoiAt(world.x, world.y)
    const clickedPano = findPanoAt(world.x, world.y)

    // Режим УДАЛЕНИЯ
    if (tool === 'delete') {
      if (clickedCorner) onDeleteCorner(clickedCorner.id)
      else if (clickedWall) onDeleteWall(clickedWall.id)
      else if (clickedRoom) onDeleteRoom(clickedRoom.id)
      else if (clickedPoi) onDeletePoi(clickedPoi.id)
      else if (clickedPano) onDeletePano(clickedPano.id)
      return
    }

    // Режим ЗОНА (Комната)
    if (tool === 'room') {
      if (clickedCorner) {
        if (inter.roomDraftCorners.length === 0) {
          inter.roomDraftCorners.push(clickedCorner.id)
          onStatusHintChange(`Начало зоны [${clickedCorner.id}]. Кликайте по остальным углам контура.`)
        } else {
          const firstId = inter.roomDraftCorners[0]
          if (clickedCorner.id === firstId) {
            if (inter.roomDraftCorners.length >= 3) {
              const finalCorners = [...inter.roomDraftCorners]
              inter.roomDraftCorners = []
              onOpenRoomCreateModal(finalCorners)
            } else {
              onStatusHintChange('Для создания зоны нужно минимум 3 точки!')
            }
          } else if (!inter.roomDraftCorners.includes(clickedCorner.id)) {
            inter.roomDraftCorners.push(clickedCorner.id)
            onStatusHintChange(
              `Контур: ${inter.roomDraftCorners.join(' ➔ ')}. Кликните по [${firstId}] для замыкания зоны.`
            )
          }
        }
        render()
        return
      } else if (clickedRoom) {
        onSelectRoom(clickedRoom.id)
        onStatusHintChange(`Зона "${clickedRoom.name}". Двойной клик — редактировать.`)
        return
      }
    }

    // Режим POI
    if (tool === 'poi') {
      if (clickedPoi) {
        onSelectPoi(clickedPoi.id)
        inter.isDraggingPoi = true
        inter.draggedId = clickedPoi.id
        inter.dragStartMouse = { x: sx, y: sy }
        inter.hasDragged = false
        onStatusHintChange(`Метка "${clickedPoi.name}". Зажмите и тяните для перемещения.`)
        return
      } else {
        onOpenPoiCreateModal(snap(world.x), snap(world.y))
        return
      }
    }

    // Режим 360° ПАНОРАМА
    if (tool === 'pano') {
      if (clickedPano) {
        onSelectPano(clickedPano.id)
        if (clickedPano.image_data || clickedPano.image) {
          onOpenPanoViewerModal(clickedPano)
        } else {
          onOpenPanoCreateModal(clickedPano.x, clickedPano.y, clickedPano.room_id)
        }
        return
      } else {
        const targetRoom = clickedRoom || findRoomAt(world.x, world.y)
        onOpenPanoCreateModal(snap(world.x), snap(world.y), targetRoom?.id)
        return
      }
    }

    // Режим СТЕНА
    if (tool === 'wall') {
      if (clickedCorner) {
        if (!inter.wallStartCornerId) {
          inter.wallStartCornerId = clickedCorner.id
          onSelectCorner(clickedCorner.id)
          onStatusHintChange(`Начало стены в точке [${clickedCorner.id}]. Кликните следующую точку.`)
        } else {
          if (inter.wallStartCornerId !== clickedCorner.id) {
            onCreateWall(inter.wallStartCornerId, clickedCorner.id)
            inter.wallStartCornerId = clickedCorner.id
            onSelectCorner(clickedCorner.id)
            onStatusHintChange(`Стена построена! Точка [${clickedCorner.id}] закреплена как начало следующей. Esc / ПКМ для завершения.`)
          } else {
            inter.wallStartCornerId = null
            onSelectCorner(null)
            onStatusHintChange('Выбор начальной точки стены отменен')
          }
        }
        render()
        return
      } else if (clickedWall) {
        onSelectWall(clickedWall.id)
        return
      } else {
        const wx = snap(world.x)
        const wy = snap(world.y)
        if (onFastCreateWallCorner) {
          const newId = onFastCreateWallCorner(wx, wy, inter.wallStartCornerId)
          inter.wallStartCornerId = newId
          onSelectCorner(newId)
          onStatusHintChange(`Точка [${newId}] создана на сетке. Кликните следующую точку или Esc для завершения.`)
          render()
          return
        }
      }
    }

    // Режим ТОЧКА
    if (tool === 'corner') {
      if (clickedCorner) {
        onSelectCorner(clickedCorner.id)
        inter.isDraggingCorner = true
        inter.draggedId = clickedCorner.id
        inter.dragStartMouse = { x: sx, y: sy }
        inter.hasDragged = false
        canvas.style.cursor = 'grabbing'
        return
      } else {
        if (e.shiftKey) {
          onFastCreateCorner(snap(world.x), snap(world.y))
        } else {
          onOpenCornerCreateModal(snap(world.x), snap(world.y))
        }
        return
      }
    }

    // Режим КУРСОР (Select)
    if (tool === 'select') {
      if (clickedPano) {
        onSelectPano(clickedPano.id)
        inter.isDraggingPano = true
        inter.draggedId = clickedPano.id
        inter.dragStartMouse = { x: sx, y: sy }
        inter.hasDragged = false
        canvas.style.cursor = 'grabbing'
        return
      }
      if (clickedPoi) {
        onSelectPoi(clickedPoi.id)
        inter.isDraggingPoi = true
        inter.draggedId = clickedPoi.id
        inter.dragStartMouse = { x: sx, y: sy }
        inter.hasDragged = false
        canvas.style.cursor = 'grabbing'
        return
      }
      if (clickedCorner) {
        onSelectCorner(clickedCorner.id)
        inter.isDraggingCorner = true
        inter.draggedId = clickedCorner.id
        inter.dragStartMouse = { x: sx, y: sy }
        inter.hasDragged = false
        canvas.style.cursor = 'grabbing'
        return
      }
      if (clickedWall) {
        onSelectWall(clickedWall.id)
        return
      }
      if (clickedRoom) {
        onSelectRoom(clickedRoom.id)
        return
      }

      // Клик по пустому месту — панорамирование
      onSelectCorner(null)
      onSelectWall(null)
      onSelectRoom(null)
      onSelectPoi(null)
      onSelectPano(null)
      inter.isPanning = true
      inter.panStart = { x: sx - panZoom.pan.x, y: sy - panZoom.pan.y }
      canvas.style.cursor = 'grabbing'
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas || !floor) return

    const rect = canvas.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const world = screenToWorld(sx, sy)
    const inter = interStateRef.current

    inter.mouseWorld = world
    onCursorMove(world)

    // Перемещение холста
    if (inter.isPanning) {
      onPanZoomChange({
        ...panZoom,
        pan: {
          x: sx - inter.panStart.x,
          y: sy - inter.panStart.y
        }
      })
      return
    }

    // Перетаскивание точки
    if (inter.isDraggingCorner && inter.draggedId) {
      inter.hasDragged = true
      onCornerMove(inter.draggedId, snap(world.x), snap(world.y))
      render()
      return
    }

    // Перетаскивание POI
    if (inter.isDraggingPoi && inter.draggedId) {
      inter.hasDragged = true
      onPoiMove(inter.draggedId, snap(world.x), snap(world.y))
      render()
      return
    }

    // Перетаскивание панорамы
    if (inter.isDraggingPano && inter.draggedId) {
      inter.hasDragged = true
      onPanoMove(inter.draggedId, snap(world.x), snap(world.y))
      render()
      return
    }

    // Хит-тесты для подсветки курсора
    const hoverC = findCornerAt(world.x, world.y)
    const hoverW = findWallAt(world.x, world.y)
    const hoverR = findRoomAt(world.x, world.y)
    const hoverP = findPoiAt(world.x, world.y)
    const hoverPa = findPanoAt(world.x, world.y)

    inter.hoverCornerId = hoverC?.id || null
    inter.hoverWallId = hoverW?.id || null
    inter.hoverRoomId = hoverR?.id || null
    inter.hoverPoiId = hoverP?.id || null
    inter.hoverPanoId = hoverPa?.id || null

    if (hoverC || hoverP || hoverPa) {
      canvas.style.cursor = 'pointer'
    } else if (tool === 'select' && !hoverW && !hoverR) {
      canvas.style.cursor = 'default'
    } else {
      canvas.style.cursor = 'crosshair'
    }

    render()
  }

  const handleMouseUp = () => {
    const canvas = canvasRef.current
    if (canvas) {
      canvas.style.cursor = 'default'
    }
    const inter = interStateRef.current
    inter.isPanning = false
    inter.isDraggingCorner = false
    inter.isDraggingPoi = false
    inter.isDraggingPano = false
    inter.draggedId = null
  }

  // Нативный non-passive обработчик зума (предотвращает зум страницы браузера)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const onNativeWheel = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const rect = canvas.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top

      let zoomFactor: number
      if (e.ctrlKey) {
        zoomFactor = Math.exp(-e.deltaY * 0.015)
      } else {
        zoomFactor = e.deltaY < 0 ? 1.12 : 0.89
      }

      const curZoom = panZoomRef.current.zoom
      const curPan = panZoomRef.current.pan
      const newZoom = Math.max(0.15, Math.min(6.0, curZoom * zoomFactor))

      const newPan = {
        x: sx - (sx - curPan.x) * (newZoom / curZoom),
        y: sy - (sy - curPan.y) * (newZoom / curZoom)
      }

      onPanZoomChange({
        pan: newPan,
        zoom: newZoom
      })
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (interStateRef.current.wallStartCornerId) {
          interStateRef.current.wallStartCornerId = null
          onSelectCorner(null)
          onStatusHintChange('Построение цепочки стен завершено')
          render()
        }
        if (interStateRef.current.roomDraftCorners.length > 0) {
          interStateRef.current.roomDraftCorners = []
          onStatusHintChange('Создание зоны отменено')
          render()
        }
      }
      if (e.key === 'Shift') {
        if (toolRef.current === 'corner') {
          canvas.style.cursor = 'crosshair'
          onStatusHintChange('Режим быстрого спавна: кликайте ЛКМ для добавления точек подряд')
        }
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        if (toolRef.current === 'corner') {
          canvas.style.cursor = 'crosshair'
          onStatusHintChange('Точка: кликните по холсту для добавления вершины (Shift + ЛКМ для серии)')
        } else {
          canvas.style.cursor = 'default'
        }
      }
    }

    canvas.addEventListener('wheel', onNativeWheel, { passive: false })
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    return () => {
      canvas.removeEventListener('wheel', onNativeWheel)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [onPanZoomChange, onStatusHintChange])

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas || !floor) return

    const rect = canvas.getBoundingClientRect()
    const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top)

    const clickedPano = findPanoAt(world.x, world.y)
    if (clickedPano) {
      onOpenPanoViewerModal(clickedPano)
      return
    }

    const clickedPoi = findPoiAt(world.x, world.y)
    if (clickedPoi) {
      onOpenPoiEditModal(clickedPoi)
      return
    }

    const clickedCorner = findCornerAt(world.x, world.y)
    if (clickedCorner) {
      onOpenCornerEditModal(clickedCorner)
      return
    }

    const clickedRoom = findRoomAt(world.x, world.y)
    if (clickedRoom) {
      onOpenRoomEditModal(clickedRoom)
      return
    }

    if (tool === 'corner') {
      onOpenCornerCreateModal(snap(world.x), snap(world.y))
      return
    }
  }

  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas || !floor) return

    const rect = canvas.getBoundingClientRect()
    const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top)
    const inter = interStateRef.current

    if (tool === 'room' && inter.roomDraftCorners.length > 0) {
      inter.roomDraftCorners = []
      onStatusHintChange('Создание зоны отменено.')
      render()
      return
    }

    if (tool === 'wall' && inter.wallStartCornerId) {
      inter.wallStartCornerId = null
      onStatusHintChange('Построение стены отменено.')
      render()
      return
    }

    const clickedCorner = findCornerAt(world.x, world.y)
    const clickedWall = findWallAt(world.x, world.y)
    const clickedRoom = findRoomAt(world.x, world.y)
    const clickedPoi = findPoiAt(world.x, world.y)
    const clickedPano = findPanoAt(world.x, world.y)

    if (clickedPano) onDeletePano(clickedPano.id)
    else if (clickedPoi) onDeletePoi(clickedPoi.id)
    else if (clickedCorner) onDeleteCorner(clickedCorner.id)
    else if (clickedWall) onDeleteWall(clickedWall.id)
    else if (clickedRoom) onDeleteRoom(clickedRoom.id)
  }

  return (
    <div ref={containerRef} className="flex-1 w-full h-full relative overflow-hidden bg-slate-950 select-none touch-none overscroll-none">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        className="w-full h-full block"
      />
    </div>
  )
}
