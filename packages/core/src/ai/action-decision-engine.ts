import { GameState, GameAction, PlayerId, ActionType, ResourceCards } from '../types'
import { BoardAnalyzer, createBoardAnalyzer } from './board-analyzer'
import {
  getPossibleSettlementPositions,
  getPossibleRoadPositions
} from '../engine/adjacency-helpers'
import { 
  canPlaceSettlement,
  canPlaceCity, 
  canPlaceRoad,
  canBuyDevelopmentCard
} from '../engine/state-validator'
import { hasResources } from '../calculations'
import { BUILDING_COSTS } from '../constants'

/**
 * Action Decision Engine for AI
 * 
 * This is the corrected version that properly integrates with the existing
 * action system, using the exact action types and data structures from
 * action-processor.ts and state-validator.ts.
 */

export interface ScoredAction {
  action: GameAction
  score: number           // 0-100, higher = better
  priority: number        // 0-100, higher = more urgent
  reasoning: string[]     // Human-readable explanation
}

export class ActionDecisionEngine {
  private readonly state: GameState
  private readonly playerId: PlayerId
  private readonly analyzer: BoardAnalyzer

  constructor(gameState: GameState, playerId: PlayerId) {
    this.state = gameState
    this.playerId = playerId
    this.analyzer = createBoardAnalyzer(gameState)
  }

  /**
   * Get the best action to take right now
   */
  getBestAction(): GameAction | null {
    const actions = this.getAllScoredActions()
    return actions.length > 0 ? actions[0].action : null
  }

  /**
   * Get all valid actions scored and prioritized
   */
  getAllScoredActions(): ScoredAction[] {
    const actions: ScoredAction[] = []

    // Generate actions based on current phase
    switch (this.state.phase) {
      case 'setup1':
      case 'setup2':
        actions.push(...this.getSetupActions())
        break
      case 'roll':
        actions.push(...this.getRollActions())
        break
      case 'actions':
        actions.push(...this.getMainPhaseActions())
        break
      case 'discard':
        actions.push(...this.getDiscardActions())
        break
      case 'moveRobber':
        actions.push(...this.getRobberActions())
        break
      default:
        break
    }

    // Sort by score (highest first)
    return actions.sort((a, b) => b.score - a.score)
  }

  // ============= Phase-Specific Action Generation =============

  private getSetupActions(): ScoredAction[] {
    const actions: ScoredAction[] = []
    
    // In setup, we place settlements first, then roads
    const possibleSettlements = getPossibleSettlementPositions(this.state, this.playerId)
    
    for (const vertexId of possibleSettlements) {
      const positionScore = this.analyzer.scoreSettlementPosition(vertexId, this.playerId)
      
      const action: GameAction = {
        type: 'placeBuilding',
        playerId: this.playerId,
        data: { buildingType: 'settlement', vertexId }
      }

      actions.push({
        action,
        score: positionScore.totalScore,
        priority: this.state.phase === 'setup2' ? 95 : 85, // Setup2 more urgent
        reasoning: [
          `Setup ${this.state.phase} settlement placement`,
          `Position score: ${positionScore.totalScore.toFixed(1)}`,
          ...positionScore.breakdown.slice(0, 2)
        ]
      })
    }

    return actions
  }

  private getRollActions(): ScoredAction[] {
    return [{
      action: {
        type: 'roll',
        playerId: this.playerId,
        data: {}
      },
      score: 100, // Must roll
      priority: 100,
      reasoning: ['Roll dice to start turn']
    }]
  }

  private getMainPhaseActions(): ScoredAction[] {
    const actions: ScoredAction[] = []
    const player = this.state.players.get(this.playerId)
    if (!player) return actions

    // Building actions
    actions.push(...this.getBuildingActions())
    
    // Trading actions  
    actions.push(...this.getTradingActions())
    
    // Development card actions
    actions.push(...this.getDevelopmentActions())
    
    // End turn (always available as fallback)
    actions.push({
      action: {
        type: 'endTurn',
        playerId: this.playerId,
        data: {}
      },
      score: 10, // Low score - only if nothing else to do
      priority: 5,
      reasoning: ['End turn - no other beneficial actions available']
    })

    return actions
  }

