// State validator for game action validation

import {
  GameState,
  PlayerId,
  ResourceCards,
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
  getTotalResourceCount,
  calculateDiscardCount
} from '../calculations'
import {
  checkDistanceRule,
  isConnectedToPlayerNetwork,
  isEdgeConnectedToPlayer,
  checkSetupRoadPlacement
} from './adjacency-helpers'

// Validation result interface
interface PlacementValidation {
  isValid: boolean
  reason?: string
}

// Helper function for hex coordinate string conversion
function hexToString(coord: HexCoordinate | null): string {
  if (!coord) return 'null'
  return `${coord.q},${coord.r},${coord.s}`
}

// ============= Turn Validation =============

export function isPlayerTurn(state: GameState, playerId: PlayerId): boolean {
  return state.currentPlayer === playerId
}

export function canPerformAction(
  state: GameState,
  playerId: PlayerId,
  phase: GamePhase
): PlacementValidation {
  if (!isPlayerTurn(state, playerId)) {
    return { isValid: false, reason: ERROR_MESSAGES.notPlayerTurn }
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
  if (!checkDistanceRule(state.board, vertexId)) {
    return { isValid: false, reason: 'Too close to another building' }
  }
  
  // Check building limit
  const settlementsBuilt = countPlayerBuildings(state, playerId, 'settlement')
  if (settlementsBuilt >= GAME_RULES.maxSettlements) {
    return { isValid: false, reason: ERROR_MESSAGES.buildingLimitReached }
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
    return { isValid: false, reason: ERROR_MESSAGES.buildingLimitReached }
  }
  
  // Check resources
  if (!hasResources(player.resources, BUILDING_COSTS.city)) {
    return { isValid: false, reason: ERROR_MESSAGES.insufficientResources }
  }
  
  return { isValid: true }
}

export function canPlaceRoad(
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
    return { isValid: false, reason: 'Edge already has a road' }
  }
  
  // Check building limit
  const roadsBuilt = countPlayerRoads(state, playerId)
  if (roadsBuilt >= GAME_RULES.maxRoads) {
    return { isValid: false, reason: ERROR_MESSAGES.buildingLimitReached }
  }
  
  // During setup, must be connected to the settlement just placed
  if (state.phase === 'setup1' || state.phase === 'setup2') {
    // Check if connected to player's most recent settlement
    if (!checkSetupRoadPlacement(state, playerId, edgeId)) {
      return { isValid: false, reason: 'Must connect to your most recent settlement' }
    }
  }
  
  // Check if connected to player's network
  if (!isEdgeConnectedToPlayer(state, playerId, edgeId)) {
    return { isValid: false, reason: 'Must be connected to your network' }
  }
  
  // Check resources
  if (!hasResources(player.resources, BUILDING_COSTS.road)) {
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
  
  // Check if player has resources to offer (convert Partial to full ResourceCards)
  if (trade.offering) {
    const offeringResources: ResourceCards = {
      wood: trade.offering.wood || 0,
      brick: trade.offering.brick || 0,
      ore: trade.offering.ore || 0,
      wheat: trade.offering.wheat || 0,
      sheep: trade.offering.sheep || 0
    }
    if (!hasResources(player.resources, offeringResources)) {
      return { isValid: false, reason: ERROR_MESSAGES.insufficientResources }
    }
  }
  
  // Check if trade is valid (not trading nothing for nothing)
  const offeringCount = trade.offering ? 
    Object.values(trade.offering).reduce((sum, val) => sum + (val || 0), 0) : 0
  const requestingCount = trade.requesting ? 
    Object.values(trade.requesting).reduce((sum, val) => sum + (val || 0), 0) : 0
  
  if (offeringCount === 0 || requestingCount === 0) {
    return { isValid: false, reason: 'Invalid trade: must offer and request resources' }
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

// ============= Robber Validation =============

export function canMoveRobber(
  state: GameState,
  playerId: PlayerId,
  hexPosition: { q: number, r: number, s: number }
): PlacementValidation {
  if (state.phase !== 'moveRobber') {
    return { isValid: false, reason: 'Not in robber movement phase' }
  }
  
  // Find hex with matching position
  const hex = Array.from(state.board.hexes.values()).find(h => 
    h.position.q === hexPosition.q && 
    h.position.r === hexPosition.r && 
    h.position.s === hexPosition.s
  )
  if (!hex) {
    return { isValid: false, reason: 'Invalid hex position' }
  }
  
  // Can't place on same hex
  if (state.board.robberPosition && hexToString(hex.position) === hexToString(state.board.robberPosition)) {
    return { isValid: false, reason: 'Must move robber to different hex' }
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
  if (getTotalResourceCount(target.resources) === 0) {
    return { isValid: false, reason: 'Target has no resources' }
  }
  
  // Target must have building adjacent to robber
  const robberPosString = hexToString(state.board.robberPosition)
  const robberHex = Array.from(state.board.hexes.values()).find(h => h.id === robberPosString)
  if (!robberHex) {
    return { isValid: false, reason: 'Robber position invalid' }
  }
  
  // Check if target has buildings adjacent to robber hex
  const hasAdjacentBuilding = playerHasBuildingAdjacentToRobber(state, targetId)
  
  if (!hasAdjacentBuilding) {
    return { isValid: false, reason: 'No valid targets to steal from' }
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
  
  const totalResources = getTotalResourceCount(player.resources)
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
  
  // Check if player has resources to discard (convert Partial to full ResourceCards)
  const discardResources: ResourceCards = {
    wood: toDiscard.wood || 0,
    brick: toDiscard.brick || 0,
    ore: toDiscard.ore || 0,
    wheat: toDiscard.wheat || 0,
    sheep: toDiscard.sheep || 0
  }
  if (!hasResources(player.resources, discardResources)) {
    return { isValid: false, reason: 'You do not have those resources' }
  }
  
  // Check if discarding correct amount
  const totalResources = getTotalResourceCount(player.resources)
  const requiredDiscard = calculateDiscardCount(totalResources)
  const discardCount = Object.values(toDiscard).reduce((sum, val) => sum + (val || 0), 0)
  
  if (discardCount !== requiredDiscard) {
    return { isValid: false, reason: `Must discard exactly ${requiredDiscard} resources` }
  }
  
  return { isValid: true }
}

// ============= Helper Functions =============

// Removed stubbed functions - now using real implementations from adjacency-helpers.ts

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

function countPlayerRoads(
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

/**
 * Check if a player has any buildings adjacent to the robber's current position
 */
function playerHasBuildingAdjacentToRobber(state: GameState, playerId: PlayerId): boolean {
  if (!state.board.robberPosition) {
    return false // No robber position set
  }

  // Get all vertices adjacent to the robber's hex
  const adjacentVertices: string[] = []
  
  state.board.vertices.forEach((vertex, vertexId) => {
    // Check if any of the vertex's hexes match the robber's position
    for (const vertexHex of vertex.position.hexes) {
      if (vertexHex.q === state.board.robberPosition!.q && 
          vertexHex.r === state.board.robberPosition!.r && 
          vertexHex.s === state.board.robberPosition!.s) {
        adjacentVertices.push(vertexId)
        break
      }
    }
  })

  // Check if any of these vertices have the player's buildings
  for (const vertexId of adjacentVertices) {
    const vertex = state.board.vertices.get(vertexId)
    if (vertex && vertex.building && vertex.building.owner === playerId) {
      return true
    }
  }

  return false
} 