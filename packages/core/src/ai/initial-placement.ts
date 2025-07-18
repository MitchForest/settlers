import {
  GameState,
  GameAction,
  PlayerId,
  ResourceType,
  TerrainType,
  ResourceCards
} from '../types'
import {
  NUMBER_PROBABILITIES
} from '../constants'
import { BoardAnalyzer } from './board-analyzer'
import {
  getPossibleSettlementPositions,
  getPossibleRoadPositions,
  getAdjacentVertices,
  getVertexEdges,
  getEdgeVertices
} from '../engine/adjacency-helpers'

export interface PlacementAnalysis {
  vertexId: string
  totalScore: number
  breakdown: {
    production: number      // Expected resource generation (0-100)
    diversity: number       // Resource type variety (0-100)  
    reliability: number     // Consistency of numbers (0-100)
    expansion: number       // Future settlement potential (0-100)
    ports: number          // Port access bonus (0-100)
    scarcity: number       // Rare resource bonus (0-100)
    blocking: number       // Opponent denial value (0-100)
    synergy: number        // Combo with existing settlements (0-100)
  }
  reasoning: string[]
  riskFactors: string[]
}

// This interface is no longer used - keeping for compatibility
// interface VertexProductionData {
//   production: ResourceCards
//   totalExpected: number
//   resourceTypes: number
// }

// Board analysis for strategy selection
interface BoardAnalysis {
  resourceScarcity: {
    ore: number
    wheat: number
    wood: number
    brick: number
    sheep: number
  }
  highNumberResources: {
    ore: number
    wheat: number
    wood: number
    brick: number
    sheep: number
  }
  availablePorts: {
    ore: boolean
    wheat: boolean
    wood: boolean
    brick: boolean
    sheep: boolean
    generic: number
  }
  powerSpots: Array<{
    vertexId: string
    has68: boolean
    resourceTypes: ResourceType[]
    totalProduction: number
    hasPort: boolean
  }>
}

interface PowerSpot {
  vertexId: string
  has68: boolean
  resourceTypes: ResourceType[]
  totalProduction: number
  hasPort: boolean
}

type Strategy = 'CITY_RUSH' | 'PORT_MONOPOLY' | 'BALANCED_EXPANSION'

interface VertexData {
  vertexId: string
  resources: ResourceType[]
  numbers: number[]
  port?: { type: ResourceType | 'generic' }
  production: ResourceCards
  totalExpected: number
}

/**
 * STRATEGIC Initial Placement AI - Board-aware strategy selection
 * Focus: Analyze board first, select best strategy, then optimize placement
 */
export class InitialPlacementAI {
  private state: GameState
  private playerId: PlayerId
  private analyzer: BoardAnalyzer
  private difficulty: 'easy' | 'medium' | 'hard'
  private personality: 'aggressive' | 'balanced' | 'defensive' | 'economic'
  
  // Strategy system
  private strategy: Strategy = 'BALANCED_EXPANSION'
  private boardAnalysis: BoardAnalysis | null = null
  
  // Performance caches
  private vertexDataCache = new Map<string, VertexData>()

  constructor(
    gameState: GameState,
    playerId: PlayerId,
    analyzer: BoardAnalyzer,
    difficulty: 'easy' | 'medium' | 'hard' = 'medium',
    personality: 'aggressive' | 'balanced' | 'defensive' | 'economic' = 'balanced'
  ) {
    this.state = gameState
    this.playerId = playerId
    this.analyzer = analyzer
    this.difficulty = difficulty
    this.personality = personality
  }

  /**
   * STRATEGIC first settlement selection - board-aware strategy
   */
  selectFirstSettlement(): GameAction {
    console.log('🎯 First settlement placement starting...')
    
    // 1. Analyze the board to understand opportunities
    this.boardAnalysis = this.analyzeBoard()
    console.log('📊 Board analysis:', this.boardAnalysis)
    
    // 2. Select the best strategy for this board
    this.strategy = this.selectStrategy(this.boardAnalysis)
    console.log('🎯 Selected strategy:', this.strategy)
    
    // 3. Get all possible vertices and score them
    const validVertices = getPossibleSettlementPositions(this.state, this.playerId)
    console.log(`📍 Analyzing ${validVertices.length} possible vertices`)
    
    // 4. Score each vertex based on our selected strategy
    const scoredVertices = validVertices.map(vertexId => {
      const vertexData = this.getVertexData(vertexId)
      const score = this.scoreVertexForStrategy(vertexData, this.strategy)
      return { vertexId, score, data: vertexData }
    })
    
    // 5. Sort by score and pick the best
    scoredVertices.sort((a, b) => b.score - a.score)
    const best = scoredVertices[0]
    
    console.log(`🏆 Best vertex: ${best.vertexId} (score: ${best.score})`)
    console.log(`📈 Resources: ${best.data.resources.join(', ')}`)
    console.log(`🎲 Numbers: ${best.data.numbers.join(', ')}`)
    
    return {
      type: 'placeBuilding',
      playerId: this.playerId,
      data: { buildingType: 'settlement', vertexId: best.vertexId }
    }
  }

