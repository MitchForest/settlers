import { GameState, PlayerId } from '@settlers/game-engine'
import { findRoadEndpoints, findNewExpansionPaths, ExpansionPath } from './expansion-tracker'
import { getCurrentResources, canBuild } from './resource-manager'
import { getPlayerProduction } from './production-analyzer'

export type GamePhase = 'EXPANSION' | 'GROWTH' | 'ACCELERATION' | 'VICTORY'

export interface StuckState {
  isStuck: boolean
  reason: string
  turnsStuck: number
  recommendedAction: 'BUILD_NEW_ROAD' | 'BUY_DEV_CARDS' | 'UPGRADE_SETTLEMENTS' | 'END_TURN' | 'CONTINUE'
}

export interface PhaseInfo {
  phase: GamePhase
  victoryPoints: number
  turnsInPhase: number
  primaryGoal: string
  secondaryGoals: string[]
}

/**
 * Determine current game phase based on victory points and game state
 */
export function getGamePhase(gameState: GameState, playerId: PlayerId): PhaseInfo {
  const player = gameState.players.get(playerId)
  const victoryPoints = (typeof player?.score === 'number' ? player.score : player?.score?.total) || 0
  
  let phase: GamePhase
  let primaryGoal: string
  let secondaryGoals: string[]
  
  if (victoryPoints <= 2) {
    phase = 'EXPANSION'
    primaryGoal = 'Build 3rd settlement'
    secondaryGoals = ['Build roads toward best vertices', 'Collect resources for expansion']
  } else if (victoryPoints <= 5) {
    phase = 'GROWTH'
    primaryGoal = 'Build economic engine'
    secondaryGoals = ['Expand to 4th+ settlements', 'Upgrade high-production settlements', 'Maintain expansion pace']
  } else if (victoryPoints <= 8) {
    phase = 'ACCELERATION'
    primaryGoal = 'Maximize point generation'
    secondaryGoals = ['Build cities', 'Buy development cards', 'Continue selective expansion']
  } else {
    phase = 'VICTORY'
    primaryGoal = 'Race to 10 points'
    secondaryGoals = ['Focus on fastest victory path', 'Block opponents if necessary', 'Calculate optimal endgame']
  }
  
  return {
    phase,
    victoryPoints,
    turnsInPhase: getEstimatedTurnsInPhase(gameState, playerId, phase),
    primaryGoal,
    secondaryGoals
  }
}

/**
 * Estimate turns spent in current phase (simplified)
 */
function getEstimatedTurnsInPhase(gameState: GameState, playerId: PlayerId, phase: GamePhase): number {
  // Simple estimation based on game state
  // In full implementation, we'd track this properly
  const player = gameState.players.get(playerId)
  if (!player) return 0
  
  // Rough estimate based on buildings owned
  let buildings = 0
  for (const vertex of gameState.board.vertices.values()) {
    if (vertex.building?.owner === playerId) {
      buildings++
    }
  }
  
  // Estimate turns: more buildings = more turns played
  return Math.floor(buildings / 2) + 1
}

/**
 * Check if player is in a stuck state and needs fallback strategy
 */
export function checkForStuckState(gameState: GameState, playerId: PlayerId): StuckState {
  const expansionPaths = findNewExpansionPaths(gameState, playerId)
  const readyPaths = expansionPaths.filter(path => path.status === 'READY')
  const buildingPaths = expansionPaths.filter(path => path.status === 'BUILDING')
  const blockedPaths = expansionPaths.filter(path => path.status === 'BLOCKED')
  
  // Check various stuck conditions
  
  // 1. No expansion options at all
  if (expansionPaths.length === 0 || expansionPaths.every(path => path.status === 'DEAD_END')) {
    return {
      isStuck: true,
      reason: 'No viable expansion paths remaining',
      turnsStuck: 1,
      recommendedAction: 'BUILD_NEW_ROAD'
    }
  }
  
  // 2. All paths blocked by opponents
  if (readyPaths.length === 0 && buildingPaths.length === 0 && blockedPaths.length > 0) {
    return {
      isStuck: true,
      reason: 'All expansion paths blocked by opponents',
      turnsStuck: 1,
      recommendedAction: 'BUILD_NEW_ROAD'
    }
  }
  
  // 3. Can't build anything and no useful options
  if (!canBuildExpansionItems(gameState, playerId) && !canBuild(gameState, playerId, 'developmentCard')) {
    return {
      isStuck: true,
      reason: 'Cannot build roads, settlements, or development cards',
      turnsStuck: 1,
      recommendedAction: 'END_TURN'
    }
  }
  
  // 4. Multiple turns without progress (would need turn tracking)
  // For now, assume not stuck if we have viable paths
  
  return {
    isStuck: false,
    reason: '',
    turnsStuck: 0,
    recommendedAction: 'CONTINUE'
  }
}

/**
 * Provide fallback strategy when stuck
 */
