import { GameState, Board, VertexPosition, EdgePosition, HexCoordinate, PlayerId, ResourceType, Building } from '../types'
import { honeycombBridge } from '../geometry/honeycomb-bridge'
import {
  getAdjacentVertices,
  getVertexEdges,
  getEdgeVertices,
  getPlayerRoadNetwork,
  getPossibleSettlementPositions,
  getPossibleRoadPositions,
  calculateLongestRoad
} from '../engine/adjacency-helpers'
import { NUMBER_PROBABILITIES } from '../constants'

/**
 * Board Analyzer for AI Decision Making
 * 
 * Provides comprehensive analysis of board positions, resource values,
 * and strategic opportunities. This is the "brain" that understands
 * what makes positions valuable and guides AI decision making.
 */

// ============= Core Analysis Interfaces =============

export interface ResourceValue {
  resourceType: ResourceType
  probability: number      // Dice probability (0-1)
  scarcity: number        // How contested (0-1, higher = more scarce)
  portAccess: boolean     // Has 2:1 or 3:1 port access
  expectedYield: number   // Expected resources per turn
}

export interface PositionScore {
  productionValue: number     // Expected resource generation (0-100)
  diversification: number    // Resource type variety (0-100)
  expansionPotential: number // Future building opportunities (0-100)
  portAccess: number         // Trade efficiency bonus (0-100)
  blockingValue: number      // Denies opponents key spots (0-100)
  totalScore: number         // Weighted combination (0-100)
  breakdown: string[]        // Human-readable scoring breakdown
}

export interface PortAccessibility {
  hasPort: boolean
  portType: '2:1' | '3:1' | null
  resourceType: ResourceType | 'any'
  tradeEfficiency: number // Multiplier for trade value
}

export interface ExpansionPath {
  fromVertex: string
  toVertex: string
  requiredRoads: string[]  // Edge IDs needed to connect
  cost: number            // Number of roads needed
  value: number           // Strategic value of expansion
}

export interface RoadPotential {
  currentLength: number
  maxPossibleLength: number
  bottlenecks: string[]      // Vertices that could be blocked
  expansionPaths: ExpansionPath[]
}

export interface BlockingMove {
  vertexId: string
  targetPlayer: PlayerId
  strategicValue: number     // How much it hurts opponent
  urgency: number           // How soon opponent might take it
}

export interface PlayerAssessment {
  playerId: PlayerId
  totalProduction: number   // Expected resources per turn
  resourceBalance: Record<ResourceType, number>
  longestRoadLength: number
  expansionOptions: number  // Available settlement spots
  tradingPosition: number   // Access to ports and trade efficiency
  threatLevel: number       // How threatening this player is
}

export interface ThreatAnalysis {
  type: 'longest_road' | 'rapid_expansion' | 'resource_monopoly' | 'victory_points'
  player: PlayerId
  severity: number          // 0-100, how urgent the threat is
  counterMeasures: string[] // Possible ways to respond
}

export interface TradeOpportunity {
  giveResources: Partial<Record<ResourceType, number>>
  receiveResources: Partial<Record<ResourceType, number>>
  tradePartner: PlayerId | 'bank'
  efficiency: number        // How good this trade is (0-100)
  urgency: number          // How soon we should make this trade
}

// ============= BoardAnalyzer Implementation =============

export class BoardAnalyzer {
  private readonly state: GameState
  private readonly board: Board
  private resourceValueCache = new Map<string, ResourceValue>()
  private positionScoreCache = new Map<string, PositionScore>()

  constructor(gameState: GameState) {
    this.state = gameState
    this.board = gameState.board
  }

  // ============= Resource & Production Analysis =============

