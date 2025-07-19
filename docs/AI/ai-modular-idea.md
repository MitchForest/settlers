// Modular AI Decision Framework for Catan
// Hierarchical: Pruning Rules → Heuristics → MCTS → Performance Analysis

export interface GameDecision {
  type: 'immediate' | 'heuristic' | 'mcts'
  action: GameAction
  reasoning: string
  confidence: number
  strategicGoal?: string
}

export interface PerformanceMetrics {
  orphanedRoads: string[]           // Roads that don't lead to settlements
  unusedDevCards: string[]          // Cards held too long
  missedOpportunities: string[]     // Could have built but didn't
  strategicCoherence: number        // 0-1, how well moves work together
  efficiencyScore: number           // 0-1, resource utilization
  endGameAnalysis: {
    wastedResources: number
    incompleteStrategies: string[]
    optimalVsActual: number
  }
}

/**
 * TIER 1: Immediate Execution Rules (No-Brainer Moves)
 */
export class ImmediateActionPruner {
  static readonly IMMEDIATE_RULES = [
    'BUILD_WINNING_SETTLEMENT',    // If this gets you to 10 VP
    'BUILD_WINNING_CITY',          // If this gets you to 10 VP
    'PLAY_VICTORY_CARD',           // If you have a VP card and it wins
    'UPGRADE_SETTLEMENT_TO_CITY',  // If you have settlement + resources
    'BUILD_ACCESSIBLE_SETTLEMENT', // If you have 2 roads + settlement resources
    'PLAY_KNIGHT_AGAINST_ROBBER',  // If robber is on you and you have knight
    'USE_DEV_CARDS_EARLY_GAME',    // If <4 cards and early game
    'USE_DEV_CARDS_LATE_GAME',     // If turn >40 and holding cards
    'DISCARD_OBVIOUS_EXCESS'       // If >7 cards, discard lowest priority
  ]

  execute(state: GameState, playerId: PlayerId): GameDecision | null {
    const player = state.players.get(playerId)!
    
    // WINNING MOVES - Always execute immediately
    if (player.score.total >= 9) {
      const winningMove = this.findWinningMove(state, playerId)
      if (winningMove) {
        return {
          type: 'immediate',
          action: winningMove,
          reasoning: '🏆 IMMEDIATE VICTORY!',
          confidence: 1.0,
          strategicGoal: 'WIN_GAME'
        }
      }
    }
    
    // SETTLEMENT TO CITY UPGRADE
    if (this.canUpgradeSettlement(state, playerId)) {
      const cityAction = this.getSettlementUpgrade(state, playerId)
      return {
        type: 'immediate',
        action: cityAction,
        reasoning: 'Immediate city upgrade available (+2VP, double production)',
        confidence: 0.95,
        strategicGoal: 'MAXIMIZE_PRODUCTION'
      }
    }
    
    // BUILD SETTLEMENT IF ROADS + RESOURCES READY
    if (this.canBuildAccessibleSettlement(state, playerId)) {
      const settlementAction = this.getBestAccessibleSettlement(state, playerId)
      return {
        type: 'immediate',
        action: settlementAction,
        reasoning: 'Roads + resources ready for settlement (+1VP)',
        confidence: 0.9,
        strategicGoal: 'EXPAND_TERRITORY'
      }
    }
    
    // PLAY KNIGHT IF ROBBER IS ON US
    if (this.shouldPlayKnightAgainstRobber(state, playerId)) {
      const knightAction = this.getKnightAction(state, playerId)
      return {
        type: 'immediate',
        action: knightAction,
        reasoning: 'Robber blocking our production - use knight',
        confidence: 0.85,
        strategicGoal: 'REMOVE_BLOCKADE'
      }
    }
    
    // USE DEV CARDS STRATEGICALLY
    const devCardAction = this.shouldUseDevCard(state, playerId)
    if (devCardAction) {
      return devCardAction
    }
    
    return null // No immediate actions
  }
  
