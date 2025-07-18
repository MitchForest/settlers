import { GameState, GameAction, PlayerId, ActionType, ResourceCards, GamePhase, Player, ResourceType } from '../types'
import { BoardAnalyzer, createBoardAnalyzer } from './board-analyzer'
import { createInitialPlacementAI } from './initial-placement'
import {
  getPossibleSettlementPositions,
  getPossibleRoadPositions,
  getVertexEdges,
  getEdgeVertices
} from '../engine/adjacency-helpers'
import { 
  canPlaceSettlement,
  canPlaceCity, 
  canPlaceRoad,
  canBuyDevelopmentCard
} from '../engine/state-validator'
import { hasResources } from '../calculations'
import { BUILDING_COSTS } from '../constants'

// ===== CORE INTERFACES =====

interface ActionEvaluator {
  canEvaluate(state: GameState, action: GameAction): boolean
  evaluate(state: GameState, action: GameAction): ActionScore
  priority: number // Determines evaluation order
}

interface PhaseStrategy {
  phase: GamePhase
  generateActions(state: GameState, playerId: PlayerId): GameAction[]
  selectBestAction(actions: ScoredAction[]): GameAction
}

interface ActionScore {
  value: number       // 0-100
  confidence: number  // 0-1
  reasoning: string[]
}

interface ActionGenerator {
  generate(state: GameState, playerId: PlayerId): GameAction[]
}

interface AIConfig {
  timeLimit: number
  maxActionsToConsider: number
  randomnessFactor: number
  difficulty: 'easy' | 'medium' | 'hard'
  personality: 'aggressive' | 'balanced' | 'defensive' | 'economic'
}

export interface ScoredAction {
  action: GameAction
  score: number           // 0-100, higher = better
  priority: number        // 0-100, higher = more urgent
  reasoning: string[]     // Human-readable explanation
}

// ===== MAIN AI COORDINATOR =====

export class AICoordinator {
  constructor(
    private strategies: Map<GamePhase, PhaseStrategy>,
    private evaluators: ActionEvaluator[],
    private config: AIConfig,
    private analyzer: BoardAnalyzer
  ) {
    // Sort evaluators by priority
    this.evaluators.sort((a, b) => b.priority - a.priority)
  }

  async getAction(state: GameState, playerId: PlayerId): Promise<GameAction> {
    const strategy = this.strategies.get(state.phase)
    if (!strategy) {
      throw new Error(`No strategy for phase: ${state.phase}`)
    }

    // 1. Generate possible actions for current phase
    const possibleActions = strategy.generateActions(state, playerId)
    
    if (possibleActions.length === 0) {
      throw new Error(`No actions generated for phase: ${state.phase}`)
    }

    // 2. Score each action using evaluator chain
    const scoredActions = possibleActions.map(action => {
      const actionScore = this.evaluateAction(state, action)
      return {
        action,
        score: Math.round(actionScore.value * actionScore.confidence),
        priority: Math.round(actionScore.value * actionScore.confidence),
        reasoning: actionScore.reasoning
      }
    })
    
    // 3. Apply strategy-specific selection
    return strategy.selectBestAction(scoredActions)
  }

  private evaluateAction(state: GameState, action: GameAction): ActionScore {
    const scores: ActionScore[] = []
    
    // Run through evaluator chain
    for (const evaluator of this.evaluators) {
      if (evaluator.canEvaluate(state, action)) {
        scores.push(evaluator.evaluate(state, action))
      }
    }
    
    // Combine scores (weighted by confidence)
    return this.combineScores(scores)
  }

  private combineScores(scores: ActionScore[]): ActionScore {
    if (scores.length === 0) {
      return { value: 0, confidence: 0, reasoning: ['No evaluators matched'] }
    }
    
    const totalConfidence = scores.reduce((sum, s) => sum + s.confidence, 0)
    const weightedValue = scores.reduce((sum, s) => sum + s.value * s.confidence, 0)
    
    return {
      value: Math.min(100, weightedValue / totalConfidence),
      confidence: Math.min(1.0, totalConfidence / scores.length),
      reasoning: scores.flatMap(s => s.reasoning)
    }
  }

