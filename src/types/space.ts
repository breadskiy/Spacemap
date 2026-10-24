export type SpaceCategory = 'exhibition' | 'conference' | 'office' | 'mall' | 'other'

export interface SpaceObject {
  id: string
  title: string
  category: SpaceCategory
  categoryLabel: string
  address: string
  description: string
  status: 'draft' | 'published'
  floorsCount: number
  wallsCount?: number
  updatedAt: string
  publicUrl?: string
}