  /**
   * STRATEGIC second settlement selection - complement first settlement
   */
  selectSecondSettlement(firstVertexId: string): GameAction {
    console.log('🎯 Second settlement placement starting...')
    
    const validVertices = getPossibleSettlementPositions(this.state, this.playerId)
    console.log(`📍 Analyzing ${validVertices.length} possible vertices for second settlement`)
    
    // Safety check - if firstVertexId is empty, find it from the board
    let actualFirstVertexId = firstVertexId
    if (!firstVertexId || firstVertexId === '') {
      console.log('⚠️  First vertex ID is empty, searching for player settlements...')
      actualFirstVertexId = this.findPlayerFirstSettlement()
      console.log(`🔍 Found first settlement: ${actualFirstVertexId}`)
    }
    
    // If we still can't find the first settlement, use a fallback approach
    let firstVertexData: VertexData
    if (!actualFirstVertexId || actualFirstVertexId === '') {
      console.log('⚠️  No first settlement found, using fallback strategy')
      // Create a dummy first vertex data that needs all resources
      firstVertexData = {
        vertexId: '',
        resources: [],
        numbers: [],
        production: { wood: 0, brick: 0, ore: 0, wheat: 0, sheep: 0 },
        totalExpected: 0
      }
    } else {
      // Get data for first settlement to determine what we need
      firstVertexData = this.getVertexData(actualFirstVertexId)
      console.log(`🏠 First settlement resources: ${firstVertexData.resources.join(', ')}`)
    }
    
    // Adjust strategy based on first settlement
    const adjustedStrategy = this.adjustStrategyForSecondPlacement(
      this.strategy,
      firstVertexData
    )
    
    if (adjustedStrategy !== this.strategy) {
      console.log(`🔄 Strategy adjusted from ${this.strategy} to ${adjustedStrategy}`)
      this.strategy = adjustedStrategy
    }
    
    // Score each vertex based on complementary value
    const scoredVertices = validVertices.map(vertexId => {
      const vertexData = this.getVertexData(vertexId)
      const score = this.scoreSecondVertex(vertexData, firstVertexData, this.strategy)
      return { vertexId, score, data: vertexData }
    })
    
    // Sort by score and pick the best
    scoredVertices.sort((a, b) => b.score - a.score)
    const best = scoredVertices[0]
    
    console.log(`🏆 Best second vertex: ${best.vertexId} (score: ${best.score})`)
    console.log(`📈 Resources: ${best.data.resources.join(', ')}`)
    console.log(`🎲 Numbers: ${best.data.numbers.join(', ')}`)
    
    return {
      type: 'placeBuilding',
      playerId: this.playerId,
      data: { buildingType: 'settlement', vertexId: best.vertexId }
    }
  }

  /**
   * FAST road selection
   */
  selectSetupRoad(settlementVertexId: string): GameAction {
    const validRoads = getPossibleRoadPositions(this.state, this.playerId)
    const settlementEdges = getVertexEdges(this.state.board, settlementVertexId)
    const adjacentRoads = validRoads.filter(edgeId => settlementEdges.includes(edgeId))
    
    if (adjacentRoads.length === 0) {
      throw new Error('No valid roads from settlement')
    }
    
    // Simple road selection: prefer paths toward high-value areas
    let bestRoad = adjacentRoads[0]
    let bestScore = 0
    
    for (const edgeId of adjacentRoads) {
      const score = this.fastScoreRoad(edgeId, settlementVertexId)
      if (score > bestScore) {
        bestScore = score
        bestRoad = edgeId
      }
    }
    
    return {
      type: 'placeRoad',
      playerId: this.playerId,
      data: { edgeId: bestRoad }
    }
  }

  // ============= REMOVED OLD SCORING METHODS =============
  // The old fast scoring methods have been removed to eliminate conflicts
  // All scoring now uses the strategic board-aware approach


