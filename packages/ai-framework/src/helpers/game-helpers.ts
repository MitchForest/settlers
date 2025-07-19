import { GameState, GameAction, PlayerId, getPossibleSettlementPositions, getPossibleRoadPositions } from '@settlers/game-engine'
import { smartDiscard } from '../modules/discard-strategy'
import { selectRobberTarget, selectStealTarget } from '../modules/robber-strategy'
import { InitialPlacementStrategy } from '../strategies/setup/simple-vertex'

/**
 * Handle simple actions for non-main game phases
 */
export function getSimplePhaseAction(gameState: GameState, playerId: PlayerId): GameAction | null {
  const phase = gameState.phase
  
  switch (phase) {
    case 'setup1':
    case 'setup2':
      return handleSetupPhase(gameState, playerId)
    
    case 'discard':
      return handleDiscardPhase(gameState, playerId)
    
    case 'moveRobber':
      return handleMoveRobberPhase(gameState, playerId)
    
    case 'steal':
      return handleStealPhase(gameState, playerId)
    
    case 'roll':
      return { type: 'roll', playerId, data: {} }
    
    default:
      console.log(`⚠️ Unhandled phase: ${phase}`)
      return null
  }
}

/**
 * Handle discard phase - smart discard based on goals and phase
 */
function handleDiscardPhase(gameState: GameState, playerId: PlayerId): GameAction | null {
  const player = gameState.players.get(playerId)
  if (!player) return null
  
  const totalResources = Object.values(player.resources).reduce((sum, count) => sum + (count || 0), 0)
  
  // Only discard if player has more than 7 resources
  if (totalResources <= 7) {
    return null
  }
  
  const discardRecommendation = smartDiscard(gameState, playerId)
  
  // Check if any discard is needed (exclude reasoning string)
  const totalToDiscard = discardRecommendation.wood + discardRecommendation.brick + 
                        discardRecommendation.sheep + discardRecommendation.wheat + 
                        discardRecommendation.ore
  
  if (totalToDiscard === 0) {
    console.log(`🗃️ No discard needed despite having ${totalResources} resources`)
    return null
  }
  
  console.log(`🗃️ Smart discard: ${discardRecommendation.reasoning}`)
  
  return {
    type: 'discard',
    playerId,
    data: { 
      resources: {
        wood: discardRecommendation.wood,
        brick: discardRecommendation.brick,
        sheep: discardRecommendation.sheep,
        wheat: discardRecommendation.wheat,
        ore: discardRecommendation.ore
      }
    }
  }
}

/**
 * Handle robber movement - target high-value hexes of leading players
 */
function handleMoveRobberPhase(gameState: GameState, playerId: PlayerId): GameAction | null {
  const robberTarget = selectRobberTarget(gameState, playerId)
  
  if (robberTarget) {
    console.log(`🎯 Smart robber: ${robberTarget.reasoning}`)
    return {
      type: 'moveRobber',
      playerId,
      data: { hexPosition: robberTarget.hexPosition }
    }
  }
  
  // Fallback: move to first available hex
  for (const [hexId, hex] of gameState.board.hexes) {
    if (!hex.hasRobber && hex.terrain !== 'desert' && hex.terrain !== 'sea') {
      return {
        type: 'moveRobber',
        playerId,
        data: { hexPosition: hex.position }
      }
    }
  }
  
  return null
}

/**
 * Handle setup phases - use initial placement strategy
 */
function handleSetupPhase(gameState: GameState, playerId: PlayerId): GameAction | null {
  const strategy = new InitialPlacementStrategy()
  
  // Check if we need to place a settlement or road
  const possibleSettlements = getPossibleSettlementPositions(gameState, playerId)
  const possibleRoads = getPossibleRoadPositions(gameState, playerId)
  
  if (possibleSettlements.length > 0) {
    // Place settlement
    const vertexId = strategy.selectFirstSettlement(gameState, playerId)
    return {
      type: 'placeBuilding',
      playerId,
      data: { buildingType: 'settlement', vertexId }
    }
  } else if (possibleRoads.length > 0) {
    // Place road - just take first available for now
    return {
      type: 'placeRoad',
      playerId,
      data: { edgeId: possibleRoads[0] }
    }
  }
  
  return null
}

/**
 * Handle steal phase - target leading players likely to have resources
 */
function handleStealPhase(gameState: GameState, playerId: PlayerId): GameAction | null {
  // Get available steal targets (players adjacent to robber)
  const availableTargets = Array.from(gameState.players.keys()).filter(id => id !== playerId)
  // TODO: Filter to only players actually adjacent to robber hex
  
  if (availableTargets.length > 0) {
    const stealTarget = selectStealTarget(gameState, playerId, availableTargets)
    
    if (stealTarget) {
      console.log(`🎯 Smart steal: ${stealTarget.reasoning}`)
      return {
        type: 'stealResource',
        playerId,
        data: { targetPlayerId: stealTarget.targetPlayerId }
      }
    }
  }
  
  return null
} 