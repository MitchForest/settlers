// State validator for game action validation

import {
  GameState,
  Player,
  PlayerId,
  Building,
  Connection,
  Vertex,
  VertexPosition,
  EdgePosition,
  ResourceCards,
  PlacementValidation,
  HexCoordinate,
  GamePhase,
  Trade
} from '../types'
import {
  GAME_RULES,
  BUILDING_COSTS,
  ERROR_MESSAGES
} from '../constants'
import {
  hasResources,
  getTotalResources,
  calculateDiscardCount,
  hexToString
} from '../calculations'

// ============= Turn Validation =============

export function isPlayerTurn(state: GameState, playerId: PlayerId): boolean {
  const currentPlayer = state.playerOrder[state.currentPlayerIndex]
  return currentPlayer === playerId
}

export function canPerformAction(
  state: GameState,
  playerId: PlayerId,
  phase: GamePhase
): PlacementValidation {
  if (!isPlayerTurn(state, playerId)) {
    return { isValid: false, reason: ERROR_MESSAGES.notYourTurn }
  }
  
  if (state.phase !== phase) {
    return { isValid: false, reason: `Current phase is ${state.phase}, not ${phase}` }
  }
  
  if (state.winner) {
    return { isValid: false, reason: 'Game has ended' }
  }
  
  return { isValid: true }
}

// ============= Building Placement Validation =============

export function canPlaceSettlement(
  state: GameState,
  playerId: PlayerId,
  vertexId: string
): PlacementValidation {
  const player = state.players.get(playerId)
  if (!player) {
    return { isValid: false, reason: 'Player not found' }
  }
  
  const vertex = state.board.vertices.get(vertexId)
  if (!vertex) {
    return { isValid: false, reason: 'Invalid vertex' }
  }
  
  // Check if vertex is occupied
  if (vertex.building) {
    return { isValid: false, reason: 'Vertex already occupied' }
  }
  
  // Check distance rule (no adjacent settlements)
  if (!checkDistanceRule(state.board.vertices, vertexId)) {
    return { isValid: false, reason: 'Too close to another building' }
  }
  
  // Check building limit
  const settlementsBuilt = countPlayerBuildings(state, playerId, 'settlement')
  if (settlementsBuilt >= GAME_RULES.maxSettlements) {
    return { isValid: false, reason: ERROR_MESSAGES.cantBuildMore }
  }
  
  // During setup, no resource check needed
  if (state.phase === 'setup1' || state.phase === 'setup2') {
    return { isValid: true }
  }
  
  // Check if connected to player's road network
  if (!isConnectedToPlayerNetwork(state, playerId, vertexId)) {
    return { isValid: false, reason: 'Must be connected to your road network' }
  }
  
  // Check resources
  if (!hasResources(player.resources, BUILDING_COSTS.settlement)) {
    return { isValid: false, reason: ERROR_MESSAGES.insufficientResources }
  }
  
  return { isValid: true }
}

export function canPlaceCity(
  state: GameState,
  playerId: PlayerId,
  vertexId: string
): PlacementValidation {
  const player = state.players.get(playerId)
  if (!player) {
    return { isValid: false, reason: 'Player not found' }
  }
  
  const vertex = state.board.vertices.get(vertexId)
  if (!vertex) {
    return { isValid: false, reason: 'Invalid vertex' }
  }
  
  // Check if vertex has player's settlement
  if (!vertex.building || 
      vertex.building.type !== 'settlement' || 
      vertex.building.owner !== playerId) {
    return { isValid: false, reason: 'Must upgrade your own settlement' }
  }
  
  // Check building limit
  const citiesBuilt = countPlayerBuildings(state, playerId, 'city')
  if (citiesBuilt >= GAME_RULES.maxCities) {
    return { isValid: false, reason: ERROR_MESSAGES.cantBuildMore }
  }
  
  // Check resources
  if (!hasResources(player.resources, BUILDING_COSTS.city)) {
    return { isValid: false, reason: ERROR_MESSAGES.insufficientResources }
  }
  
  return { isValid: true }
}

