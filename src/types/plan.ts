export interface PlanCorner {
  id: string
  x: number
  y: number
}

export interface PlanWall {
  id: string
  from: string
  to: string
  length?: number
}

export interface PlanPoi {
  id: string
  name: string
  category: string
  x: number
  y: number
  description?: string
  room_id?: string
}

export interface PlanRoom {
  id: string
  name: string
  color?: string
  corners: string[]
  type?: string
}

export interface PlanPanorama {
  id: string
  name: string
  x: number
  y: number
  image?: string
  image_data?: string
  room_id?: string
}

export interface PlanFloor {
  id: string
  name: string
  level: number
  height?: number
  corners: PlanCorner[]
  walls: PlanWall[]
  rooms?: PlanRoom[]
  pois: PlanPoi[]
  panoramas?: PlanPanorama[]
}

export interface PlanData {
  floors: PlanFloor[]
}
