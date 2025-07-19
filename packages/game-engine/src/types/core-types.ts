// ============= Core Game Types =============

export type PlayerId = string

// Player colors (0-3 for 4 players max)
export type PlayerColor = 0 | 1 | 2 | 3

// ============= Resource and Terrain Types =============

export type ResourceType = 'wood' | 'brick' | 'ore' | 'wheat' | 'sheep'
export type TerrainType = 'forest' | 'hills' | 'mountains' | 'fields' | 'pasture' | 'desert' | 'sea'

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

// ============= Coordinate System =============

export interface HexCoordinate {
  q: number  // Column
  r: number  // Row
  s: number  // Computed: -(q + r)
}

export interface VertexPosition {
  hexes: HexCoordinate[]  // Connected hexes (2-3 hexes)
  direction: 'N' | 'NE' | 'SE' | 'S' | 'SW' | 'NW'  // Direction from first hex
}

export interface EdgePosition {
  hexes: HexCoordinate[]  // Two connected hexes
  direction: 'NE' | 'E' | 'SE' | 'SW' | 'W' | 'NW'  // Direction between hexes
}

// ============= Board Structure =============

export interface Hex {
  id: string
  position: HexCoordinate
  terrain: TerrainType | null
  numberToken: number | null
  hasRobber: boolean
}

export interface Port {
  id: string
  position: EdgePosition
  type: 'generic' | ResourceType  // 3:1 generic or 2:1 specific
  ratio: number
}

export interface Vertex {
  id: string
  position: VertexPosition
  building: Building | null
  port: Port | null
}

export interface Edge {
  id: string
  position: EdgePosition
  connection: Road | null
}

export interface Board {
  hexes: Map<string, Hex>
  vertices: Map<string, Vertex>
  edges: Map<string, Edge>
  ports: Port[]
  robberPosition: HexCoordinate | null
}

export interface BoardLayout {
  id: string
  name: string
  description: string
  baseGrid: {
    hexes: Hex[]
    ports: Port[]
  }
}

export const STANDARD_LAYOUTS: BoardLayout[] = [
  {
    id: 'classic',
    name: 'Classic Settlers',
    description: 'Standard 19-hex board',
    baseGrid: {
      hexes: [],
      ports: []
    }
  }
]

// ============= Game Pieces =============

export type BuildingType = 'settlement' | 'city'

export interface Building {
  type: BuildingType
  owner: PlayerId
  position: VertexPosition
}

export interface Road {
  type: 'road'
  owner: PlayerId
  position: EdgePosition
}

export interface BuildingInventory {
  settlements: number    // Settlements (5 max)
  cities: number         // Cities (4 max)
  roads: number          // Roads (15 max)
}

// ============= Player Types =============

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
  hasLongestRoad: boolean
  hasLargestArmy: boolean
  isConnected: boolean
  isAI: boolean
}

// ============= Game State Types =============

export type GamePhase = 
  | 'setup1'      // First placement round
  | 'setup2'      // Second placement round
  | 'roll'        // Roll dice
  | 'actions'     // Main turn actions
  | 'discard'     // Discard cards (7 rolled)
  | 'moveRobber' // Move robber
  | 'steal'       // Steal from player
  | 'ended'       // Game over

// ============= Setup Phase Types (Phase 6) =============

export type SetupPhase = 'determineOrder' | 'setup1' | 'setup2'

export interface SetupState {
  phase: SetupPhase
  turnOrder: PlayerId[]
  currentSetupPlayer: PlayerId
  setupRound: 1 | 2
  placedSettlements: Map<PlayerId, number>
  placedRoads: Map<PlayerId, number>
}

// ============= Turn Management Types (Phase 7) =============

export interface TurnState {
  currentPhase: GamePhase
  phaseStartTime: Date
  timeRemaining?: number
  actionsAvailable: ActionType[]
  mustDiscard: Map<PlayerId, number>
  pendingActions: GameAction[]
}

export interface VictoryConditions {
  targetPoints: number
  currentLeader: PlayerId | null
  pointBreakdown: Map<PlayerId, {
    settlements: number
    cities: number
    longestRoad: number
    largestArmy: number
    victoryCards: number
    total: number
  }>
}

export interface DiceRoll {
  die1: number
  die2: number
  sum: number
  timestamp: number
}

export interface GameState {
  id: string
  phase: GamePhase
  turn: number
  currentPlayer: PlayerId
  players: Map<PlayerId, Player>
  board: Board
  dice: DiceRoll | null
  developmentDeck: DevelopmentCard[]
  discardPile: DevelopmentCard[]
  winner: PlayerId | null
  activeTrades: Trade[]  // All active trades (pending, accepted but not executed)
  pendingRoadBuilding?: {
    playerId: PlayerId
    roadsRemaining: number
  }
  startedAt: Date
  updatedAt: Date
}

// ============= Game Actions =============

export type ActionType = 
  | 'roll'
  | 'placeBuilding'
  | 'placeRoad'
  | 'build'
  | 'bankTrade'
  | 'portTrade'
  | 'createTradeOffer'
  | 'acceptTrade'
  | 'rejectTrade'
  | 'cancelTrade'
  | 'playCard'
  | 'buyCard'
  | 'moveRobber'
  | 'stealResource'
  | 'discard'
  | 'endTurn'
  // Setup phase actions (Phase 6)
  | 'rollForOrder'
  | 'placeInitialSettlement'
  | 'placeInitialRoad'
  | 'confirmSetupComplete'

export interface GameAction {
  type: ActionType
  playerId: PlayerId
  data: any
}

// ============= Setup Actions (Phase 6) =============

export type SetupAction = 
  | { type: 'rollForOrder'; playerId: PlayerId }
  | { type: 'placeInitialSettlement'; playerId: PlayerId; position: VertexPosition }
  | { type: 'placeInitialRoad'; playerId: PlayerId; position: EdgePosition }
  | { type: 'confirmSetupComplete'; playerId: PlayerId }

// ============= Trading System =============

export type TradeType = 'bank' | 'port' | 'player'

export interface Trade {
  id: string
  type: TradeType
  initiator: PlayerId
  target: PlayerId | null  // null for bank/port trades, specific player for direct trades
  offering: Partial<ResourceCards>
  requesting: Partial<ResourceCards>
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'expired'
  ratio?: number  // For bank/port trades (2:1, 3:1, 4:1)
  portType?: 'generic' | ResourceType  // For port trades
  createdAt: Date
  expiresAt?: Date  // For player trades with timers
  isOpenOffer?: boolean  // true if any player can accept, false for direct offers
}

// ============= Events =============

export interface GameEvent {
  id: string
  type: string
  gameId: string
  playerId?: PlayerId
  data: any
  timestamp: Date
}

// ============= Victory Conditions =============

export interface VictoryCondition {
  type: 'points' | 'longestRoad' | 'largestArmy' | 'custom'
  description: string
  points: number
  achieved: boolean
}

// ============= Game Summary (Phase 7) =============

export interface GameSummary {
  gameId: string
  winner: PlayerId
  finalScores: Map<PlayerId, number>
  gameDuration: number // in milliseconds
  totalTurns: number
  playerStats: Map<PlayerId, {
    resourcesProduced: number
    resourcesTraded: number
    buildingsBuilt: number
    cardsPlayed: number
    longestRoadLength: number
    knightsPlayed: number
  }>
  achievements: Map<PlayerId, string[]>
} 