  /**
   * Analyze the resource value of a specific hex
   */
  analyzeHexResourceValue(hexId: string): ResourceValue {
    const cached = this.resourceValueCache.get(hexId)
    if (cached) return cached

    const hex = this.board.hexes.get(hexId)
    if (!hex || hex.terrain === 'desert' || hex.terrain === 'sea') {
      const emptyValue: ResourceValue = {
        resourceType: 'brick', // placeholder
        probability: 0,
        scarcity: 0,
        portAccess: false,
        expectedYield: 0
      }
      this.resourceValueCache.set(hexId, emptyValue)
      return emptyValue
    }

    // Calculate dice probability
    const diceNumber = hex.numberToken
    const probability = diceNumber ? (NUMBER_PROBABILITIES[diceNumber] || 0) / 36 : 0 // Convert to 0-1

    // Calculate scarcity (how many hexes produce this resource)
    const resourceType = this.getResourceTypeFromHex(hex.terrain!)
    const sameResourceHexes = Array.from(this.board.hexes.values())
      .filter(h => h.terrain && this.getResourceTypeFromHex(h.terrain) === resourceType && h.numberToken)
    const scarcity = Math.max(0, 1 - (sameResourceHexes.length / 4)) // Assume ~4 hexes per resource is normal

    // Check port access (any adjacent vertex has port access)
    const portAccess = false // Simplified for now - complex geometry calculation needed

    const value: ResourceValue = {
      resourceType,
      probability,
      scarcity,
      portAccess,
      expectedYield: probability * (1 + scarcity) // Higher scarcity increases value
    }

    this.resourceValueCache.set(hexId, value)
    return value
  }

  /**
   * Calculate expected resource production for a vertex position
   */
  calculateExpectedProduction(vertexId: string): Record<ResourceType, number> {
    const vertex = this.board.vertices.get(vertexId)
    if (!vertex) {
      return { wood: 0, brick: 0, ore: 0, wheat: 0, sheep: 0 }
    }

    const adjacentHexes = vertex.position.hexes.map(coord => 
      `${coord.q},${coord.r},${coord.s}`) // Convert coordinates to hex IDs
    
    const production: Record<ResourceType, number> = {
      wood: 0,
      brick: 0,
      ore: 0,
      wheat: 0,
      sheep: 0
    }

    for (const hexId of adjacentHexes) {
      const resourceValue = this.analyzeHexResourceValue(hexId)
      if (resourceValue.expectedYield > 0) {
        production[resourceValue.resourceType] += resourceValue.expectedYield
      }
    }

    return production
  }

  /**
   * Find the best positions for a specific resource type
   */
  findBestResourcePositions(resourceType: ResourceType, limit = 5): Array<{vertexId: string, value: number}> {
    const positions: Array<{vertexId: string, value: number}> = []

    for (const [vertexId, vertex] of this.board.vertices) {
      if (vertex.building) continue // Already occupied

      const production = this.calculateExpectedProduction(vertexId)
      const resourceValue = production[resourceType]

      if (resourceValue > 0) {
        positions.push({ vertexId, value: resourceValue })
      }
    }

    return positions
      .sort((a, b) => b.value - a.value)
      .slice(0, limit)
  }

  // ============= Strategic Position Evaluation =============

  /**
   * Score a settlement position comprehensively
   */
  scoreSettlementPosition(vertexId: string, playerId: PlayerId): PositionScore {
    const cacheKey = `${vertexId}-${playerId}`
    const cached = this.positionScoreCache.get(cacheKey)
    if (cached) return cached

    const breakdown: string[] = []

    // 1. Production Value (40% weight)
    const production = this.calculateExpectedProduction(vertexId)
    const totalProduction = Object.values(production).reduce((sum, val) => sum + val, 0)
    const productionValue = Math.min(100, totalProduction * 25) // Scale to 0-100
    breakdown.push(`Production: ${productionValue.toFixed(1)} (${totalProduction.toFixed(2)} expected/turn)`)

    // 2. Diversification (25% weight)
    const resourceTypes = Object.entries(production).filter(([_, val]) => val > 0).length
    const diversification = (resourceTypes / 5) * 100 // 5 resource types max
    breakdown.push(`Diversification: ${diversification.toFixed(1)} (${resourceTypes}/5 resources)`)

    // 3. Expansion Potential (20% weight)
    const adjacentVertices = getAdjacentVertices(this.board, vertexId)
    const availableExpansions = adjacentVertices.filter(vid => {
      const vertex = this.board.vertices.get(vid)
      return vertex && !vertex.building
    }).length
    const expansionPotential = Math.min(100, (availableExpansions / 3) * 100) // 3+ adjacent is excellent
    breakdown.push(`Expansion: ${expansionPotential.toFixed(1)} (${availableExpansions} adjacent spots)`)

    // 4. Port Access (10% weight)
    const portAccess = this.evaluatePortAccess(vertexId)
    const portScore = portAccess.hasPort ? (portAccess.portType === '2:1' ? 100 : 60) : 0
    breakdown.push(`Port Access: ${portScore.toFixed(1)} (${portAccess.portType || 'none'})`)

    // 5. Blocking Value (5% weight)
    const blockingValue = this.calculateBlockingValue(vertexId, playerId)
    breakdown.push(`Blocking: ${blockingValue.toFixed(1)}`)

    // Calculate weighted total
    const totalScore = (
      productionValue * 0.4 +
      diversification * 0.25 +
      expansionPotential * 0.2 +
      portScore * 0.1 +
      blockingValue * 0.05
    )

    const score: PositionScore = {
      productionValue,
      diversification,
      expansionPotential,
      portAccess: portScore,
      blockingValue,
      totalScore,
      breakdown
    }

    this.positionScoreCache.set(cacheKey, score)
    return score
  }

