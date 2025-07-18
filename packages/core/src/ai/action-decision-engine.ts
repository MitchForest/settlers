import { GameState, GameAction, PlayerId, ActionType, ResourceCards, GamePhase, Player, ResourceType } from '../types'
import { BoardAnalyzer, createBoardAnalyzer } from './board-analyzer'
import { createInitialPlacementAI } from './initial-placement'
import { GoalManager, ResourceManager, TurnPlanner, Goal, TurnPlan } from './goal-system'
import { VictoryPathOptimizer, VictoryAnalysis, MultiTurnPlanner, createVictoryOptimizer } from './victory-optimizer'
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
  private goalManager: GoalManager
  private resourceManager: ResourceManager
  private turnPlanner: TurnPlanner
  private currentTurnPlan: TurnPlan | null = null
  
  constructor(
    private strategies: Map<GamePhase, PhaseStrategy>,
    private evaluators: ActionEvaluator[],
    private config: AIConfig,
    private analyzer: BoardAnalyzer,
    private playerId: PlayerId
  ) {
    // Sort evaluators by priority
    this.evaluators.sort((a, b) => b.priority - a.priority)
    
    // Initialize goal system
    this.goalManager = new GoalManager(playerId)
    this.resourceManager = new ResourceManager()
    this.turnPlanner = new TurnPlanner(this.goalManager, this.resourceManager)
  }

  async getAction(state: GameState, playerId: PlayerId): Promise<GameAction> {
    // Use goal-driven decision making for main game phases
    if (state.phase === 'actions') {
      return this.getGoalDrivenAction(state, playerId)
    }
    
    // Fall back to traditional strategy for other phases
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
  
  private getGoalDrivenAction(state: GameState, playerId: PlayerId): GameAction {
    // 1. Plan the turn using goal system
    this.currentTurnPlan = this.turnPlanner.planTurn(state, playerId)
    
    // 2. Log AI thinking for debugging
    if (this.currentTurnPlan.goal) {
      console.log(`🎯 AI Goal: ${this.currentTurnPlan.goal.description}`)
      console.log(`📊 Priority: ${this.currentTurnPlan.goal.priority}`)
      console.log(`💡 Strategy: ${this.currentTurnPlan.resourceStrategy}`)
      
      // Log victory analysis if available
      const victoryAnalysis = this.goalManager.getCurrentVictoryAnalysis()
      if (victoryAnalysis) {
        console.log(`🏆 Victory Path: ${victoryAnalysis.fastestPath.description}`)
        console.log(`⏱️ Target Turns: ${victoryAnalysis.fastestPath.targetTurns}`)
        console.log(`🎲 Efficiency: ${victoryAnalysis.fastestPath.efficiency.toFixed(2)} VP/turn`)
      }
    }
    
    // 3. Try to execute planned actions
    for (const plannedAction of this.currentTurnPlan.actions) {
      if (this.canExecuteAction(plannedAction.action, state)) {
        console.log(`✅ Executing: ${plannedAction.reason}`)
        return plannedAction.action
      }
    }
    
    // 4. CRITICAL FIX: If goal system says "should trade" but provides endTurn, 
    //    fall back to normal action selection which will find the trades
    if (this.currentTurnPlan.actions.length > 0) {
      const goalAction = this.currentTurnPlan.actions[0]
      console.log(`🔍 Checking goal action: type=${goalAction.action.type}, reason="${goalAction.reason}"`)
      if (goalAction.action.type === 'endTurn' && goalAction.reason.includes('should trade')) {
        console.log(`🔄 Goal system says "should trade" but suggested endTurn - falling back to normal action selection`)
        return this.getFallbackAction(state, playerId)
      }
    }
    
    // 5. Fall back to traditional action generation if no planned actions work
    return this.getFallbackAction(state, playerId)
  }
  
  private getFallbackAction(state: GameState, playerId: PlayerId): GameAction {
    const strategy = this.strategies.get(state.phase)
    if (!strategy) {
      return { type: 'endTurn', playerId, data: {} }
    }

    const possibleActions = strategy.generateActions(state, playerId)
    if (possibleActions.length === 0) {
      return { type: 'endTurn', playerId, data: {} }
    }

    const scoredActions = possibleActions.map(action => {
      const actionScore = this.evaluateAction(state, action)
      return {
        action,
        score: Math.round(actionScore.value * actionScore.confidence),
        priority: Math.round(actionScore.value * actionScore.confidence),
        reasoning: actionScore.reasoning
      }
    })
    
    return strategy.selectBestAction(scoredActions)
  }
  
  private canExecuteAction(action: GameAction, state: GameState): boolean {
    // Simplified action validation - in practice would use full validation
    const player = state.players.get(action.playerId)!
    
    if (action.type === 'build') {
      const buildingType = action.data.buildingType
      if (buildingType === 'city') {
        return hasResources(player.resources, BUILDING_COSTS.city)
      } else if (buildingType === 'settlement') {
        return hasResources(player.resources, BUILDING_COSTS.settlement)
      } else if (buildingType === 'road') {
        return hasResources(player.resources, BUILDING_COSTS.road)
      }
    } else if (action.type === 'buyCard') {
      return hasResources(player.resources, BUILDING_COSTS.developmentCard)
    } else if (action.type === 'bankTrade') {
      const offering = action.data.offering || {}
      return Object.entries(offering).every(([resource, amount]) => 
        player.resources[resource as ResourceType] >= (amount as number)
      )
    } else if (action.type === 'portTrade') {
      const offering = action.data.offering || {}
      return Object.entries(offering).every(([resource, amount]) => 
        player.resources[resource as ResourceType] >= (amount as number)
      )
    }
    
    return true // Default to allowing action
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
      // Use goal-driven decision making for main game phases
      if (state.phase === 'actions') {
        return this.getGoalDrivenAction(state, playerId)
      }
      
      // Fall back to traditional strategy for other phases
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
  
  // Public method to get current goal information
  getCurrentGoal(): Goal | null {
    return this.currentTurnPlan?.goal || null
  }
  
  // Public method to get all active goals
  getActiveGoals(): Goal[] {
    return this.goalManager.getActiveGoals()
  }
  
  // Public method to get victory analysis
  getVictoryAnalysis(): VictoryAnalysis | null {
    return this.goalManager.getCurrentVictoryAnalysis()
  }
  
  // Public method to get multi-turn plan
  getMultiTurnPlan(): any {
    return this.goalManager.getMultiTurnPlan()
  }
}

// ===== PHASE STRATEGIES =====

class SetupPhaseStrategy implements PhaseStrategy {
  phase: GamePhase
  
  constructor(private setupRound: 1 | 2) {
    this.phase = (this.setupRound === 1 ? 'setup1' : 'setup2') as GamePhase
  }

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
      // new DevelopmentCardPlayGenerator(), // Temporarily disabled - game engine doesn't support it
      new BankTradeGenerator(),
      new PortTradeGenerator(),
      new EndTurnGenerator()
    ]
    
    for (const generator of generators) {
      actions.push(...generator.generate(state, playerId))
    }
    
    return actions
  }

  selectBestAction(actions: ScoredAction[]): GameAction {
    // AGGRESSIVE BUILDING STRATEGY - Build when possible, trade when necessary
    
    // 1. Immediate victory actions
    const victoryActions = actions.filter(a => 
      a.reasoning.some(r => r.includes('VICTORY') || r.includes('🏆')) || a.score >= 95
    )
    if (victoryActions.length > 0) {
      return victoryActions.sort((a, b) => b.priority - a.priority)[0].action
    }
    
    // 2. Development card playing (knights, road building, etc.)
    const devCardPlayActions = actions.filter(a => a.action.type === 'playCard')
    if (devCardPlayActions.length > 0) {
      return devCardPlayActions.sort((a, b) => b.score - a.score)[0].action
    }
    
    // 3. Building actions (cities > settlements > roads)
    const cityActions = actions.filter(a => 
      a.action.type === 'build' && a.action.data.buildingType === 'city'
    )
    if (cityActions.length > 0) {
      return cityActions.sort((a, b) => b.score - a.score)[0].action
    }
    
    const settlementActions = actions.filter(a => 
      a.action.type === 'build' && a.action.data.buildingType === 'settlement'
    )
    if (settlementActions.length > 0) {
      return settlementActions.sort((a, b) => b.score - a.score)[0].action
    }
    
    // 4. AGGRESSIVE TRADING - Trade when we have resources but can't build
    const tradeActions = actions.filter(a => 
      a.action.type === 'bankTrade' || a.action.type === 'portTrade'
    )
    if (tradeActions.length > 0) {
      return tradeActions.sort((a, b) => b.score - a.score)[0].action
    }
    
    // 5. Development cards (VP potential + knights)
    const devCardActions = actions.filter(a => a.action.type === 'buyCard')
    if (devCardActions.length > 0) {
      return devCardActions.sort((a, b) => b.score - a.score)[0].action
    }
    
    // 6. Strategic roads for expansion
    const roadActions = actions.filter(a => 
      a.action.type === 'build' && a.action.data.buildingType === 'road'
    )
    if (roadActions.length > 0) {
      return roadActions.sort((a, b) => b.score - a.score)[0].action
    }
    
    // 7. ONLY end turn if absolutely nothing else possible
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

class DevelopmentCardPlayGenerator implements ActionGenerator {
  generate(state: GameState, playerId: PlayerId): GameAction[] {
    const player = state.players.get(playerId)!
    const actions: GameAction[] = []
    
    // Check each unplayed development card
    for (const card of player.developmentCards) {
      // Can't play cards bought this turn
      if (card.playedTurn || card.purchasedTurn === state.turn) continue
      
      switch (card.type) {
        case 'knight':
          // Always play knights - work toward largest army
          actions.push({
            type: 'playCard',
            playerId,
            data: { cardId: card.id }
          })
          break
          
        case 'roadBuilding':
          // Play if we have 2+ roads available
          if (player.buildings.roads >= 2) {
            actions.push({
              type: 'playCard',
              playerId,
              data: { cardId: card.id }
            })
          }
          break
          
        case 'yearOfPlenty':
          // Play to get needed resources
          const needs = this.getResourceNeeds(player)
          if (needs.length >= 2) {
            actions.push({
              type: 'playCard',
              playerId,
              data: { 
                cardId: card.id,
                resources: { [needs[0]]: 1, [needs[1]]: 1 }
              }
            })
          }
          break
          
        case 'monopoly':
          // Play if opponents have resources we need
          const bestResource = this.findBestMonopolyResource(state, player)
          if (bestResource) {
            actions.push({
              type: 'playCard',
              playerId,
              data: { 
                cardId: card.id,
                resourceType: bestResource
              }
            })
          }
          break
          
        case 'victory':
          // Only reveal if it wins the game
          if (player.score.total + 1 >= 10) {
            actions.push({
              type: 'playCard',
              playerId,
              data: { cardId: card.id }
            })
          }
          break
      }
    }
    
    return actions
  }
  
  private getResourceNeeds(player: Player): ResourceType[] {
    const needs = new Set<ResourceType>()
    
    // Priority 1: City building (highest VP)
    if (player.buildings.settlements > 0) {
      if (player.resources.ore < 3) needs.add('ore')
      if (player.resources.wheat < 2) needs.add('wheat')
    }
    
    // Priority 2: Settlement building
    if (player.resources.wood < 1) needs.add('wood')
    if (player.resources.brick < 1) needs.add('brick')
    if (player.resources.sheep < 1) needs.add('sheep')
    if (player.resources.wheat < 1) needs.add('wheat')
    
    // Priority 3: Development cards
    if (player.resources.ore < 1) needs.add('ore')
    if (player.resources.wheat < 1) needs.add('wheat')
    if (player.resources.sheep < 1) needs.add('sheep')
    
    return Array.from(needs)
  }
  
  private findBestMonopolyResource(state: GameState, player: Player): ResourceType | null {
    const needs = this.getResourceNeeds(player)
    if (needs.length === 0) return null
    
    // Count opponent resources
    const resourceCounts: Record<ResourceType, number> = {
      wood: 0, brick: 0, ore: 0, wheat: 0, sheep: 0
    }
    
    for (const [opponentId, opponent] of state.players) {
      if (opponentId === player.id) continue
      
      for (const resource of needs) {
        resourceCounts[resource] += opponent.resources[resource]
      }
    }
    
    // Find resource with highest opponent count
    let bestResource: ResourceType | null = null
    let bestCount = 0
    
    for (const [resource, count] of Object.entries(resourceCounts)) {
      if (count > bestCount) {
        bestCount = count
        bestResource = resource as ResourceType
      }
    }
    
    return bestCount >= 2 ? bestResource : null
  }
}

class BankTradeGenerator implements ActionGenerator {
  generate(state: GameState, playerId: PlayerId): GameAction[] {
    const player = state.players.get(playerId)!
    const actions: GameAction[] = []
    
    // Enhanced resource needs analysis
    const neededResources = this.analyzeResourceNeeds(player)
    if (neededResources.length === 0) return []
    
    // Find tradeable resources (4+ for bank trade)
    const tradeableResources = this.findTradeableResources(player)
    
    // Generate 4:1 bank trades
    for (const [giveResource, giveAmount] of Object.entries(tradeableResources)) {
      if (giveAmount < 4) continue
      
      for (const needResource of neededResources) {
        if (giveResource === needResource) continue
        
        actions.push({
          type: 'bankTrade',
          playerId,
          data: {
            offering: { [giveResource]: 4 },
            requesting: { [needResource]: 1 }
          }
        })
      }
    }
    
    return actions
  }
  
  private analyzeResourceNeeds(player: Player): ResourceType[] {
    const needs = new Set<ResourceType>()
    
    // Priority 1: City building (2 VP + double production) - AGGRESSIVE
    if (this.hasSettlementsToUpgrade(player)) {
      if (player.resources.ore < 3) needs.add('ore')
      if (player.resources.wheat < 2) needs.add('wheat')
    }
    
    // Priority 2: Settlement building (1 VP + expansion) - AGGRESSIVE
    if (player.buildings.settlements > 0) {
      if (player.resources.wood < 1) needs.add('wood')
      if (player.resources.brick < 1) needs.add('brick')
      if (player.resources.sheep < 1) needs.add('sheep')
      if (player.resources.wheat < 1) needs.add('wheat')
    }
    
    // Priority 3: Development cards (25% VP chance + knights) - AGGRESSIVE
    if (player.resources.ore < 1) needs.add('ore')
    if (player.resources.wheat < 1) needs.add('wheat')
    if (player.resources.sheep < 1) needs.add('sheep')
    
    return Array.from(needs)
  }
  
  private hasSettlementsToUpgrade(player: Player): boolean {
    // Check if player has settlements that can be upgraded to cities
    return player.buildings.settlements > 0 // Simplified - would need board analysis for real check
  }
  
  private findTradeableResources(player: Player): Record<string, number> {
    const tradeable: Record<string, number> = {}
    const resourceTypes = ['wood', 'brick', 'ore', 'wheat', 'sheep'] as const
    
    for (const resource of resourceTypes) {
      const amount = player.resources[resource]
      // AGGRESSIVE TRADING: Trade even smaller amounts if we have them
      if (amount >= 4) {
        tradeable[resource] = amount
      }
    }
    
    return tradeable
  }
}

class PortTradeGenerator implements ActionGenerator {
  generate(state: GameState, playerId: PlayerId): GameAction[] {
    const player = state.players.get(playerId)!
    const actions: GameAction[] = []
    const ports = this.getPlayerPorts(state, playerId)
    
    if (ports.length === 0) return []
    
    const neededResources = this.analyzeResourceNeeds(player)
    if (neededResources.length === 0) return []
    
    for (const port of ports) {
      if (port.type === 'generic') {
        // 3:1 generic port - can trade any resource
        const resourceTypes = ['wood', 'brick', 'ore', 'wheat', 'sheep'] as const
        for (const resource of resourceTypes) {
          if (player.resources[resource] >= 3) {
            for (const needResource of neededResources) {
              if (needResource !== resource) {
                actions.push({
                  type: 'portTrade',
                  playerId,
                  data: {
                    offering: { [resource]: 3 },
                    requesting: { [needResource]: 1 },
                    portType: 'generic'
                  }
                })
              }
            }
          }
        }
      } else {
        // 2:1 specific port - best trade rate
        const specificResource = port.type as ResourceType
        if (player.resources[specificResource] >= 2) {
          for (const needResource of neededResources) {
            if (needResource !== specificResource) {
              actions.push({
                type: 'portTrade',
                playerId,
                data: {
                  offering: { [specificResource]: 2 },
                  requesting: { [needResource]: 1 },
                  portType: specificResource
                }
              })
            }
          }
        }
      }
    }
    
    return actions
  }
  
  private getPlayerPorts(state: GameState, playerId: PlayerId): Array<{type: string}> {
    const ports: Array<{type: string}> = []
    
    for (const [vertexId, vertex] of state.board.vertices) {
      if (vertex.building?.owner === playerId && vertex.port) {
        ports.push(vertex.port)
      }
    }
    
    return ports
  }
  
  private analyzeResourceNeeds(player: Player): ResourceType[] {
    const needs = new Set<ResourceType>()
    
    // Priority 1: City building (2 VP + double production)
    if (player.buildings.settlements > 0) {
      if (player.resources.ore < 3) needs.add('ore')
      if (player.resources.wheat < 2) needs.add('wheat')
    }
    
    // Priority 2: Settlement building (1 VP + expansion)
    if (player.buildings.settlements > 0) {
      if (player.resources.wood < 1) needs.add('wood')
      if (player.resources.brick < 1) needs.add('brick')
      if (player.resources.sheep < 1) needs.add('sheep')
      if (player.resources.wheat < 1) needs.add('wheat')
    }
    
    // Priority 3: Development cards (25% VP chance + knights)
    if (player.resources.ore < 1) needs.add('ore')
    if (player.resources.wheat < 1) needs.add('wheat')
    if (player.resources.sheep < 1) needs.add('sheep')
    
    return Array.from(needs)
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

class DevelopmentCardEvaluator implements ActionEvaluator {
  priority = 85

  canEvaluate(state: GameState, action: GameAction): boolean {
    return action.type === 'playCard' || action.type === 'buyCard'
  }

  evaluate(state: GameState, action: GameAction): ActionScore {
    const player = state.players.get(action.playerId)!
    
    if (action.type === 'playCard') {
      const card = player.developmentCards.find(c => c.id === action.data.cardId)
      if (!card) return { value: 0, confidence: 0, reasoning: ['Card not found'] }
      
      switch (card.type) {
        case 'knight':
          // High value - works toward largest army
          const knightValue = player.knightsPlayed >= 2 ? 85 : 70
          return {
            value: knightValue,
            confidence: 0.9,
            reasoning: [`Knight #${player.knightsPlayed + 1} - toward largest army`]
          }
          
        case 'victory':
          // Only if winning
          if (player.score.total + 1 >= 10) {
            return {
              value: 100,
              confidence: 1.0,
              reasoning: ['VICTORY POINT - WIN THE GAME!']
            }
          }
          return { value: 0, confidence: 1.0, reasoning: ['Save victory card'] }
          
        case 'yearOfPlenty':
          return {
            value: 80,
            confidence: 0.9,
            reasoning: ['Year of Plenty - get needed resources']
          }
          
        case 'monopoly':
          return {
            value: 75,
            confidence: 0.8,
            reasoning: ['Monopoly - steal opponent resources']
          }
          
        case 'roadBuilding':
          return {
            value: 70,
            confidence: 0.8,
            reasoning: ['Road Building - free expansion']
          }
          
        default:
          return {
            value: 75,
            confidence: 0.8,
            reasoning: [`Play ${card.type} for advantage`]
          }
      }
    }
    
    // Buying development cards
    if (action.type === 'buyCard') {
      const baseValue = 60
      const vpBonus = player.score.total >= 7 ? 25 : 0 // Higher value when close to winning
      
      return {
        value: baseValue + vpBonus,
        confidence: 0.8,
        reasoning: [
          'Development card - 25% VP chance',
          'Knights for largest army',
          player.score.total >= 7 ? 'ENDGAME - hidden VPs critical' : ''
        ].filter(r => r)
      }
    }
    
    return { value: 50, confidence: 0.5, reasoning: [] }
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
      
      // Check if we're close to any building
      const closeToCity = player.resources.ore >= 2 && player.resources.wheat >= 1
      const closeToSettlement = 
        (player.resources.wood + player.resources.brick + 
         player.resources.sheep + player.resources.wheat) >= 3
      const closeToDevCard = 
        (player.resources.ore + player.resources.wheat + player.resources.sheep) >= 2
      
      if (resourceTotal === 0) {
        return { value: 80, confidence: 0.9, reasoning: ['No resources - must end turn'] }
      } else if (closeToCity || closeToSettlement || closeToDevCard) {
        return { 
          value: 5, 
          confidence: 0.9, 
          reasoning: ['DO NOT END - Trade for missing resources!'] 
        }
      } else if (resourceTotal >= 4) {
        return { 
          value: 10, 
          confidence: 0.9, 
          reasoning: ['DO NOT END - Trade or build with resources!'] 
        }
      } else if (resourceTotal <= 2) {
        return { value: 40, confidence: 0.7, reasoning: ['Low resources, limited options'] }
      } else {
        return { value: 20, confidence: 0.8, reasoning: ['Consider trading first'] }
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
      reasoning: ['Take action!']
    }
  }
}

class TradeEvaluator implements ActionEvaluator {
  priority = 75

  canEvaluate(state: GameState, action: GameAction): boolean {
    return action.type === 'bankTrade' || action.type === 'portTrade'
  }

  evaluate(state: GameState, action: GameAction): ActionScore {
    const player = state.players.get(action.playerId)!
    
    if (action.type === 'bankTrade') {
      return this.evaluateBankTrade(action, player)
    } else if (action.type === 'portTrade') {
      return this.evaluatePortTrade(action, player)
    }
    
    return { value: 0, confidence: 0, reasoning: ['Unknown trade type'] }
  }
  
  private evaluateBankTrade(action: GameAction, player: Player): ActionScore {
    const offering = action.data.offering || {}
    const requesting = action.data.requesting || {}
    
    // AGGRESSIVE TRADING - Base value higher
    let value = 60
    
    // Bonus for getting resources we desperately need
    const resourceNeeds = this.getResourcePriority(player)
    const requestedResource = Object.keys(requesting)[0] as ResourceType
    const resourcePriority = resourceNeeds[requestedResource] || 0
    value += resourcePriority * 25 // Higher bonus for needed resources
    
    // LESS penalty for poor trade rate - trading is better than hoarding
    value -= 5 // Bank trades are inefficient but still better than not trading
    
    // Bonus if we have excess resources (need to spend them)
    const offeringResource = Object.keys(offering)[0] as ResourceType
    const offeringAmount = offering[offeringResource] || 0
    const currentAmount = player.resources[offeringResource] || 0
    if (currentAmount >= offeringAmount + 2) {
      value += 15 // We have excess, trade it away
    }
    
    return {
      value: Math.max(0, Math.min(100, value)),
      confidence: 0.8,
      reasoning: [`Bank trade 4:1 for ${requestedResource}`, `Priority: ${resourcePriority}`, `Excess: ${currentAmount >= offeringAmount + 2}`]
    }
  }
  
  private evaluatePortTrade(action: GameAction, player: Player): ActionScore {
    const offering = action.data.offering || {}
    const requesting = action.data.requesting || {}
    const portType = action.data.portType
    
    // AGGRESSIVE PORT TRADING - Base value higher
    let value = 70
    
    // Bonus for getting resources we desperately need
    const resourceNeeds = this.getResourcePriority(player)
    const requestedResource = Object.keys(requesting)[0] as ResourceType
    const resourcePriority = resourceNeeds[requestedResource] || 0
    value += resourcePriority * 30 // Higher bonus for needed resources
    
    // Bonus for good trade rate
    const tradeRate = portType === 'generic' ? 3 : 2
    if (tradeRate === 2) {
      value += 25 // 2:1 is excellent
    } else if (tradeRate === 3) {
      value += 15 // 3:1 is good
    }
    
    // Bonus if we have excess resources (need to spend them)
    const offeringResource = Object.keys(offering)[0] as ResourceType
    const offeringAmount = offering[offeringResource] || 0
    const currentAmount = player.resources[offeringResource] || 0
    if (currentAmount >= offeringAmount + 1) {
      value += 10 // We have excess, trade it away
    }
    
    return {
      value: Math.max(0, Math.min(100, value)),
      confidence: 0.9,
      reasoning: [`Port trade ${tradeRate}:1 for ${requestedResource}`, `Priority: ${resourcePriority}`, `Excess: ${currentAmount >= offeringAmount + 1}`]
    }
  }
  
  private getResourcePriority(player: Player): Record<ResourceType, number> {
    const priorities: Record<ResourceType, number> = {
      wood: 0, brick: 0, ore: 0, wheat: 0, sheep: 0
    }
    
    // City building priority (highest VP)
    if (player.buildings.settlements > 0) {
      if (player.resources.ore < 3) priorities.ore = 5
      if (player.resources.wheat < 2) priorities.wheat = 5
    }
    
    // Settlement building priority
    if (player.buildings.settlements > 0) {
      if (player.resources.wood < 1) priorities.wood = 3
      if (player.resources.brick < 1) priorities.brick = 3
      if (player.resources.sheep < 1) priorities.sheep = 3
      if (player.resources.wheat < 1) priorities.wheat = Math.max(priorities.wheat, 3)
    }
    
    // Development card priority
    if (player.resources.ore < 1) priorities.ore = Math.max(priorities.ore, 2)
    if (player.resources.wheat < 1) priorities.wheat = Math.max(priorities.wheat, 2)
    if (player.resources.sheep < 1) priorities.sheep = Math.max(priorities.sheep, 2)
    
    return priorities
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
  playerId: PlayerId,
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
    // new DevelopmentCardEvaluator(), // Temporarily disabled - game engine doesn't support it
    new TradeEvaluator(),
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
  
  return new AICoordinator(strategies, evaluators, config, analyzer, playerId)
}

// ===== CLEAN PUBLIC API =====

export function getBestActionForPlayer(
  gameState: GameState, 
  playerId: PlayerId,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium',
  personality: 'aggressive' | 'balanced' | 'defensive' | 'economic' = 'balanced'
): GameAction | null {
  const ai = createAIDecisionSystem(gameState, playerId, difficulty, personality)
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
    const ai = createAIDecisionSystem(gameState, playerId, difficulty, personality)
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

// New function to get AI's current goal information
export function getAIGoalInfo(
  gameState: GameState,
  playerId: PlayerId,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium',
  personality: 'aggressive' | 'balanced' | 'defensive' | 'economic' = 'balanced'
): { currentGoal: Goal | null; allGoals: Goal[] } {
  const ai = createAIDecisionSystem(gameState, playerId, difficulty, personality)
  return {
    currentGoal: ai.getCurrentGoal(),
    allGoals: ai.getActiveGoals()
  }
}

// New function to get comprehensive AI analysis
export function getAIAnalysis(
  gameState: GameState,
  playerId: PlayerId,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium',
  personality: 'aggressive' | 'balanced' | 'defensive' | 'economic' = 'balanced'
): { 
  goals: { currentGoal: Goal | null; allGoals: Goal[] },
  victoryAnalysis: VictoryAnalysis | null,
  multiTurnPlan: any
} {
  const ai = createAIDecisionSystem(gameState, playerId, difficulty, personality)
  return {
    goals: {
      currentGoal: ai.getCurrentGoal(),
      allGoals: ai.getActiveGoals()
    },
    victoryAnalysis: ai.getVictoryAnalysis(),
    multiTurnPlan: ai.getMultiTurnPlan()
  }
} 