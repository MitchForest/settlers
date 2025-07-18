import { GameState, Player, PlayerId, Board, Hex, Vertex, Edge, Port, Building, Road, Trade, DevelopmentCard } from '@settlers/core'

/**
 * Database-compatible serialized game state structure
 * All Maps are converted to Records for JSON storage
 */
interface SerializedGameState {
  players: Record<PlayerId, Player>
  board: {
    hexes: Array<{ id: string; hex: Hex }>
    vertices: Array<{ id: string; vertex: Vertex }>
    edges: Array<{ id: string; edge: Edge }>
    ports: Port[]
    robberPosition: { q: number; r: number; s: number } | null
  }
  dice: { die1: number; die2: number; sum: number; timestamp: number } | null
  developmentDeck: DevelopmentCard[]
  discardPile: DevelopmentCard[]
  activeTrades: Array<Omit<Trade, 'createdAt' | 'expiresAt'> & {
    createdAt: string
    expiresAt?: string
  }>
  pendingRoadBuilding?: {
    playerId: PlayerId
    roadsRemaining: number
  }
  // Future setup state support
  setupState?: {
    phase: string
    turnOrder: PlayerId[]
    currentSetupPlayer: PlayerId
    setupRound: number
    placedSettlements: Record<PlayerId, number>
    placedRoads: Record<PlayerId, number>
  }
  // Future turn state support
  turnState?: {
    currentPhase: string
    phaseStartTime: string
    timeRemaining?: number
    actionsAvailable: string[]
    mustDiscard: Record<PlayerId, number>
    pendingActions: any[]
  }
}

/**
 * Serializes a GameState for database storage
 * Converts all Map structures to Records/Arrays for JSON compatibility
 */
export function serializeGameState(gameState: GameState): SerializedGameState {
  // Convert Map<PlayerId, Player> to Record<PlayerId, Player>
  const playersRecord: Record<PlayerId, Player> = {}
  for (const [playerId, player] of gameState.players) {
    playersRecord[playerId] = player
  }

  // Convert Board Maps to Arrays
  const hexesArray = Array.from(gameState.board.hexes.entries()).map(([id, hex]) => ({
    id,
    hex
  }))

  const verticesArray = Array.from(gameState.board.vertices.entries()).map(([id, vertex]) => ({
    id,
    vertex
  }))

  const edgesArray = Array.from(gameState.board.edges.entries()).map(([id, edge]) => ({
    id,
    edge
  }))

  // Convert Trade dates to ISO strings
  const serializedTrades = gameState.activeTrades.map(trade => ({
    ...trade,
    createdAt: trade.createdAt.toISOString(),
    expiresAt: trade.expiresAt?.toISOString()
  }))

  return {
    players: playersRecord,
    board: {
      hexes: hexesArray,
      vertices: verticesArray,
      edges: edgesArray,
      ports: gameState.board.ports,
      robberPosition: gameState.board.robberPosition
    },
    dice: gameState.dice,
    developmentDeck: gameState.developmentDeck,
    discardPile: gameState.discardPile,
    activeTrades: serializedTrades,
    pendingRoadBuilding: gameState.pendingRoadBuilding,
    // Future fields - handle safely
    setupState: (gameState as any).setupState,
    turnState: (gameState as any).turnState
  }
}

/**
 * Deserializes a GameState from database storage
 * Converts all Records/Arrays back to Map structures
 */
export function deserializeGameState(
  id: string,
  phase: GameState['phase'],
  turn: number,
  currentPlayer: PlayerId,
  winner: PlayerId | null,
  startedAt: Date,
  updatedAt: Date,
  serializedState: SerializedGameState
): GameState {
  // Convert Record<PlayerId, Player> to Map<PlayerId, Player>
  const playersMap = new Map<PlayerId, Player>()
  for (const [playerId, player] of Object.entries(serializedState.players)) {
    playersMap.set(playerId as PlayerId, player)
  }

  // Convert Arrays back to Maps for Board
  const hexesMap = new Map<string, Hex>()
  for (const { id: hexId, hex } of serializedState.board.hexes) {
    hexesMap.set(hexId, hex)
  }

  const verticesMap = new Map<string, Vertex>()
  for (const { id: vertexId, vertex } of serializedState.board.vertices) {
    verticesMap.set(vertexId, vertex)
  }

  const edgesMap = new Map<string, Edge>()
  for (const { id: edgeId, edge } of serializedState.board.edges) {
    edgesMap.set(edgeId, edge)
  }

  const board: Board = {
    hexes: hexesMap,
    vertices: verticesMap,
    edges: edgesMap,
    ports: serializedState.board.ports,
    robberPosition: serializedState.board.robberPosition
  }

  // Convert ISO date strings back to Date objects in trades
  const activeTrades: Trade[] = serializedState.activeTrades.map(trade => ({
    ...trade,
    createdAt: new Date(trade.createdAt),
    expiresAt: trade.expiresAt ? new Date(trade.expiresAt) : undefined
  }))

  return {
    id,
    phase,
    turn,
    currentPlayer,
    players: playersMap,
    board,
    dice: serializedState.dice,
    developmentDeck: serializedState.developmentDeck,
    discardPile: serializedState.discardPile,
    winner,
    activeTrades,
    pendingRoadBuilding: serializedState.pendingRoadBuilding,
    startedAt,
    updatedAt
  }
}

/**
 * Type-safe database game state retrieval
 */
export async function loadGameStateFromDB(
  gameRecord: {
    id: string
    phase: any
    turn: number
    currentPlayer: string
    winner: string | null
    startedAt: Date
    updatedAt: Date
    gameState: any
  }
): Promise<GameState> {
  return deserializeGameState(
    gameRecord.id,
    gameRecord.phase,
    gameRecord.turn,
    gameRecord.currentPlayer as PlayerId,
    gameRecord.winner as PlayerId | null,
    gameRecord.startedAt,
    gameRecord.updatedAt,
    gameRecord.gameState as SerializedGameState
  )
}

/**
 * Type-safe database game state persistence
 */
export function prepareGameStateForDB(gameState: GameState) {
  return {
    id: gameState.id,
    currentPlayer: gameState.currentPlayer,
    phase: gameState.phase,
    turn: gameState.turn,
    winner: gameState.winner,
    gameState: serializeGameState(gameState),
    updatedAt: gameState.updatedAt
  }
}

/**
 * Prepare game state for frontend transmission via WebSocket
 * Converts Maps to Objects but keeps the structure the frontend expects
 */
export function prepareGameStateForFrontend(gameState: GameState): any {
  // Convert players Map to Object but preserve structure
  const playersObject: Record<string, any> = {}
  for (const [playerId, player] of gameState.players) {
    playersObject[playerId] = player
  }

  // Convert board Maps to Objects
  const hexesObject: Record<string, any> = {}
  for (const [hexId, hex] of gameState.board.hexes) {
    hexesObject[hexId] = hex
  }

  const verticesObject: Record<string, any> = {}
  for (const [vertexId, vertex] of gameState.board.vertices) {
    verticesObject[vertexId] = vertex
  }

  const edgesObject: Record<string, any> = {}
  for (const [edgeId, edge] of gameState.board.edges) {
    edgesObject[edgeId] = edge
  }

  return {
    ...gameState,
    players: playersObject,
    board: {
      ...gameState.board,
      hexes: hexesObject,
      vertices: verticesObject,
      edges: edgesObject
    }
  }
} 