  private findWinningMove(state: GameState, playerId: PlayerId): GameAction | null {
    // Check if any building gets us to 10 VP
    // Implementation details...
    return null
  }
  
  private canUpgradeSettlement(state: GameState, playerId: PlayerId): boolean {
    const player = state.players.get(playerId)!
    const hasResources = player.resources.ore >= 3 && player.resources.wheat >= 2
    
    if (!hasResources) return false
    
    // Check if we have settlements to upgrade
    for (const [, vertex] of state.board.vertices) {
      if (vertex.building?.owner === playerId && vertex.building.type === 'settlement') {
        return true
      }
    }
    return false
  }
  
  private getSettlementUpgrade(state: GameState, playerId: PlayerId): GameAction {
    // Find best settlement to upgrade (highest production)
    // Implementation details...
    return { type: 'build', playerId, data: { buildingType: 'city', position: 'best-settlement' } }
  }
  
  private canBuildAccessibleSettlement(state: GameState, playerId: PlayerId): boolean {
    // Check if we have settlement resources and accessible spots
    // Implementation details...
    return false
  }
  
  private getBestAccessibleSettlement(state: GameState, playerId: PlayerId): GameAction {
    // Implementation details...
    return { type: 'build', playerId, data: { buildingType: 'settlement', position: 'best-spot' } }
  }
  
  private shouldPlayKnightAgainstRobber(state: GameState, playerId: PlayerId): boolean {
    // Check if robber is on our high-value hexes and we have knight
    // Implementation details...
    return false
  }
  
  private getKnightAction(state: GameState, playerId: PlayerId): GameAction {
    // Implementation details...
    return { type: 'playCard', playerId, data: { cardId: 'knight-id' } }
  }
  
  private shouldUseDevCard(state: GameState, playerId: PlayerId): GameDecision | null {
    const player = state.players.get(playerId)!
    const totalCards = Object.values(player.resources).reduce((a, b) => a + b, 0)
    
    // Early game: use cards if hand is small
    if (state.turn < 20 && totalCards < 4) {
      for (const card of player.developmentCards) {
        if (card.type === 'yearOfPlenty' || card.type === 'monopoly') {
          return {
            type: 'immediate',
            action: { type: 'playCard', playerId, data: { cardId: card.id } },
            reasoning: 'Early game - use dev cards for resources',
            confidence: 0.8,
            strategicGoal: 'EARLY_ACCELERATION'
          }
        }
      }
    }
    
    // Late game: don't hold cards
    if (state.turn > 40) {
      const oldestCard = player.developmentCards
        .filter(c => !c.playedTurn && c.purchasedTurn < state.turn)
        .sort((a, b) => a.purchasedTurn - b.purchasedTurn)[0]
      
      if (oldestCard && oldestCard.type !== 'victory') {
        return {
          type: 'immediate',
          action: { type: 'playCard', playerId, data: { cardId: oldestCard.id } },
          reasoning: 'Late game - use dev cards before game ends',
          confidence: 0.7,
          strategicGoal: 'MAXIMIZE_UTILITY'
        }
      }
    }
    
    return null
  }
}

/**
 * TIER 2: Heuristic-Based Decisions (Fast, Pattern-Based)
 */
export class HeuristicDecisionMaker {
  static readonly HEURISTIC_DOMAINS = [
    'INITIAL_PLACEMENT',
    'TRADE_EVALUATION', 
    'DISCARD_SELECTION',
    'ROBBER_PLACEMENT',
    'SIMPLE_BUILDING'
  ]

  decide(state: GameState, playerId: PlayerId, domain: string): GameDecision | null {
    switch (domain) {
      case 'INITIAL_PLACEMENT':
        return this.handleInitialPlacement(state, playerId)
      case 'TRADE_EVALUATION':
        return this.handleTradeEvaluation(state, playerId)
      case 'DISCARD_SELECTION':
        return this.handleDiscardSelection(state, playerId)
      case 'ROBBER_PLACEMENT':
        return this.handleRobberPlacement(state, playerId)
      default:
        return null
    }
  }
  
