import type { SpaceObject, SpaceCategory } from '../types/space'
import type { UserProfile } from '../types/auth'
import {
  apiGetSpaces,
  apiCreateSpace,
  apiPublishSpace,
  apiDeleteSpace,
  apiLogout
} from './api'

const STORAGE_KEY = 'spacemap_venues_v3'
const USER_STORAGE_KEY = 'spacemap_user_auth'

export function getStoredUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    if (!parsed.name || typeof parsed.name !== 'string') {
      parsed.name = (parsed.email ? String(parsed.email).split('@')[0] : '') || 'Организатор'
    }
    return parsed
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
      apiLogout()
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

/**
 * Асинхронно получает актуальный список пространств из PostgreSQL базы данных
 * и обновляет локальный кэш.
 */
export async function syncSpacesFromServer(): Promise<SpaceObject[]> {
  try {
    const serverSpaces = await apiGetSpaces()
    if (Array.isArray(serverSpaces)) {
      saveSpaces(serverSpaces)
      return serverSpaces
    }
  } catch (e) {
    console.warn('Backend unavailable, using cached spaces', e)
  }
  return getSpaces()
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

  // Фоновая отправка в PostgreSQL
  apiCreateSpace({
    title: data.title,
    category: data.category,
    address: data.address,
    description: data.description
  }).then(serverSpace => {
    const current = getSpaces()
    const idx = current.findIndex(s => s.id === newSpace.id)
    if (idx !== -1) {
      current[idx] = serverSpace
    } else {
      current.unshift(serverSpace)
    }
    saveSpaces(current)
  }).catch(err => {
    console.warn('Could not sync created space to backend', err)
  })

  const updated = [newSpace, ...spaces]
  saveSpaces(updated)
  return newSpace
}

export async function createSpaceAsync(data: {
  title: string
  category: SpaceCategory
  address: string
  description: string
}): Promise<SpaceObject> {
  const serverSpace = await apiCreateSpace(data)
  const spaces = getSpaces().filter(s => s.id !== serverSpace.id)
  const updated = [serverSpace, ...spaces]
  saveSpaces(updated)
  return serverSpace
}

export function publishSpace(id: string): SpaceObject | undefined {
  const spaces = getSpaces()
  const index = spaces.findIndex(s => s.id === id)
  if (index === -1) return undefined

  const space = spaces[index]

  const updatedSpace: SpaceObject = {
    ...space,
    status: 'published',
    publicUrl: `${window.location.origin}/?view=${space.id}`,
    updatedAt: new Date().toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Фоновая публикация на сервере
  apiPublishSpace(id).then(res => {
    const current = getSpaces()
    const idx = current.findIndex(s => s.id === id)
    if (idx !== -1) {
      current[idx] = res
      saveSpaces(current)
    }
  }).catch(err => {
    console.warn('Could not publish space to server', err)
  })

  spaces[index] = updatedSpace
  saveSpaces(spaces)
  return updatedSpace
}

export async function publishSpaceAsync(id: string): Promise<SpaceObject | undefined> {
  try {
    const res = await apiPublishSpace(id)
    const current = getSpaces()
    const idx = current.findIndex(s => s.id === id)
    if (idx !== -1) {
      current[idx] = res
    } else {
      current.unshift(res)
    }
    saveSpaces(current)
    return res
  } catch (e) {
    console.warn('Failed to publish on backend, using fallback', e)
    return publishSpace(id)
  }
}

export function deleteSpace(id: string): void {
  const spaces = getSpaces()
  const filtered = spaces.filter(s => s.id !== id)
  saveSpaces(filtered)

  // Удаление на сервере
  apiDeleteSpace(id).catch(err => {
    console.warn('Could not delete space on server', err)
  })
}

export async function deleteSpaceAsync(id: string): Promise<void> {
  try {
    await apiDeleteSpace(id)
  } catch (e) {
    console.warn('Could not delete space on server', e)
  }
  deleteSpace(id)
}
