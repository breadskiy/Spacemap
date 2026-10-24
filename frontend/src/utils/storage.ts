import type { SpaceObject, SpaceCategory } from '../types/space'
import type { UserProfile } from '../types/auth'

const STORAGE_KEY = 'spacemap_venues_v2'
const USER_STORAGE_KEY = 'spacemap_user_auth'

export function getStoredUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    console.error('Error reading user from localStorage', e)
    return null
  }
}

export function saveStoredUser(user: UserProfile | null): void {
  try {
    if (user) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user))
    } else {
      localStorage.removeItem(USER_STORAGE_KEY)
    }
  } catch (e) {
    console.error('Error saving user to localStorage', e)
  }
}

export const CATEGORY_LABELS: Record<SpaceCategory, string> = {
  exhibition: 'Выставка',
  conference: 'Конференция',
  office: 'Бизнес-центр / Офис',
  mall: 'Торговый комплекс',
  other: 'Пространство'
}

// Сухой чистый каркас без лишних предустановленных мероприятий
const INITIAL_SPACES: SpaceObject[] = []

export function getSpaces(): SpaceObject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_SPACES))
      return INITIAL_SPACES
    }
    return JSON.parse(raw)
  } catch (e) {
    console.error('Error reading spaces from localStorage', e)
    return INITIAL_SPACES
  }
}

export function saveSpaces(spaces: SpaceObject[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(spaces))
  } catch (e) {
    console.error('Error saving spaces to localStorage', e)
  }
}

export function getSpaceById(id: string): SpaceObject | undefined {
  const spaces = getSpaces()
  return spaces.find(s => s.id === id)
}

export function createSpace(data: {
  title: string
  category: SpaceCategory
  address: string
  description: string
  userId?: string
}): SpaceObject {
  const spaces = getSpaces()
  const newSpace: SpaceObject = {
    id: `space-${Date.now()}`,
    userId: data.userId,
    title: data.title.trim(),
    category: data.category,
    categoryLabel: CATEGORY_LABELS[data.category],
    address: data.address.trim() || 'Адрес не указан',
    description: data.description.trim() || 'Цифровой 2D-план этажей и навигации.',
    status: 'draft',
    floorsCount: 1,
    wallsCount: 0,
    updatedAt: new Date().toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const updated = [newSpace, ...spaces]
  saveSpaces(updated)
  return newSpace
}

export function publishSpace(id: string): SpaceObject | undefined {
  const spaces = getSpaces()
  const index = spaces.findIndex(s => s.id === id)
  if (index === -1) return undefined

  const space = spaces[index]
  const cleanSlug = space.title
    .toLowerCase()
    .replace(/[^a-zа-я0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'venue'

  const updatedSpace: SpaceObject = {
    ...space,
    status: 'published',
    publicUrl: `https://spacemap.ttk.ru/v/${cleanSlug}`,
    updatedAt: new Date().toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  spaces[index] = updatedSpace
  saveSpaces(spaces)
  return updatedSpace
}

export function deleteSpace(id: string): void {
  const spaces = getSpaces()
  const filtered = spaces.filter(s => s.id !== id)
  saveSpaces(filtered)
}