export function canPlaceConnection(
  state: GameState,
  playerId: PlayerId,
  edgeId: string
): PlacementValidation {
  const player = state.players.get(playerId)
  if (!player) {
    return { isValid: false, reason: 'Player not found' }
  }
  
  const edge = state.board.edges.get(edgeId)
  if (!edge) {
    return { isValid: false, reason: 'Invalid edge' }
  }
  
  // Check if edge is occupied
  if (edge.connection) {
    return { isValid: false, reason: 'Edge already has a connection' }
  }
  
  // Check building limit
  const connectionsBuilt = countPlayerConnections(state, playerId)
  if (connectionsBuilt >= GAME_RULES.maxConnections) {
    return { isValid: false, reason: ERROR_MESSAGES.cantBuildMore }
  }
  
  // During setup, must be connected to the settlement just placed
  if (state.phase === 'setup1' || state.phase === 'setup2') {
    // Check if connected to player's most recent settlement
    return checkSetupConnectionPlacement(state, playerId, edgeId)
  }
  
  // Check if connected to player's network
  if (!isEdgeConnectedToPlayer(state, playerId, edgeId)) {
    return { isValid: false, reason: 'Must be connected to your network' }
  }
  
  // Check resources
  if (!hasResources(player.resources, BUILDING_COSTS.connection)) {
    return { isValid: false, reason: ERROR_MESSAGES.insufficientResources }
  }
  
  return { isValid: true }
}

// ============= Trading Validation =============

export function canProposeTrade(
  state: GameState,
  playerId: PlayerId,
  trade: Partial<Trade>
): PlacementValidation {
  const player = state.players.get(playerId)
  if (!player) {
    return { isValid: false, reason: 'Player not found' }
  }
  
  if (state.phase !== 'actions') {
    return { isValid: false, reason: 'Can only trade during actions phase' }
  }
  
  // Check if player has resources to offer
  if (trade.offering && !hasResources(player.resources, trade.offering)) {
    return { isValid: false, reason: ERROR_MESSAGES.insufficientResources }
  }
  
  // Check if trade is valid (not trading nothing for nothing)
  const offeringCount = trade.offering ? 
    Object.values(trade.offering).reduce((sum, val) => sum + (val || 0), 0) : 0
  const requestingCount = trade.requesting ? 
    Object.values(trade.requesting).reduce((sum, val) => sum + (val || 0), 0) : 0
  
  if (offeringCount === 0 || requestingCount === 0) {
    return { isValid: false, reason: ERROR_MESSAGES.invalidTrade }
  }
  
  return { isValid: true }
}

// ============= Development Card Validation =============

export function canBuyDevelopmentCard(
  state: GameState,
  playerId: PlayerId
): PlacementValidation {
  const player = state.players.get(playerId)
  if (!player) {
    return { isValid: false, reason: 'Player not found' }
  }
  
  if (state.phase !== 'actions') {
    return { isValid: false, reason: 'Can only buy cards during actions phase' }
  }
  
  // Check if cards available
  if (state.developmentDeck.length === 0) {
    return { isValid: false, reason: 'No development cards left' }
  }
  
  // Check resources
  if (!hasResources(player.resources, BUILDING_COSTS.developmentCard)) {
    return { isValid: false, reason: ERROR_MESSAGES.insufficientResources }
  }
  
  return { isValid: true }
}

export function canPlayDevelopmentCard(
  state: GameState,
  playerId: PlayerId,
  cardId: string
): PlacementValidation {
  const player = state.players.get(playerId)
  if (!player) {
    return { isValid: false, reason: 'Player not found' }
  }
  
  const card = player.developmentCards.find(c => c.id === cardId)
  if (!card) {
    return { isValid: false, reason: 'Card not found' }
  }
  
  // Can't play card bought this turn
  if (card.playedTurn === null && state.turn === state.turn) {
    return { isValid: false, reason: 'Cannot play card bought this turn' }
  }
  
  // Already played?
  if (card.playedTurn !== null) {
    return { isValid: false, reason: 'Card already played' }
  }
  
  // Victory point cards can be played anytime on your turn
  if (card.type === 'victory') {
    return { isValid: true }
  }
  
  // Other cards only during actions phase
  if (state.phase !== 'actions') {
    return { isValid: false, reason: 'Can only play cards during actions phase' }
  }
  
  return { isValid: true }
}

// ============= Robber/Blocker Validation =============

export function canMoveBlocker(
  state: GameState,
  playerId: PlayerId,
  hexId: string
): PlacementValidation {
  if (state.phase !== 'moveBlocker') {
    return { isValid: false, reason: 'Not in blocker movement phase' }
  }
  
  const hex = state.board.hexes.get(hexId)
  if (!hex) {
    return { isValid: false, reason: 'Invalid hex' }
  }
  
  // Can't place on same hex
  if (hexToString(hex.position) === hexToString(state.board.blockerPosition)) {
    return { isValid: false, reason: 'Must move blocker to different hex' }
  }
  
  return { isValid: true }
}

