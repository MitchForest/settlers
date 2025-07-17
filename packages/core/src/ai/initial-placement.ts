import {
  GameState,
  GameAction,
  Player,
  PlayerId,
  ResourceType,
  HexCoordinate,
  Vertex,
  Edge
} from '../types'
import {
  NUMBER_PROBABILITIES,
  BUILDING_COSTS,
  GAME_RULES
} from '../constants'
import { BoardAnalyzer } from './board-analyzer'
import { 
  canPlaceSettlement, 
  canPlaceRoad
} from '../engine/state-validator'
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

export interface RoadAnalysis {
  edgeId: string
  score: number
  reasoning: string[]
  expansionPotential: number
  longestRoadContribution: number
}

export class InitialPlacementAI {
  private readonly state: GameState
  private readonly playerId: PlayerId
  private readonly analyzer: BoardAnalyzer
  private readonly difficulty: 'easy' | 'medium' | 'hard'
  private readonly personality: 'aggressive' | 'balanced' | 'defensive' | 'economic'
  
  // Cached analysis for performance
  private vertexAnalysisCache = new Map<string, PlacementAnalysis>()
  private resourceScarcity: Record<ResourceType, number> = {} as any
  private boardMetrics: {
    avgProduction: number
    totalPorts: number
    highValueHexes: number
    resourceDistribution: Record<ResourceType, number>
  } = {} as any

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
    
