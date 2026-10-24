import { useState } from 'react'
import type { PlanFloor, PlanCorner, PlanRoom, PlanPoi, PlanPanorama } from '../../types/plan'
import {
  LayerGroupIcon,
  PointIcon,
  WallIcon,
  RoomIcon,
  PoiIcon,
  PanoIcon,
  PlusIcon,
  EditIcon,
  TrashIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  InfoIcon
} from './EditorIcons'

type SidebarTabType = 'floors' | 'corners' | 'walls' | 'rooms' | 'pois' | 'panos'

interface EditorSidebarProps {
  floors: PlanFloor[]
  activeFloorId: string
  selectedCornerId: string | null
  selectedWallId: string | null
  selectedRoomId: string | null
  selectedPoiId: string | null
  selectedPanoId: string | null
  onSelectFloor: (floorId: string) => void
  onAddFloor: () => void
  onUpdateFloorParams: (floorId: string, params: { name: string; level: number; height: number }) => void
  onDeleteFloor: (floorId: string) => void
  onSelectCorner: (cornerId: string) => void
  onCenterPoint: (x: number, y: number) => void
  onEditCorner: (corner: PlanCorner) => void
  onDeleteCorner: (cornerId: string) => void
  onSelectWall: (wallId: string) => void
  onDeleteWall: (wallId: string) => void
  onSelectRoom: (roomId: string) => void
  onEditRoom: (room: PlanRoom) => void
  onDeleteRoom: (roomId: string) => void
  onSelectPoi: (poiId: string) => void
  onEditPoi: (poi: PlanPoi) => void
  onDeletePoi: (poiId: string) => void
  onSelectPano: (panoId: string) => void
  onEditPano: (pano: PlanPanorama) => void
  onViewPano: (pano: PlanPanorama) => void
  onDeletePano: (panoId: string) => void
  onOpenPanoHelp: () => void
  onStartCreatePano: () => void
}

