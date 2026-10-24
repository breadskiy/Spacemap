import type { PlanCorner, PlanWall } from '../types/plan'

export interface Point {
  x: number
  y: number
}

export interface WallSegment {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface PathResult {
  path: Point[]
  distance: number // примерная длина в условных единицах
  distanceMeters: number // пересчитанное расстояние в метрах
  estimatedMinutes: number // время пешком
  success: boolean
}

// Расстояние от точки до отрезка прямой
export function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const l2 = dx * dx + dy * dy
  if (l2 === 0) return Math.hypot(px - x1, py - y1)
  let t = ((px - x1) * dx + (py - y1) * dy) / l2
  t = Math.max(0, Math.min(1, t))
  const projX = x1 + t * dx
  const projY = y1 + t * dy
  return Math.hypot(px - projX, py - projY)
}

// Минимальное расстояние от точки до набора стен
export function distToWalls(px: number, py: number, segments: WallSegment[]): number {
  if (segments.length === 0) return Infinity
  let minDist = Infinity
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i]
    const d = distToSegment(px, py, s.x1, s.y1, s.x2, s.y2)
    if (d < minDist) minDist = d
  }
  return minDist
}

function ccw(p1: Point, p2: Point, p3: Point): boolean {
  return (p3.y - p1.y) * (p2.x - p1.x) > (p2.y - p1.y) * (p3.x - p1.x)
}

// Проверка пересечения двух отрезков
export function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  if (
    Math.max(a.x, b.x) < Math.min(c.x, d.x) ||
    Math.min(a.x, b.x) > Math.max(c.x, d.x) ||
    Math.max(a.y, b.y) < Math.min(c.y, d.y) ||
    Math.min(a.y, b.y) > Math.max(c.y, d.y)
  ) {
    return false
  }
  const ccw1 = ccw(a, c, d)
  const ccw2 = ccw(b, c, d)
  const ccw3 = ccw(a, b, c)
  const ccw4 = ccw(a, b, d)
  return ccw1 !== ccw2 && ccw3 !== ccw4
}

// Расстояние между двумя отрезками
export function segmentToSegmentDist(a: Point, b: Point, c: Point, d: Point): number {
  if (segmentsIntersect(a, b, c, d)) return 0
  return Math.min(
    distToSegment(a.x, a.y, c.x, c.y, d.x, d.y),
    distToSegment(b.x, b.y, c.x, c.y, d.x, d.y),
    distToSegment(c.x, c.y, a.x, a.y, b.x, b.y),
    distToSegment(d.x, d.y, a.x, a.y, b.x, b.y)
  )
}

// Проверка свободен ли прямой отрезок от стен с учетом заданного отступа
export function isLineClear(
  p1: Point,
  p2: Point,
  segments: WallSegment[],
  clearance: number
): boolean {
  if (segments.length === 0) return true

  // 1. Проверка прямого пересечения отрезка со стенами
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i]
    if (segmentsIntersect(p1, p2, { x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 })) {
      return false
    }
  }

  // 2. Проверка безопасного отступа от стен вдоль всего отрезка
  const d1 = distToWalls(p1.x, p1.y, segments)
  const d2 = distToWalls(p2.x, p2.y, segments)

  const len = Math.hypot(p2.x - p1.x, p2.y - p1.y)
  const steps = Math.max(6, Math.min(25, Math.ceil(len / 18)))

  for (let step = 1; step < steps; step++) {
    const t = step / steps
    const qx = p1.x + (p2.x - p1.x) * t
    const qy = p1.y + (p2.y - p1.y) * t

    // Плавный безопасный отступ с учетом возможной близости концов к стенам
    const endTaper = Math.min(d1 * (1 - t) + d2 * t, clearance)
    const required = Math.min(clearance, Math.max(5, endTaper))

    const d = distToWalls(qx, qy, segments)
    if (d < required) {
      return false
    }
  }

  return true
}

// Быстрый класс очереди с приоритетом (Min-Heap) для алгоритма A*
class PriorityQueue {
  private items: { id: number; priority: number }[] = []

  push(id: number, priority: number) {
    this.items.push({ id, priority })
    let i = this.items.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (this.items[parent].priority <= this.items[i].priority) break
      const tmp = this.items[parent]
      this.items[parent] = this.items[i]
      this.items[i] = tmp
      i = parent
    }
  }

  pop(): number | undefined {
    if (this.items.length === 0) return undefined
    const top = this.items[0].id
    const last = this.items.pop()!
    if (this.items.length > 0) {
      this.items[0] = last
      let i = 0
      const len = this.items.length
      while (true) {
        let left = (i << 1) + 1
        let right = left + 1
        let smallest = i
        if (left < len && this.items[left].priority < this.items[smallest].priority) {
          smallest = left
        }
        if (right < len && this.items[right].priority < this.items[smallest].priority) {
          smallest = right
        }
        if (smallest === i) break
        const tmp = this.items[i]
        this.items[i] = this.items[smallest]
        this.items[smallest] = tmp
        i = smallest
      }
    }
    return top
  }

  isEmpty(): boolean {
    return this.items.length === 0
  }
}

