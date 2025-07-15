// Core game types for Settlers
// Theme-agnostic naming for extensibility

import type { HexCoordinates, CubeCoordinates } from 'honeycomb-grid'

// ============= Base Grid Types =============

// Re-export Honeycomb coordinate types
export type HexCoordinate = CubeCoordinates
export type { HexCoordinates }

// Base hexagonal grid - just coordinates, no content
export interface BaseGrid {
  hexes: HexCoordinate[]
  ports: PortPlacement[]
}

// Port placement on the base grid
export interface PortPlacement {
  position: HexCoordinate
  direction: 'N' | 'NE' | 'SE' | 'S' | 'SW' | 'NW'
  type: 'generic' | 'resource' // generic = 3:1, resource = 2:1
  resourceType?: string // only for resource ports
}

// ============= Terrain Assignment Types =============

// Terrain types for hex tiles (theme-agnostic)
export type TerrainType = 
  | 'terrain1'  // Forest (Lumber)
  | 'terrain2'  // Pasture (Wool) 
  | 'terrain3'  // Fields (Grain)
  | 'terrain4'  // Hills (Brick)
  | 'terrain5'  // Mountains (Ore)
  | 'desert'    // No resources

// Terrain assignment for the grid
export interface TerrainAssignment {
  [hexCoordKey: string]: TerrainType // key is "q,r,s"
}

// ============= Number Token Assignment Types =============

// Number token assignment for the grid
export interface NumberAssignment {
  [hexCoordKey: string]: number | null // key is "q,r,s", null for desert/water
}

// ============= Complete Board Types =============

// A hex tile with all information
export interface Hex {
  id: string
  position: HexCoordinate
  terrain: TerrainType
  numberToken: number | null
  hasBlocker: boolean
}

// Complete board state combining all layers
export interface Board {
  id: string
  baseGrid: BaseGrid
  terrainAssignment: TerrainAssignment
  numberAssignment: NumberAssignment
  // Computed for convenience
  hexes: Hex[]
  ports: Port[]
  // Essential for game mechanics
  vertices: Map<string, Vertex>
  edges: Map<string, Edge>
  blockerPosition: HexCoordinate // Robber position
}

// ============= Game Board Layouts =============

// Predefined board layouts (base grids)
export interface BoardLayout {
  id: string
  name: string
  description: string
  baseGrid: BaseGrid
}

// Standard board layouts
export const STANDARD_LAYOUTS: BoardLayout[] = [
  {
    id: 'classic',
    name: 'Classic Settlers',
    description: 'Standard 19-hex board',
    baseGrid: {
      hexes: [], // Will be populated by board generator
      ports: []  // Will be populated by board generator
    }
  }
]

// ============= Existing Types (updated) =============

// Resource types for cards
export type ResourceType = 
  | 'resource1'  // Lumber
  | 'resource2'  // Wool
  | 'resource3'  // Grain
  | 'resource4'  // Brick
  | 'resource5'  // Ore

// Vertex position (intersection of hexes)
export interface VertexPosition {
  hexes: HexCoordinate[]
  direction: 'N' | 'NE' | 'SE' | 'S' | 'SW' | 'NW'
}

// Edge position (between two vertices)
export type EdgePosition = [VertexPosition, VertexPosition]

// Port for trading
export interface Port {
  id: string
  position: HexCoordinate
  type: 'generic' | 'resource1' | 'resource2' | 'resource3' | 'resource4' | 'resource5'
  ratio: number // 2:1 or 3:1
}

// Vertex (intersection where buildings can be placed)
export interface Vertex {
  id: string
  position: VertexPosition
  building: Building | null
  port: Port | null
}

// Edge (where connections can be placed)
export interface Edge {
  id: string
  position: EdgePosition
  connection: Connection | null
}

// ============= Player Types =============

export type PlayerId = string

// Player colors
export type PlayerColor = 0 | 1 | 2 | 3

export interface ResourceCards {
  resource1: number  // Lumber
  resource2: number  // Wool
  resource3: number  // Grain
  resource4: number  // Brick
  resource5: number  // Ore
}

// Development card types
export type DevelopmentCardType = 
  | 'knight'
  | 'victory'
  | 'progress1'  // Road Building
  | 'progress2'  // Year of Plenty
  | 'progress3'  // Monopoly

// Development card
export interface DevelopmentCard {
  id: string
  type: DevelopmentCardType
  purchasedTurn: number
  playedTurn?: number
}

