import { GameState, PlayerId } from '@settlers/game-engine'
import { PIP_VALUES, calculateScarcityMultipliers } from '../helpers'

export interface RobberTarget {
  hexPosition: { q: number, r: number, s: number }
  reasoning: string
  targetPlayers: PlayerId[]
  expectedValue: number
}

export interface StealTarget {
  targetPlayerId: PlayerId
  reasoning: string
  likelihood: number
}

/**
 * Smart robber placement strategy
 * Targets high-pip hexes of leading players, with bonus for hitting multiple opponents
 */
export function selectRobberTarget(gameState: GameState, playerId: PlayerId): RobberTarget | null {
  const candidates: Array<RobberTarget & { score: number }> = []
  const scarcityMultipliers = calculateScarcityMultipliers(gameState)
  const playerScores = getPlayerScores(gameState)
  const leadingPlayers = getLeadingPlayers(playerScores, playerId)
  
  console.log(`🎯 Robber targeting - leading players: ${leadingPlayers.join(', ')}`)
  
  for (const [hexId, hex] of gameState.board.hexes) {
    // Skip current robber position, desert, and sea
    if (hex.hasRobber || hex.terrain === 'desert' || hex.terrain === 'sea') {
      continue
    }
    
    // Skip hexes without number tokens
    if (!hex.numberToken) {
      continue
    }
    
    // Find players with settlements/cities on this hex
    const playersOnHex = getPlayersOnHex(gameState, hex.position)
    
    // Skip hexes with no opponents
    const opponentPlayersOnHex = playersOnHex.filter(p => p !== playerId)
    if (opponentPlayersOnHex.length === 0) {
      continue
    }
    
    // Calculate target value
    const pipValue = PIP_VALUES[hex.numberToken! as keyof typeof PIP_VALUES] || 0
    const scarcityBonus = scarcityMultipliers[terrainToResource(hex.terrain!)] || 1.0
    const leadingPlayerBonus = opponentPlayersOnHex.filter(p => leadingPlayers.includes(p)).length * 3
    const multiPlayerBonus = Math.max(0, opponentPlayersOnHex.length - 1) * 2
    
    const score = (pipValue * scarcityBonus) + leadingPlayerBonus + multiPlayerBonus
    
    const reasoning = `${pipValue} pips on ${hex.terrain}-${hex.numberToken} ` +
      `(scarcity: ${scarcityBonus.toFixed(1)}x, ` +
      `${opponentPlayersOnHex.length} opponents, ` +
      `${opponentPlayersOnHex.filter(p => leadingPlayers.includes(p)).length} leading)`
    
    candidates.push({
      hexPosition: hex.position,
      reasoning,
      targetPlayers: opponentPlayersOnHex,
      expectedValue: score,
      score
    })
  }
  
  // Sort by score and return best target
  candidates.sort((a, b) => b.score - a.score)
  
  if (candidates.length > 0) {
    const best = candidates[0]
    console.log(`🎯 Best robber target: ${best.reasoning} (score: ${best.score.toFixed(1)})`)
    return {
      hexPosition: best.hexPosition,
      reasoning: best.reasoning,
      targetPlayers: best.targetPlayers,
      expectedValue: best.expectedValue
    }
  }
  
  return null
}

/**
 * Smart steal target selection
 * Prioritize players likely to have resources we need
 */