// Расчет длины ломаной линии
export function calculatePathLength(points: Point[]): number {
  let len = 0
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
  }
  return len
}

/**
 * Вспомогательная проверка допустимости прямого Г-образного поворота под 90 градусов
 */
function isOrthogonalLValid(
  p1: Point,
  p2: Point,
  corner: Point,
  segments: WallSegment[],
  clearance: number
): boolean {
  if (segments.length === 0) return true
  const dCorner = distToWalls(corner.x, corner.y, segments)
  if (dCorner < clearance * 0.7) return false
  return isLineClear(p1, corner, segments, clearance) && isLineClear(corner, p2, segments, clearance)
}

/**
 * Попытка прямого соединения под 90 градусов (одна прямая или один Г-образный угол)
 */
function findDirectOrthogonal(
  start: Point,
  end: Point,
  segments: WallSegment[],
  clearance: number
): Point[] | null {
  // 1. Если точки уже на одной горизонтали или вертикали
  if (Math.abs(start.x - end.x) < 1e-3 || Math.abs(start.y - end.y) < 1e-3) {
    if (isLineClear(start, end, segments, clearance)) {
      return [start, end]
    }
    return null
  }

  // 2. Два возможных поворота под 90 градусов
  const cX: Point = { x: end.x, y: start.y }
  const cY: Point = { x: start.x, y: end.y }

  const canX = isOrthogonalLValid(start, end, cX, segments, clearance)
  const canY = isOrthogonalLValid(start, end, cY, segments, clearance)

  if (canX && canY) {
    const dX = distToWalls(cX.x, cX.y, segments)
    const dY = distToWalls(cY.x, cY.y, segments)
    return dX >= dY ? [start, cX, end] : [start, cY, end]
  }
  if (canX) return [start, cX, end]
  if (canY) return [start, cY, end]

  return null
}

/**
 * Объединение последовательных коллинеарных отрезков (идущих строго вдоль X или вдоль Y)
 */
export function mergeCollinear(points: Point[]): Point[] {
  if (points.length <= 2) return points
  const res: Point[] = [points[0]]

  for (let i = 1; i < points.length - 1; i++) {
    const prev = res[res.length - 1]
    const curr = points[i]
    const next = points[i + 1]

    const isCollinearX = Math.abs(prev.x - curr.x) < 1e-3 && Math.abs(curr.x - next.x) < 1e-3
    const isCollinearY = Math.abs(prev.y - curr.y) < 1e-3 && Math.abs(curr.y - next.y) < 1e-3

    if (!isCollinearX && !isCollinearY) {
      res.push(curr)
    }
  }

  res.push(points[points.length - 1])
  return res
}

/**
 * Ортогональное соединение двух точек строго под 90 градусов
 */
function connectOrthogonal(
  p1: Point,
  p2: Point,
  segments: WallSegment[]
): Point[] {
  if (Math.abs(p1.x - p2.x) < 1e-3 || Math.abs(p1.y - p2.y) < 1e-3) {
    return [p1, p2]
  }
  const cX = { x: p2.x, y: p1.y }
  const cY = { x: p1.x, y: p2.y }
  const dX = distToWalls(cX.x, cX.y, segments)
  const dY = distToWalls(cY.x, cY.y, segments)
  const corner = dX >= dY ? cX : cY
  return [p1, corner, p2]
}

/**
 * Основная функция поиска маршрута с обходом стен и отступом (clearance).
 * СТРОГО ПОД 90 ГРАДУСОВ (ортогональные сегменты без диагональных срезов).
 */