  // Public method for synchronous usage
  getActionSync(state: GameState, playerId: PlayerId): GameAction | null {
    try {
      const strategy = this.strategies.get(state.phase)
      if (!strategy) return null
      
      const actions = strategy.generateActions(state, playerId)
      if (actions.length === 0) return null
      
      const scoredActions = actions.map(action => {
        const actionScore = this.evaluateAction(state, action)
        return { 
          action, 
          score: Math.round(actionScore.value * actionScore.confidence),
          priority: Math.round(actionScore.value * actionScore.confidence),
          reasoning: actionScore.reasoning
        }
      })
      
      return strategy.selectBestAction(scoredActions)
    } catch (error) {
      console.error('AI decision error:', error)
      return null
    }
  }
}

// ===== PHASE STRATEGIES =====

class SetupPhaseStrategy implements PhaseStrategy {
  constructor(private setupRound: 1 | 2) {}
  
  phase = (this.setupRound === 1 ? 'setup1' : 'setup2') as GamePhase

  generateActions(state: GameState, playerId: PlayerId): GameAction[] {
    // Check what the player needs to do in setup phase
    const player = state.players.get(playerId)
    if (!player) return []

    // Count player's existing buildings to determine setup state
    const settlements = this.countPlayerSettlements(state, playerId)
    const roads = this.countPlayerRoads(state, playerId)

    // Setup1: Each player places 1 settlement + 1 road
    // Setup2: Each player places 1 settlement + 1 road (in reverse order)
    const expectedSettlements = this.setupRound === 1 ? 1 : 2
    const expectedRoads = this.setupRound === 1 ? 1 : 2

    // Determine what to place next
    if (settlements < expectedSettlements) {
      // Need to place settlement
      const placementAI = createInitialPlacementAI(state, playerId, 'hard', 'balanced')
      
      if (this.setupRound === 1) {
        return [placementAI.selectFirstSettlement()]
      } else {
        const firstSettlement = this.findPlayerFirstSettlement(state, playerId)
        return [placementAI.selectSecondSettlement(firstSettlement)]
      }
    } else if (roads < expectedRoads) {
      // Need to place road adjacent to most recent settlement
      const recentSettlement = this.findMostRecentSettlement(state, playerId)
      if (recentSettlement) {
        const placementAI = createInitialPlacementAI(state, playerId, 'hard', 'balanced')
        return [placementAI.selectSetupRoad(recentSettlement)]
      }
    }

    // Fallback to end turn
    return [{ type: 'endTurn', playerId, data: {} }]
  }

  selectBestAction(actions: ScoredAction[]): GameAction {
    return actions[0].action // Setup has only one optimal action
  }

  private countPlayerSettlements(state: GameState, playerId: PlayerId): number {
    let count = 0
    for (const [, vertex] of state.board.vertices) {
      if (vertex.building?.owner === playerId && vertex.building.type === 'settlement') {
        count++
      }
    }
    return count
  }

  private countPlayerRoads(state: GameState, playerId: PlayerId): number {
    let count = 0
    for (const [, edge] of state.board.edges) {
      if (edge.connection?.owner === playerId && edge.connection.type === 'road') {
        count++
      }
    }
    return count
  }

  private findPlayerFirstSettlement(state: GameState, playerId: PlayerId): string {
    for (const [vertexId, vertex] of state.board.vertices) {
      if (vertex.building?.owner === playerId && vertex.building.type === 'settlement') {
        return vertexId
      }
    }
    return ''
  }

  private findMostRecentSettlement(state: GameState, playerId: PlayerId): string {
    // In setup, find the settlement that doesn't have an adjacent road yet
    for (const [vertexId, vertex] of state.board.vertices) {
      if (vertex.building?.owner === playerId && vertex.building.type === 'settlement') {
        // Check if this settlement has an adjacent road
        const adjacentEdges = getVertexEdges(state.board, vertexId)
        const hasAdjacentRoad = adjacentEdges.some(edgeId => {
          const edge = state.board.edges.get(edgeId)
          return edge?.connection?.owner === playerId
        })
        
        if (!hasAdjacentRoad) {
          return vertexId // This is the settlement that needs a road
        }
      }
    }
    
    // Fallback to any settlement
    return this.findPlayerFirstSettlement(state, playerId)
  }
}