export function selectStealTarget(gameState: GameState, playerId: PlayerId, availableTargets: PlayerId[]): StealTarget | null {
  if (availableTargets.length === 0) {
    return null
  }
  
  const candidates: Array<StealTarget & { score: number }> = []
  const playerScores = getPlayerScores(gameState)
  const leadingPlayers = getLeadingPlayers(playerScores, playerId)
  
  for (const targetId of availableTargets) {
    const targetPlayer = gameState.players.get(targetId)
    if (!targetPlayer) continue
    
    let score = 0
    let reasoning = ''
    
    // Prefer stealing from leading players
    if (leadingPlayers.includes(targetId)) {
      score += 5
      reasoning += 'leading player, '
    }
    
    // Estimate resource likelihood based on their settlements
    const resourceLikelihood = estimateResourceLikelihood(gameState, targetId)
    const totalResources = Object.values(targetPlayer.resources).reduce((sum, n) => sum + n, 0)
    
    // Prefer players with more resources
    score += Math.min(totalResources * 0.5, 3)
    reasoning += `${totalResources} resources, `
    
    // Prefer players likely to have resources we need
    // (This is simplified - could be enhanced with our resource manager)
    score += resourceLikelihood * 2
    reasoning += `${resourceLikelihood.toFixed(1)} resource likelihood`
    
    candidates.push({
      targetPlayerId: targetId,
      reasoning: reasoning.replace(/, $/, ''),
      likelihood: resourceLikelihood,
      score
    })
  }
  
  // Sort by score and return best target
  candidates.sort((a, b) => b.score - a.score)
  
  if (candidates.length > 0) {
    const best = candidates[0]
    console.log(`🎯 Best steal target: ${best.targetPlayerId} (${best.reasoning})`)
    return {
      targetPlayerId: best.targetPlayerId,
      reasoning: best.reasoning,
      likelihood: best.likelihood
    }
  }
  
  return {
    targetPlayerId: availableTargets[0],
    reasoning: 'Random fallback',
    likelihood: 0.5
  }
}

/**
 * Get player scores for determining leaders
 */
function getPlayerScores(gameState: GameState): Record<PlayerId, number> {
  const scores: Record<PlayerId, number> = {}
  
  for (const [playerId, player] of gameState.players) {
    scores[playerId] = (typeof player.score === 'number' ? player.score : player.score?.total) || 0
  }
  
  return scores
}

/**
 * Get leading players (1st and 2nd place, excluding current player)
 */
function getLeadingPlayers(playerScores: Record<PlayerId, number>, excludePlayerId: PlayerId): PlayerId[] {
  const sortedPlayers = Object.entries(playerScores)
    .filter(([id, _]) => id !== excludePlayerId)
    .sort(([, a], [, b]) => b - a)
    .map(([id, _]) => id)
  
  return sortedPlayers.slice(0, 2) // Top 2 players
}

/**
 * Get players with buildings on a specific hex
 */
function getPlayersOnHex(gameState: GameState, hexPosition: { q: number, r: number, s: number }): PlayerId[] {
  const players: PlayerId[] = []
  
  for (const [vertexId, vertex] of gameState.board.vertices) {
    if (vertex.building) {
      // Check if vertex is adjacent to this hex
      const isAdjacent = vertex.position.hexes.some(hexCoord =>
        hexCoord.q === hexPosition.q && hexCoord.r === hexPosition.r && hexCoord.s === hexPosition.s
      )
      
      if (isAdjacent && !players.includes(vertex.building.owner)) {
        players.push(vertex.building.owner)
      }
    }
  }
  
  return players
}

/**
 * Convert terrain to resource type (simplified version)
 */
function terrainToResource(terrain: string): 'wood' | 'brick' | 'sheep' | 'wheat' | 'ore' {
  const mapping: Record<string, 'wood' | 'brick' | 'sheep' | 'wheat' | 'ore'> = {
    forest: 'wood',
    hills: 'brick',
    pasture: 'sheep',
    fields: 'wheat',
    mountains: 'ore'
  }
  return mapping[terrain] || 'wood'
}

/**
 * Estimate likelihood that a player has resources (simplified)
 */
function estimateResourceLikelihood(gameState: GameState, playerId: PlayerId): number {
  // Simplified: assume players with more settlements have more resources
  let settlementCount = 0
  let cityCount = 0
  
  for (const [vertexId, vertex] of gameState.board.vertices) {
    if (vertex.building?.owner === playerId) {
      if (vertex.building.type === 'settlement') {
        settlementCount++
      } else if (vertex.building.type === 'city') {
        cityCount++
      }
    }
  }
  
  // Cities produce more resources
  const productionScore = settlementCount + (cityCount * 2)
  
  // Normalize to 0-1 scale
  return Math.min(productionScore / 6, 1.0)
} 