export function findNavRoute(
  start: Point,
  end: Point,
  walls: PlanWall[],
  corners: PlanCorner[],
  desiredClearance: number = 22
): PathResult | null {
  const cornerMap = new Map<string, PlanCorner>()
  corners.forEach(c => cornerMap.set(c.id, c))

  // Собираем отрезки стен
  const segments: WallSegment[] = []
  walls.forEach(w => {
    const c1 = cornerMap.get(w.from)
    const c2 = cornerMap.get(w.to)
    if (c1 && c2) {
      segments.push({
        id: w.id,
        x1: c1.x,
        y1: c1.y,
        x2: c2.x,
        y2: c2.y
      })
    }
  })

  // Если стен вообще нет — ортогональный маршрут под 90 градусов
  if (segments.length === 0) {
    const directPath = (Math.abs(start.x - end.x) < 1e-3 || Math.abs(start.y - end.y) < 1e-3)
      ? [start, end]
      : [start, { x: end.x, y: start.y }, end]
    const rawLen = calculatePathLength(directPath)
    const meters = Math.max(1, Math.round(rawLen * 0.1))
    return {
      path: directPath,
      distance: rawLen,
      distanceMeters: meters,
      estimatedMinutes: Math.max(1, Math.round(meters / 60)),
      success: true
    }
  }

  // Проверяем прямое ортогональное соединение под 90 градусов с безопасным отступом
  const startDistToWalls = distToWalls(start.x, start.y, segments)
  const endDistToWalls = distToWalls(end.x, end.y, segments)
  const safeDirectClearance = Math.min(desiredClearance, Math.max(4, Math.min(startDistToWalls, endDistToWalls) * 0.8))

  const direct = findDirectOrthogonal(start, end, segments, safeDirectClearance)
  if (direct) {
    const rawLen = calculatePathLength(direct)
    const meters = Math.max(1, Math.round(rawLen * 0.1))
    return {
      path: direct,
      distance: rawLen,
      distanceMeters: meters,
      estimatedMinutes: Math.max(1, Math.round(meters / 60)),
      success: true
    }
  }

  // Попробуем с базовым отступом, а если проходы узкие (например, двери) — с адаптивным понижением
  const clearanceTiers = [
    desiredClearance,
    Math.round(desiredClearance * 0.65),
    Math.round(desiredClearance * 0.4),
    8
  ]

  for (const clearance of clearanceTiers) {
    const result = searchOrthogonalGridPath(start, end, segments, corners, clearance)
    if (result) {
      // Ортогональная оптимизация пути строго под 90 градусов
      const smoothed = smoothOrthogonalPath(result, segments, Math.min(clearance, safeDirectClearance))
      const rawLen = calculatePathLength(smoothed)
      const meters = Math.max(1, Math.round(rawLen * 0.1))
      return {
        path: smoothed,
        distance: rawLen,
        distanceMeters: meters,
        estimatedMinutes: Math.max(1, Math.round(meters / 60)),
        success: true
      }
    }
  }

  return null
}