export interface Building {
  type: 'settlement' | 'city'
  owner: PlayerId
  position: VertexPosition
}

export interface Connection {
  owner: PlayerId
  position: EdgePosition
}

export interface BuildingInventory {
  settlements: number  // 5 max
  cities: number      // 4 max
  connections: number // 15 max
}

// Score tracking
export interface Score {
  public: number    // Visible to all
  hidden: number    // Victory point cards
  total: number     // public + hidden
}

export interface Player {
  id: PlayerId
  name: string
  color: PlayerColor
  resources: ResourceCards
  developmentCards: DevelopmentCard[]
  score: Score
  buildings: BuildingInventory
  knightsPlayed: number
  hasLongestPath: boolean
  hasLargestForce: boolean  // Largest army
  isConnected: boolean
  isAI: boolean
}

// ============= Game State Types =============

export type GamePhase = 
  | 'setup1'      // First settlement + road
  | 'setup2'      // Second settlement + road (reverse order)
  | 'roll'        // Roll dice
  | 'actions'     // Trade, build, play cards
  | 'discard'     // Discard half when 7 rolled
  | 'moveBlocker' // Move robber
  | 'steal'       // Steal from player
  | 'ended'       // Game over

export interface DiceRoll {
  die1: number  // 1-6
  die2: number  // 1-6
  sum: number   // 2-12
}

export interface Trade {
  id: string
  from: PlayerId
  to: PlayerId | 'bank' | 'port'
  offering: Partial<ResourceCards>
  requesting: Partial<ResourceCards>
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled'
  createdAt: number
}

// Game actions
export type ActionType = 
  | 'roll'
  | 'placeSettlement'
  | 'placeConnection'
  | 'build'
  | 'trade'
  | 'playCard'
  | 'buyCard'
  | 'moveBlocker'
  | 'stealResource'
  | 'discard'
  | 'endTurn'

export interface GameAction {
  type: ActionType
  playerId: PlayerId
  data: any  // Action-specific data
  timestamp: number
}

// Game settings
export interface GameSettings {
  victoryPoints: number
  boardLayout: string
  randomizeBoard: boolean
  randomizePlayerOrder: boolean
  allowUndo: boolean
  turnTimerSeconds: number
  privateTradeEnabled: boolean
  developmentCardLimit: number
}

// Complete game state
export interface GameState {
  id: string
  phase: GamePhase
  turn: number
  currentPlayerIndex: number
  players: Map<PlayerId, Player>
  playerOrder: PlayerId[]
  board: Board
  developmentDeck: DevelopmentCard[]
  dice: DiceRoll | null
  trades: Trade[]
  winner: PlayerId | null
  settings: GameSettings
  createdAt: number
  updatedAt: number
  discardingPlayers?: PlayerId[]
  endedAt?: number
}

// ============= Validation Types =============

export interface PlacementValidation {
  isValid: boolean
  reason?: string
}

export interface BuildingCosts {
  settlement: ResourceCards
  city: Partial<ResourceCards>      // Only some resources needed
  connection: ResourceCards
  developmentCard: ResourceCards
}

// ============= Event Types =============

export type GameEventType =
  | 'gameCreated'
  | 'playerJoined'
  | 'gameStarted'
  | 'diceRolled'
  | 'resourcesDistributed'
  | 'buildingPlaced'
  | 'connectionBuilt'
  | 'tradeProposed'
  | 'tradeCompleted'
  | 'cardPurchased'
  | 'cardPlayed'
  | 'blockerMoved'
  | 'resourceStolen'
  | 'turnEnded'
  | 'gameEnded'

export interface GameEvent {
  id: string
  gameId: string
  type: GameEventType
  playerId?: PlayerId
  data: any
  timestamp: number
}

// ============= UI State Types =============

export interface UIState {
  selectedHex: string | null
  selectedVertex: string | null
  selectedEdge: string | null
  highlightedElements: {
    hexes: string[]
    vertices: string[]
    edges: string[]
  }
  showTradePanel: boolean
  showCardsPanel: boolean
  animations: AnimationState[]
}

export interface AnimationState {
  id: string
  type: 'resource' | 'dice' | 'card' | 'building'
  from?: { x: number; y: number }
  to?: { x: number; y: number }
  duration: number
  startTime: number
}

// ============= Helper Types =============

export type Nullable<T> = T | null
export type Optional<T> = T | undefined
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
} 