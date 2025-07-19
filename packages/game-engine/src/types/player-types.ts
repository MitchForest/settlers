// ============= Core Player Types =============

export type PlayerId = string

// Player colors (0-3 for 4 players max)
export type PlayerColor = 0 | 1 | 2 | 3

// ============= Resource Types =============

export type ResourceType = 'wood' | 'brick' | 'ore' | 'wheat' | 'sheep'

export interface ResourceCards {
  wood: number
  brick: number
  ore: number
  wheat: number
  sheep: number
}

// ============= Development Cards =============

export type DevelopmentCardType = 
  | 'knight'
  | 'victory'
  | 'roadBuilding'
  | 'yearOfPlenty'
  | 'monopoly'

export interface DevelopmentCard {
  id: string
  type: DevelopmentCardType
  purchasedTurn: number
  playedTurn?: number
}

// ============= Terrain Types =============

export type TerrainType = 'forest' | 'hills' | 'mountains' | 'fields' | 'pasture' | 'desert' | 'sea'

// ============= Buildings =============

export type BuildingType = 'settlement' | 'city'

export interface Building {
  id: string
  type: BuildingType
  playerId: PlayerId
  vertexId: string
}

export interface Road {
  id: string
  playerId: PlayerId
  edgeId: string
}

// ============= Player State =============

export interface Score {
  public: number    // Visible to all
  hidden: number    // Victory point cards
  total: number     // public + hidden
}

export interface BuildingInventory {
  settlements: number    // Settlements (5 max)
  cities: number         // Cities (4 max)
  roads: number          // Roads (15 max)
}

export interface Player {
  id: PlayerId
  name: string
  color: PlayerColor
  resources: ResourceCards
  developmentCards: DevelopmentCard[]
  buildings: BuildingInventory
  score: Score
  longestRoadLength: number
  knightCount: number
  hasLongestRoad: boolean
  hasLargestArmy: boolean
} 