export function recoverFromStuck(gameState: GameState, playerId: PlayerId): {
  type: string
  data: any
  reasoning: string
} {
  const stuckState = checkForStuckState(gameState, playerId)
  const phase = getGamePhase(gameState, playerId)
  
  switch (stuckState.recommendedAction) {
    case 'BUILD_NEW_ROAD':
      return handleRoadRecovery(gameState, playerId, phase.phase)
      
    case 'BUY_DEV_CARDS':
      // Only try to buy dev cards if we can actually afford them
      if (canBuild(gameState, playerId, 'developmentCard')) {
        return {
          type: 'buyDevelopmentCard',
          data: {},
          reasoning: 'Stuck in expansion - buying dev cards for progress and potential victory points'
        }
      } else {
        return {
          type: 'endTurn',
          data: {},
          reasoning: 'Stuck but cannot afford dev cards - ending turn to accumulate resources'
        }
      }
      
    case 'UPGRADE_SETTLEMENTS':
      return handleUpgradeRecovery(gameState, playerId)
      
    case 'END_TURN':
    default:
      return {
        type: 'endTurn',
        data: {},
        reasoning: 'No viable actions available - ending turn'
      }
  }
}

/**
 * Handle recovery by building new roads in different directions
 */
function handleRoadRecovery(gameState: GameState, playerId: PlayerId, phase: GamePhase): {
  type: string
  data: any
  reasoning: string
} {
  // Find a settlement to build a new road from
  const playerSettlements = getPlayerSettlements(gameState, playerId)
  
  // Try to find a settlement with fewest roads built from it
  for (const settlementVertex of playerSettlements) {
    // Find expansion paths from this settlement
    const expansionPaths = findNewExpansionPaths(gameState, playerId)
    const buildingPath = expansionPaths.find(path => 
      path.startingSettlement === settlementVertex && 
      path.status === 'BUILDING'
    )
    
    if (buildingPath && buildingPath.currentEndpoints.length > 0) {
      return {
        type: 'buildRoad',
        data: {
          edgeId: buildingPath.currentEndpoints[0].edgeId
        },
        reasoning: `Stuck in expansion - building new road from ${settlementVertex} to open new opportunities`
      }
    }
  }
  
  return {
    type: 'endTurn',
    data: {},
    reasoning: 'Cannot find viable road building options'
  }
}

/**
 * Handle recovery by upgrading settlements
 */
function handleUpgradeRecovery(gameState: GameState, playerId: PlayerId): {
  type: string
  data: any
  reasoning: string
} {
  // Find best settlement to upgrade
  const playerSettlements = getPlayerSettlements(gameState, playerId)
  
  for (const settlementVertex of playerSettlements) {
    const vertex = gameState.board.vertices.get(settlementVertex)
    if (vertex?.building?.type === 'settlement') {
      return {
        type: 'upgradeSettlement',
        data: {
          vertexId: settlementVertex
        },
        reasoning: 'Stuck in expansion - upgrading settlement to city for increased resource production'
      }
    }
  }
  
  return {
    type: 'endTurn',
    data: {},
    reasoning: 'No settlements available to upgrade'
  }
}

/**
 * Check if player can build items needed for expansion
 */
function canBuildExpansionItems(gameState: GameState, playerId: PlayerId): boolean {
  return canBuild(gameState, playerId, 'road') || 
         canBuild(gameState, playerId, 'settlement')
}

/**
 * Get vertices where player has settlements
 */
function getPlayerSettlements(gameState: GameState, playerId: PlayerId): string[] {
  const settlements: string[] = []
  
  for (const [vertexId, vertex] of gameState.board.vertices) {
    if (vertex.building?.owner === playerId && vertex.building.type === 'settlement') {
      settlements.push(vertexId)
    }
  }
  
  return settlements
}

/**
 * Calculate progress toward victory conditions
 */
export function calculateVictoryProgress(gameState: GameState, playerId: PlayerId): {
  currentVP: number
  potentialVP: number
  fastestPath: string
  turnsToVictory: number
} {
  const player = gameState.players.get(playerId)
  const currentVP = (typeof player?.score === 'number' ? player.score : player?.score?.total) || 0
  
  // Calculate potential VP from various sources
  let potentialVP = currentVP
  
  // Count settlements that could be upgraded to cities
  const settlements = getPlayerSettlements(gameState, playerId)
  potentialVP += settlements.length // Each settlement can become a city (+1 VP)
  
  // Potential dev card VPs (simplified)
  const resources = getCurrentResources(gameState, playerId)
  const canBuyDevCards = Math.floor(Math.min(resources.sheep, resources.wheat, resources.ore))
  potentialVP += Math.min(canBuyDevCards, 3) // Assume some dev cards give VP
  
  // Estimate turns to victory (simplified)
  const vpNeeded = 10 - currentVP
  const turnsToVictory = Math.max(1, Math.ceil(vpNeeded / 1.5)) // Assume 1.5 VP per turn average
  
  return {
    currentVP,
    potentialVP,
    fastestPath: potentialVP >= 10 ? 'Cities and dev cards' : 'Need more expansion',
    turnsToVictory
  }
} 