  private handleInitialPlacement(state: GameState, playerId: PlayerId): GameDecision {
    // Use your existing InitialPlacementAI
    const ai = createInitialPlacementAI(state, playerId, 'hard', 'balanced')
    const action = ai.selectFirstSettlement()
    
    return {
      type: 'heuristic',
      action,
      reasoning: 'Strategic board analysis + vertex scoring',
      confidence: 0.85,
      strategicGoal: 'OPTIMAL_START'
    }
  }
  
  private handleTradeEvaluation(state: GameState, playerId: PlayerId): GameDecision | null {
    // Fast trade acceptance/decline based on resource needs
    // Implementation details...
    return null
  }
  
  private handleDiscardSelection(state: GameState, playerId: PlayerId): GameDecision | null {
    const player = state.players.get(playerId)!
    const totalCards = Object.values(player.resources).reduce((a, b) => a + b, 0)
    
    if (totalCards <= 7) return null
    
    // Simple priority: keep wheat/ore > wood/brick > sheep
    const priorities = ['sheep', 'brick', 'wood', 'ore', 'wheat']
    const toDiscard: any = {}
    let remaining = totalCards - 7
    
    for (const resource of priorities) {
      const available = player.resources[resource as ResourceType]
      const discard = Math.min(available, remaining)
      if (discard > 0) {
        toDiscard[resource] = discard
        remaining -= discard
      }
      if (remaining === 0) break
    }
    
    return {
      type: 'heuristic',
      action: { type: 'discard', playerId, data: { resources: toDiscard } },
      reasoning: 'Discard lowest priority resources',
      confidence: 0.8,
      strategicGoal: 'PRESERVE_VALUABLE_RESOURCES'
    }
  }
  
  private handleRobberPlacement(state: GameState, playerId: PlayerId): GameDecision | null {
    // Target opponent with highest score and best production
    // Implementation details...
    return null
  }
}

/**
 * TIER 3: MCTS for Complex Strategic Decisions
 */
export class StrategicMCTS {
  static readonly MCTS_DOMAINS = [
    'EXPANSION_ROUTING',    // Where to build roads for expansion
    'RESOURCE_STRATEGY',    // Dev cards vs buildings vs trades
    'LONG_TERM_PLANNING',   // Multi-turn strategies
    'COMPETITIVE_BLOCKING'  // Opponent disruption
  ]

  async decide(state: GameState, playerId: PlayerId, domain: string, timeLimit: number = 1000): Promise<GameDecision> {
    // Simplified MCTS structure
    const root = new MCTSNode(state, null, playerId)
    const startTime = Date.now()
    
    while (Date.now() - startTime < timeLimit) {
      // Selection
      let node = root
      while (!node.isTerminal() && node.isFullyExpanded()) {
        node = node.selectBestChild()
      }
      
      // Expansion
      if (!node.isTerminal()) {
        node = node.expand()
      }
      
      // Simulation
      const value = await this.simulateRandom(node.state, playerId)
      
      // Backpropagation
      node.backpropagate(value)
    }
    
    const bestAction = root.getBestAction()
    
    return {
      type: 'mcts',
      action: bestAction,
      reasoning: `MCTS simulation (${root.visits} iterations)`,
      confidence: root.getBestChildWinRate(),
      strategicGoal: domain
    }
  }
  
  private async simulateRandom(state: GameState, playerId: PlayerId): Promise<number> {
    // Fast random simulation to terminal state
    // Return win rate for playerId
    return Math.random() // Placeholder
  }
}

/**
 * TIER 4: Performance Analysis & Learning
 */