class RollPhaseStrategy implements PhaseStrategy {
  phase = 'roll' as GamePhase

  generateActions(state: GameState, playerId: PlayerId): GameAction[] {
    return [{ type: 'roll', playerId, data: {} }]
  }

  selectBestAction(actions: ScoredAction[]): GameAction {
    return actions[0].action
  }
}

class MainPhaseStrategy implements PhaseStrategy {
  phase = 'actions' as GamePhase

  generateActions(state: GameState, playerId: PlayerId): GameAction[] {
    const actions: GameAction[] = []
    const generators = [
      new BuildingActionGenerator(),
      new DevelopmentCardGenerator(),
      // new BankTradeGenerator(), // TODO: Add after implementing processors
      new EndTurnGenerator()
    ]
    
    for (const generator of generators) {
      actions.push(...generator.generate(state, playerId))
    }
    
    return actions
  }

  selectBestAction(actions: ScoredAction[]): GameAction {
    // Victory-focused selection with proper fallback
    const victoryActions = actions.filter(a => 
      a.reasoning.some(r => r.includes('VICTORY') || r.includes('🏆'))
    )
    
    if (victoryActions.length > 0) {
      return victoryActions
        .sort((a, b) => b.priority - a.priority)[0].action
    }
    
    // High-value building actions
    const buildingActions = actions.filter(a => 
      a.action.type === 'build' && a.score >= 70
    )
    
    if (buildingActions.length > 0) {
      return buildingActions
        .sort((a, b) => b.score - a.score)[0].action
    }
    
    // Otherwise pick highest scored action
    const sortedActions = actions.sort((a, b) => b.score - a.score)
    return sortedActions[0].action
  }
}

class DiscardPhaseStrategy implements PhaseStrategy {
  phase = 'discard' as GamePhase

  generateActions(state: GameState, playerId: PlayerId): GameAction[] {
    const player = state.players.get(playerId)!
    const totalResources = Object.values(player.resources).reduce((sum, n) => sum + n, 0)
    
    if (totalResources <= 7) {
      // Player doesn't need to discard - discard 0 resources
      return [{
        type: 'discard',
        playerId,
        data: { resources: { wood: 0, brick: 0, ore: 0, wheat: 0, sheep: 0 } }
      }]
    }
    
    const discardCount = Math.floor(totalResources / 2)
    const optimizer = new DiscardOptimizer()
    const optimalDiscard = optimizer.optimize(player.resources, discardCount)
    
    return [{
      type: 'discard',
      playerId,
      data: { resources: optimalDiscard }
    }]
  }

  selectBestAction(actions: ScoredAction[]): GameAction {
    return actions[0].action
  }
}

class RobberPhaseStrategy implements PhaseStrategy {
  phase = 'moveRobber' as GamePhase

  generateActions(state: GameState, playerId: PlayerId): GameAction[] {
    const actions: GameAction[] = []
    
    // Simple robber strategy: target high-production hexes with opponents
    for (const [hexId, hex] of state.board.hexes) {
      if (hex.hasRobber) continue
      
      actions.push({
        type: 'moveRobber',
        playerId,
        data: { hexPosition: hex.position }
      })
    }
    
    return actions.slice(0, 5) // Limit choices
  }

  selectBestAction(actions: ScoredAction[]): GameAction {
    return actions.sort((a, b) => b.score - a.score)[0].action
  }
}

class StealPhaseStrategy implements PhaseStrategy {
  phase = 'steal' as GamePhase

  generateActions(state: GameState, playerId: PlayerId): GameAction[] {
    const adjacentPlayers = this.getPlayersAdjacentToRobber(state, playerId)
      .filter(targetId => {
        const player = state.players.get(targetId)
        if (!player) return false
        const resourceCount = Object.values(player.resources).reduce((sum, count) => sum + count, 0)
        return resourceCount > 0
      })
    
    if (adjacentPlayers.length === 0) {
      return [{ type: 'endTurn', playerId, data: {} }]
    }
    
    return adjacentPlayers.map(targetId => ({
      type: 'stealResource',
      playerId,
      data: { targetPlayerId: targetId }
    }))
  }