export function EditorSidebar({
  floors,
  activeFloorId,
  selectedCornerId,
  selectedWallId,
  selectedRoomId,
  selectedPoiId,
  selectedPanoId,
  onSelectFloor,
  onAddFloor,
  onUpdateFloorParams,
  onDeleteFloor,
  onSelectCorner,
  onCenterPoint,
  onEditCorner,
  onDeleteCorner,
  onSelectWall,
  onDeleteWall,
  onSelectRoom,
  onEditRoom,
  onDeleteRoom,
  onSelectPoi,
  onEditPoi,
  onDeletePoi,
  onSelectPano,
  onEditPano,
  onViewPano,
  onDeletePano,
  onOpenPanoHelp,
  onStartCreatePano
}: EditorSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<SidebarTabType>('floors')

  const currentFloor = floors.find(f => f.id === activeFloorId) || floors[0]

  const tabs: { id: SidebarTabType; label: string; count?: number; icon: React.ReactNode }[] = [
    {
      id: 'floors',
      label: 'Этаж',
      count: floors.length,
      icon: <LayerGroupIcon className="size-3 text-red-500" />
    },
    {
      id: 'corners',
      label: 'Точки',
      count: currentFloor?.corners?.length || 0,
      icon: <PointIcon className="size-3 text-amber-400" />
    },
    {
      id: 'walls',
      label: 'Стены',
      count: currentFloor?.walls?.length || 0,
      icon: <WallIcon className="size-3 text-emerald-400" />
    },
    {
      id: 'rooms',
      label: 'Зоны',
      count: currentFloor?.rooms?.length || 0,
      icon: <RoomIcon className="size-3 text-cyan-400" />
    },
    {
      id: 'pois',
      label: 'POI',
      count: currentFloor?.pois?.length || 0,
      icon: <PoiIcon className="size-3 text-rose-400" />
    },
    {
      id: 'panos',
      label: '360°',
      count: currentFloor?.panoramas?.length || 0,
      icon: <PanoIcon className="size-3 text-indigo-400" />
    }
  ]

  return (
    <div className="relative flex shrink-0 z-10 select-none">
      {/* Боковая панель */}
      <aside
        className={`bg-slate-800/95 border-r border-slate-700 flex flex-col shadow-xl text-slate-200 transition-all duration-300 relative overflow-hidden ${
          isCollapsed ? 'w-0 border-r-0' : 'w-80'
        }`}
      >
        {/* Сетка вкладок */}
        <div className="grid grid-cols-6 gap-0.5 border-b border-slate-700 bg-slate-900/90 p-1 text-[10px]">
          {tabs.map(tab => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-1.5 px-0.5 rounded-lg font-semibold flex flex-col items-center justify-center gap-0.5 transition ${
                  isActive
                    ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
                title={tab.label}
              >
                {tab.icon}
                <span className="truncate max-w-[42px]">{tab.label}</span>
                {tab.count !== undefined && (
                  <span className="text-[9px] opacity-75 font-mono">{tab.count}</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Содержимое активной вкладки */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          
          {/* Вкладка 1: Этажи */}
          {activeTab === 'floors' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-white">Список уровней здания</span>
                <button
                  onClick={onAddFloor}
                  className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold text-xs flex items-center gap-1 transition shadow cursor-pointer"
                >
                  <PlusIcon className="size-3" />
                  <span>Добавить этаж</span>
                </button>
              </div>

              <div className="space-y-1.5">
                {[...floors].sort((a, b) => b.level - a.level).map(floor => {
                  const isActive = floor.id === activeFloorId
                  return (
                    <div
                      key={floor.id}
                      onClick={() => onSelectFloor(floor.id)}
                      className={`p-2.5 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                        isActive
                          ? 'bg-red-600/15 border-red-500 text-white shadow-sm ring-1 ring-red-500/30'
                          : 'bg-slate-900/60 border-slate-700/60 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`size-6 rounded-md flex items-center justify-center font-bold text-xs ${
                            isActive ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {floor.level}
                        </span>
                        <div>
                          <div className="text-xs font-semibold">{floor.name}</div>
                          <div className="text-[10px] text-slate-400">
                            {floor.corners?.length || 0} точек · {floor.walls?.length || 0} стен
                          </div>
                        </div>
                      </div>

                      {floors.length > 1 && (
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            if (confirm(`Удалить этаж "${floor.name}"?`)) {
                              onDeleteFloor(floor.id)
                            }
                          }}
                          className="text-slate-500 hover:text-rose-400 p-1.5 rounded transition text-xs"
                          title="Удалить этаж"
                        >
                          <TrashIcon className="size-3.5" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Параметры выбранного этажа */}
              {currentFloor && (
                <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-700/80 space-y-2 mt-4 text-xs">
                  <span className="font-bold text-slate-300 block text-[11px]">
                    Параметры активного этажа
                  </span>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Название</label>
                    <input
                      type="text"
                      value={currentFloor.name}
                      onChange={e =>
                        onUpdateFloorParams(currentFloor.id, {
                          name: e.target.value,
                          level: currentFloor.level,
                          height: currentFloor.height || 3.5
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5">Уровень (номер)</label>
                      <input
                        type="number"
                        value={currentFloor.level}
                        onChange={e =>
                          onUpdateFloorParams(currentFloor.id, {
                            name: currentFloor.name,
                            level: parseInt(e.target.value) || 0,
                            height: currentFloor.height || 3.5
                          })
                        }
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5">Высота потолка (м)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={currentFloor.height || 3.5}
                        onChange={e =>
                          onUpdateFloorParams(currentFloor.id, {
                            name: currentFloor.name,
                            level: currentFloor.level,
                            height: parseFloat(e.target.value) || 3.5
                          })
                        }
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Вкладка 2: Точки (углы) */}
          {activeTab === 'corners' && (
            <div className="space-y-1.5">
              {!currentFloor?.corners || currentFloor.corners.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  <PointIcon className="size-8 mx-auto mb-2 text-slate-600" />
                  Нет созданных точек.<br />Выберите инструмент «Точка» и кликните по холсту.
                </div>
              ) : (
                currentFloor.corners.map(c => {
                  const isSelected = selectedCornerId === c.id
                  return (
                    <div
                      key={c.id}
                      onClick={() => {
                        onSelectCorner(c.id)
                        onCenterPoint(c.x, c.y)
                      }}
                      className={`p-2 px-3 rounded-lg border text-xs flex items-center justify-between transition cursor-pointer ${
                        isSelected
                          ? 'bg-amber-500/15 border-amber-500/80 text-white'
                          : 'bg-slate-900/60 border-slate-700/60 hover:border-slate-500 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded text-[11px] border border-amber-400/20">
                          {c.id}
                        </span>
                        <div className="font-mono text-[11px] text-slate-300">
                          X: <span className="text-emerald-400">{c.x}</span>, Y:{' '}
                          <span className="text-emerald-400">{c.y}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            onEditCorner(c)
                          }}
                          className="text-slate-400 hover:text-amber-400 p-1 rounded transition"
                          title="Изменить координаты"
                        >
                          <EditIcon className="size-3.5" />
                        </button>
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            onDeleteCorner(c.id)
                          }}
                          className="text-slate-400 hover:text-rose-400 p-1 rounded transition"
                          title="Удалить вершину"
                        >
                          <TrashIcon className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* Вкладка 3: Стены */}
          {activeTab === 'walls' && (
            <div className="space-y-1.5">
              {!currentFloor?.walls || currentFloor.walls.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  <WallIcon className="size-8 mx-auto mb-2 text-slate-600" />
                  Нет созданных стен.<br />Выберите инструмент «Стена» и соедините две точки.
                </div>
              ) : (
                currentFloor.walls.map(w => {
                  const isSelected = selectedWallId === w.id
                  const c1 = currentFloor.corners.find(c => c.id === w.from)
                  const c2 = currentFloor.corners.find(c => c.id === w.to)
                  const len = w.length || (c1 && c2 ? Math.round(Math.hypot(c2.x - c1.x, c2.y - c1.y)) : 0)

                  return (
                    <div
                      key={w.id}
                      onClick={() => {
                        onSelectWall(w.id)
                        if (c1 && c2) onCenterPoint((c1.x + c2.x) / 2, (c1.y + c2.y) / 2)
                      }}
                      className={`p-2 px-3 rounded-lg border text-xs flex items-center justify-between transition cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-500/15 border-emerald-500 text-white'
                          : 'bg-slate-900/60 border-slate-700/60 hover:border-slate-500 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-400 bg-slate-800 px-1 py-0.5 rounded text-[10px]">
                          {w.id}
                        </span>
                        <div className="flex items-center gap-1 font-mono text-[11px] text-slate-200">
                          <span className="text-amber-400">{w.from}</span>
                          <span className="text-slate-500 text-[10px]">➔</span>
                          <span className="text-amber-400">{w.to}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono font-semibold px-2 py-0.5 rounded text-[11px]">
                          {len} px
                        </span>
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            onDeleteWall(w.id)
                          }}
                          className="text-slate-400 hover:text-rose-400 p-1 rounded transition"
                          title="Удалить стену"
                        >
                          <TrashIcon className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* Вкладка 4: Зоны / Комнаты */}
          {activeTab === 'rooms' && (
            <div className="space-y-1.5">
              {!currentFloor?.rooms || currentFloor.rooms.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  <RoomIcon className="size-8 mx-auto mb-2 text-slate-600" />
                  Нет созданных зон.<br />Выберите инструмент «Зона» и кликните по точкам контура.
                </div>
              ) : (
                currentFloor.rooms.map(room => {
                  const isSelected = selectedRoomId === room.id
                  const color = room.color || '#3b82f6'

                  return (
                    <div
                      key={room.id}
                      onClick={() => onSelectRoom(room.id)}
                      className={`p-2 px-3 rounded-lg border text-xs flex items-center justify-between transition cursor-pointer ${
                        isSelected
                          ? 'bg-cyan-500/15 border-cyan-500 text-white'
                          : 'bg-slate-900/60 border-slate-700/60 hover:border-slate-500 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="size-3.5 rounded-full shrink-0 border border-white/20"
                          style={{ backgroundColor: color }}
                        />
                        <div className="min-w-0">
                          <div className="font-semibold text-white text-[12px] truncate">
                            {room.name}
                          </div>
                          <div className="font-mono text-[10px] text-slate-400 truncate">
                            Точки: {room.corners.join(', ')}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            onEditRoom(room)
                          }}
                          className="text-slate-400 hover:text-cyan-400 p-1 rounded transition"
                          title="Переименовать"
                        >
                          <EditIcon className="size-3.5" />
                        </button>
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            onDeleteRoom(room.id)
                          }}
                          className="text-slate-400 hover:text-rose-400 p-1 rounded transition"
                          title="Удалить зону"
                        >
                          <TrashIcon className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* Вкладка 5: Точки интереса (POI) */}
          {activeTab === 'pois' && (
            <div className="space-y-1.5">
              {!currentFloor?.pois || currentFloor.pois.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  <PoiIcon className="size-8 mx-auto mb-2 text-slate-600" />
                  Нет созданных точек интереса.<br />Выберите инструмент «POI» и кликните внутри помещения.
                </div>
              ) : (
                currentFloor.pois.map(poi => {
                  const isSelected = selectedPoiId === poi.id
                  const room = currentFloor.rooms?.find(r => r.id === poi.room_id)
                  const roomName = room ? room.name : 'Без зоны'

                  return (
                    <div
                      key={poi.id}
                      onClick={() => {
                        onSelectPoi(poi.id)
                        onCenterPoint(poi.x, poi.y)
                      }}
                      className={`p-2 px-3 rounded-lg border text-xs flex items-center justify-between transition cursor-pointer ${
                        isSelected
                          ? 'bg-rose-500/15 border-rose-500 text-white'
                          : 'bg-slate-900/60 border-slate-700/60 hover:border-slate-500 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <PoiIcon className="size-4 text-rose-500 shrink-0" />
                        <div className="min-w-0">
                          <div className="font-semibold text-white text-[12px] truncate">
                            {poi.name}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {roomName} · ({poi.x}, {poi.y})
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            onEditPoi(poi)
                          }}
                          className="text-slate-400 hover:text-rose-400 p-1 rounded transition"
                          title="Редактировать"
                        >
                          <EditIcon className="size-3.5" />
                        </button>
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            onDeletePoi(poi.id)
                          }}
                          className="text-slate-400 hover:text-rose-400 p-1 rounded transition"
                          title="Удалить"
                        >
                          <TrashIcon className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* Вкладка 6: 360° Панорамы */}
          {activeTab === 'panos' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-1">
                <button
                  onClick={onOpenPanoHelp}
                  className="px-2 py-1 rounded-lg bg-indigo-950/80 hover:bg-indigo-900/60 text-indigo-300 border border-indigo-800/60 text-[11px] font-semibold flex items-center gap-1 transition"
                >
                  <InfoIcon className="size-3.5" />
                  <span>Инструкция</span>
                </button>
                <button
                  onClick={onStartCreatePano}
                  className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1 transition shadow"
                >
                  <PlusIcon className="size-3" />
                  <span>Добавить</span>
                </button>
              </div>

              <div className="space-y-1.5">
                {!currentFloor?.panoramas || currentFloor.panoramas.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-500">
                    <PanoIcon className="size-8 mx-auto mb-2 text-slate-600" />
                    Нет панорам на этом этаже.<br />Нажмите «Добавить» или кликните инструментом 360°.
                  </div>
                ) : (
                  currentFloor.panoramas.map(pano => {
                    const isSelected = selectedPanoId === pano.id
                    const room = currentFloor.rooms?.find(r => r.id === pano.room_id)
                    const roomName = room ? room.name : 'Помещение'

                    return (
                      <div
                        key={pano.id}
                        onClick={() => {
                          onSelectPano(pano.id)
                          onCenterPoint(pano.x, pano.y)
                        }}
                        className={`p-2.5 rounded-xl border text-xs flex items-center justify-between transition cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600/20 border-indigo-500 text-white shadow'
                            : 'bg-slate-900/60 border-slate-700/60 hover:border-slate-500 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="size-7 rounded-lg bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
                            <PanoIcon className="size-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-white text-xs truncate">
                              {pano.name}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {roomName} · ({pano.x}, {pano.y})
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              onViewPano(pano)
                            }}
                            className="p-1 rounded text-slate-400 hover:text-indigo-400 transition"
                            title="Смотреть 360°"
                          >
                            <PanoIcon className="size-3.5" />
                          </button>
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              onEditPano(pano)
                            }}
                            className="p-1 rounded text-slate-400 hover:text-amber-400 transition"
                            title="Настройки"
                          >
                            <EditIcon className="size-3.5" />
                          </button>
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              onDeletePano(pano.id)
                            }}
                            className="p-1 rounded text-slate-400 hover:text-rose-400 transition"
                            title="Удалить"
                          >
                            <TrashIcon className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Кнопка сворачивания/разворачивания панели */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-3 z-30 size-6 rounded-full bg-slate-800 border border-slate-600 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center shadow-md transition"
        title={isCollapsed ? 'Развернуть панель' : 'Свернуть панель'}
      >
        {isCollapsed ? (
          <ChevronRightIcon className="size-3.5" />
        ) : (
          <ChevronLeftIcon className="size-3.5" />
        )}
      </button>
    </div>
  )
}