  private getBuildingActions(): ScoredAction[] {
    const actions: ScoredAction[] = []
    const player = this.state.players.get(this.playerId)
    if (!player) return actions

    // Settlement building
    if (hasResources(player.resources, BUILDING_COSTS.settlement)) {
      const possibleSettlements = getPossibleSettlementPositions(this.state, this.playerId)
      
      for (const vertexId of possibleSettlements.slice(0, 5)) { // Top 5 options
        const validation = canPlaceSettlement(this.state, this.playerId, vertexId)
        if (!validation.isValid) continue

        const score = this.analyzer.scoreSettlementPosition(vertexId, this.playerId)
        
        const action: GameAction = {
          type: 'build',
          playerId: this.playerId,
          data: { buildingType: 'settlement', position: vertexId }
        }

        actions.push({
          action,
          score: score.totalScore,
          priority: score.totalScore > 80 ? 90 : 70,
          reasoning: [
            `Build settlement - Score: ${score.totalScore.toFixed(1)}`,
            ...score.breakdown.slice(0, 2)
          ]
        })
      }
    }

    // City upgrades
    if (hasResources(player.resources, BUILDING_COSTS.city)) {
      const playerSettlements = Array.from(this.state.board.vertices.values())
        .filter(v => v.building?.owner === this.playerId && v.building?.type === 'settlement')
      
      for (const settlement of playerSettlements.slice(0, 3)) {
        const validation = canPlaceCity(this.state, this.playerId, settlement.id)
        if (!validation.isValid) continue

        const score = this.analyzer.scoreCityUpgrade(settlement.id, this.playerId)
        
        const action: GameAction = {
          type: 'build',
          playerId: this.playerId,
          data: { buildingType: 'city', position: settlement.id }
        }

        actions.push({
          action,
          score: score.totalScore,
          priority: 85, // Cities are high priority
          reasoning: [
            `Upgrade to city - Score: ${score.totalScore.toFixed(1)}`,
            'Doubles resource production',
            '+1 Victory Point'
          ]
        })
      }
    }

    // Road building
    if (hasResources(player.resources, BUILDING_COSTS.road)) {
      const possibleRoads = getPossibleRoadPositions(this.state, this.playerId)
      const expansionPaths = this.analyzer.findExpansionOpportunities(this.playerId)
      
      for (const edgeId of possibleRoads.slice(0, 8)) {
        const validation = canPlaceRoad(this.state, this.playerId, edgeId)
        if (!validation.isValid) continue

        let score = 30 // Base road score
        const reasoning: string[] = []

        // Check if enables expansion
        const enablesExpansion = expansionPaths.some(path => 
          path.requiredRoads.includes(edgeId)
        )
        
        if (enablesExpansion) {
          score += 40
          reasoning.push('Enables settlement expansion')
        }

        // Check longest road potential
        const roadPotential = this.analyzer.calculateLongestRoadPotential(this.playerId)
        if (roadPotential.currentLength >= 4) {
          score += 20
          reasoning.push(`Extends longest road (${roadPotential.currentLength})`)
        }

        const action: GameAction = {
          type: 'build',
          playerId: this.playerId,
          data: { buildingType: 'road', position: edgeId }
        }

        actions.push({
          action,
          score: Math.min(100, score),
          priority: enablesExpansion ? 75 : 50,
          reasoning: reasoning.length > 0 ? reasoning : ['Extend road network']
        })
      }
    }

    return actions
  }

  private getTradingActions(): ScoredAction[] {
    const actions: ScoredAction[] = []
    const player = this.state.players.get(this.playerId)
    if (!player) return actions

    const opportunities = this.analyzer.findTradingOpportunities(this.playerId)

    for (const opportunity of opportunities.slice(0, 3)) {
      if (opportunity.tradePartner === 'bank') {
        const action: GameAction = {
          type: 'bankTrade',
          playerId: this.playerId,
          data: {
            offering: opportunity.giveResources as ResourceCards,
            requesting: opportunity.receiveResources as ResourceCards
          }
        }

        actions.push({
          action,
          score: opportunity.efficiency,
          priority: opportunity.urgency,
          reasoning: [
            `Bank trade - ${opportunity.efficiency.toFixed(1)}% efficiency`,
            'Convert excess resources to needed resources'
          ]
        })
      }
    }

    return actions
  }

  private getDevelopmentActions(): ScoredAction[] {
    const actions: ScoredAction[] = []
    const player = this.state.players.get(this.playerId)
    if (!player) return actions

    // Buy development card
    const validation = canBuyDevelopmentCard(this.state, this.playerId)
    if (validation.isValid) {
      const action: GameAction = {
        type: 'buyCard',
        playerId: this.playerId,
        data: {}
      }

      actions.push({
        action,
        score: 60, // Moderate score
        priority: 40,
        reasoning: [
          'Buy development card for strategic advantage',
          'Potential for knight cards or victory points'
        ]
      })
    }

    // Play development cards
    const playableCards = player.developmentCards.filter(card => 
      !card.playedTurn && card.purchasedTurn < this.state.turn
    )

    for (const card of playableCards) {
      if (card.type === 'knight') {
        const action: GameAction = {
          type: 'playCard',
          playerId: this.playerId,
          data: { cardId: card.id, cardType: 'knight' }
        }

        actions.push({
          action,
          score: 70,
          priority: 80,
          reasoning: [
            'Play knight card',
            'Move robber strategically',
            'Progress toward largest army'
          ]
        })
      }
    }

    return actions
  }

