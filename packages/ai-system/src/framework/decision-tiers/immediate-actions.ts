import { GameState, GameAction, PlayerId, BUILDING_COSTS } from '@settlers/game-engine'
import { Decision, DecisionContext, DecisionTier } from '../types'

/**
 * TIER 1: Immediate Actions - No-brainer moves that should always be executed
 * 
 * These are moves with >95% confidence that don't require deep analysis:
 * - Winning moves (building that gets 10+ VP)
 * - Obvious upgrades (settlement → city with resources)
 * - Defensive plays (robber removal when blocked)
 * - Resource management (forced discards)
 */
export class ImmediateActionsTier implements DecisionTier {
  name = 'ImmediateActions'
  priority = 100 // Highest priority

  canHandle(context: DecisionContext): boolean {
    const { gameState, playerId } = context
    
    // Can handle any main game phase
    return gameState.phase === 'actions' || 
           gameState.phase === 'discard' ||
           gameState.phase === 'moveRobber'
  }

  async decide(context: DecisionContext): Promise<Decision | null> {
    const { gameState, playerId } = context
    const player = gameState.players.get(playerId)!

    // 1. WINNING MOVES - Always highest priority
    const winningMove = this.findWinningMove(gameState, playerId)
    if (winningMove) {
      return {
        type: 'immediate',
        action: winningMove,
        reasoning: '🏆 IMMEDIATE VICTORY MOVE!',
        confidence: 1.0,
        strategicGoal: 'WIN_GAME'
      }
    }

    // 2. FORCED DISCARDS - Must handle immediately
    if (gameState.phase === 'discard') {
      const discardAction = this.getOptimalDiscard(gameState, playerId)
      if (discardAction) {
        return {
          type: 'immediate',
          action: discardAction,
          reasoning: 'Forced discard - optimal resource selection',
          confidence: 0.9,
          strategicGoal: 'COMPLY_WITH_RULES'
        }
      }
    }

    // 3. SETTLEMENT → CITY UPGRADE (if we have exact resources)
    const cityUpgrade = this.getObviousCityUpgrade(gameState, playerId)
    if (cityUpgrade) {
      return {
        type: 'immediate',
        action: cityUpgrade,
        reasoning: 'Settlement→City upgrade (+2VP, double production)',
        confidence: 0.95,
        strategicGoal: 'MAXIMIZE_PRODUCTION'
      }
    }

    // 4. BUILD SETTLEMENT (if roads + resources ready)
    const settlementBuild = this.getObviousSettlement(gameState, playerId)
    if (settlementBuild) {
      return {
        type: 'immediate',
        action: settlementBuild,
        reasoning: 'Settlement ready - roads connected, resources available',
        confidence: 0.9,
        strategicGoal: 'EXPAND_TERRITORY'
      }
    }

    // 5. PLAY KNIGHT (if robber is blocking our production)
    if (this.shouldPlayKnightImmediately(gameState, playerId)) {
      const knightAction = this.getKnightAction(gameState, playerId)
      if (knightAction) {
        return {
          type: 'immediate',
          action: knightAction,
          reasoning: 'Robber blocking high-value production - use knight',
          confidence: 0.85,
          strategicGoal: 'REMOVE_BLOCKADE'
        }
      }
    }

    // 6. USE OLD DEVELOPMENT CARDS (late game efficiency)
    const oldCardAction = this.useOldDevelopmentCards(gameState, playerId)
    if (oldCardAction) {
      return {
        type: 'immediate',
        action: oldCardAction,
        reasoning: 'Use old development cards before game ends',
        confidence: 0.8,
        strategicGoal: 'MAXIMIZE_CARD_VALUE'
      }
    }

    return null // No immediate actions needed
  }