  /**
   * Road placement for aggressive expansion
   */
  private fastScoreRoad(edgeId: string, fromVertex: string): number {
    const connectedVertices = getEdgeVertices(this.state.board, edgeId)
    const toVertex = connectedVertices.find(v => v !== fromVertex)
    
    if (!toVertex) return 0
    
    let score = 0
    
    // Check if this road points toward high-value expansion spots
    const adjacentVertices = getAdjacentVertices(this.state.board, toVertex)
    for (const adjVertex of adjacentVertices) {
      // Safety check - make sure vertex exists
      if (!adjVertex) continue
      
      try {
        const adjData = this.getVertexData(adjVertex)
        // High value spots we could build to
        if (adjData.totalExpected > 6) {
          score += 20
        }
        // Super high value spots (6/8 with ore/wheat)
        if (adjData.production.ore > 3 || adjData.production.wheat > 3) {
          score += 30
        }
      } catch (error) {
        // Skip invalid vertices gracefully
        continue
      }
    }
    
    return score
  }

  // ============= REMOVED OLD PRODUCTION CACHE METHODS =============
  // These methods were duplicating functionality from getVertexData
  // All production data now comes from the strategic getVertexData method

  /**
   * Map terrain to resource type
   */
  private getResourceForTerrain(terrain: TerrainType): ResourceType | null {
    switch (terrain) {
      case 'forest': return 'wood'
      case 'hills': return 'brick'
      case 'mountains': return 'ore'
      case 'fields': return 'wheat'
      case 'pasture': return 'sheep'
      default: return null
    }
  }

  /**
   * Find the first settlement placed by this player
   */
  private findPlayerFirstSettlement(): string {
    for (const [vertexId, vertex] of this.state.board.vertices) {
      if (vertex.building?.owner === this.playerId && vertex.building.type === 'settlement') {
        return vertexId
      }
    }
    return ''
  }

  // ============= STRATEGIC BOARD ANALYSIS =============

  /**
   * Analyze the entire board to determine resource scarcity and opportunities
   */
  private analyzeBoard(): BoardAnalysis {
    const resourceScarcity = { ore: 0, wheat: 0, wood: 0, brick: 0, sheep: 0 }
    const highNumberResources = { ore: 0, wheat: 0, wood: 0, brick: 0, sheep: 0 }
    const availablePorts = { ore: false, wheat: false, wood: false, brick: false, sheep: false, generic: 0 }
    const powerSpots: PowerSpot[] = []

    // Analyze all hexes on the board
    for (const [, hex] of this.state.board.hexes) {
      if (!hex.terrain || hex.terrain === 'desert' || hex.terrain === 'sea' || !hex.numberToken) continue

      const resource = this.getResourceForTerrain(hex.terrain)
      if (!resource) continue

      const probability = NUMBER_PROBABILITIES[hex.numberToken] || 0
      resourceScarcity[resource] += probability

      // Count high-value hexes
      if (hex.numberToken === 6 || hex.numberToken === 8) {
        highNumberResources[resource] += 1
      }
    }

    // Analyze ports
    for (const [vertexId, vertex] of this.state.board.vertices) {
      if (vertex.port) {
        if (vertex.port.type === 'generic') {
          availablePorts.generic += 1
        } else {
          availablePorts[vertex.port.type as ResourceType] = true
        }
      }

      // Analyze power spots
      const vertexData = this.getVertexData(vertexId)
      if (vertexData.totalExpected > 8 || vertexData.numbers.some(n => n === 6 || n === 8)) {
        powerSpots.push({
          vertexId,
          has68: vertexData.numbers.some(n => n === 6 || n === 8),
          resourceTypes: vertexData.resources,
          totalProduction: vertexData.totalExpected,
          hasPort: !!vertex.port
        })
      }
    }

    return {
      resourceScarcity,
      highNumberResources,
      availablePorts,
      powerSpots
    }
  }

  /**
   * Select the best strategy based on board analysis
   */
  private selectStrategy(boardAnalysis: BoardAnalysis): Strategy {
    const cityRushScore = this.evaluateCityRush(boardAnalysis)
    const portMonopolyScore = this.evaluatePortMonopoly(boardAnalysis)
    const expansionScore = this.evaluateExpansion(boardAnalysis)

    console.log(`📊 Strategy scores: City Rush: ${cityRushScore}, Port Monopoly: ${portMonopolyScore}, Expansion: ${expansionScore}`)

    if (cityRushScore > portMonopolyScore && cityRushScore > expansionScore) {
      return 'CITY_RUSH'
    } else if (portMonopolyScore > expansionScore) {
      return 'PORT_MONOPOLY'
    }
    return 'BALANCED_EXPANSION'
  }

