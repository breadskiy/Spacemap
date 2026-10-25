import type { SpaceObject, SpaceCategory } from '../types/space'
import type { UserProfile } from '../types/auth'
import type { PlanData } from '../types/plan'

const TOKEN_KEY = 'spacemap_jwt_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
}

interface ApiErrorResponse {
  detail?: string | { msg?: string }[]
  message?: string
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {})
  
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  const token = getToken()
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  })

  if (response.status === 204) {
    return {} as T
  }

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    let errorMsg = 'Произошла ошибка при обращении к серверу'
    const errData = data as ApiErrorResponse
    if (typeof errData.detail === 'string') {
      errorMsg = errData.detail
    } else if (Array.isArray(errData.detail) && errData.detail.length > 0) {
      errorMsg = errData.detail[0].msg || errorMsg
    } else if (errData.message) {
      errorMsg = errData.message
    }
    throw new Error(errorMsg)
  }

  return data as T
}

// =============================================================================
// 1. АВТОРИЗАЦИЯ (Auth API)
// =============================================================================


export function normalizeUser(raw: any): UserProfile {
  if (!raw || typeof raw !== 'object') {
    return {
      id: 'usr_default',
      name: 'Пользователь',
      email: '',
      organization: '',
      role: 'Организатор пространства'
    }
  }

  const rawName = raw.name || raw.displayName || raw.display_name || ''
  const cleanEmail = String(raw.email || '')
  const fallbackName = cleanEmail ? cleanEmail.split('@')[0] : 'Пользователь'

  return {
    id: String(raw.id || 'usr_' + Date.now()),
    name: String(rawName || fallbackName || 'Пользователь'),
    email: cleanEmail,
    organization: String(raw.company || raw.organization || ''),
    role: raw.role === 'organizer' ? 'Организатор пространства' : String(raw.role || 'Организатор пространства')
  }
}

export interface AuthResponse {
  accessToken: string
  tokenType: string
  user: {
    id: string
    email: string
    name: string
    company: string
    role: string
  }
}

export async function apiLogin(payload: { email: string; password: string }): Promise<UserProfile> {
  const res = await request<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  setToken(res.accessToken)
  return normalizeUser(res.user)
}

export async function apiRegister(payload: {
  email: string
  password: string
  name: string
  company?: string
  role?: string
}): Promise<UserProfile> {
  const res = await request<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  setToken(res.accessToken)
  return normalizeUser(res.user)
}

export async function apiGetMe(): Promise<UserProfile | null> {
  const token = getToken()
  if (!token) return null

  try {
    const user = await request<{
      id: string
      email: string
      name: string
      company: string
      role: string
    }>('/api/auth/me')
    return normalizeUser(user)
  } catch (e) {
    console.warn('Session expired or invalid token', e)
    setToken(null)
    return null
  }
}

export async function apiUpdateProfile(payload: {
  name?: string
  company?: string
  password?: string
}): Promise<UserProfile> {
  const user = await request<{
    id: string
    email: string
    name: string
    company: string
    role: string
  }>('/api/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  return normalizeUser(user)
}

export function apiLogout(): void {
  setToken(null)
}

// =============================================================================
// 2. ПРОСТРАНСТВА И КАРТОЧКИ (Spaces API)
// =============================================================================

export async function apiGetSpaces(): Promise<SpaceObject[]> {
  return await request<SpaceObject[]>('/api/spaces')
}

export async function apiGetSpace(id: string): Promise<SpaceObject> {
  return await request<SpaceObject>(`/api/spaces/${encodeURIComponent(id)}`)
}

export async function apiCreateSpace(data: {
  title: string
  category: SpaceCategory
  address: string
  description: string
}): Promise<SpaceObject> {
  return await request<SpaceObject>('/api/spaces', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function apiUpdateSpace(
  id: string,
  data: {
    title?: string
    category?: SpaceCategory
    address?: string
    description?: string
  }
): Promise<SpaceObject> {
  return await request<SpaceObject>(`/api/spaces/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function apiDeleteSpace(id: string): Promise<void> {
  await request<void>(`/api/spaces/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export async function apiPublishSpace(id: string): Promise<SpaceObject> {
  return await request<SpaceObject>(`/api/spaces/${encodeURIComponent(id)}/publish`, {
    method: 'POST',
  })
}

// =============================================================================
// 3. 2D CAD ЧЕРТЕЖИ ЭТАЖЕЙ (Plan Editor API)
// =============================================================================

export async function apiGetSpacePlan(spaceId: string): Promise<PlanData> {
  return await request<PlanData>(`/api/spaces/${encodeURIComponent(spaceId)}/plan`)
}

export async function apiSaveSpacePlan(spaceId: string, plan: PlanData): Promise<PlanData> {
  return await request<PlanData>(`/api/spaces/${encodeURIComponent(spaceId)}/plan`, {
    method: 'PUT',
    body: JSON.stringify(plan),
  })
}

// =============================================================================
// 4. ПУБЛИЧНЫЙ ПРОСМОТР И QR-КОД (Public Viewer API)
// =============================================================================

export interface PublicSpaceData extends SpaceObject {
  plan?: PlanData | null
}

export async function apiGetPublicSpace(slugOrId: string): Promise<PublicSpaceData> {
  return await request<PublicSpaceData>(`/api/spaces/${encodeURIComponent(slugOrId)}/public`)
}

export function apiGetQrCodeUrl(spaceId: string): string {
  return `/api/spaces/${encodeURIComponent(spaceId)}/qr`
}

// =============================================================================
// 5. ПАНОРАМЫ 360° (Upload API)
// =============================================================================

export async function apiUploadPanorama(file: File): Promise<{ imageUrl: string; thumbnailUrl: string }> {
  const formData = new FormData()
  formData.append('file', file)

  const res = await request<{ imageUrl: string; thumbnailUrl: string }>('/api/panoramas/upload', {
    method: 'POST',
    body: formData,
  })
  return res
}