  /**
   * Score a city upgrade opportunity
   */
  scoreCityUpgrade(vertexId: string, playerId: PlayerId): PositionScore {
    const baseScore = this.scoreSettlementPosition(vertexId, playerId)
    
    // City doubles production, so increase production value
    const upgradedScore: PositionScore = {
      ...baseScore,
      productionValue: Math.min(100, baseScore.productionValue * 1.8), // Cities are very valuable
      totalScore: baseScore.totalScore * 1.5, // Significant upgrade bonus
      breakdown: [
        ...baseScore.breakdown,
        'City Upgrade: +80% production value, +50% total score'
      ]
    }

    return upgradedScore
  }

  /**
   * Evaluate port accessibility for a vertex
   */
  evaluatePortAccess(vertexId: string): PortAccessibility {
    const vertex = this.board.vertices.get(vertexId)
    if (!vertex?.port) {
      return {
        hasPort: false,
        portType: null,
        resourceType: 'brick', // placeholder
        tradeEfficiency: 1.0
      }
    }

    const portType = vertex.port.type === 'generic' ? '3:1' : '2:1'
    const resourceType = vertex.port.type === 'generic' ? 'any' : vertex.port.type
    const tradeEfficiency = portType === '2:1' ? 2.0 : 1.33

    return {
      hasPort: true,
      portType,
      resourceType,
      tradeEfficiency
    }
  }

  // ============= Network & Expansion Analysis =============

  /**
   * Find expansion opportunities for a player
   */
  findExpansionOpportunities(playerId: PlayerId): ExpansionPath[] {
    const playerRoads = getPlayerRoadNetwork(this.state, playerId)
    const possibleSettlements = getPossibleSettlementPositions(this.state, playerId)
    const expansionPaths: ExpansionPath[] = []

    for (const targetVertex of possibleSettlements) {
      // Find shortest path from existing network to target
      const path = this.findShortestRoadPath(playerRoads, targetVertex)
      if (path) {
        const score = this.scoreSettlementPosition(targetVertex, playerId)
        expansionPaths.push({
          fromVertex: path.from,
          toVertex: targetVertex,
          requiredRoads: path.roads,
          cost: path.roads.length,
          value: score.totalScore
        })
      }
    }

    return expansionPaths.sort((a, b) => b.value / b.cost - a.value / a.cost) // Sort by value/cost ratio
  }

  /**
   * Calculate longest road potential
   */
  calculateLongestRoadPotential(playerId: PlayerId): RoadPotential {
    const currentLength = calculateLongestRoad(this.state, playerId)
    const playerRoads = getPlayerRoadNetwork(this.state, playerId)
    const possibleRoads = getPossibleRoadPositions(this.state, playerId)
    
    // Simulate adding all possible roads to find maximum potential
    const maxPossibleLength = currentLength + possibleRoads.length // Simplified calculation

    // Find bottlenecks (vertices that could cut off expansion)
    const bottlenecks = this.findRoadBottlenecks(playerId)

    // Find expansion paths
    const expansionPaths = this.findExpansionOpportunities(playerId)

    return {
      currentLength,
      maxPossibleLength,
      bottlenecks,
      expansionPaths
    }
  }

  /**
   * Analyze blocking opportunities against opponents
   */
  analyzeBlockingOpportunities(): BlockingMove[] {
    const blockingMoves: BlockingMove[] = []
    
    for (const [opponentId] of this.state.players) {
      if (opponentId === this.state.currentPlayer) continue

      const opponentExpansions = this.findExpansionOpportunities(opponentId)
      
      for (const expansion of opponentExpansions.slice(0, 3)) { // Top 3 opponent moves
        const strategicValue = expansion.value
        const urgency = this.calculateMoveUrgency(expansion, opponentId)

        blockingMoves.push({
          vertexId: expansion.toVertex,
          targetPlayer: opponentId,
          strategicValue,
          urgency
        })
      }
    }

    return blockingMoves.sort((a, b) => b.strategicValue * b.urgency - a.strategicValue * a.urgency)
  }