    this.analyzeBoard()
  }

  /**
   * Choose optimal first settlement placement
   */
  selectFirstSettlement(): GameAction {
    const candidates = this.analyzeAllFirstPlacements()
    const selected = this.selectWithStrategy(candidates, 'first')
    
    return {
      type: 'placeBuilding',
      playerId: this.playerId,
      data: { buildingType: 'settlement', vertexId: selected.vertexId }
    }
  }

  /**
   * Choose optimal second settlement placement  
   */
  selectSecondSettlement(): GameAction {
    const firstSettlement = this.findPlayerFirstSettlement()
    const candidates = this.analyzeAllSecondPlacements(firstSettlement)
    const selected = this.selectWithStrategy(candidates, 'second')
    
    return {
      type: 'placeBuilding',
      playerId: this.playerId,
      data: { buildingType: 'settlement', vertexId: selected.vertexId }
    }
  }

  /**
   * Choose optimal setup road placement
   */
  selectSetupRoad(settlementVertexId: string): GameAction {
    const roadAnalysis = this.analyzeSetupRoads(settlementVertexId)
    const selected = this.selectBestRoad(roadAnalysis)
    
    return {
      type: 'placeRoad',
      playerId: this.playerId,
      data: { edgeId: selected.edgeId }
    }
  }

  // ============= First Settlement Analysis =============

  private analyzeAllFirstPlacements(): PlacementAnalysis[] {
    const validVertices = getPossibleSettlementPositions(this.state, this.playerId)
    const analyses: PlacementAnalysis[] = []
    
    for (const vertexId of validVertices) {
      const analysis = this.analyzeFirstPlacement(vertexId)
      if (analysis.totalScore > 20) { // Filter obviously bad positions
        analyses.push(analysis)
      }
    }
    
    return analyses.sort((a, b) => b.totalScore - a.totalScore)
  }

  private analyzeFirstPlacement(vertexId: string): PlacementAnalysis {
    if (this.vertexAnalysisCache.has(vertexId)) {
      return this.vertexAnalysisCache.get(vertexId)!
    }

    const production = this.calculateVertexProduction(vertexId)
    const diversity = this.calculateResourceDiversity(production.byResource)
    const reliability = this.calculateNumberReliability(vertexId)
    const expansion = this.calculateExpansionPotential(vertexId)
    const ports = this.calculatePortValue(vertexId)
    const scarcity = this.calculateScarcityBonus(vertexId)
    const blocking = 0 // Not relevant for first placement

    // Personality-based weight adjustments
    const weights = this.getPersonalityWeights('first')
    
    const totalScore = 
      (production.totalExpected * weights.production) +
      (diversity * weights.diversity) +
      (reliability * weights.reliability) +
      (expansion * weights.expansion) +
      (ports * weights.ports) +
      (scarcity * weights.scarcity)

    const analysis: PlacementAnalysis = {
      vertexId,
      totalScore: Math.min(totalScore, 100),
      breakdown: {
        production: production.totalExpected,
        diversity,
        reliability,
        expansion,
        ports,
        scarcity,
        blocking,
        synergy: 0 // Not applicable for first placement
      },
      reasoning: [
        `Production: ${production.totalExpected.toFixed(1)} expected/turn`,
        `Diversity: ${diversity.toFixed(1)} (${production.resourceCount} resource types)`,
        `Expansion: ${expansion.toFixed(1)} future opportunities`,
        ports > 0 ? `Port: ${this.getPortDescription(vertexId)}` : null
      ].filter(Boolean) as string[],
      riskFactors: this.identifyRiskFactors(vertexId, production)
    }

    this.vertexAnalysisCache.set(vertexId, analysis)
    return analysis
  }

  // ============= Second Settlement Analysis =============

  private analyzeAllSecondPlacements(firstVertexId: string): PlacementAnalysis[] {
    const validVertices = getPossibleSettlementPositions(this.state, this.playerId)
    const analyses: PlacementAnalysis[] = []
    
    for (const vertexId of validVertices) {
      const analysis = this.analyzeSecondPlacement(vertexId, firstVertexId)
      if (analysis.totalScore > 25) { // Higher threshold for second settlement
        analyses.push(analysis)
      }
    }
    
    return analyses.sort((a, b) => b.totalScore - a.totalScore)
  }

  private analyzeSecondPlacement(vertexId: string, firstVertexId: string): PlacementAnalysis {
    const firstProduction = this.calculateVertexProduction(firstVertexId)
    const secondProduction = this.calculateVertexProduction(vertexId)
    
    const production = secondProduction.totalExpected
    const diversity = this.calculateResourceDiversity(secondProduction.byResource)
    const reliability = this.calculateNumberReliability(vertexId)
    const expansion = this.calculateExpansionPotential(vertexId)
    const ports = this.calculatePortValue(vertexId)
    const scarcity = this.calculateScarcityBonus(vertexId)
    const blocking = this.calculateBlockingValue(vertexId)
    const synergy = this.calculateResourceSynergy(firstProduction.byResource, secondProduction.byResource)

    // Strategic distance analysis
    const distance = this.calculateRoadDistance(firstVertexId, vertexId)
    const distanceScore = this.scoreStrategicDistance(distance)
    
    // Combined resource engine analysis
    const combinedEngine = this.analyzeCombinedResourceEngine(firstProduction.byResource, secondProduction.byResource)

    const weights = this.getPersonalityWeights('second')
    
    const totalScore = 
      (production * weights.production * 0.8) + // Slightly less weight than first
      (synergy * weights.synergy) +
      (combinedEngine.completeness * weights.diversity) +
      (expansion * weights.expansion) +
      (ports * weights.ports) +
      (blocking * weights.blocking) +
      (distanceScore * 0.3)

    return {
      vertexId,
      totalScore: Math.min(totalScore, 100),
      breakdown: {
        production,
        diversity: combinedEngine.completeness,
        reliability,
        expansion,
        ports,
        scarcity,
        blocking,
        synergy
      },
      reasoning: [
        `Synergy: ${synergy.toFixed(1)} (complements first settlement)`,
        `Combined engine: ${combinedEngine.resourceTypes} resource types`,
        `Distance: ${distance} roads (${this.describeDistance(distance)})`,
        blocking > 0 ? `Blocks opponents: ${blocking.toFixed(1)}` : null
      ].filter(Boolean) as string[],
      riskFactors: this.identifyRiskFactors(vertexId, secondProduction)
    }
  }

  // ============= Production Analysis =============

  private calculateVertexProduction(vertexId: string): {
    totalExpected: number,
    byResource: Record<ResourceType, number>,
    resourceCount: number,
    highValueHexes: number
  } {
    const vertex = this.state.board.vertices.get(vertexId)
    if (!vertex) return { totalExpected: 0, byResource: {} as any, resourceCount: 0, highValueHexes: 0 }

    const byResource: Record<ResourceType, number> = {
      wood: 0, brick: 0, ore: 0, wheat: 0, sheep: 0
    }
    
    let totalExpected = 0
    let highValueHexes = 0
    
    for (const hexCoord of vertex.position.hexes) {
      const hexId = `${hexCoord.q},${hexCoord.r},${hexCoord.s}`
      const hex = this.state.board.hexes.get(hexId)
      
      if (hex && hex.terrain && hex.terrain !== 'desert' && hex.numberToken) {
        const probability = NUMBER_PROBABILITIES[hex.numberToken] || 0
        const resourceType = this.getResourceForTerrain(hex.terrain)
        
        if (resourceType) {
          byResource[resourceType] += probability
          totalExpected += probability
        }
        
        if (hex.numberToken === 6 || hex.numberToken === 8) {
          highValueHexes++
        }
      }
    }
    
    const resourceCount = Object.values(byResource).filter(v => v > 0).length
    
    return { totalExpected, byResource, resourceCount, highValueHexes }
  }

  private calculateResourceDiversity(production: Record<ResourceType, number>): number {
    const resourceTypes = Object.values(production).filter(p => p > 0).length
    const evenness = this.calculateResourceEvenness(production)
    
    let score = resourceTypes * 15 // Base diversity
    
    // Bonus for optimal diversity (3-4 resources ideal)
    if (resourceTypes === 3) score += 25
    if (resourceTypes === 4) score += 35
    if (resourceTypes === 5) score += 20 // All 5 is good but harder to balance
    
    // Penalty for poor diversity
    if (resourceTypes <= 2) score -= 30
    
    // Bonus for even distribution
    score += evenness * 10
    
    return Math.max(0, Math.min(100, score))
  }

  private calculateResourceEvenness(production: Record<ResourceType, number>): number {
    const values = Object.values(production).filter(v => v > 0)
    if (values.length <= 1) return 0
    
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
    
    // Lower variance = more even = better score
    return Math.max(0, 100 - (variance * 20))
  }

  private calculateNumberReliability(vertexId: string): number {
    const vertex = this.state.board.vertices.get(vertexId)
    if (!vertex) return 0

    let reliabilityScore = 0
    let hexCount = 0

    for (const hexCoord of vertex.position.hexes) {
      const hexId = `${hexCoord.q},${hexCoord.r},${hexCoord.s}`
      const hex = this.state.board.hexes.get(hexId)
      
      if (hex && hex.terrain !== 'desert' && hex.numberToken) {
        hexCount++
        
        // Score based on reliability (6,8 = great, 5,9 = good, etc.)
        if (hex.numberToken === 6 || hex.numberToken === 8) {
          reliabilityScore += 40
        } else if (hex.numberToken === 5 || hex.numberToken === 9) {
          reliabilityScore += 30
        } else if (hex.numberToken === 4 || hex.numberToken === 10) {
          reliabilityScore += 20
        } else if (hex.numberToken === 3 || hex.numberToken === 11) {
          reliabilityScore += 10
        } else if (hex.numberToken === 2 || hex.numberToken === 12) {
          reliabilityScore -= 10
        }
      }
    }

    return hexCount > 0 ? Math.max(0, reliabilityScore / hexCount) : 0
  }

  // ============= Strategic Analysis =============

  private calculateExpansionPotential(vertexId: string): number {
    let score = 0
    
    // Find vertices within 2-4 road distance
    const nearbyVertices = this.findVerticesWithinRoadDistance(vertexId, 4)
    
    for (const nearVertexId of nearbyVertices) {
      if (this.isValidFuturePosition(nearVertexId)) {
        const distance = this.calculateRoadDistance(vertexId, nearVertexId)
        const vertexValue = this.calculateVertexProduction(nearVertexId).totalExpected
        
        // Score decreases with distance but increases with value
        const distanceMultiplier = distance <= 2 ? 1.0 : distance <= 3 ? 0.7 : 0.4
        score += (vertexValue * distanceMultiplier)
      }
    }
    
    // Bonus for being on coast (more directions)
    if (this.isCoastalVertex(vertexId)) {
      score += 15
    }
    
    // Bonus for central board position
    if (this.isCentralPosition(vertexId)) {
      score += 10
    }
    
    return Math.min(100, score * 1.5)
  }

  private calculateResourceSynergy(
    first: Record<ResourceType, number>,
    second: Record<ResourceType, number>
  ): number {
    let synergy = 0
    
    // High bonus for covering missing resources
    for (const resource of ['wood', 'brick', 'ore', 'wheat', 'sheep'] as ResourceType[]) {
      if (first[resource] === 0 && second[resource] > 0) {
        synergy += 25 // Big bonus for new resource
      } else if (first[resource] > 0 && second[resource] > 0) {
        synergy += 5  // Small bonus for reinforcement
      }
      
      // Penalty for over-concentration
      if (first[resource] > 0.15 && second[resource] > 0.15) {
        synergy -= 10
      }
    }
    
    return Math.max(0, synergy)
  }

  private analyzeCombinedResourceEngine(
    first: Record<ResourceType, number>,
    second: Record<ResourceType, number>
  ): { completeness: number, resourceTypes: number, balance: number } {
    const combined: Record<ResourceType, number> = {
      wood: first.wood + second.wood,
      brick: first.brick + second.brick,
      ore: first.ore + second.ore,
      wheat: first.wheat + second.wheat,
      sheep: first.sheep + second.sheep
    }
    
    const resourceTypes = Object.values(combined).filter(v => v > 0).length
    const balance = this.calculateResourceEvenness(combined)
    
    let completeness = resourceTypes * 20
    
    // Big bonus for having all 5 resources
    if (resourceTypes === 5) completeness += 40
    
    // Bonus for good balance
    completeness += balance * 0.3
    
    return { completeness, resourceTypes, balance }
  }

  private calculateBlockingValue(vertexId: string): number {
    let blockingValue = 0
    
    // Find nearby opponent settlements
    const nearbyOpponents = this.findNearbyOpponentBuildings(vertexId, 3)
    
    for (const opponentVertexId of nearbyOpponents) {
      const opponentProduction = this.calculateVertexProduction(opponentVertexId)
      const distance = this.calculateRoadDistance(vertexId, opponentVertexId)
      
      // Higher value for blocking high-production opponents
      const threatLevel = opponentProduction.totalExpected
      const proximityMultiplier = distance <= 2 ? 2.0 : distance <= 3 ? 1.5 : 1.0
      
      blockingValue += (threatLevel * proximityMultiplier * 0.3)
    }
    
    // Extra value for taking last good spot in area
    const availableNearby = this.countAvailableVerticesNearby(vertexId, 2)
    if (availableNearby <= 2) {
      blockingValue += 20
    }
    
    return Math.min(50, blockingValue)
  }

  // ============= Road Placement Analysis =============

  private analyzeSetupRoads(settlementVertexId: string): RoadAnalysis[] {
    const validRoads = getPossibleRoadPositions(this.state, this.playerId)
    const settlementEdges = getVertexEdges(this.state.board, settlementVertexId)
    const adjacentRoads = validRoads.filter(edgeId => settlementEdges.includes(edgeId))
    
    return adjacentRoads.map(edgeId => this.analyzeRoadPlacement(edgeId, settlementVertexId))
      .sort((a, b) => b.score - a.score)
  }

  private analyzeRoadPlacement(edgeId: string, fromVertexId: string): RoadAnalysis {
    const connectedVertices = getEdgeVertices(this.state.board, edgeId)
    const toVertexId = connectedVertices.find(v => v !== fromVertexId)
    
    if (!toVertexId) {
      return { edgeId, score: 0, reasoning: ['Invalid road'], expansionPotential: 0, longestRoadContribution: 0 }
    }
    
    let score = 10 // Base score
    const reasoning: string[] = []
    
    // Expansion potential - where does this road lead?
    const expansionPotential = this.calculateRoadExpansionValue(toVertexId)
    score += expansionPotential * 0.6
    
    if (expansionPotential > 20) {
      reasoning.push(`Leads to valuable expansion (${expansionPotential.toFixed(1)})`)
    }
    
    // Port access
    const vertex = this.state.board.vertices.get(toVertexId)
    if (vertex?.port) {
      const portValue = vertex.port.type === 'generic' ? 15 : 25
      score += portValue
      reasoning.push(`Provides ${vertex.port.type} port access`)
    }
    
    // Longest road potential (for future)
    const roadPotential = this.calculateLongestRoadFromPosition(toVertexId)
    if (roadPotential > 5) {
      score += roadPotential * 2
      reasoning.push(`Good longest road potential (${roadPotential})`)
    }
    
    // Avoid dead ends unless they lead to high value
    const connectionCount = getVertexEdges(this.state.board, toVertexId).length
    if (connectionCount <= 2 && expansionPotential < 15) {
      score -= 15
      reasoning.push('Leads to dead end')
    }
    
    // Second settlement setup - prefer roads toward second settlement area
    if (this.state.phase === 'setup2') {
      const directionValue = this.calculateDirectionValue(fromVertexId, toVertexId)
      score += directionValue * 0.4
      
      if (directionValue > 20) {
        reasoning.push('Good direction for future expansion')
      }
    }
    
    return {
      edgeId,
      score: Math.max(0, score),
      reasoning,
      expansionPotential,
      longestRoadContribution: roadPotential
    }
  }

  private calculateRoadExpansionValue(vertexId: string): number {
    const reachableVertices = this.findVerticesWithinRoadDistance(vertexId, 3)
    let maxValue = 0
    
    for (const reachableVertexId of reachableVertices) {
      if (this.isValidFuturePosition(reachableVertexId)) {
        const production = this.calculateVertexProduction(reachableVertexId)
        maxValue = Math.max(maxValue, production.totalExpected)
      }
    }
    
    return maxValue
  }

  // ============= Selection Strategy =============

  private selectWithStrategy(candidates: PlacementAnalysis[], phase: 'first' | 'second'): PlacementAnalysis {
    if (candidates.length === 0) {
      throw new Error(`No valid candidates for ${phase} settlement`)
    }
    
    // Filter candidates based on difficulty
    const topCount = this.getTopCandidateCount(candidates.length, phase)
    const topCandidates = candidates.slice(0, topCount)
    
    // Apply personality-based selection
    return this.applyPersonalitySelection(topCandidates, phase)
  }

  private getTopCandidateCount(totalCandidates: number, phase: 'first' | 'second'): number {
    const baseCount = phase === 'first' ? 8 : 6 // Second placement more focused
    
    switch (this.difficulty) {
      case 'easy': return Math.min(totalCandidates, Math.max(3, Math.floor(totalCandidates * 0.5)))
      case 'medium': return Math.min(totalCandidates, Math.max(baseCount, Math.floor(totalCandidates * 0.3)))
      case 'hard': return Math.min(totalCandidates, Math.max(baseCount, Math.floor(totalCandidates * 0.2)))
    }
  }

  private applyPersonalitySelection(candidates: PlacementAnalysis[], phase: 'first' | 'second'): PlacementAnalysis {
    switch (this.personality) {
      case 'aggressive':
        return this.selectAggressive(candidates)
      case 'defensive':
        return this.selectDefensive(candidates)
      case 'economic':
        return this.selectEconomic(candidates)
      case 'balanced':
      default:
        return this.selectBalanced(candidates)
    }
  }

  private selectAggressive(candidates: PlacementAnalysis[]): PlacementAnalysis {
    // Prefer high blocking value and expansion potential
    return candidates.reduce((best, current) => {
      const bestScore = best.breakdown.blocking + best.breakdown.expansion
      const currentScore = current.breakdown.blocking + current.breakdown.expansion
      return currentScore > bestScore ? current : best
    })
  }

  private selectDefensive(candidates: PlacementAnalysis[]): PlacementAnalysis {
    // Prefer reliable production and low risk
    return candidates.reduce((best, current) => {
      const bestScore = best.breakdown.reliability + best.breakdown.production - (best.riskFactors.length * 5)
      const currentScore = current.breakdown.reliability + current.breakdown.production - (current.riskFactors.length * 5)
      return currentScore > bestScore ? current : best
    })
  }

  private selectEconomic(candidates: PlacementAnalysis[]): PlacementAnalysis {
    // Prefer high production and port access
    return candidates.reduce((best, current) => {
      const bestScore = best.breakdown.production + best.breakdown.ports + best.breakdown.diversity
      const currentScore = current.breakdown.production + current.breakdown.ports + current.breakdown.diversity
      return currentScore > bestScore ? current : best
    })
  }

  private selectBalanced(candidates: PlacementAnalysis[]): PlacementAnalysis {
    // Use weighted randomness for variety while favoring top choices
    if (this.difficulty === 'hard') {
      return candidates[0] // Always optimal for hard AI
    }
    
    const weights = candidates.map((candidate, index) => {
      // Exponential decay - top candidates much more likely
      return Math.exp(-index * 0.8)
    })
    
    return this.weightedRandomSelection(candidates, weights)
  }

  private selectBestRoad(roadAnalyses: RoadAnalysis[]): RoadAnalysis {
    if (roadAnalyses.length === 0) {
      // This is a realistic scenario - sometimes there are no valid road positions
      // Return a fallback error that can be handled gracefully
      throw new Error('No valid roads available - this can happen when settlement is isolated')
    }
    
    // Simple selection for roads - usually fewer options
    const topRoads = roadAnalyses.slice(0, Math.min(3, roadAnalyses.length))
    
    if (this.difficulty === 'hard') {
      return topRoads[0]
    }
    
    // Add some randomness for lower difficulties
    const weights = topRoads.map((_, index) => Math.exp(-index * 1.2))
    return this.weightedRandomSelection(topRoads, weights)
  }

  // ============= Personality Weights =============

  private getPersonalityWeights(phase: 'first' | 'second'): {
    production: number, diversity: number, reliability: number,
    expansion: number, ports: number, scarcity: number,
    blocking: number, synergy: number
  } {
    const base = {
      production: 1.0,
      diversity: 0.8,
      reliability: 0.6,
      expansion: 0.7,
      ports: 0.4,
      scarcity: 0.5,
      blocking: phase === 'second' ? 0.6 : 0.0,
      synergy: phase === 'second' ? 1.0 : 0.0
    }
    
    switch (this.personality) {
      case 'aggressive':
        return {
          ...base,
          expansion: base.expansion * 1.3,
          blocking: base.blocking * 1.5,
          production: base.production * 0.9
        }
      case 'defensive':
        return {
          ...base,
          reliability: base.reliability * 1.4,
          diversity: base.diversity * 1.2,
          expansion: base.expansion * 0.8
        }
      case 'economic':
        return {
          ...base,
          production: base.production * 1.3,
          ports: base.ports * 1.6,
          scarcity: base.scarcity * 1.2
        }
      case 'balanced':
      default:
        return base
    }
  }

  // ============= Utility Functions =============

  private analyzeBoard(): void {
    // Calculate resource scarcity
    const resourceTotals: Record<ResourceType, number> = {
      wood: 0, brick: 0, ore: 0, wheat: 0, sheep: 0
    }
    
    let totalProduction = 0
    let totalPorts = 0
    let highValueHexes = 0
    
    // Analyze all hexes
    this.state.board.hexes.forEach(hex => {
      if (hex.terrain && hex.terrain !== 'desert' && hex.numberToken) {
        const probability = NUMBER_PROBABILITIES[hex.numberToken] || 0
        const resourceType = this.getResourceForTerrain(hex.terrain)
        
        if (resourceType) {
          resourceTotals[resourceType] += probability
          totalProduction += probability
        }
        
        if (hex.numberToken === 6 || hex.numberToken === 8) {
          highValueHexes++
        }
      }
    })
    
    // Count ports
    this.state.board.vertices.forEach(vertex => {
      if (vertex.port) totalPorts++
    })
    
    // Calculate scarcity (lower = more scarce)
    for (const resource in resourceTotals) {
      this.resourceScarcity[resource as ResourceType] = resourceTotals[resource as ResourceType] / totalProduction
    }
    
    this.boardMetrics = {
      avgProduction: totalProduction / Object.keys(resourceTotals).length,
      totalPorts,
      highValueHexes,
      resourceDistribution: resourceTotals
    }
  }

  private calculateScarcityBonus(vertexId: string): number {
    const production = this.calculateVertexProduction(vertexId)
    let bonus = 0
    
    for (const [resource, amount] of Object.entries(production.byResource)) {
      const scarcity = this.resourceScarcity[resource as ResourceType]
      if (scarcity < 0.15) { // Very scarce
        bonus += amount * 30
      } else if (scarcity < 0.2) { // Somewhat scarce
        bonus += amount * 15
      }
    }
    
    return Math.min(50, bonus)
  }

  private calculatePortValue(vertexId: string): number {
    const vertex = this.state.board.vertices.get(vertexId)
    if (!vertex?.port) return 0
    
    if (vertex.port.type !== 'generic') {
      // 2:1 resource port
      const production = this.calculateVertexProduction(vertexId)
      const resourceType = vertex.port.type as ResourceType
      
      if (production.byResource[resourceType] > 0) {
        return 50 // Very valuable if we produce that resource
      } else {
        return 30 // Still useful for trading
      }
    }
    
    // 3:1 generic port
    return 20
  }

  private scoreStrategicDistance(distance: number): number {
    // Optimal distance for second settlement is 4-6 roads
    if (distance >= 4 && distance <= 6) return 30
    if (distance === 3 || distance === 7) return 20
    if (distance <= 2) return -20 // Too close
    if (distance >= 8) return -10 // Too far
    return 0
  }

  private identifyRiskFactors(vertexId: string, production: any): string[] {
    const risks: string[] = []
    
    // Check for over-reliance on rare numbers
    const vertex = this.state.board.vertices.get(vertexId)
    if (vertex) {
      let rareNumbers = 0
      for (const hexCoord of vertex.position.hexes) {
        const hexId = `${hexCoord.q},${hexCoord.r},${hexCoord.s}`
        const hex = this.state.board.hexes.get(hexId)
        if (hex?.numberToken === 2 || hex?.numberToken === 12) {
          rareNumbers++
        }
      }
      if (rareNumbers > 0) {
        risks.push(`${rareNumbers} rare number${rareNumbers > 1 ? 's' : ''} (2 or 12)`)
      }
    }
    
    // Check for robber vulnerability
    if (production.highValueHexes > 1) {
      risks.push('Multiple high-value hexes (robber target)')
    }
    
    // Check for resource concentration
    const maxResource = Math.max(...Object.values(production.byResource) as number[])
    if (maxResource > 0.25) {
      risks.push('Over-concentrated on single resource')
    }
    
    return risks
  }

  // Helper functions for distance and positioning
  private findVerticesWithinRoadDistance(fromVertexId: string, maxDistance: number): string[] {
    const visited = new Set<string>()
    const queue: Array<{vertexId: string, distance: number}> = []
    const result: string[] = []
    
    queue.push({ vertexId: fromVertexId, distance: 0 })
    visited.add(fromVertexId)
    
    while (queue.length > 0) {
      const { vertexId, distance } = queue.shift()!
      
      if (distance <= maxDistance) {
        result.push(vertexId)
      }
      
      if (distance < maxDistance) {
        const adjacentVertices = getAdjacentVertices(this.state.board, vertexId)
        for (const nextVertexId of adjacentVertices) {
          if (!visited.has(nextVertexId)) {
            visited.add(nextVertexId)
            queue.push({ vertexId: nextVertexId, distance: distance + 1 })
          }
        }
      }
    }
    
    return result
  }

  private calculateRoadDistance(vertex1: string, vertex2: string): number {
    const visited = new Set<string>()
    const queue: Array<{vertexId: string, distance: number}> = []
    
    queue.push({ vertexId: vertex1, distance: 0 })
    visited.add(vertex1)
    
    while (queue.length > 0) {
      const { vertexId, distance } = queue.shift()!
      
      if (vertexId === vertex2) {
        return distance
      }
      
      const adjacentVertices = getAdjacentVertices(this.state.board, vertexId)
      for (const nextVertexId of adjacentVertices) {
        if (!visited.has(nextVertexId)) {
          visited.add(nextVertexId)
          queue.push({ vertexId: nextVertexId, distance: distance + 1 })
        }
      }
    }
    
    return Infinity
  }

  // Additional helper methods
  private getResourceForTerrain(terrain: string): ResourceType | null {
    const mapping: Record<string, ResourceType | null> = {
      forest: 'wood',
      hills: 'brick',
      mountains: 'ore',
      fields: 'wheat',
      pasture: 'sheep',
      desert: null,
      sea: null
    }
    return mapping[terrain] || null
  }

  private findPlayerFirstSettlement(): string {
    for (const [vertexId, vertex] of this.state.board.vertices) {
      if (vertex.building?.owner === this.playerId && vertex.building.type === 'settlement') {
        return vertexId
      }
    }
    return ''
  }

  private isValidFuturePosition(vertexId: string): boolean {
    const vertex = this.state.board.vertices.get(vertexId)
    return !!(vertex && !vertex.building)
  }

  private isCoastalVertex(vertexId: string): boolean {
    const vertex = this.state.board.vertices.get(vertexId)
    if (!vertex) return false
    
    return vertex.position.hexes.some(hexCoord => {
      const hexId = `${hexCoord.q},${hexCoord.r},${hexCoord.s}`
      const hex = this.state.board.hexes.get(hexId)
      return hex?.terrain === 'sea'
    })
  }

  private isCentralPosition(vertexId: string): boolean {
    const vertex = this.state.board.vertices.get(vertexId)
    if (!vertex) return false
    
    // Calculate distance from board center (rough heuristic)
    const avgCoord = vertex.position.hexes.reduce(
      (acc, hex) => ({ q: acc.q + hex.q, r: acc.r + hex.r }),
      { q: 0, r: 0 }
    )
    avgCoord.q /= vertex.position.hexes.length
    avgCoord.r /= vertex.position.hexes.length
    
    const distanceFromCenter = Math.abs(avgCoord.q) + Math.abs(avgCoord.r)
    return distanceFromCenter <= 2 // Within 2 hexes of center
  }

  private findNearbyOpponentBuildings(vertexId: string, maxDistance: number): string[] {
    const nearbyVertices = this.findVerticesWithinRoadDistance(vertexId, maxDistance)
    return nearbyVertices.filter(nearVertexId => {
      const vertex = this.state.board.vertices.get(nearVertexId)
      return vertex?.building && vertex.building.owner !== this.playerId
    })
  }

  private countAvailableVerticesNearby(vertexId: string, distance: number): number {
    const nearby = this.findVerticesWithinRoadDistance(vertexId, distance)
    return nearby.filter(v => this.isValidFuturePosition(v)).length
  }

  private calculateLongestRoadFromPosition(vertexId: string): number {
    // Simplified calculation for potential road length from this position
    const reachableVertices = this.findVerticesWithinRoadDistance(vertexId, 5)
    return Math.min(15, reachableVertices.length * 0.8) // Rough estimate
  }

  private calculateDirectionValue(fromVertexId: string, toVertexId: string): number {
    // In setup2, prefer roads that head toward unexplored areas
    // This is a simplified heuristic
    const nearbyBuildings = this.findNearbyOpponentBuildings(toVertexId, 2)
    return Math.max(0, 30 - (nearbyBuildings.length * 8))
  }

  private getPortDescription(vertexId: string): string {
    const vertex = this.state.board.vertices.get(vertexId)
    if (!vertex?.port) return ''
    
    return vertex.port.type === 'generic' ? '3:1 Generic Port' : `2:1 ${vertex.port.type} Port`
  }

  private describeDistance(distance: number): string {
    if (distance <= 3) return 'close'
    if (distance <= 6) return 'optimal'
    return 'far'
  }

  private weightedRandomSelection<T>(items: T[], weights: number[]): T {
    const totalWeight = weights.reduce((sum, w) => sum + w, 0)
    let random = Math.random() * totalWeight
    
    for (let i = 0; i < items.length; i++) {
      random -= weights[i]
      if (random <= 0) {
        return items[i]
      }
    }
    
    return items[items.length - 1]
  }
}

export function createInitialPlacementAI(
  gameState: GameState,
  playerId: PlayerId,
  analyzer: BoardAnalyzer,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium',
  personality: 'aggressive' | 'balanced' | 'defensive' | 'economic' = 'balanced'
): InitialPlacementAI {
  return new InitialPlacementAI(gameState, playerId, analyzer, difficulty, personality)
} 