import type { PlanCorner, PlanRoom, PlanPoi, PlanPanorama } from './plan'

export type EditorTool = 'select' | 'corner' | 'wall' | 'room' | 'poi' | 'pano' | 'delete'

export type SidebarTab = 'floors' | 'corners' | 'walls' | 'rooms' | 'panos'

export interface Point2D {
  x: number
  y: number
}

export interface PanZoomState {
  pan: Point2D
  zoom: number
}

export interface PoiCategoryDef {
  id: string
  label: string
  color: string
  icon: string
  symbol: string
}

export const POI_CATEGORIES: Record<string, PoiCategoryDef> = {
  stand: { id: 'stand', label: 'Стенд / Экспозиция', color: '#e30613', icon: '🏢', symbol: '🏢' },
  expo: { id: 'expo', label: 'Выставка / Арт', color: '#ec4899', icon: '🖼️', symbol: '🖼️' },
  cafe: { id: 'cafe', label: 'Кафе / Кофе', color: '#f59e0b', icon: '☕', symbol: '☕' },
  food: { id: 'food', label: 'Фудкорт', color: '#f97316', icon: '🍔', symbol: '🍔' },
  shop: { id: 'shop', label: 'Магазин / Мерч', color: '#3b82f6', icon: '🛍️', symbol: '🛍️' },
  stage: { id: 'stage', label: 'Сцена / Зал', color: '#8b5cf6', icon: '🎤', symbol: '🎤' },
  info: { id: 'info', label: 'Инфостойка', color: '#06b6d4', icon: 'ℹ️', symbol: 'ℹ️' },
  exit: { id: 'exit', label: 'Вход / Выход', color: '#10b981', icon: '🚪', symbol: '🚪' },
  wc: { id: 'wc', label: 'Туалет (WC)', color: '#64748b', icon: '🚻', symbol: '🚻' },
  atm: { id: 'atm', label: 'Банкомат', color: '#0d9488', icon: '💳', symbol: '💳' },
  firstaid: { id: 'firstaid', label: 'Медпункт', color: '#e11d48', icon: '🏥', symbol: '🏥' }
}

export const ROOM_COLOR_PRESETS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#8b5cf6', // purple
  '#f59e0b', // amber
  '#ef4444', // red
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#64748b', // slate
  '#14b8a6', // teal
  '#f97316'  // orange
]

export interface ModalCornerCreateState {
  isOpen: boolean
  defaultX: number
  defaultY: number
}

export interface ModalCornerEditState {
  isOpen: boolean
  corner: PlanCorner | null
}

export interface ModalRoomEditState {
  isOpen: boolean
  room: PlanRoom | null
  cornerIds: string[]
}

export interface ModalPoiEditState {
  isOpen: boolean
  poi: PlanPoi | null
  defaultX: number
  defaultY: number
}

export interface ModalPanoEditState {
  isOpen: boolean
  pano: PlanPanorama | null
  defaultX: number
  defaultY: number
  targetRoomId?: string
}

export interface ModalPanoViewerState {
  isOpen: boolean
  pano: PlanPanorama | null
}