  selectBestAction(actions: ScoredAction[]): GameAction {
    return actions.sort((a, b) => b.score - a.score)[0].action
  }

  private getPlayersAdjacentToRobber(state: GameState, playerId: PlayerId): string[] {
    const robberPosition = state.board.robberPosition
    if (!robberPosition) return []
    
    const adjacentPlayers: string[] = []
    
    for (const [, vertex] of state.board.vertices) {
      if (!vertex.building || vertex.building.owner === playerId) continue
      
      const isAdjacent = vertex.position.hexes.some(hex => 
        hex.q === robberPosition.q && 
        hex.r === robberPosition.r && 
        hex.s === robberPosition.s
      )
      
      if (isAdjacent && !adjacentPlayers.includes(vertex.building.owner)) {
        adjacentPlayers.push(vertex.building.owner)
      }
    }
    
    return adjacentPlayers
  }
}

// ===== ACTION GENERATORS =====

class BuildingActionGenerator implements ActionGenerator {
  generate(state: GameState, playerId: PlayerId): GameAction[] {
    const actions: GameAction[] = []
    const player = state.players.get(playerId)!
    
    // AGGRESSIVE BUILDING - Always build when possible
    
    // Cities (highest priority - immediate VP + double production)
    if (hasResources(player.resources, BUILDING_COSTS.city)) {
      const citySpots = this.getCityBuildingSpots(state, playerId)
      for (const spot of citySpots) {
        actions.push({
          type: 'build' as const,
          playerId,
          data: { buildingType: 'city', position: spot }
        })
      }
    }
    
    // Settlements (VP expansion)
    if (hasResources(player.resources, BUILDING_COSTS.settlement) && player.buildings.settlements > 0) {
      const settlementSpots = this.getSettlementSpots(state, playerId)
      for (const spot of settlementSpots.slice(0, 5)) { // Consider more spots
        actions.push({
          type: 'build' as const,
          playerId,
          data: { buildingType: 'settlement', position: spot }
        })
      }
    }
    
    // Roads (strategic expansion)
    if (hasResources(player.resources, BUILDING_COSTS.road) && player.buildings.roads > 0) {
      const strategicRoads = this.getStrategicRoads(state, playerId)
      for (const road of strategicRoads.slice(0, 3)) { // Consider more roads
        actions.push({
          type: 'build' as const,
          playerId,
          data: { buildingType: 'road', position: road }
        })
      }
    }
    
    return actions
  }

  private getCityBuildingSpots(state: GameState, playerId: PlayerId): string[] {
    const citySpots: string[] = []
    for (const [vertexId, vertex] of state.board.vertices) {
      if (vertex.building?.owner === playerId && vertex.building.type === 'settlement') {
        citySpots.push(vertexId)
      }
    }
    return citySpots
  }

  private getSettlementSpots(state: GameState, playerId: PlayerId): string[] {
    return getPossibleSettlementPositions(state, playerId)
  }

  private getStrategicRoads(state: GameState, playerId: PlayerId): string[] {
    const strategicRoads: string[] = []
    const possibleRoads = getPossibleRoadPositions(state, playerId)
    
    for (const roadId of possibleRoads) {
      if (this.roadEnablesNewSettlement(state, roadId, playerId)) {
        strategicRoads.push(roadId)
      }
    }
    
    // If no strategic roads, return some roads anyway (expansion)
    if (strategicRoads.length === 0) {
      return possibleRoads.slice(0, 2)
    }
    
    return strategicRoads
  }

  private roadEnablesNewSettlement(state: GameState, edgeId: string, playerId: PlayerId): boolean {
    const connectedVertices = getEdgeVertices(state.board, edgeId)
    
    for (const vertexId of connectedVertices) {
      const vertex = state.board.vertices.get(vertexId)
      if (vertex && !vertex.building) {
        if (canPlaceSettlement(state, playerId, vertexId).isValid) {
          return true
        }
      }
    }
    
    return false
  }
}

