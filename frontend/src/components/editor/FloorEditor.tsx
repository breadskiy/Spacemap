import { useState, useCallback, useEffect, useTransition } from 'react'
import { apiGetSpacePlan, apiSaveSpacePlan } from '../../utils/api'
import type { SpaceObject } from '../../types/space'
import type { PlanData, PlanFloor, PlanCorner, PlanRoom, PlanPoi, PlanPanorama } from '../../types/plan'
import type { EditorTool, PanZoomState } from '../../types/editor'

import { EditorHeader } from './EditorHeader'
import { EditorSidebar } from './EditorSidebar'
import { EditorCanvas } from './EditorCanvas'
import { EditorStatusBar } from './EditorStatusBar'

import { CornerCreateModal } from './modals/CornerCreateModal'
import { CornerEditModal } from './modals/CornerEditModal'
import { RoomEditModal } from './modals/RoomEditModal'
import { PoiEditModal } from './modals/PoiEditModal'
import { PanoramaEditModal } from './modals/PanoramaEditModal'
import { PanoramaHelpModal } from './modals/PanoramaHelpModal'
import { JsonCodeModal } from './modals/JsonCodeModal'
import { EditorHelpModal } from './modals/EditorHelpModal'
import { PanoramaViewerModal } from '../PanoramaViewerModal'

interface FloorEditorProps {
  space: SpaceObject
  onBack: () => void
  onUpdateSpace: (updated: SpaceObject) => void
}

const DEFAULT_PLAN: PlanData = {
  floors: [
    {
      id: 'floor-1',
      name: '1 этаж',
      level: 1,
      height: 3.5,
      corners: [],
      walls: [],
      rooms: [],
      pois: [],
      panoramas: []
    }
  ]
}

function safeSetPlanStorage(spaceId: string, planData: PlanData): void {
  try {
    const key = `spacemap_plan_${spaceId}`
    // Исключаем гигантские base64 из локального кэша, чтобы никогда не вызывать QuotaExceededError
    const strippedPlan: PlanData = {
      ...planData,
      floors: planData.floors.map(f => ({
        ...f,
        panoramas: f.panoramas?.map(p => {
          const img = p.image_data || p.image || ''
          if (img.startsWith('data:') && img.length > 50000) {
            return { ...p, image_data: undefined, imageData: undefined }
          }
          return p
        })
      }))
    }
    localStorage.setItem(key, JSON.stringify(strippedPlan))
  } catch (err) {
    console.warn('LocalStorage quota exceeded, clearing obsolete drafts:', err)
    try {
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && (k.startsWith('spacemap_plan_') || k.startsWith('ttk_'))) {
          keysToRemove.push(k)
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k))
    } catch (_) {}
  }
}