  // ============= Game State Assessment =============

  /**
   * Assess overall player position
   */
  assessPlayerPosition(playerId: PlayerId): PlayerAssessment {
    const player = this.state.players.get(playerId)
    if (!player) throw new Error(`Player ${playerId} not found`)

    // Calculate total production
    const settlements = Array.from(this.board.vertices.values())
      .filter(v => v.building?.owner === playerId)
    
    let totalProduction = 0
    const resourceBalance: Record<ResourceType, number> = {
      brick: 0, wood: 0, ore: 0, wheat: 0, sheep: 0
    }

    for (const settlement of settlements) {
      const production = this.calculateExpectedProduction(settlement.id)
      const multiplier = settlement.building?.type === 'city' ? 2 : 1
      
      for (const [resource, amount] of Object.entries(production)) {
        const adjustedAmount = amount * multiplier
        totalProduction += adjustedAmount
        resourceBalance[resource as ResourceType] += adjustedAmount
      }
    }

    const longestRoadLength = calculateLongestRoad(this.state, playerId)
    const expansionOptions = getPossibleSettlementPositions(this.state, playerId).length

    // Calculate trading position based on port access
    const playerPorts = settlements.filter(s => {
      const vertex = this.board.vertices.get(s.id)
      return vertex?.port
    })
    const tradingPosition = playerPorts.length * 25 + (totalProduction > 8 ? 25 : 0) // More production = better trading

    // Calculate threat level
    const victoryPoints = player.score.total
    const threatLevel = Math.min(100, (victoryPoints / 10) * 100 + longestRoadLength * 5)

    return {
      playerId,
      totalProduction,
      resourceBalance,
      longestRoadLength,
      expansionOptions,
      tradingPosition,
      threatLevel
    }
  }

  /**
   * Identify threats from other players
   */
  identifyThreats(playerId: PlayerId): ThreatAnalysis[] {
    const threats: ThreatAnalysis[] = []

    for (const [opponentId] of this.state.players) {
      if (opponentId === playerId) continue

      const assessment = this.assessPlayerPosition(opponentId)
      
      // Longest road threat
      if (assessment.longestRoadLength >= 8) {
        threats.push({
          type: 'longest_road',
          player: opponentId,
          severity: Math.min(100, assessment.longestRoadLength * 10),
          counterMeasures: ['Block road expansion', 'Build competing road network']
        })
      }

      // Victory point threat
      if (assessment.threatLevel > 70) {
        threats.push({
          type: 'victory_points',
          player: opponentId,
          severity: assessment.threatLevel,
          counterMeasures: ['Block key settlements', 'Limit resource access']
        })
      }

      // Resource monopoly threat
      const dominantResource = Object.entries(assessment.resourceBalance)
        .sort(([,a], [,b]) => b - a)[0]
      
      if (dominantResource[1] > 4) {
        threats.push({
          type: 'resource_monopoly',
          player: opponentId,
          severity: Math.min(100, dominantResource[1] * 15),
          counterMeasures: [`Block ${dominantResource[0]} production`, 'Trade away excess resources']
        })
      }
    }

    return threats.sort((a, b) => b.severity - a.severity)
  }

  /**
   * Find trading opportunities
   */
  findTradingOpportunities(playerId: PlayerId): TradeOpportunity[] {
    const player = this.state.players.get(playerId)
    if (!player) return []

    const opportunities: TradeOpportunity[] = []
    const currentResources = player.resources
    const resourceNeeds = this.calculateResourceNeeds(playerId)

    // Find bank trades (4:1 or with ports)
    for (const [resource, amount] of Object.entries(currentResources)) {
      if (amount >= 4 && resourceNeeds[resource as ResourceType] < 2) {
        // Find what we need most
        const mostNeeded = Object.entries(resourceNeeds)
          .sort(([,a], [,b]) => b - a)[0]

        if (mostNeeded[1] > 0) {
          opportunities.push({
            giveResources: { [resource]: 4 } as any,
            receiveResources: { [mostNeeded[0]]: 1 } as any,
            tradePartner: 'bank',
            efficiency: 60, // 4:1 is not great but sometimes necessary
            urgency: mostNeeded[1] * 20
          })
        }
      }
    }

    return opportunities.sort((a, b) => b.efficiency * b.urgency - a.efficiency * a.urgency)
  }