  /**
   * Get comprehensive vertex data for strategic analysis
   */
  private getVertexData(vertexId: string): VertexData {
    const cached = this.vertexDataCache.get(vertexId)
    if (cached) {
      return cached
    }

    const vertex = this.state.board.vertices.get(vertexId)
    if (!vertex) {
      throw new Error(`Vertex ${vertexId} not found`)
    }

    const resources: ResourceType[] = []
    const numbers: number[] = []
    const production = { wood: 0, brick: 0, ore: 0, wheat: 0, sheep: 0 }
    let totalExpected = 0

    // Analyze adjacent hexes
    for (const hexCoord of vertex.position.hexes) {
      const hexId = `${hexCoord.q},${hexCoord.r},${hexCoord.s}`
      const hex = this.state.board.hexes.get(hexId)

      if (hex?.terrain && hex.terrain !== 'desert' && hex.numberToken) {
        const resource = this.getResourceForTerrain(hex.terrain)
        const probability = NUMBER_PROBABILITIES[hex.numberToken] || 0

        if (resource) {
          if (!resources.includes(resource)) {
            resources.push(resource)
          }
          numbers.push(hex.numberToken)
          production[resource] += probability
          totalExpected += probability
        }
      }
    }

    const vertexData: VertexData = {
      vertexId,
      resources,
      numbers,
      port: vertex.port ? { type: vertex.port.type } : undefined,
      production,
      totalExpected
    }

    this.vertexDataCache.set(vertexId, vertexData)
    return vertexData
  }

  /**
   * Score a vertex based on the selected strategy
   */
  private scoreVertexForStrategy(vertexData: VertexData, strategy: Strategy): number {
    switch (strategy) {
      case 'CITY_RUSH':
        return this.scoreCityRushVertex(vertexData)
      case 'PORT_MONOPOLY':
        return this.scorePortMonopolyVertex(vertexData)
      case 'BALANCED_EXPANSION':
        return this.scoreExpansionVertex(vertexData)
    }
  }

  /**
   * Score second settlement for complementary value
   */
  private scoreSecondVertex(vertexData: VertexData, firstVertexData: VertexData, strategy: Strategy): number {
    let baseScore = this.scoreVertexForStrategy(vertexData, strategy)

    // Add complementary bonuses
    // Critical: Get wheat if we don't have it
    if (!firstVertexData.resources.includes('wheat') && vertexData.resources.includes('wheat')) {
      baseScore += 200 // ESSENTIAL
    }

    // Critical: Get sheep if we don't have it
    if (!firstVertexData.resources.includes('sheep') && vertexData.resources.includes('sheep')) {
      baseScore += 150 // ESSENTIAL
    }

    // Important: Get wood if we don't have it
    if (!firstVertexData.resources.includes('wood') && vertexData.resources.includes('wood')) {
      baseScore += 100
    }

    // Important: Get ore if we don't have it
    if (!firstVertexData.resources.includes('ore') && vertexData.resources.includes('ore')) {
      baseScore += 80
    }

    // Important: Get brick if we don't have it
    if (!firstVertexData.resources.includes('brick') && vertexData.resources.includes('brick')) {
      baseScore += 60
    }

    return baseScore
  }

  /**
   * Adjust strategy based on first settlement results
   */
  private adjustStrategyForSecondPlacement(
    originalStrategy: Strategy,
    firstVertexData: VertexData
  ): Strategy {
    // If City Rush but missing essential resources, consider pivoting
    if (originalStrategy === 'CITY_RUSH') {
      const hasWheat = firstVertexData.resources.includes('wheat')
      const hasOre = firstVertexData.resources.includes('ore')
      
      if (!hasWheat && !hasOre) {
        console.log('🔄 Pivoting from City Rush - missing both wheat and ore')
        return 'BALANCED_EXPANSION'
      }
    }

    return originalStrategy
  }

  // ============= STRATEGY EVALUATION =============

  private evaluateCityRush(boardAnalysis: BoardAnalysis): number {
    let score = 0

    // Need ore/wheat on high numbers
    if (boardAnalysis.highNumberResources.ore >= 1) score += 40
    if (boardAnalysis.highNumberResources.wheat >= 1) score += 40

    // Bonus if ore/wheat are NOT scarce
    if (boardAnalysis.resourceScarcity.ore > 5) score += 20
    if (boardAnalysis.resourceScarcity.wheat > 5) score += 20

    // Check for ore+wheat combinations
    const oreWheatSpots = boardAnalysis.powerSpots.filter(spot => 
      spot.resourceTypes.includes('ore') && 
      spot.resourceTypes.includes('wheat') &&
      spot.has68
    )
    if (oreWheatSpots.length > 0) score += 50

    return score
  }