class DevelopmentCardGenerator implements ActionGenerator {
  generate(state: GameState, playerId: PlayerId): GameAction[] {
    const player = state.players.get(playerId)!
    const devCardCost = { wood: 0, brick: 0, ore: 1, wheat: 1, sheep: 1 }
    
    if (hasResources(player.resources, devCardCost) && canBuyDevelopmentCard(state, playerId).isValid) {
      return [{
        type: 'buyCard',
        playerId,
        data: {}
      }]
    }
    
    return []
  }
}

class BankTradeGenerator implements ActionGenerator {
  generate(state: GameState, playerId: PlayerId): GameAction[] {
    const player = state.players.get(playerId)!
    const actions: GameAction[] = []
    
    // Check what the player needs for building
    const neededResources = this.analyzeResourceNeeds(player)
    if (Object.keys(neededResources).length === 0) return []
    
    // Check what resources player has in abundance (can trade away)
    const abundantResources = this.findAbundantResources(player)
    
    // Generate bank trades (4:1) and port trades
    for (const [giveResource, giveAmount] of Object.entries(abundantResources)) {
      if (giveAmount < 4) continue // Need at least 4 for bank trade
      
      for (const [wantResource, priority] of Object.entries(neededResources)) {
        if (giveResource === wantResource) continue
        
        // Check for port trades first (better rates)
        const portRate = this.getPortTradeRate(state, playerId, giveResource as ResourceType)
        if (portRate && giveAmount >= portRate) {
          actions.push({
            type: 'portTrade',
            playerId,
            data: {
              give: { [giveResource]: portRate },
              receive: { [wantResource]: 1 }
            }
          })
        }
        
        // Bank trade (4:1) as fallback
        if (giveAmount >= 4) {
          actions.push({
            type: 'bankTrade',
            playerId,
            data: {
              give: { [giveResource]: 4 },
              receive: { [wantResource]: 1 }
            }
          })
        }
      }
    }
    
    return actions
  }
  
  private analyzeResourceNeeds(player: Player): Record<string, number> {
    const needs: Record<string, number> = {}
    
    // Check what's needed for city (highest priority - 2 VP)
    const cityNeed = this.checkBuildingNeed(player.resources, BUILDING_COSTS.city)
    if (cityNeed) {
      for (const [resource, deficit] of Object.entries(cityNeed)) {
        needs[resource] = (needs[resource] || 0) + deficit * 3 // High priority
      }
    }
    
    // Check what's needed for settlement (1 VP)
    const settlementNeed = this.checkBuildingNeed(player.resources, BUILDING_COSTS.settlement)
    if (settlementNeed) {
      for (const [resource, deficit] of Object.entries(settlementNeed)) {
        needs[resource] = (needs[resource] || 0) + deficit * 2 // Medium priority
      }
    }
    
    // Check what's needed for dev card (potential VP)
    const devCardNeed = this.checkBuildingNeed(player.resources, BUILDING_COSTS.developmentCard)
    if (devCardNeed) {
      for (const [resource, deficit] of Object.entries(devCardNeed)) {
        needs[resource] = (needs[resource] || 0) + deficit * 1 // Low priority
      }
    }
    
    return needs
  }
  
  private findAbundantResources(player: Player): Record<string, number> {
    const abundant: Record<string, number> = {}
    const resourceTypes = ['wood', 'brick', 'ore', 'wheat', 'sheep'] as const
    
    for (const resource of resourceTypes) {
      const amount = player.resources[resource]
      // Consider abundant if we have more than we typically need
      if (amount >= 4) {
        abundant[resource] = amount
      }
    }
    
    return abundant
  }
  
  private checkBuildingNeed(resources: ResourceCards, cost: ResourceCards): Record<string, number> | null {
    const deficit: Record<string, number> = {}
    let hasDeficit = false
    
    for (const [resource, needed] of Object.entries(cost)) {
      const have = resources[resource as keyof ResourceCards] || 0
      if (have < needed) {
        deficit[resource] = needed - have
        hasDeficit = true
      }
    }
    
    return hasDeficit ? deficit : null
  }
  