function searchOrthogonalGridPath(
  start: Point,
  end: Point,
  segments: WallSegment[],
  corners: PlanCorner[],
  clearance: number
): Point[] | null {
  // Определяем границы рабочей сетки
  let minX = Math.min(start.x, end.x)
  let maxX = Math.max(start.x, end.x)
  let minY = Math.min(start.y, end.y)
  let maxY = Math.max(start.y, end.y)

  corners.forEach(c => {
    if (c.x < minX) minX = c.x
    if (c.x > maxX) maxX = c.x
    if (c.y < minY) minY = c.y
    if (c.y > maxY) maxY = c.y
  })

  const padding = clearance * 3 + 40
  minX -= padding
  maxX += padding
  minY -= padding
  maxY += padding

  const cellSize = 12
  const cols = Math.ceil((maxX - minX) / cellSize) + 1
  const rows = Math.ceil((maxY - minY) / cellSize) + 1
  const totalCells = cols * rows

  // Поле расстояний до стен
  const distField = new Float32Array(totalCells)
  for (let r = 0; r < rows; r++) {
    const wy = minY + r * cellSize
    const rowOffset = r * cols
    for (let c = 0; c < cols; c++) {
      const wx = minX + c * cellSize
      distField[rowOffset + c] = distToWalls(wx, wy, segments)
    }
  }

  // Координаты старта и финиша в сетке
  const startCol = Math.max(0, Math.min(cols - 1, Math.round((start.x - minX) / cellSize)))
  const startRow = Math.max(0, Math.min(rows - 1, Math.round((start.y - minY) / cellSize)))
  const endCol = Math.max(0, Math.min(cols - 1, Math.round((end.x - minX) / cellSize)))
  const endRow = Math.max(0, Math.min(rows - 1, Math.round((end.y - minY) / cellSize)))

  const startIndex = startRow * cols + startCol
  const endIndex = endRow * cols + endCol

  // Проверяем проходимость клетки:
  // Клетка проходима, если расстояние до стен >= clearance, либо это окрестность старта/финиша
  const startDist = distToWalls(start.x, start.y, segments)
  const endDist = distToWalls(end.x, end.y, segments)
  const minStartClear = Math.max(3, Math.min(clearance, startDist * 0.75))
  const minEndClear = Math.max(3, Math.min(clearance, endDist * 0.75))

  const isCellWalkable = (c: number, r: number): boolean => {
    if (c < 0 || c >= cols || r < 0 || r >= rows) return false
    const idx = r * cols + c
    const d = distField[idx]
    if (d >= clearance) return true

    // Разрешаем старт и финиш около стены
    const wx = minX + c * cellSize
    const wy = minY + r * cellSize
    const distToS = Math.hypot(wx - start.x, wy - start.y)
    if (distToS <= clearance * 1.5 && d >= minStartClear) return true

    const distToE = Math.hypot(wx - end.x, wy - end.y)
    if (distToE <= clearance * 1.5 && d >= minEndClear) return true

    return false
  }

  // ТОЛЬКО 4 ОРТОГОНАЛЬНЫХ НАПРАВЛЕНИЯ (БЕЗ ДИАГОНАЛЕЙ, СТРОГО 90 ГРАДУСОВ)
  const directions = [
    { dc: 1, dr: 0, cost: cellSize, dir: 0 },
    { dc: -1, dr: 0, cost: cellSize, dir: 1 },
    { dc: 0, dr: 1, cost: cellSize, dir: 2 },
    { dc: 0, dr: -1, cost: cellSize, dir: 3 }
  ]

  const gScore = new Float32Array(totalCells).fill(Infinity)
  const cameFrom = new Int32Array(totalCells).fill(-1)
  const cameFromDir = new Int8Array(totalCells).fill(-1)
  const closed = new Uint8Array(totalCells)

  const openQueue = new PriorityQueue()

  gScore[startIndex] = 0
  const hStart = Math.abs(start.x - end.x) + Math.abs(start.y - end.y)
  openQueue.push(startIndex, hStart)

  let found = false

  while (!openQueue.isEmpty()) {
    const current = openQueue.pop()!
    if (current === endIndex) {
      found = true
      break
    }

    if (closed[current]) continue
    closed[current] = 1

    const currCol = current % cols
    const currRow = Math.floor(current / cols)
    const currentG = gScore[current]
    const currentDir = cameFromDir[current]

    for (let i = 0; i < directions.length; i++) {
      const { dc, dr, cost, dir } = directions[i]
      const nextCol = currCol + dc
      const nextRow = currRow + dr

      if (!isCellWalkable(nextCol, nextRow)) continue

      const nextIndex = nextRow * cols + nextCol
      if (closed[nextIndex]) continue

      // Штраф за приближение к стене (побуждает идти по центру коридоров)
      const dWall = distField[nextIndex]
      let penalty = 0
      if (dWall < clearance * 1.8) {
        penalty = ((clearance * 1.8 - dWall) / (clearance * 1.8)) * (cellSize * 0.9)
      }

      // Штраф за поворот на 90 градусов (побуждает идти по прямым линиям без лишних изломов)
      const turnPenalty = (currentDir !== -1 && currentDir !== dir) ? cellSize * 0.75 : 0

      const tentativeG = currentG + cost + penalty + turnPenalty

      if (tentativeG < gScore[nextIndex]) {
        cameFrom[nextIndex] = current
        cameFromDir[nextIndex] = dir
        gScore[nextIndex] = tentativeG
        const nextWx = minX + nextCol * cellSize
        const nextWy = minY + nextRow * cellSize
        // Манхэттенская эвристика для сетки с движением под 90 градусов
        const h = Math.abs(nextWx - end.x) + Math.abs(nextWy - end.y)
        openQueue.push(nextIndex, tentativeG + h)
      }
    }
  }

  if (!found) return null

  // Восстанавливаем цепочку центров ячеек
  const gridPath: Point[] = []
  let curr = endIndex
  while (curr !== -1) {
    const c = curr % cols
    const r = Math.floor(curr / cols)
    gridPath.push({
      x: minX + c * cellSize,
      y: minY + r * cellSize
    })
    if (curr === startIndex) break
    curr = cameFrom[curr]
  }

  gridPath.reverse()

  // Соединяем со стартом и финишем СТРОГО под 90 градусов
  const firstGrid = gridPath[0]
  const lastGrid = gridPath[gridPath.length - 1]

  const startLeg = connectOrthogonal(start, firstGrid, segments)
  const endLeg = connectOrthogonal(lastGrid, end, segments)

  const combined: Point[] = [
    ...startLeg.slice(0, -1),
    ...gridPath,
    ...endLeg.slice(1)
  ]

  return mergeCollinear(combined)
}