  // ============= Helper Methods =============

  private getResourceTypeFromHex(hexType: string): ResourceType {
    switch (hexType) {
      case 'hills': return 'brick'
      case 'forest': return 'wood'
      case 'mountains': return 'ore'
      case 'fields': return 'wheat'
      case 'pasture': return 'sheep'
      default: return 'brick' // fallback
    }
  }

  private calculateBlockingValue(vertexId: string, playerId: PlayerId): number {
    let blockingValue = 0

    // Check how many opponents this position would hurt
    for (const [opponentId] of this.state.players) {
      if (opponentId === playerId) continue

      const opponentExpansions = this.findExpansionOpportunities(opponentId)
      const blocksOpponent = opponentExpansions.some(exp => exp.toVertex === vertexId)
      
      if (blocksOpponent) {
        blockingValue += 30 // Each opponent blocked adds value
      }
    }

    return Math.min(100, blockingValue)
  }

  private findShortestRoadPath(playerRoads: Set<string>, targetVertex: string): {from: string, roads: string[]} | null {
    // Simplified pathfinding - in a real implementation, use A* or Dijkstra
    // For now, return a basic path if any road is adjacent to target
    const targetEdges = getVertexEdges(this.board, targetVertex)
    
    for (const edgeId of targetEdges) {
      if (playerRoads.has(edgeId)) {
        const vertices = getEdgeVertices(this.board, edgeId)
        const fromVertex = vertices.find(v => v !== targetVertex)
        return {
          from: fromVertex || targetVertex,
          roads: [] // Already connected
        }
      }
    }

    return null // No path found (simplified)
  }

  private findRoadBottlenecks(playerId: PlayerId): string[] {
    // Find vertices that, if blocked, would significantly limit road expansion
    const bottlenecks: string[] = []
    const playerRoads = getPlayerRoadNetwork(this.state, playerId)
    
    // This would need graph analysis to find cut vertices
    // For now, return empty array - this is a complex algorithm
    return bottlenecks
  }

  private calculateMoveUrgency(expansion: ExpansionPath, playerId: PlayerId): number {
    const player = this.state.players.get(playerId)
    if (!player) return 0

    // Higher urgency if player has resources to build soon
    const hasResources = player.resources.brick >= 1 && 
                        player.resources.wood >= 1 && 
                        player.resources.wheat >= 1 && 
                        player.resources.sheep >= 1

    return hasResources ? 1.0 : 0.5
  }

  calculateResourceNeeds(playerId: PlayerId): Record<ResourceType, number> {
    // Calculate what resources the player needs for their likely next moves
    const needs: Record<ResourceType, number> = {
      brick: 0, wood: 0, ore: 0, wheat: 0, sheep: 0
    }

    const player = this.state.players.get(playerId)
    if (!player) return needs

    // If we can build settlements, we need settlement resources
    const canBuildSettlement = getPossibleSettlementPositions(this.state, playerId).length > 0
    if (canBuildSettlement) {
      needs.brick += 1
      needs.wood += 1
      needs.wheat += 1
      needs.sheep += 1
    }

    // If we have settlements, we might want cities
    const settlements = Array.from(this.board.vertices.values())
      .filter(v => v.building?.owner === playerId && v.building?.type === 'settlement')
    
    if (settlements.length > 0) {
      needs.ore += 3
      needs.wheat += 2
    }

    return needs
  }

  /**
   * Clear all caches (call when game state changes significantly)
   */
  clearCaches(): void {
    this.resourceValueCache.clear()
    this.positionScoreCache.clear()
  }
}

// ============= Utility Functions =============

/**
 * Create a BoardAnalyzer instance for the given game state
 */
export function createBoardAnalyzer(gameState: GameState): BoardAnalyzer {
  return new BoardAnalyzer(gameState)
}

/**
 * Quick position comparison for sorting settlement options
 */
export function comparePositions(
  analyzer: BoardAnalyzer,
  vertexA: string,
  vertexB: string,
  playerId: PlayerId
): number {
  const scoreA = analyzer.scoreSettlementPosition(vertexA, playerId)
  const scoreB = analyzer.scoreSettlementPosition(vertexB, playerId)
  return scoreB.totalScore - scoreA.totalScore
} 