  private getPortTradeRate(state: GameState, playerId: PlayerId, resource: ResourceType): number | null {
    // Check if player has access to a port for this resource
    for (const [vertexId, vertex] of state.board.vertices) {
      if (vertex.building?.owner === playerId && vertex.port) {
        if (vertex.port.type === 'generic') {
          return 3 // 3:1 generic port
        } else if (vertex.port.type === resource) {
          return 2 // 2:1 specific port
        }
      }
    }
    return null
  }
}

class EndTurnGenerator implements ActionGenerator {
  generate(state: GameState, playerId: PlayerId): GameAction[] {
    // Always provide endTurn as an option for the main phase
    return [{
      type: 'endTurn',
      playerId,
      data: {}
    }]
  }
}

// ===== DISCARD OPTIMIZER =====

class DiscardOptimizer {
  optimize(resources: ResourceCards, discardCount: number): ResourceCards {
    const discardResources: ResourceCards = { wood: 0, brick: 0, ore: 0, wheat: 0, sheep: 0 }
    const resourceTypes = ['wood', 'brick', 'ore', 'wheat', 'sheep'] as const
    
    // Calculate building needs and strategic priorities
    const buildingNeeds = this.calculateBuildingNeeds(resources)
    const strategicValue = this.calculateStrategicValue()
    
    // Create priority-based discard order
    const discardPriority = resourceTypes
      .map(type => ({
        type,
        count: resources[type] || 0,
        need: buildingNeeds[type] || 0,
        strategicValue: strategicValue[type] || 1,
        surplus: Math.max(0, (resources[type] || 0) - (buildingNeeds[type] || 0))
      }))
      .filter(item => item.count > 0)
      .sort((a, b) => {
        if (a.surplus !== b.surplus) return b.surplus - a.surplus
        if (a.strategicValue !== b.strategicValue) return a.strategicValue - b.strategicValue
        if (a.need !== b.need) return a.need - b.need
        return b.count - a.count
      })
    
    // Execute discard strategy
    let remaining = discardCount
    for (const item of discardPriority) {
      if (remaining <= 0) break
      
      const maxDiscard = Math.min(remaining, item.count)
      const keepForBuilding = Math.min(item.count, item.need)
      const optimalDiscard = Math.min(maxDiscard, Math.max(0, item.count - keepForBuilding))
      
      if (optimalDiscard > 0) {
        discardResources[item.type] = optimalDiscard
        remaining -= optimalDiscard
      }
    }
    
    // Fallback: discard from most abundant
    if (remaining > 0) {
      for (const item of discardPriority) {
        if (remaining <= 0) break
        
        const currentDiscard = discardResources[item.type]
        const availableToDiscard = item.count - currentDiscard
        const additionalDiscard = Math.min(remaining, availableToDiscard)
        
        if (additionalDiscard > 0) {
          discardResources[item.type] += additionalDiscard
          remaining -= additionalDiscard
        }
      }
    }
    
    return discardResources
  }

  private calculateBuildingNeeds(resources: ResourceCards): ResourceCards {
    const needs: ResourceCards = { wood: 0, brick: 0, ore: 0, wheat: 0, sheep: 0 }
    
    // Priority: Settlement
    const settlementCost = BUILDING_COSTS.settlement
    for (const [resource, cost] of Object.entries(settlementCost)) {
      if (typeof cost === 'number') {
        const shortage = Math.max(0, cost - (resources[resource as keyof ResourceCards] || 0))
        needs[resource as keyof ResourceCards] = Math.max(needs[resource as keyof ResourceCards], shortage)
      }
    }
    
    return needs
  }

  private calculateStrategicValue(): ResourceCards {
    return { wood: 3, brick: 3, ore: 4, wheat: 4, sheep: 3 }
  }
}

// ===== ACTION EVALUATORS =====

class VictoryEvaluator implements ActionEvaluator {
  priority = 100