  /**
   * Find any building that would win the game (10+ VP)
   */
  private findWinningMove(gameState: GameState, playerId: PlayerId): GameAction | null {
    const player = gameState.players.get(playerId)!
    
    if (player.score.total < 8) {
      return null // Too far from winning
    }

    // Check if we can build a city for the win
    if (player.score.total >= 8 && this.canAffordCity(player)) {
      const settlementToUpgrade = this.findBestSettlementToUpgrade(gameState, playerId)
      if (settlementToUpgrade) {
        return {
          type: 'build',
          playerId,
          data: {
            buildingType: 'city',
            vertexId: settlementToUpgrade
          }
        }
      }
    }

    // Check if we can build a settlement for the win
    if (player.score.total >= 9 && this.canAffordSettlement(player)) {
      const settlementSpot = this.findBestSettlementSpot(gameState, playerId)
      if (settlementSpot) {
        return {
          type: 'build',
          playerId,
          data: {
            buildingType: 'settlement',
            vertexId: settlementSpot
          }
        }
      }
    }

    // Note: Victory point cards count automatically and cannot be played

    return null
  }

  /**
   * Handle forced discard optimally
   */
  private getOptimalDiscard(gameState: GameState, playerId: PlayerId): GameAction | null {
    const player = gameState.players.get(playerId)!
    const totalCards = Object.values(player.resources).reduce((a, b) => a + b, 0)
    
    if (totalCards <= 7) {
      return null // No discard needed
    }

    const toDiscard = totalCards - 7
    const resources = { ...player.resources }
    const discardPlan: Record<string, number> = {}

    // Priority order: keep wheat/ore > wood/brick > sheep
    const discardPriority = ['sheep', 'brick', 'wood', 'ore', 'wheat']
    
    let remaining = toDiscard
    for (const resourceType of discardPriority) {
      if (remaining <= 0) break
      
      const available = resources[resourceType as keyof typeof resources]
      const discard = Math.min(available, remaining)
      
      if (discard > 0) {
        discardPlan[resourceType] = discard
        remaining -= discard
      }
    }

    return {
      type: 'discard',
      playerId,
      data: {
        resources: discardPlan
      }
    }
  }

  /**
   * Check for obvious city upgrades
   */
  private getObviousCityUpgrade(gameState: GameState, playerId: PlayerId): GameAction | null {
    const player = gameState.players.get(playerId)!
    
    if (!this.canAffordCity(player)) {
      return null
    }

    const settlementToUpgrade = this.findBestSettlementToUpgrade(gameState, playerId)
    if (settlementToUpgrade) {
      return {
        type: 'build',
        playerId,
        data: {
          buildingType: 'city',
          vertexId: settlementToUpgrade
        }
      }
    }

    return null
  }

  /**
   * Check for obvious settlement builds
   */
  private getObviousSettlement(gameState: GameState, playerId: PlayerId): GameAction | null {
    const player = gameState.players.get(playerId)!
    
    if (!this.canAffordSettlement(player)) {
      return null
    }

    const settlementSpot = this.findBestSettlementSpot(gameState, playerId)
    if (settlementSpot) {
      return {
        type: 'build',
        playerId,
        data: {
          buildingType: 'settlement',
          vertexId: settlementSpot
        }
      }
    }

    return null
  }

  /**
   * Check if we should immediately play a knight
   */
  private shouldPlayKnightImmediately(gameState: GameState, playerId: PlayerId): boolean {
    const player = gameState.players.get(playerId)!
    
    // Must have a knight card
    const hasKnight = player.developmentCards.some(
      card => card.type === 'knight' && !card.playedTurn && card.purchasedTurn < gameState.turn
    )
    
    if (!hasKnight) return false

    // Check if robber is on our high-value hexes
    const robberHex = Array.from(gameState.board.hexes.values()).find(hex => hex.hasRobber)
    if (!robberHex) return false

    // Calculate our production value from this hex
    let ourProductionValue = 0
    for (const [vertexId, vertex] of gameState.board.vertices) {
      if (vertex.building?.owner === playerId) {
        // Check if this vertex is adjacent to the robber hex
        const isAdjacent = vertex.position.hexes.some(
          hexCoord => hexCoord.q === robberHex.position.q && hexCoord.r === robberHex.position.r
        )
        
        if (isAdjacent && robberHex.numberToken) {
          const probability = this.getNumberProbability(robberHex.numberToken)
          const buildingMultiplier = vertex.building.type === 'city' ? 2 : 1
          ourProductionValue += probability * buildingMultiplier
        }
      }
    }

    // Play knight if we're losing significant production
    return ourProductionValue >= 0.3 // Roughly 6 or 8 number with settlement
  }