  private evaluatePortMonopoly(boardAnalysis: BoardAnalysis): number {
    let score = 0

    // Find scarce resources with 2:1 ports
    const resourceTypes: ResourceType[] = ['ore', 'wheat', 'wood', 'brick', 'sheep']
    for (const resource of resourceTypes) {
      const scarcity = boardAnalysis.resourceScarcity[resource]
      const hasPort = boardAnalysis.availablePorts[resource]
      const highNumbers = boardAnalysis.highNumberResources[resource]

      if (scarcity <= 3 && hasPort && highNumbers >= 1) {
        score = Math.max(score, 100) // Perfect setup
      } else if (scarcity <= 5 && hasPort) {
        score = Math.max(score, 70) // Good setup
      }
    }

    return score
  }

  private evaluateExpansion(boardAnalysis: BoardAnalysis): number {
    let score = 50 // Base score - always viable

    // Better if wood/brick are abundant
    if (boardAnalysis.resourceScarcity.wood > 7) score += 20
    if (boardAnalysis.resourceScarcity.brick > 7) score += 20

    // Better if resources are well distributed
    const resourceTypes: ResourceType[] = ['ore', 'wheat', 'wood', 'brick', 'sheep']
    const avgScarcity = resourceTypes.reduce((sum, r) => sum + boardAnalysis.resourceScarcity[r], 0) / 5
    if (avgScarcity > 6) score += 30

    return score
  }

  // ============= VERTEX SCORING BY STRATEGY =============

  private scoreCityRushVertex(vertexData: VertexData): number {
    let score = 0

    // Heavily prioritize ore/wheat on high numbers
    if (vertexData.numbers.includes(6) || vertexData.numbers.includes(8)) {
      if (vertexData.resources.includes('ore')) score += 100
      if (vertexData.resources.includes('wheat')) score += 100
    }

    // Secondary priorities
    if (vertexData.resources.includes('wood')) score += 20
    if (vertexData.resources.includes('brick')) score += 20
    if (vertexData.resources.includes('sheep')) score += 20

    // Total production bonus
    score += vertexData.totalExpected * 10

    return score
  }

  private scorePortMonopolyVertex(vertexData: VertexData): number {
    let score = 0

    // Find the scarce resource we're targeting
    const scarcestResource = this.findScarcestResourceWithPort()
    
    if (scarcestResource && vertexData.resources.includes(scarcestResource)) {
      // High numbers on scarce resource
      if (vertexData.numbers.includes(6) || vertexData.numbers.includes(8)) {
        score += 150
      } else if (vertexData.numbers.includes(5) || vertexData.numbers.includes(9)) {
        score += 100
      }

      // Bonus if has matching port
      if (vertexData.port?.type === scarcestResource) {
        score += 100
      }
    }

    // Still need other resources
    vertexData.resources.forEach(r => {
      if (r !== scarcestResource) score += 15
    })

    return score
  }

  private scoreExpansionVertex(vertexData: VertexData): number {
    let score = 0

    // Prioritize high production
    score += vertexData.totalExpected * 20

    // Bonus for resource diversity
    score += vertexData.resources.length * 15

    // Bonus for essential resources
    if (vertexData.resources.includes('wheat')) score += 50
    if (vertexData.resources.includes('sheep')) score += 40
    if (vertexData.resources.includes('wood')) score += 30
    if (vertexData.resources.includes('ore')) score += 25
    if (vertexData.resources.includes('brick')) score += 20

    return score
  }

  private findScarcestResourceWithPort(): ResourceType | null {
    if (!this.boardAnalysis) return null

    const resourceTypes: ResourceType[] = ['ore', 'wheat', 'wood', 'brick', 'sheep']
    let scarcestResource: ResourceType | null = null
    let lowestScarcity = Infinity

    for (const resource of resourceTypes) {
      const scarcity = this.boardAnalysis.resourceScarcity[resource]
      const hasPort = this.boardAnalysis.availablePorts[resource]

      if (hasPort && scarcity < lowestScarcity) {
        lowestScarcity = scarcity
        scarcestResource = resource
      }
    }

    return scarcestResource
  }
}

/**
 * Factory function for creating optimized initial placement AI
 */
export function createInitialPlacementAI(
  gameState: GameState, 
  playerId: PlayerId,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium',
  personality: 'aggressive' | 'balanced' | 'defensive' | 'economic' = 'balanced'
): InitialPlacementAI {
  const analyzer = new BoardAnalyzer(gameState) // We still need this for interface compatibility
  return new InitialPlacementAI(gameState, playerId, analyzer, difficulty, personality)
} 