/**
 * Ортогональное сглаживание:
 * Устраняет мелкие лесенки и избыточные повороты, сохраняя ВСЕ углы СТРОГО 90 градусов
 * и контролируя безопасный отступ от стен.
 */
function smoothOrthogonalPath(rawPath: Point[], segments: WallSegment[], clearance: number): Point[] {
  let path = mergeCollinear(rawPath)
  if (path.length <= 2) return path

  let changed = true
  let iterations = 0

  while (changed && iterations < 3) {
    changed = false
    iterations++
    const simplified: Point[] = [path[0]]
    let i = 0

    while (i < path.length - 1) {
      let bestJ = i + 1
      let bestCorner: Point | null = null

      // Ищем самую дальнюю точку, которую можно соединить одной прямой или одним углом 90°
      for (let j = path.length - 1; j > i + 1; j--) {
        const p1 = path[i]
        const p2 = path[j]

        // 1. Прямая линия по горизонтали или вертикали
        if (Math.abs(p1.x - p2.x) < 1e-3 || Math.abs(p1.y - p2.y) < 1e-3) {
          if (isLineClear(p1, p2, segments, clearance * 0.75)) {
            bestJ = j
            bestCorner = null
            break
          }
        }

        // 2. Одиночный Г-образный поворот под 90°
        const cX: Point = { x: p2.x, y: p1.y }
        const cY: Point = { x: p1.x, y: p2.y }

        const canX = isOrthogonalLValid(p1, p2, cX, segments, clearance * 0.75)
        const canY = isOrthogonalLValid(p1, p2, cY, segments, clearance * 0.75)

        if (canX && canY) {
          const dX = distToWalls(cX.x, cX.y, segments)
          const dY = distToWalls(cY.x, cY.y, segments)
          bestJ = j
          bestCorner = dX >= dY ? cX : cY
          break
        } else if (canX) {
          bestJ = j
          bestCorner = cX
          break
        } else if (canY) {
          bestJ = j
          bestCorner = cY
          break
        }
      }

      if (bestCorner) {
        simplified.push(bestCorner)
      }
      simplified.push(path[bestJ])

      if (bestJ > i + 1) {
        changed = true
      }
      i = bestJ
    }

    path = mergeCollinear(simplified)
  }

  return path
}

// Получение координат точки и угла направления на траектории при параметре t от 0 до 1
export function getPointAlongPath(points: Point[], t: number): { x: number; y: number; angle: number } | null {
  if (points.length < 2) return null
  const totalLen = calculatePathLength(points)
  if (totalLen === 0) return { x: points[0].x, y: points[0].y, angle: 0 }

  const targetDist = Math.max(0, Math.min(totalLen, totalLen * t))
  let accumulated = 0

  for (let i = 1; i < points.length; i++) {
    const p1 = points[i - 1]
    const p2 = points[i]
    const segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y)
    if (accumulated + segLen >= targetDist || i === points.length - 1) {
      const segT = segLen === 0 ? 0 : (targetDist - accumulated) / segLen
      const x = p1.x + (p2.x - p1.x) * segT
      const y = p1.y + (p2.y - p1.y) * segT
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x)
      return { x, y, angle }
    }
    accumulated += segLen
  }
  const last = points[points.length - 1]
  return { x: last.x, y: last.y, angle: 0 }
}

// Отрисовка пути с учетом прогресса анимации (от 0 до 1)
export function tracePartialPath(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  progress: number,
  worldToCanvas: (x: number, y: number) => { x: number; y: number }
) {
  if (points.length < 2 || progress <= 0) return
  const totalLen = calculatePathLength(points)
  const targetDist = totalLen * Math.min(1, Math.max(0, progress))

  const p0 = worldToCanvas(points[0].x, points[0].y)
  ctx.moveTo(p0.x, p0.y)

  let accumulated = 0
  for (let i = 1; i < points.length; i++) {
    const pPrev = points[i - 1]
    const pCurr = points[i]
    const segLen = Math.hypot(pCurr.x - pPrev.x, pCurr.y - pPrev.y)

    if (accumulated + segLen <= targetDist) {
      const cp = worldToCanvas(pCurr.x, pCurr.y)
      ctx.lineTo(cp.x, cp.y)
      accumulated += segLen
    } else {
      const remain = targetDist - accumulated
      const t = segLen === 0 ? 0 : remain / segLen
      const interpX = pPrev.x + (pCurr.x - pPrev.x) * t
      const interpY = pPrev.y + (pCurr.y - pPrev.y) * t
      const cp = worldToCanvas(interpX, interpY)
      ctx.lineTo(cp.x, cp.y)
      break
    }
  }
}