  /**
   * Get knight action
   */
  private getKnightAction(gameState: GameState, playerId: PlayerId): GameAction | null {
    const player = gameState.players.get(playerId)!
    const knightCard = player.developmentCards.find(
      card => card.type === 'knight' && !card.playedTurn && card.purchasedTurn < gameState.turn
    )

    if (!knightCard) return null

    return {
      type: 'playCard',
      playerId,
      data: {
        cardId: knightCard.id
      }
    }
  }

  /**
   * Use old development cards in late game
   */
  private useOldDevelopmentCards(gameState: GameState, playerId: PlayerId): GameAction | null {
    // Only in late game (turn 30+) or if we have many old cards
    if (gameState.turn < 30) return null

    const player = gameState.players.get(playerId)!
    const oldCards = player.developmentCards.filter(
      card => !card.playedTurn && 
             card.purchasedTurn < gameState.turn - 3 && 
             card.type !== 'victory'
    )

    if (oldCards.length === 0) return null

    // Prioritize: yearOfPlenty > monopoly > roadBuilding > knight
    const cardPriority = ['yearOfPlenty', 'monopoly', 'roadBuilding', 'knight']
    
    for (const cardType of cardPriority) {
      const card = oldCards.find(c => c.type === cardType)
      if (card) {
        return {
          type: 'playCard',
          playerId,
          data: {
            cardId: card.id
          }
        }
      }
    }

    return null
  }

  // Helper methods
  private canAffordCity(player: any): boolean {
    return player.resources.ore >= BUILDING_COSTS.city.ore && 
           player.resources.wheat >= BUILDING_COSTS.city.wheat
  }

  private canAffordSettlement(player: any): boolean {
    return player.resources.wood >= BUILDING_COSTS.settlement.wood &&
           player.resources.brick >= BUILDING_COSTS.settlement.brick &&
           player.resources.wheat >= BUILDING_COSTS.settlement.wheat &&
           player.resources.sheep >= BUILDING_COSTS.settlement.sheep
  }

  private findBestSettlementToUpgrade(gameState: GameState, playerId: PlayerId): string | null {
    // Find settlement with highest production value
    let bestSettlement: string | null = null
    let highestValue = 0

    for (const [vertexId, vertex] of gameState.board.vertices) {
      if (vertex.building?.owner === playerId && vertex.building.type === 'settlement') {
        const productionValue = this.calculateVertexProductionValue(gameState, vertexId)
        if (productionValue > highestValue) {
          highestValue = productionValue
          bestSettlement = vertexId
        }
      }
    }

    return bestSettlement
  }

  private findBestSettlementSpot(gameState: GameState, playerId: PlayerId): string | null {
    // Simplified - would use more sophisticated placement logic
    // For now, just find any valid spot
    for (const [vertexId, vertex] of gameState.board.vertices) {
      if (!vertex.building && this.canBuildSettlementAt(gameState, playerId, vertexId)) {
        return vertexId
      }
    }
    return null
  }

  private calculateVertexProductionValue(gameState: GameState, vertexId: string): number {
    const vertex = gameState.board.vertices.get(vertexId)
    if (!vertex) return 0

    let totalValue = 0
    for (const hexCoord of vertex.position.hexes) {
      const hex = Array.from(gameState.board.hexes.values()).find(
        h => h.position.q === hexCoord.q && h.position.r === hexCoord.r
      )
      
      if (hex?.numberToken && hex.terrain !== 'desert') {
        totalValue += this.getNumberProbability(hex.numberToken)
      }
    }

    return totalValue
  }

  private canBuildSettlementAt(gameState: GameState, playerId: PlayerId, vertexId: string): boolean {
    // Simplified check - would need proper placement validation
    const vertex = gameState.board.vertices.get(vertexId)
    return vertex !== undefined && vertex.building === null
  }

  private getNumberProbability(number: number): number {
    const probabilities: Record<number, number> = {
      2: 1/36, 3: 2/36, 4: 3/36, 5: 4/36, 6: 5/36,
      7: 6/36, 8: 5/36, 9: 4/36, 10: 3/36, 11: 2/36, 12: 1/36
    }
    return probabilities[number] || 0
  }
} 