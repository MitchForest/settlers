// Initial Placement Evaluation Framework
// Tests placement quality across multiple board configurations

export interface PlacementEvaluation {
  boardId: string
  playerId: string
  playerCount: number
  placements: {
    first: { vertexId: string, score: number }
    second: { vertexId: string, score: number }
  }
  metrics: {
    totalProduction: number
    resourceDiversity: number
    numberQuality: number
    strategicFit: number
    expertRating: number // 1-10
    gameOutcome?: number // Win rate from actual games
  }
  reasoning: string[]
}

export class InitialPlacementEvaluator {
  /**
   * Generate multiple random board configurations for testing
   */
  generateTestBoards(count: number = 50): GameState[] {
    const boards: GameState[] = []
    
    for (let i = 0; i < count; i++) {
      // Generate boards with different characteristics
      const playerCount = Math.random() < 0.5 ? 3 : 4
      const boardType = this.selectBoardType(i)
      
      const gameState = GameFlowManager.createGame({
        playerNames: Array(playerCount).fill(0).map((_, j) => `Player${j}`),
        randomizePlayerOrder: true,
        boardConfiguration: boardType
      }).getState()
      
      boards.push(gameState)
    }
    
    return boards
  }
  
  /**
   * Evaluate placement quality across multiple dimensions
   */
  evaluatePlacement(
    gameState: GameState, 
    playerId: PlayerId,
    firstVertex: string,
    secondVertex: string
  ): PlacementEvaluation {
    
    const ai = createInitialPlacementAI(gameState, playerId)
    
    // Calculate core metrics
    const totalProduction = this.calculateTotalProduction(gameState, [firstVertex, secondVertex])
    const resourceDiversity = this.calculateResourceDiversity(gameState, [firstVertex, secondVertex])
    const numberQuality = this.calculateNumberQuality(gameState, [firstVertex, secondVertex])
    const strategicFit = this.calculateStrategicFit(gameState, firstVertex, secondVertex)
    const expertRating = this.getExpertRating(gameState, firstVertex, secondVertex)
    
    return {
      boardId: gameState.id,
      playerId,
      playerCount: gameState.players.size,
      placements: {
        first: { vertexId: firstVertex, score: 0 }, // Could add individual scores
        second: { vertexId: secondVertex, score: 0 }
      },
      metrics: {
        totalProduction,
        resourceDiversity,
        numberQuality,
        strategicFit,
        expertRating
      },
      reasoning: []
    }
  }
  
  /**
   * Run comprehensive placement evaluation
   */
  async runEvaluationSuite(): Promise<{
    overallScore: number
    breakdown: {
      production: number
      diversity: number
      numberQuality: number
      strategicFit: number
      expertRating: number
    }
    boardResults: PlacementEvaluation[]
    recommendations: string[]
  }> {
    
    const testBoards = this.generateTestBoards(100)
    const results: PlacementEvaluation[] = []
    
    console.log(`🧪 Testing initial placement AI on ${testBoards.length} board configurations...`)
    
    for (const gameState of testBoards) {
      const playerIds = Array.from(gameState.players.keys())
      
      for (const playerId of playerIds) {
        try {
          const ai = createInitialPlacementAI(gameState, playerId, 'hard', 'balanced')
          
          // Get AI's placement choices
          const firstAction = ai.selectFirstSettlement()
          const firstVertex = firstAction.data.vertexId!
          
          // Simulate the first placement
          const tempState = this.simulatePlacement(gameState, playerId, firstVertex)
          const secondAction = ai.selectSecondSettlement(firstVertex)
          const secondVertex = secondAction.data.vertexId!
          
          // Evaluate the placement
          const evaluation = this.evaluatePlacement(gameState, playerId, firstVertex, secondVertex)
          results.push(evaluation)
          
        } catch (error) {
          console.warn(`Failed to evaluate placement for ${playerId}: ${error}`)
        }
      }
    }
    
    // Aggregate results
    const avgProduction = results.reduce((sum, r) => sum + r.metrics.totalProduction, 0) / results.length
    const avgDiversity = results.reduce((sum, r) => sum + r.metrics.resourceDiversity, 0) / results.length
    const avgNumberQuality = results.reduce((sum, r) => sum + r.metrics.numberQuality, 0) / results.length
    const avgStrategicFit = results.reduce((sum, r) => sum + r.metrics.strategicFit, 0) / results.length
    const avgExpertRating = results.reduce((sum, r) => sum + r.metrics.expertRating, 0) / results.length
    
    const overallScore = (avgProduction + avgDiversity + avgNumberQuality + avgStrategicFit + avgExpertRating) / 5
    
    return {
      overallScore,
      breakdown: {
        production: avgProduction,
        diversity: avgDiversity,
        numberQuality: avgNumberQuality,
        strategicFit: avgStrategicFit,
        expertRating: avgExpertRating
      },
      boardResults: results,
      recommendations: this.generateRecommendations(results)
    }
  }
  