export class PerformanceAnalyzer {
  analyzeGame(gameStates: GameState[], decisions: GameDecision[]): PerformanceMetrics {
    const orphanedRoads = this.findOrphanedRoads(gameStates)
    const unusedDevCards = this.findUnusedDevCards(gameStates)
    const missedOpportunities = this.findMissedOpportunities(gameStates, decisions)
    const strategicCoherence = this.calculateStrategicCoherence(decisions)
    const efficiencyScore = this.calculateEfficiencyScore(gameStates)
    
    return {
      orphanedRoads,
      unusedDevCards,
      missedOpportunities,
      strategicCoherence,
      efficiencyScore,
      endGameAnalysis: {
        wastedResources: this.calculateWastedResources(gameStates),
        incompleteStrategies: this.findIncompleteStrategies(decisions),
        optimalVsActual: this.compareToOptimal(gameStates)
      }
    }
  }
  
  private findOrphanedRoads(gameStates: GameState[]): string[] {
    const finalState = gameStates[gameStates.length - 1]
    const orphanedRoads: string[] = []
    
    // Find roads that don't contribute to any settlement path
    for (const [edgeId, edge] of finalState.board.edges) {
      if (edge.connection?.type === 'road') {
        if (!this.roadLeadsToSettlement(finalState, edgeId, edge.connection.owner)) {
          orphanedRoads.push(edgeId)
        }
      }
    }
    
    return orphanedRoads
  }
  
  private findUnusedDevCards(gameStates: GameState[]): string[] {
    const finalState = gameStates[gameStates.length - 1]
    const unusedCards: string[] = []
    
    for (const [playerId, player] of finalState.players) {
      for (const card of player.developmentCards) {
        if (!card.playedTurn && card.type !== 'victory') {
          // Card was never used and isn't a victory point
          unusedCards.push(`${playerId}-${card.type}-turn${card.purchasedTurn}`)
        }
      }
    }
    
    return unusedCards
  }
  
  private findMissedOpportunities(gameStates: GameState[], decisions: GameDecision[]): string[] {
    const opportunities: string[] = []
    
    // Analyze each game state to see if obvious good moves were missed
    for (let i = 0; i < gameStates.length - 1; i++) {
      const state = gameStates[i]
      const decision = decisions[i]
      
      // Check if they could have built something but didn't
      if (decision?.type !== 'immediate' && this.couldHaveBuilt(state, decision?.action.playerId)) {
        opportunities.push(`Turn ${i}: Could have built but chose ${decision?.action.type}`)
      }
    }
    
    return opportunities
  }
  