export function canStealFrom(
  state: GameState,
  stealerId: PlayerId,
  targetId: PlayerId
): PlacementValidation {
  if (state.phase !== 'steal') {
    return { isValid: false, reason: 'Not in steal phase' }
  }
  
  const target = state.players.get(targetId)
  if (!target) {
    return { isValid: false, reason: 'Invalid target player' }
  }
  
  // Can't steal from self
  if (stealerId === targetId) {
    return { isValid: false, reason: 'Cannot steal from yourself' }
  }
  
  // Target must have resources
  if (getTotalResources(target.resources) === 0) {
    return { isValid: false, reason: 'Target has no resources' }
  }
  
  // Target must have building adjacent to robber
  const blockerHex = state.board.hexes.get(hexToString(state.board.blockerPosition))
  if (!blockerHex) {
    return { isValid: false, reason: 'Blocker position invalid' }
  }
  
  // Check if target has buildings adjacent to blocker hex
  // (Simplified - would need proper adjacency check)
  const hasAdjacentBuilding = true // TODO: Implement proper check
  
  if (!hasAdjacentBuilding) {
    return { isValid: false, reason: ERROR_MESSAGES.noValidTargets }
  }
  
  return { isValid: true }
}

// ============= Discard Validation =============

export function mustDiscard(
  state: GameState,
  playerId: PlayerId
): boolean {
  if (state.phase !== 'discard') {
    return false
  }
  
  const player = state.players.get(playerId)
  if (!player) {
    return false
  }
  
  const totalResources = getTotalResources(player.resources)
  return totalResources > GAME_RULES.handLimitBeforeDiscard
}

export function canDiscard(
  state: GameState,
  playerId: PlayerId,
  toDiscard: Partial<ResourceCards>
): PlacementValidation {
  const player = state.players.get(playerId)
  if (!player) {
    return { isValid: false, reason: 'Player not found' }
  }
  
  if (!mustDiscard(state, playerId)) {
    return { isValid: false, reason: 'You do not need to discard' }
  }
  
  // Check if player has resources to discard
  if (!hasResources(player.resources, toDiscard)) {
    return { isValid: false, reason: 'You do not have those resources' }
  }
  
  // Check if discarding correct amount
  const totalResources = getTotalResources(player.resources)
  const requiredDiscard = calculateDiscardCount(totalResources)
  const discardCount = Object.values(toDiscard).reduce((sum, val) => sum + (val || 0), 0)
  
  if (discardCount !== requiredDiscard) {
    return { isValid: false, reason: `Must discard exactly ${requiredDiscard} resources` }
  }
  
  return { isValid: true }
}

// ============= Helper Functions =============

function checkDistanceRule(
  vertices: Map<string, Vertex>,
  vertexId: string
): boolean {
  // Check if any adjacent vertex has a building
  // Simplified - would need proper adjacency calculation
  return true // TODO: Implement proper distance rule check
}

function isConnectedToPlayerNetwork(
  state: GameState,
  playerId: PlayerId,
  vertexId: string
): boolean {
  // Check if vertex is connected to player's road network
  // Simplified - would need graph traversal
  return true // TODO: Implement proper network check
}

function isEdgeConnectedToPlayer(
  state: GameState,
  playerId: PlayerId,
  edgeId: string
): boolean {
  // Check if edge connects to player's network
  // Must connect to either:
  // 1. Another road owned by player
  // 2. A settlement/city owned by player
  return true // TODO: Implement proper connection check
}

function checkSetupConnectionPlacement(
  state: GameState,
  playerId: PlayerId,
  edgeId: string
): PlacementValidation {
  // During setup, road must connect to the settlement just placed
  // TODO: Track last placed settlement and verify connection
  return { isValid: true }
}

function countPlayerBuildings(
  state: GameState,
  playerId: PlayerId,
  type: 'settlement' | 'city'
): number {
  let count = 0
  state.board.vertices.forEach(vertex => {
    if (vertex.building && 
        vertex.building.owner === playerId && 
        vertex.building.type === type) {
      count++
    }
  })
  return count
}

function countPlayerConnections(
  state: GameState,
  playerId: PlayerId
): number {
  let count = 0
  state.board.edges.forEach(edge => {
    if (edge.connection && edge.connection.owner === playerId) {
      count++
    }
  })
  return count
} 