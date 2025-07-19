import { GameState, GameAction, PlayerId } from '@settlers/game-engine'

/**
 * Handle simple actions for non-main game phases
 */
export function getSimplePhaseAction(gameState: GameState, playerId: PlayerId): GameAction | null {
  const phase = gameState.phase
  
  switch (phase) {
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
 * Handle discard phase - discard excess resources randomly
 */
function handleDiscardPhase(gameState: GameState, playerId: PlayerId): GameAction | null {
  const player = gameState.players.get(playerId)!
  const totalResources = Object.values(player.resources).reduce((sum, n) => sum + n, 0)
  
  if (totalResources <= 7) {
    return null // No need to discard
  }
  
  const toDiscard = Math.floor(totalResources / 2)
  const discard = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 }
  
  // Simple strategy: discard randomly from available resources
  let remaining = toDiscard
  const resourceTypes = Object.keys(player.resources) as (keyof typeof player.resources)[]
  
  while (remaining > 0) {
    for (const resourceType of resourceTypes) {
      if (remaining <= 0) break
      if (player.resources[resourceType] > discard[resourceType]) {
        discard[resourceType]++
        remaining--
      }
    }
  }
  
  return {
    type: 'discard',
    playerId,
    data: { resources: discard }
  }
}

/**
 * Handle robber movement - move to hex that hurts opponents most
 */
function handleMoveRobberPhase(gameState: GameState, playerId: PlayerId): GameAction | null {
  // Simple strategy: move robber to first available hex that's not current position
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
 * Handle steal phase - steal from random opponent
 */
function handleStealPhase(gameState: GameState, playerId: PlayerId): GameAction | null {
  // Simple strategy: steal from first available opponent
  const opponents = Array.from(gameState.players.keys()).filter(id => id !== playerId)
  
  if (opponents.length > 0) {
    return {
      type: 'stealResource',
      playerId,
      data: { targetPlayerId: opponents[0] }
    }
  }
  
  return null
} 