  private getDiscardActions(): ScoredAction[] {
    const actions: ScoredAction[] = []
    const player = this.state.players.get(this.playerId)
    if (!player) return actions

    const resourceNeeds = this.analyzer.calculateResourceNeeds(this.playerId)
    const currentResources = player.resources
    const totalResources = Object.values(currentResources).reduce((sum, count) => sum + count, 0)
    const discardCount = Math.floor(totalResources / 2)

    if (discardCount > 0) {
      // Generate optimal discard
      const optimalDiscard = this.generateOptimalDiscard(currentResources, resourceNeeds, discardCount)
      
      const action: GameAction = {
        type: 'discard',
        playerId: this.playerId,
        data: { resources: optimalDiscard.resources }
      }

      actions.push({
        action,
        score: 100, // Must discard
        priority: 100,
        reasoning: optimalDiscard.reasoning
      })
    }

    return actions
  }

  private getRobberActions(): ScoredAction[] {
    const actions: ScoredAction[] = []
    const threats = this.analyzer.identifyThreats(this.playerId)
    
    // Target hexes that hurt leading players
    for (const [hexId, hex] of this.state.board.hexes) {
      if (hex.hasRobber) continue // Can't place on same hex
      if (!hex.numberToken || hex.terrain === 'desert') continue

      let score = 30
      const reasoning: string[] = []

      // Check if hex affects threatening players
      for (const threat of threats.slice(0, 2)) {
        const affectsPlayer = this.hexAffectsPlayer(hexId, threat.player)
        if (affectsPlayer) {
          score += threat.severity * 0.5
          reasoning.push(`Blocks ${threat.player} (${threat.type}: ${threat.severity.toFixed(1)})`)
        }
      }

      const action: GameAction = {
        type: 'moveRobber',
        playerId: this.playerId,
        data: { hexId }
      }

      actions.push({
        action,
        score: Math.min(100, score),
        priority: 100, // Must move robber
        reasoning: reasoning.length > 0 ? reasoning : [`Block ${hex.terrain} production`]
      })
    }

    return actions.sort((a, b) => b.score - a.score)
  }

  // ============= Helper Methods =============

  private generateOptimalDiscard(
    resources: ResourceCards,
    needs: Record<string, number>,
    discardCount: number
  ): { resources: Partial<ResourceCards>, reasoning: string[] } {
    const discard: Partial<ResourceCards> = {}
    const reasoning: string[] = []
    
    // Sort resources by need (ascending - discard least needed first)
    const resourceEntries = Object.entries(resources) as [keyof ResourceCards, number][]
    resourceEntries.sort(([typeA], [typeB]) => {
      const needA = needs[typeA] || 0
      const needB = needs[typeB] || 0
      return needA - needB
    })
    
    let remaining = discardCount
    for (const [resourceType, count] of resourceEntries) {
      if (remaining <= 0) break
      
      const toDiscard = Math.min(remaining, count)
      if (toDiscard > 0) {
        discard[resourceType] = toDiscard
        remaining -= toDiscard
        reasoning.push(`Discard ${toDiscard} ${resourceType} (low need)`)
      }
    }
    
    return { resources: discard, reasoning }
  }

  private hexAffectsPlayer(hexId: string, playerId: PlayerId): boolean {
    // Check if any of the player's buildings are adjacent to this hex
    for (const [, vertex] of this.state.board.vertices) {
      if (vertex.building?.owner === playerId) {
        const isAdjacent = vertex.position.hexes.some(coord => 
          `${coord.q},${coord.r},${coord.s}` === hexId
        )
        if (isAdjacent) return true
      }
    }
    
    return false
  }

  /**
   * Clear caches when game state changes
   */
  clearCaches(): void {
    this.analyzer.clearCaches()
  }
}

// ============= Utility Functions =============

/**
 * Create an ActionDecisionEngine instance
 */
export function createActionDecisionEngine(gameState: GameState, playerId: PlayerId): ActionDecisionEngine {
  return new ActionDecisionEngine(gameState, playerId)
}

/**
 * Get the best action for immediate execution
 */
export function getBestActionForPlayer(gameState: GameState, playerId: PlayerId): GameAction | null {
  const engine = createActionDecisionEngine(gameState, playerId)
  return engine.getBestAction()
}

/**
 * Get top N actions for consideration
 */
export function getTopActionsForPlayer(
  gameState: GameState, 
  playerId: PlayerId, 
  count: number = 5
): ScoredAction[] {
  const engine = createActionDecisionEngine(gameState, playerId)
  const actions = engine.getAllScoredActions()
  return actions.slice(0, count)
} 