  canEvaluate(state: GameState, action: GameAction): boolean {
    return action.type === 'build' || action.type === 'buyCard' || action.type === 'placeBuilding'
  }

  evaluate(state: GameState, action: GameAction): ActionScore {
    const player = state.players.get(action.playerId)!
    const currentScore = player.score.total
    
    // Immediate victory check
    if (currentScore >= 9) {
      if ((action.type === 'build' && 
          (action.data.buildingType === 'city' || action.data.buildingType === 'settlement')) ||
          (action.type === 'placeBuilding' && action.data.buildingType === 'settlement')) {
        return {
          value: 100,
          confidence: 1.0,
          reasoning: ['🏆 IMMEDIATE VICTORY!']
        }
      }
    }
    
    // Score based on VP value and urgency
    let vpValue = 0
    if (action.type === 'build' || action.type === 'placeBuilding') {
      vpValue = action.data.buildingType === 'city' ? 2 : 
                action.data.buildingType === 'settlement' ? 1 : 0
    } else if (action.type === 'buyCard') {
      vpValue = 0.25 // 25% chance of VP card
    }
    
    const urgencyMultiplier = currentScore >= 7 ? 2.0 : currentScore >= 5 ? 1.5 : 1.0
    const score = 50 + (vpValue * 30 * urgencyMultiplier) + (currentScore * 2)
    
    return {
      value: Math.min(100, score),
      confidence: 0.9,
      reasoning: [`Progress toward victory: ${currentScore + vpValue}/10`]
    }
  }
}

class ProductionEvaluator implements ActionEvaluator {
  priority = 80

  canEvaluate(state: GameState, action: GameAction): boolean {
    return (action.type === 'build' || action.type === 'placeBuilding') && 
           (action.data.buildingType === 'settlement' || action.data.buildingType === 'city')
  }

  evaluate(state: GameState, action: GameAction): ActionScore {
    const position = action.data.position || action.data.vertexId
    const productionValue = this.calculateProductionValue(state, position)
    const multiplier = action.data.buildingType === 'city' ? 2 : 1
    
    return {
      value: Math.min(100, productionValue * 8 * multiplier),
      confidence: 0.8,
      reasoning: [`Production value: ${(productionValue * multiplier).toFixed(1)}`]
    }
  }

  private calculateProductionValue(state: GameState, position: string): number {
    const vertex = state.board.vertices.get(position)
    if (!vertex) return 0
    
    let totalValue = 0
    
    for (const hexCoord of vertex.position.hexes) {
      const hex = Array.from(state.board.hexes.values())
        .find(h => h.position.q === hexCoord.q && h.position.r === hexCoord.r)
      
      if (hex && hex.terrain && hex.terrain !== 'desert' && hex.numberToken) {
        const probability = this.getNumberProbability(hex.numberToken)
        const resourceValue = this.getResourceValue(hex.terrain)
        totalValue += probability * resourceValue
      }
    }
    
    return totalValue
  }

  private getNumberProbability(number: number): number {
    const probabilities: Record<number, number> = {
      2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6,
      8: 5, 9: 4, 10: 3, 11: 2, 12: 1
    }
    return probabilities[number] || 0
  }

  private getResourceValue(terrain: string): number {
    const values: Record<string, number> = {
      'forest': 3, 'hills': 3, 'mountains': 4, 'fields': 4, 'pasture': 3,
      'desert': 0, 'sea': 0
    }
    return values[terrain] || 0
  }
}

class ResourceEvaluator implements ActionEvaluator {
  priority = 70

  canEvaluate(): boolean {
    return true
  }

  evaluate(state: GameState, action: GameAction): ActionScore {
    const player = state.players.get(action.playerId)!
    const resourceTotal = Object.values(player.resources).reduce((sum, n) => sum + n, 0)
    
    if (action.type === 'endTurn') {
      // AGGRESSIVE: Only end turn when absolutely necessary
      if (resourceTotal === 0) {
        return { value: 95, confidence: 0.9, reasoning: ['No resources - must end turn'] }
      } else if (resourceTotal <= 1) {
        return { value: 60, confidence: 0.7, reasoning: ['Very low resources'] }
      } else if (resourceTotal >= 4) {
        return { value: 10, confidence: 0.9, reasoning: ['Should build - too many resources!'] }
      } else {
        return { value: 30, confidence: 0.6, reasoning: ['Should try to build first'] }
      }
    }
    
    // Building action with resource management context
    if (resourceTotal >= 6) {
      return {
        value: 95,
        confidence: 0.9,
        reasoning: ['URGENT: Risk of robber discard']
      }
    }
    
    return {
      value: 70,
      confidence: 0.7,
      reasoning: ['Building is good']
    }
  }
}