export function FloorEditor({ space, onBack: _onBack, onUpdateSpace }: FloorEditorProps) {
  const [, startTransition] = useTransition()
  // Хранилище плана этажей
  const [plan, setPlan] = useState<PlanData>(() => {
    try {
      const savedKey = `spacemap_plan_${space.id}`
      const raw = localStorage.getItem(savedKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed?.floors?.length > 0) return parsed
      }
      localStorage.removeItem('ttk_floor_plan_draft')
    } catch (_) {}
    return DEFAULT_PLAN
  })

  const [activeFloorId, setActiveFloorId] = useState<string>(
    () => plan.floors[0]?.id || 'floor-1'
  )

  // Инструмент и навигация
  const [tool, setTool] = useState<EditorTool>('select')
  const [panZoom, setPanZoom] = useState<PanZoomState>({
    pan: { x: 120, y: 550 },
    zoom: 1.0
  })

  // Загрузка актуального 2D-плана из базы данных PostgreSQL
  useEffect(() => {
    // Очищаем потенциально переполненные ключи LocalStorage с тяжелыми data: URI
    try {
      const savedKey = `spacemap_plan_${space.id}`
      const val = localStorage.getItem(savedKey)
      if (val && val.length > 500000) {
        localStorage.removeItem(savedKey)
      }
    } catch (_) {}

    apiGetSpacePlan(space.id).then(serverPlan => {
      if (serverPlan?.floors?.length > 0) {
        setPlan(serverPlan)
        if (serverPlan.floors[0]?.id) {
          setActiveFloorId(serverPlan.floors[0].id)
        }
      }
    }).catch(err => {
      console.warn('Could not fetch space plan from server', err)
    })
  }, [space.id])

  // Выбранные сущности
  const [selectedCornerId, setSelectedCornerId] = useState<string | null>(null)
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null)
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null)
  const [selectedPanoId, setSelectedPanoId] = useState<string | null>(null)

  // Статус и координаты курсора
  const [statusHint, setStatusHint] = useState<string>('Курсор: выберите инструмент или перемещайтесь по плану')
  const [cursorCoords, setCursorCoords] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isDirty, setIsDirty] = useState<boolean>(false)
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [justSaved, setJustSaved] = useState<boolean>(false)

  // Модальные окна
  const [modalCornerCreate, setModalCornerCreate] = useState<{ isOpen: boolean; x: number; y: number }>({
    isOpen: false,
    x: 0,
    y: 0
  })
  const [modalCornerEdit, setModalCornerEdit] = useState<{ isOpen: boolean; corner: PlanCorner | null }>({
    isOpen: false,
    corner: null
  })
  const [modalRoomEdit, setModalRoomEdit] = useState<{
    isOpen: boolean
    room: PlanRoom | null
    cornerIds: string[]
  }>({
    isOpen: false,
    room: null,
    cornerIds: []
  })
  const [modalPoiEdit, setModalPoiEdit] = useState<{
    isOpen: boolean
    poi: PlanPoi | null
    x: number
    y: number
  }>({
    isOpen: false,
    poi: null,
    x: 0,
    y: 0
  })
  const [modalPanoEdit, setModalPanoEdit] = useState<{
    isOpen: boolean
    pano: PlanPanorama | null
    x: number
    y: number
    targetRoomId?: string
  }>({
    isOpen: false,
    pano: null,
    x: 0,
    y: 0
  })
  const [isPanoHelpOpen, setIsPanoHelpOpen] = useState<boolean>(false)
  const [isJsonModalOpen, setIsJsonModalOpen] = useState<boolean>(false)
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false)
  const [viewerPanorama, setViewerPanorama] = useState<PlanPanorama | null>(null)

  const currentFloor = plan.floors.find(f => f.id === activeFloorId) || plan.floors[0]

  // Автосохранение в LocalStorage и PostgreSQL
  const savePlanToStorage = useCallback(
    (currentPlan: PlanData) => {
      try {
        safeSetPlanStorage(space.id, currentPlan)

        // Обновляем количество стен в объекте
        const floor0 = currentPlan.floors[0]
        const wallsCount = floor0?.walls?.length ?? space.wallsCount
        const updatedSpace = { ...space, wallsCount }
        onUpdateSpace(updatedSpace)

        // Сохраняем чертёж в PostgreSQL базу данных в фоне
        apiSaveSpacePlan(space.id, currentPlan).catch(err => {
          console.warn('Backend auto-save notice:', err)
        })

      } catch (err) {
        console.warn('Ошибка сохранения плана:', err)
      }
    },
    [space, onUpdateSpace]
  )

  // Явное сохранение изменений
  const handleManualSave = useCallback(async () => {
    setIsSaving(true)
    setStatusHint('Сохранение чертежа в базу данных PostgreSQL...')
    try {
      safeSetPlanStorage(space.id, plan)
      const saved = await apiSaveSpacePlan(space.id, plan)
      if (saved && saved.floors) {
        setPlan(saved)
      }
      setIsDirty(false)
      setJustSaved(true)
      setStatusHint('✓ Все изменения (стены, зоны, POI, панорамы) успешно сохранены!')
      setTimeout(() => setJustSaved(false), 2500)
    } catch (err: any) {
      console.error('Ошибка сохранения:', err)
      setStatusHint(`Ошибка сохранения: ${err.message || 'сервер недоступен'}`)
    } finally {
      setIsSaving(false)
    }
  }, [plan, space.id])

  // Пересчет длин стен для этажа
  const recalculateWalls = (floor: PlanFloor): PlanFloor => {
    const updatedWalls = floor.walls.map(w => {
      const c1 = floor.corners.find(c => c.id === w.from)
      const c2 = floor.corners.find(c => c.id === w.to)
      return {
        ...w,
        length: c1 && c2 ? Math.round(Math.hypot(c2.x - c1.x, c2.y - c1.y)) : w.length
      }
    })
    return { ...floor, walls: updatedWalls }
  }

  // Обновление этажа в плане
  const updateCurrentFloor = useCallback(
    (updater: (floor: PlanFloor) => PlanFloor) => {
      setIsDirty(true)
      setPlan(prevPlan => {
        const nextFloors = prevPlan.floors.map(f => {
          if (f.id === activeFloorId) {
            return recalculateWalls(updater(f))
          }
          return f
        })
        const nextPlan = { ...prevPlan, floors: nextFloors }
        savePlanToStorage(nextPlan)
        return nextPlan
      })
    },
    [activeFloorId, savePlanToStorage]
  )

  // Управление инструментом и подсказками
  const handleSelectTool = (newTool: EditorTool) => {
    setTool(newTool)
    setSelectedCornerId(null)
    setSelectedWallId(null)
    setSelectedRoomId(null)
    setSelectedPoiId(null)
    setSelectedPanoId(null)

    switch (newTool) {
      case 'select':
        setStatusHint('Курсор: кликните по объекту для выбора или перетащите его мышью')
        break
      case 'corner':
        setStatusHint('Точка: кликните по холсту для добавления вершины')
        break
      case 'wall':
        setStatusHint('Стена: кликните по первой точке, затем по второй для возведения стены')
        break
      case 'room':
        setStatusHint('Зона: последовательно кликайте по углам, затем кликните по первой точке для замыкания зоны')
        break
      case 'poi':
        setStatusHint('POI: кликните внутри зоны или на плане для создания точки интереса')
        break
      case 'pano':
        setStatusHint('360°: кликните по холсту для расстановки точки панорамного обзора')
        break
      case 'delete':
        setStatusHint('Удалить: кликайте по точкам, стенам, зонам, POI или панорамам для удаления')
        break
    }
  }

  // Центрирование на точке
  const handleCenterPoint = (wx: number, wy: number) => {
    const canvas = document.querySelector('canvas')
    const w = canvas?.clientWidth || 800
    const h = canvas?.clientHeight || 600

    startTransition(() => {
      setPanZoom(prev => ({
        ...prev,
        pan: {
          x: w / 2 - wx * prev.zoom,
          y: h / 2 + wy * prev.zoom
        }
      }))
    })
  }

  // Управление точками (Corners)
  const handleCreateCorner = (x: number, y: number, connectWithCornerId?: string) => {
    updateCurrentFloor(floor => {
      let maxId = 0
      floor.corners.forEach(c => {
        const n = parseInt(c.id)
        if (!isNaN(n) && n > maxId) maxId = n
      })
      const newId = (maxId + 1).toString()
      const newCorner: PlanCorner = { id: newId, x, y }
      const corners = [...floor.corners, newCorner]

      let walls = [...floor.walls]
      if (connectWithCornerId) {
        walls.push({
          id: `w_${Math.floor(Math.random() * 100000)}`,
          from: connectWithCornerId,
          to: newId
        })
      }

      return { ...floor, corners, walls }
    })
    setStatusHint(`Создана точка [X: ${x}, Y: ${y}]`)
  }

  // Быстрое создание точек со Shift
  const handleFastCreateCorner = useCallback((x: number, y: number) => {
    handleCreateCorner(x, y)
    setIsDirty(true)
    setStatusHint(`Точка создана в [${x}, ${y}]. Зажмите Shift для быстрого создания точек.`)
  }, [handleCreateCorner])

  // Быстрое создание точки и продолжение стены прямо по сетке
  const handleFastCreateWallCorner = useCallback(
    (x: number, y: number, connectFromId?: string | null): string => {
      let createdId = '1'
      const curFloor = plan.floors.find(f => f.id === activeFloorId) || plan.floors[0]
      if (curFloor) {
        let maxId = 0
        curFloor.corners.forEach(c => {
          const n = parseInt(c.id)
          if (!isNaN(n) && n > maxId) maxId = n
        })
        createdId = (maxId + 1).toString()
      }

      updateCurrentFloor(floor => {
        let maxId = 0
        floor.corners.forEach(c => {
          const n = parseInt(c.id)
          if (!isNaN(n) && n > maxId) maxId = n
        })
        const newId = (maxId + 1).toString()
        const newCorner: PlanCorner = { id: newId, x, y }
        const corners = [...floor.corners, newCorner]

        let walls = [...floor.walls]
        if (connectFromId) {
          const exists = walls.some(
            w =>
              (w.from === connectFromId && w.to === newId) ||
              (w.from === newId && w.to === connectFromId)
          )
          if (!exists) {
            walls.push({
              id: `w_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
              from: connectFromId,
              to: newId
            })
          }
        }
        return { ...floor, corners, walls }
      })

      setIsDirty(true)
      setStatusHint(`Создана точка [${createdId}] на сетке`)
      return createdId
    },
    [plan, activeFloorId, updateCurrentFloor]
  )

  // Добавление базового контура комнаты (4 точки)
  const handleAddDefaultBox = useCallback(() => {
    updateCurrentFloor(floor => {
      let maxId = 0
      floor.corners.forEach(c => {
        const n = parseInt(c.id)
        if (!isNaN(n) && n > maxId) maxId = n
      })
      const c1 = (maxId + 1).toString()
      const c2 = (maxId + 2).toString()
      const c3 = (maxId + 3).toString()
      const c4 = (maxId + 4).toString()
      const newCorners: PlanCorner[] = [
        { id: c1, x: 100, y: 100 },
        { id: c2, x: 500, y: 100 },
        { id: c3, x: 500, y: 400 },
        { id: c4, x: 100, y: 400 }
      ]
      const newWalls = [
        { id: `w_${Date.now()}_1`, from: c1, to: c2 },
        { id: `w_${Date.now()}_2`, from: c2, to: c3 },
        { id: `w_${Date.now()}_3`, from: c3, to: c4 },
        { id: `w_${Date.now()}_4`, from: c4, to: c1 }
      ]
      return {
        ...floor,
        corners: [...floor.corners, ...newCorners],
        walls: [...floor.walls, ...newWalls]
      }
    })
    setIsDirty(true)
    setStatusHint('Добавлен базовый прямоугольный контур (4 точки, 4 стены)')
  }, [updateCurrentFloor])

  // Очистка текущего этажа
  const handleClearFloor = useCallback(() => {
    if (window.confirm('Очистить все точки, стены и зоны на этом этаже?')) {
      updateCurrentFloor(floor => ({
        ...floor,
        corners: [],
        walls: [],
        rooms: [],
        pois: [],
        panoramas: []
      }))
      setIsDirty(true)
      setStatusHint('Этаж полностью очищен')
    }
  }, [updateCurrentFloor])

  const handleCornerMove = (cornerId: string, x: number, y: number) => {
    updateCurrentFloor(floor => ({
      ...floor,
      corners: floor.corners.map(c => (c.id === cornerId ? { ...c, x, y } : c))
    }))
  }

  const handleSaveEditedCorner = (cornerId: string, x: number, y: number) => {
    handleCornerMove(cornerId, x, y)
    setStatusHint(`Координаты точки [${cornerId}] обновлены`)
  }

  const handleDeleteCorner = (cornerId: string) => {
    updateCurrentFloor(floor => ({
      ...floor,
      corners: floor.corners.filter(c => c.id !== cornerId),
      walls: floor.walls.filter(w => w.from !== cornerId && w.to !== cornerId),
      rooms: floor.rooms?.map(r => ({
        ...r,
        corners: r.corners.filter(cid => cid !== cornerId)
      })).filter(r => r.corners.length >= 3)
    }))
    setStatusHint(`Точка [${cornerId}] удалена`)
  }

  // Управление стенами (Walls)
  const handleCreateWall = (from: string, to: string) => {
    updateCurrentFloor(floor => {
      const exists = floor.walls.some(
        w => (w.from === from && w.to === to) || (w.from === to && w.to === from)
      )
      if (exists) return floor

      return {
        ...floor,
        walls: [...floor.walls, { id: `w_${Math.floor(Math.random() * 100000)}`, from, to }]
      }
    })
    setStatusHint(`Стена построена между [${from}] и [${to}]`)
  }

  const handleDeleteWall = (wallId: string) => {
    updateCurrentFloor(floor => ({
      ...floor,
      walls: floor.walls.filter(w => w.id !== wallId)
    }))
    setStatusHint('Стена удалена')
  }

  // Управление комнатами (Rooms)
  const handleSaveRoom = (data: { id?: string; name: string; color: string; corners: string[] }) => {
    updateCurrentFloor(floor => {
      const currentRooms = floor.rooms || []
      if (data.id) {
        return {
          ...floor,
          rooms: currentRooms.map(r => (r.id === data.id ? { ...r, ...data } : r))
        }
      } else {
        const newRoom: PlanRoom = {
          id: `room_${Math.floor(Math.random() * 100000)}`,
          name: data.name,
          color: data.color,
          corners: data.corners
        }
        return {
          ...floor,
          rooms: [...currentRooms, newRoom]
        }
      }
    })
    setStatusHint(`Зона "${data.name}" сохранена`)
  }

  const handleDeleteRoom = (roomId: string) => {
    updateCurrentFloor(floor => ({
      ...floor,
      rooms: floor.rooms?.filter(r => r.id !== roomId),
      pois: floor.pois?.map(p => (p.room_id === roomId ? { ...p, room_id: undefined } : p)),
      panoramas: floor.panoramas?.map(pa => (pa.room_id === roomId ? { ...pa, room_id: undefined } : pa))
    }))
    setStatusHint('Зона удалена')
  }

  // Управление POI
  const handleSavePoi = (data: {
    id?: string
    name: string
    category: string
    x: number
    y: number
    description?: string
    room_id?: string
  }) => {
    updateCurrentFloor(floor => {
      const currentPois = floor.pois || []
      if (data.id) {
        return {
          ...floor,
          pois: currentPois.map(p => (p.id === data.id ? { ...p, ...data } : p))
        }
      } else {
        const newPoi: PlanPoi = {
          id: `poi_${Math.floor(Math.random() * 100000)}`,
          name: data.name,
          category: data.category,
          x: data.x,
          y: data.y,
          description: data.description,
          room_id: data.room_id
        }
        return {
          ...floor,
          pois: [...currentPois, newPoi]
        }
      }
    })
    setStatusHint(`Точка интереса "${data.name}" сохранена`)
  }

  const handlePoiMove = (poiId: string, x: number, y: number) => {
    updateCurrentFloor(floor => ({
      ...floor,
      pois: floor.pois?.map(p => (p.id === poiId ? { ...p, x, y } : p))
    }))
  }

  const handleDeletePoi = (poiId: string) => {
    updateCurrentFloor(floor => ({
      ...floor,
      pois: floor.pois?.filter(p => p.id !== poiId)
    }))
    setStatusHint('Точка интереса удалена')
  }

  // Управление 360° панорамами
  const handleSavePano = (panoData: PlanPanorama) => {
    updateCurrentFloor(floor => {
      const currentPanos = floor.panoramas || []
      const exists = currentPanos.some(p => p.id === panoData.id)
      return {
        ...floor,
        panoramas: exists
          ? currentPanos.map(p => (p.id === panoData.id ? panoData : p))
          : [...currentPanos, panoData]
      }
    })
    setStatusHint(`Панорама "${panoData.name}" сохранена`)
  }

  const handlePanoMove = (panoId: string, x: number, y: number) => {
    updateCurrentFloor(floor => ({
      ...floor,
      panoramas: floor.panoramas?.map(p => (p.id === panoId ? { ...p, x, y } : p))
    }))
  }

  const handleDeletePano = (panoId: string) => {
    updateCurrentFloor(floor => ({
      ...floor,
      panoramas: floor.panoramas?.filter(p => p.id !== panoId)
    }))
    setStatusHint('Панорама удалена')
  }

  // Управление этажами
  const handleAddFloor = () => {
    const nextLevel = plan.floors.length + 1
    const newFloor: PlanFloor = {
      id: `floor-${Date.now()}`,
      name: `${nextLevel} этаж`,
      level: nextLevel,
      height: 3.5,
      corners: [],
      walls: [],
      rooms: [],
      pois: [],
      panoramas: []
    }
    const nextPlan = { ...plan, floors: [...plan.floors, newFloor] }
    setPlan(nextPlan)
    setActiveFloorId(newFloor.id)
    savePlanToStorage(nextPlan)
    setStatusHint(`Создан ${newFloor.name}`)
  }

  const handleUpdateFloorParams = (floorId: string, params: { name: string; level: number; height: number }) => {
    setPlan(prev => {
      const nextFloors = prev.floors.map(f => (f.id === floorId ? { ...f, ...params } : f))
      const nextPlan = { ...prev, floors: nextFloors }
      savePlanToStorage(nextPlan)
      return nextPlan
    })
  }

  const handleDeleteFloor = (floorId: string) => {
    if (plan.floors.length <= 1) return
    const nextFloors = plan.floors.filter(f => f.id !== floorId)
    const nextPlan = { ...plan, floors: nextFloors }
    setPlan(nextPlan)
    if (activeFloorId === floorId) {
      setActiveFloorId(nextFloors[0].id)
    }
    savePlanToStorage(nextPlan)
    setStatusHint('Этаж удален')
  }

  // Экспорт и импорт JSON
  const handleExportJson = () => {
    const jsonStr = JSON.stringify(plan, null, 2)
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `plan-${space.id || 'export'}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setStatusHint('План экспортирован в JSON')
  }

  const handleImportJson = (file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const content = e.target?.result as string
        const parsed = JSON.parse(content)
        if (parsed && Array.isArray(parsed.floors) && parsed.floors.length > 0) {
          setPlan(parsed)
          setActiveFloorId(parsed.floors[0].id)
          savePlanToStorage(parsed)
          setStatusHint('План успешно импортирован из JSON!')
        } else {
          alert('Файл не содержит корректной структуры этажей SpaceMap.')
        }
      } catch (err) {
        alert('Ошибка при чтении JSON: неверный формат файла.')
      }
    }
    reader.readAsText(file)
  }

  // Зум и сброс вида
  const handleZoomIn = () => {
    setPanZoom(prev => ({
      ...prev,
      zoom: Math.min(6.0, prev.zoom * 1.15)
    }))
  }

  const handleZoomOut = () => {
    setPanZoom(prev => ({
      ...prev,
      zoom: Math.max(0.15, prev.zoom * 0.85)
    }))
  }

  const handleResetView = () => {
    setPanZoom({
      pan: { x: 120, y: 550 },
      zoom: 1.0
    })
    setStatusHint('Вид сброшен к началу координат')
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-slate-900 select-none">
      {/* Шапка редактора */}
      <EditorHeader
        tool={tool}
        onSelectTool={handleSelectTool}
        onSave={handleManualSave}
        onExportJson={handleExportJson}
        onImportJson={handleImportJson}
        onOpenJsonModal={() => setIsJsonModalOpen(true)}
        isDirty={isDirty}
        isSaving={isSaving}
        justSaved={justSaved}
        onOpenHelp={() => setIsHelpOpen(true)}
      />

      {/* Основная рабочая область: Сайдбар + Канвас */}
      <div className="flex-1 flex overflow-hidden relative">
        <EditorSidebar
          floors={plan.floors}
          activeFloorId={activeFloorId}
          selectedCornerId={selectedCornerId}
          selectedWallId={selectedWallId}
          selectedRoomId={selectedRoomId}
          selectedPoiId={selectedPoiId}
          selectedPanoId={selectedPanoId}
          onSelectFloor={id => {
            setActiveFloorId(id)
            setSelectedCornerId(null)
            setSelectedWallId(null)
            setSelectedRoomId(null)
            setSelectedPoiId(null)
            setSelectedPanoId(null)
          }}
          onAddFloor={handleAddFloor}
          onUpdateFloorParams={handleUpdateFloorParams}
          onDeleteFloor={handleDeleteFloor}
          onSelectCorner={id => setSelectedCornerId(id)}
          onCenterPoint={handleCenterPoint}
          onEditCorner={corner => setModalCornerEdit({ isOpen: true, corner })}
          onDeleteCorner={handleDeleteCorner}
          onSelectWall={id => setSelectedWallId(id)}
          onDeleteWall={handleDeleteWall}
          onSelectRoom={id => setSelectedRoomId(id)}
          onEditRoom={room => setModalRoomEdit({ isOpen: true, room, cornerIds: room.corners })}
          onDeleteRoom={handleDeleteRoom}
          onSelectPoi={id => setSelectedPoiId(id)}
          onEditPoi={poi => setModalPoiEdit({ isOpen: true, poi, x: poi.x, y: poi.y })}
          onDeletePoi={handleDeletePoi}
          onSelectPano={id => setSelectedPanoId(id)}
          onEditPano={pano =>
            setModalPanoEdit({
              isOpen: true,
              pano,
              x: pano.x,
              y: pano.y,
              targetRoomId: pano.room_id
            })
          }
          onViewPano={pano => setViewerPanorama(pano)}
          onDeletePano={handleDeletePano}
          onOpenPanoHelp={() => setIsPanoHelpOpen(true)}
          onAddDefaultBox={handleAddDefaultBox}
          onClearFloor={handleClearFloor}
          onStartCreatePano={() =>
            setModalPanoEdit({
              isOpen: true,
              pano: null,
              x: 200,
              y: 200
            })
          }
        />

        <EditorCanvas
          floor={currentFloor}
          tool={tool}
          panZoom={panZoom}
          onPanZoomChange={setPanZoom}
          selectedCornerId={selectedCornerId}
          selectedWallId={selectedWallId}
          selectedRoomId={selectedRoomId}
          selectedPoiId={selectedPoiId}
          selectedPanoId={selectedPanoId}
          onSelectCorner={setSelectedCornerId}
          onSelectWall={setSelectedWallId}
          onSelectRoom={setSelectedRoomId}
          onSelectPoi={setSelectedPoiId}
          onSelectPano={setSelectedPanoId}
          onCornerMove={handleCornerMove}
          onPoiMove={handlePoiMove}
          onPanoMove={handlePanoMove}
          onCreateWall={handleCreateWall}
          onDeleteCorner={handleDeleteCorner}
          onDeleteWall={handleDeleteWall}
          onDeleteRoom={handleDeleteRoom}
          onDeletePoi={handleDeletePoi}
          onDeletePano={handleDeletePano}
          onFastCreateCorner={handleFastCreateCorner}
          onFastCreateWallCorner={handleFastCreateWallCorner}
          onOpenCornerCreateModal={(x, y) => setModalCornerCreate({ isOpen: true, x, y })}
          onOpenCornerEditModal={corner => setModalCornerEdit({ isOpen: true, corner })}
          onOpenRoomCreateModal={cornerIds =>
            setModalRoomEdit({ isOpen: true, room: null, cornerIds })
          }
          onOpenRoomEditModal={room =>
            setModalRoomEdit({ isOpen: true, room, cornerIds: room.corners })
          }
          onOpenPoiCreateModal={(x, y) => setModalPoiEdit({ isOpen: true, poi: null, x, y })}
          onOpenPoiEditModal={poi => setModalPoiEdit({ isOpen: true, poi, x: poi.x, y: poi.y })}
          onOpenPanoCreateModal={(x, y, rId) =>
            setModalPanoEdit({
              isOpen: true,
              pano: null,
              x,
              y,
              targetRoomId: rId
            })
          }
          onOpenPanoViewerModal={pano => setViewerPanorama(pano)}
          onCursorMove={setCursorCoords}
          onStatusHintChange={setStatusHint}
        />
      </div>

      {/* Нижняя строка статуса */}
      <EditorStatusBar
        hint={statusHint}
        cursorCoords={cursorCoords}
        zoom={panZoom.zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetView={handleResetView}
      />

      {/* Модальные окна */}
      <CornerCreateModal
        isOpen={modalCornerCreate.isOpen}
        defaultX={modalCornerCreate.x}
        defaultY={modalCornerCreate.y}
        corners={currentFloor?.corners || []}
        onClose={() => setModalCornerCreate({ isOpen: false, x: 0, y: 0 })}
        onCreate={handleCreateCorner}
      />

      <CornerEditModal
        isOpen={modalCornerEdit.isOpen}
        corner={modalCornerEdit.corner}
        onClose={() => setModalCornerEdit({ isOpen: false, corner: null })}
        onSave={handleSaveEditedCorner}
      />

      <RoomEditModal
        isOpen={modalRoomEdit.isOpen}
        room={modalRoomEdit.room}
        cornerIds={modalRoomEdit.cornerIds}
        onClose={() => setModalRoomEdit({ isOpen: false, room: null, cornerIds: [] })}
        onSave={handleSaveRoom}
      />

      <PoiEditModal
        isOpen={modalPoiEdit.isOpen}
        poi={modalPoiEdit.poi}
        defaultX={modalPoiEdit.x}
        defaultY={modalPoiEdit.y}
        rooms={currentFloor?.rooms || []}
        onClose={() => setModalPoiEdit({ isOpen: false, poi: null, x: 0, y: 0 })}
        onSave={handleSavePoi}
      />

      <PanoramaEditModal
        isOpen={modalPanoEdit.isOpen}
        pano={modalPanoEdit.pano}
        defaultX={modalPanoEdit.x}
        defaultY={modalPanoEdit.y}
        targetRoomId={modalPanoEdit.targetRoomId}
        floor={currentFloor}
        onClose={() =>
          setModalPanoEdit({ isOpen: false, pano: null, x: 0, y: 0, targetRoomId: undefined })
        }
        onSave={handleSavePano}
        onDelete={handleDeletePano}
        onOpenViewer={pano => setViewerPanorama(pano)}
      />

      <PanoramaHelpModal
        isOpen={isPanoHelpOpen}
        onClose={() => setIsPanoHelpOpen(false)}
      />

      <EditorHelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      <JsonCodeModal
        isOpen={isJsonModalOpen}
        planData={plan}
        onClose={() => setIsJsonModalOpen(false)}
        onApply={data => {
          setPlan(data)
          if (data.floors.length > 0) setActiveFloorId(data.floors[0].id)
          savePlanToStorage(data)
          setStatusHint('План обновлен из JSON')
        }}
      />

      {viewerPanorama && (
        <PanoramaViewerModal
          panorama={viewerPanorama}
          roomName={
            currentFloor?.rooms?.find(r => r.id === viewerPanorama.room_id)?.name || 'Помещение'
          }
          floorName={currentFloor?.name || '1 этаж'}
          onClose={() => setViewerPanorama(null)}
        />
      )}
    </div>
  )
}