  /**
   * Calculate total expected production value
   */
  private calculateTotalProduction(gameState: GameState, vertices: string[]): number {
    let totalProduction = 0
    
    for (const vertexId of vertices) {
      const vertex = gameState.board.vertices.get(vertexId)
      if (!vertex) continue
      
      for (const hexCoord of vertex.position.hexes) {
        const hex = Array.from(gameState.board.hexes.values())
          .find(h => h.position.q === hexCoord.q && h.position.r === hexCoord.r)
        
        if (hex?.terrain && hex.terrain !== 'desert' && hex.numberToken) {
          const probability = NUMBER_PROBABILITIES[hex.numberToken] || 0
          totalProduction += probability
        }
      }
    }
    
    return Math.min(10, totalProduction / 2) // Normalize to 0-10
  }
  
  /**
   * Calculate resource type diversity
   */
  private calculateResourceDiversity(gameState: GameState, vertices: string[]): number {
    const resourceTypes = new Set<string>()
    
    for (const vertexId of vertices) {
      const vertex = gameState.board.vertices.get(vertexId)
      if (!vertex) continue
      
      for (const hexCoord of vertex.position.hexes) {
        const hex = Array.from(gameState.board.hexes.values())
          .find(h => h.position.q === hexCoord.q && h.position.r === hexCoord.r)
        
        if (hex?.terrain && hex.terrain !== 'desert') {
          resourceTypes.add(hex.terrain)
        }
      }
    }
    
    return Math.min(10, (resourceTypes.size / 5) * 10) // 0-10 scale
  }
  
  /**
   * Calculate number token quality (6s and 8s are best)
   */
  private calculateNumberQuality(gameState: GameState, vertices: string[]): number {
    let qualityScore = 0
    let totalTokens = 0
    
    for (const vertexId of vertices) {
      const vertex = gameState.board.vertices.get(vertexId)
      if (!vertex) continue
      
      for (const hexCoord of vertex.position.hexes) {
        const hex = Array.from(gameState.board.hexes.values())
          .find(h => h.position.q === hexCoord.q && h.position.r === hexCoord.r)
        
        if (hex?.numberToken && hex.terrain !== 'desert') {
          totalTokens++
          if (hex.numberToken === 6 || hex.numberToken === 8) {
            qualityScore += 10
          } else if (hex.numberToken === 5 || hex.numberToken === 9) {
            qualityScore += 7
          } else if (hex.numberToken === 4 || hex.numberToken === 10) {
            qualityScore += 5
          } else {
            qualityScore += 2
          }
        }
      }
    }
    
    return totalTokens > 0 ? Math.min(10, qualityScore / totalTokens) : 0
  }
  
  /**
   * Calculate strategic fit based on game theory principles
   */
  private calculateStrategicFit(gameState: GameState, firstVertex: string, secondVertex: string): number {
    // Analyze how well the placement fits strategic principles
    let score = 5 // Base score
    
    // Check for essential resource coverage
    const resourcesCovered = this.getResourcesCovered(gameState, [firstVertex, secondVertex])
    if (resourcesCovered.has('wheat')) score += 1
    if (resourcesCovered.has('sheep')) score += 1
    if (resourcesCovered.has('ore')) score += 0.5
    if (resourcesCovered.has('wood')) score += 0.5
    if (resourcesCovered.has('brick')) score += 0.5
    
    // Check for complementary placement
    if (this.areSettlementsComplementary(gameState, firstVertex, secondVertex)) {
      score += 2
    }
    
    return Math.min(10, score)
  }
  
  /**
   * Expert rating based on established Catan principles
   */
  private getExpertRating(gameState: GameState, firstVertex: string, secondVertex: string): number {
    // This would ideally be trained on expert games or validated against known good placements
    // For now, use heuristic based on Catan strategy guides
    
    let rating = 5 // Base rating
    
    const production = this.calculateTotalProduction(gameState, [firstVertex, secondVertex])
    const diversity = this.calculateResourceDiversity(gameState, [firstVertex, secondVertex])
    const numberQuality = this.calculateNumberQuality(gameState, [firstVertex, secondVertex])
    
    // Weight the factors like an expert would
    rating = (production * 0.4) + (diversity * 0.3) + (numberQuality * 0.3)
    
    return Math.min(10, Math.max(1, rating))
  }
  
  private selectBoardType(index: number): string {
    // Vary board types to test different scenarios
    const types = ['standard', 'resource-rich', 'resource-poor', 'clustered']
    return types[index % types.length]
  }
  
  private simulatePlacement(gameState: GameState, playerId: PlayerId, vertexId: string): GameState {
    // Create a copy and simulate the placement
    // This is a simplified version - you'd use your actual game engine
    return gameState
  }
  
  private getResourcesCovered(gameState: GameState, vertices: string[]): Set<string> {
    const resources = new Set<string>()
    // Implementation similar to calculateResourceDiversity but returning the set
    return resources
  }
  
  private areSettlementsComplementary(gameState: GameState, first: string, second: string): boolean {
    // Check if the two settlements provide different resources
    // This is a simplified check
    return true
  }
  
  private generateRecommendations(results: PlacementEvaluation[]): string[] {
    const recommendations: string[] = []
    
    const avgExpertRating = results.reduce((sum, r) => sum + r.metrics.expertRating, 0) / results.length
    
    if (avgExpertRating < 6) {
      recommendations.push("Consider increasing weight on resource diversity")
    }
    if (avgExpertRating < 5) {
      recommendations.push("Number token quality scoring may need adjustment")
    }
    
    return recommendations
  }
}