class SetupEvaluator implements ActionEvaluator {
  priority = 110 // Higher than victory for setup phases

  canEvaluate(state: GameState, action: GameAction): boolean {
    return (state.phase === 'setup1' || state.phase === 'setup2') && 
           (action.type === 'placeBuilding' || action.type === 'placeRoad')
  }

  evaluate(state: GameState, action: GameAction): ActionScore {
    return {
      value: 100,
      confidence: 1.0,
      reasoning: ['Setup phase - critical initial placement']
    }
  }
}

// ===== FACTORY FUNCTION =====

export function createAIDecisionSystem(
  gameState: GameState,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium',
  personality: 'aggressive' | 'balanced' | 'defensive' | 'economic' = 'balanced'
): AICoordinator {
  // Configure strategies for each phase
  const strategies = new Map<GamePhase, PhaseStrategy>([
    ['setup1', new SetupPhaseStrategy(1)],
    ['setup2', new SetupPhaseStrategy(2)],
    ['roll', new RollPhaseStrategy()],
    ['actions', new MainPhaseStrategy()],
    ['discard', new DiscardPhaseStrategy()],
    ['moveRobber', new RobberPhaseStrategy()],
    ['steal', new StealPhaseStrategy()]
  ])
  
  // Configure evaluators based on difficulty/personality
  const evaluators: ActionEvaluator[] = [
    new SetupEvaluator(),
    new VictoryEvaluator(),
    new ProductionEvaluator(),
    new ResourceEvaluator()
  ]
  
  const config: AIConfig = {
    timeLimit: difficulty === 'easy' ? 100 : 500,
    maxActionsToConsider: difficulty === 'easy' ? 10 : 50,
    randomnessFactor: difficulty === 'easy' ? 0.2 : 0.05,
    difficulty,
    personality
  }
  
  const analyzer = createBoardAnalyzer(gameState)
  
  return new AICoordinator(strategies, evaluators, config, analyzer)
}

// ===== CLEAN PUBLIC API =====

export function getBestActionForPlayer(
  gameState: GameState, 
  playerId: PlayerId,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium',
  personality: 'aggressive' | 'balanced' | 'defensive' | 'economic' = 'balanced'
): GameAction | null {
  const ai = createAIDecisionSystem(gameState, difficulty, personality)
  return ai.getActionSync(gameState, playerId)
}

export function getTopActionsForPlayer(
  gameState: GameState, 
  playerId: PlayerId,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium',
  personality: 'aggressive' | 'balanced' | 'defensive' | 'economic' = 'balanced',
  count: number = 5
): ScoredAction[] {
  try {
    const ai = createAIDecisionSystem(gameState, difficulty, personality)
    const strategies = (ai as any).strategies as Map<GamePhase, PhaseStrategy>
    const evaluateAction = (ai as any).evaluateAction.bind(ai) as (state: GameState, action: GameAction) => ActionScore
    
    const strategy = strategies.get(gameState.phase)
    if (!strategy) return []
    
    const actions = strategy.generateActions(gameState, playerId)
    const scoredActions = actions.map(action => {
      const actionScore = evaluateAction(gameState, action)
      return { 
        action, 
        score: Math.round(actionScore.value * actionScore.confidence),
        priority: Math.round(actionScore.value * actionScore.confidence),
        reasoning: actionScore.reasoning
      }
    })
    
    return scoredActions
      .sort((a, b) => b.score - a.score)
      .slice(0, count)
  } catch (error) {
    console.error('AI decision error:', error)
    return []
  }
} 