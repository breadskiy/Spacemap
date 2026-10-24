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
}

export interface PlanFloor {
  id: string
  name: string
  level: number
  height?: number
  corners: PlanCorner[]
  walls: PlanWall[]
  pois: PlanPoi[]
}

export interface PlanData {
  floors: PlanFloor[]
}