  private calculateStrategicCoherence(decisions: GameDecision[]): number {
    // Analyze if decisions work toward consistent goals
    const goals = decisions.map(d => d.strategicGoal).filter(Boolean)
    const goalCounts = goals.reduce((acc, goal) => {
      acc[goal!] = (acc[goal!] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    // Higher score if most decisions work toward same goals
    const maxGoal = Math.max(...Object.values(goalCounts))
    const totalDecisions = decisions.length
    
    return maxGoal / totalDecisions
  }
  
  private calculateEfficiencyScore(gameStates: GameState[]): number {
    // Compare resource usage vs acquisition
    const finalState = gameStates[gameStates.length - 1]
    let totalEfficiency = 0
    let playerCount = 0
    
    for (const [playerId, player] of finalState.players) {
      const resourcesWasted = Object.values(player.resources).reduce((a, b) => a + b, 0)
      const buildingsBuilt = this.countBuildings(finalState, playerId)
      
      // Higher efficiency = more buildings, fewer leftover resources
      const efficiency = buildingsBuilt / (buildingsBuilt + resourcesWasted + 1)
      totalEfficiency += efficiency
      playerCount++
    }
    
    return totalEfficiency / playerCount
  }
  
  private calculateWastedResources(gameStates: GameState[]): number {
    const finalState = gameStates[gameStates.length - 1]
    let totalWasted = 0
    
    for (const [, player] of finalState.players) {
      totalWasted += Object.values(player.resources).reduce((a, b) => a + b, 0)
    }
    
    return totalWasted
  }
  
  private findIncompleteStrategies(decisions: GameDecision[]): string[] {
    // Look for strategies that were started but not completed
    const incomplete: string[] = []
    
    // Example: Started building roads toward an area but never settled
    // Example: Bought dev cards but never used them strategically
    
    return incomplete
  }
  
  private compareToOptimal(gameStates: GameState[]): number {
    // Compare actual performance to theoretical optimal
    // This would require running optimal algorithms
    return 0.75 // Placeholder
  }
  
  // Helper methods
  private roadLeadsToSettlement(state: GameState, edgeId: string, playerId: PlayerId): boolean {
    // Check if this road is part of a path to any settlement
    return true // Simplified
  }
  
  private couldHaveBuilt(state: GameState, playerId?: PlayerId): boolean {
    if (!playerId) return false
    const player = state.players.get(playerId)
    if (!player) return false
    
    // Check if they had resources for any building
    return player.resources.wood >= 1 && player.resources.brick >= 1 // Simplified
  }
  
  private countBuildings(state: GameState, playerId: PlayerId): number {
    let count = 0
    for (const [, vertex] of state.board.vertices) {
      if (vertex.building?.owner === playerId) count++
    }
    return count
  }
}

/**
 * MAIN COORDINATOR: Orchestrates all decision tiers
 */
export class HierarchicalAI {
  private pruner = new ImmediateActionPruner()
  private heuristic = new HeuristicDecisionMaker()
  private mcts = new StrategicMCTS()
  private analyzer = new PerformanceAnalyzer()
  
  async makeDecision(state: GameState, playerId: PlayerId): Promise<GameDecision> {
    // TIER 1: Check for immediate actions
    const immediateAction = this.pruner.execute(state, playerId)
    if (immediateAction) {
      return immediateAction
    }
    
    // TIER 2: Try heuristic approaches
    const domain = this.classifyDecisionDomain(state)
    if (HeuristicDecisionMaker.HEURISTIC_DOMAINS.includes(domain)) {
      const heuristicAction = this.heuristic.decide(state, playerId, domain)
      if (heuristicAction) {
        return heuristicAction
      }
    }
    
    // TIER 3: Use MCTS for complex decisions
    if (StrategicMCTS.MCTS_DOMAINS.includes(domain)) {
      return await this.mcts.decide(state, playerId, domain)
    }
    
    // FALLBACK: Default action
    return {
      type: 'heuristic',
      action: { type: 'endTurn', playerId, data: {} },
      reasoning: 'No better action found',
      confidence: 0.1,
      strategicGoal: 'FALLBACK'
    }
  }
  
  private classifyDecisionDomain(state: GameState): string {
    if (state.phase === 'setup1' || state.phase === 'setup2') {
      return 'INITIAL_PLACEMENT'
    }
    if (state.phase === 'discard') {
      return 'DISCARD_SELECTION'
    }
    // Add more classification logic
    return 'EXPANSION_ROUTING'
  }
  
  analyzePerformance(gameStates: GameState[], decisions: GameDecision[]): PerformanceMetrics {
    return this.analyzer.analyzeGame(gameStates, decisions)
  }
}

// Simplified MCTS Node (full implementation would be more complex)
class MCTSNode {
  constructor(
    public state: GameState,
    public parent: MCTSNode | null,
    public playerId: PlayerId,
    public visits: number = 0,
    public wins: number = 0
  ) {}
  
  isTerminal(): boolean { return false }
  isFullyExpanded(): boolean { return false }
  selectBestChild(): MCTSNode { return this }
  expand(): MCTSNode { return this }
  backpropagate(value: number): void { this.visits++; this.wins += value }
  getBestAction(): GameAction { return { type: 'endTurn', playerId: this.playerId, data: {} } }
  getBestChildWinRate(): number { return this.wins / this.visits }
}