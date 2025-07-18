import {
  GameState,
  GameAction,
  Player,
  PlayerId,
  ResourceType,
  HexCoordinate,
  Vertex,
  Edge,
  ResourceCards
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

interface VertexProductionData {
  production: ResourceCards
  totalExpected: number
  resourceTypes: number
}

/**
 * AGGRESSIVE Initial Placement AI - Optimized for wins in <30 rounds
 * Focus: 6/8 spots, ore/wheat for cities, strategic ports
 */
export class InitialPlacementAI {
  private state: GameState
  private playerId: PlayerId
  private analyzer: BoardAnalyzer
  private difficulty: 'easy' | 'medium' | 'hard'
  private personality: 'aggressive' | 'balanced' | 'defensive' | 'economic'
  
  // Performance caches
  private vertexProductionCache = new Map<string, VertexProductionData>()
  private vertexScoreCache = new Map<string, number>()

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
   * FAST first settlement selection - optimized for <50ms
   */
  selectFirstSettlement(): GameAction {
    const validVertices = getPossibleSettlementPositions(this.state, this.playerId)
    
    // PERFORMANCE: Pre-compute production for all vertices in one pass
    this.precomputeVertexProduction(validVertices)
    
    let bestVertex = validVertices[0]
    let bestScore = -1
    
    // PERFORMANCE: Simple scoring loop with early termination
    for (const vertexId of validVertices) {
      const score = this.fastScoreVertex(vertexId, 'first')
      
      if (score > bestScore) {
        bestScore = score
        bestVertex = vertexId
        
        // PERFORMANCE: Early termination for excellent positions
        if (score > 85 && this.difficulty !== 'hard') break
      }
    }
    
    return {
      type: 'placeBuilding',
      playerId: this.playerId,
      data: { buildingType: 'settlement', vertexId: bestVertex }
    }
  }

  /**
   * FAST second settlement selection
   */
  selectSecondSettlement(firstVertexId: string): GameAction {
    const validVertices = getPossibleSettlementPositions(this.state, this.playerId)
    
    // PERFORMANCE: Pre-compute production for all vertices in one pass
    this.precomputeVertexProduction(validVertices)
    
    const firstProduction = this.getVertexProduction(firstVertexId)
    
    let bestVertex = validVertices[0]
    let bestScore = -1
    
    for (const vertexId of validVertices) {
      const score = this.fastScoreSecondVertex(vertexId, firstProduction)
      
      if (score > bestScore) {
        bestScore = score
        bestVertex = vertexId
        
        // Early termination
        if (score > 90 && this.difficulty !== 'hard') break
      }
    }
    
    return {
      type: 'placeBuilding',
      playerId: this.playerId,
      data: { buildingType: 'settlement', vertexId: bestVertex }
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

  // ============= AGGRESSIVE FAST-WIN SCORING =============

  /**
   * AGGRESSIVE Initial Placement - Win in <30 rounds
   * Focus on 6/8 spots and ore/wheat for cities
   */
  private fastScoreVertex(vertexId: string, phase: 'first' | 'second'): number {
    if (this.vertexScoreCache.has(vertexId)) {
      return this.vertexScoreCache.get(vertexId)!
    }
    
    const data = this.getVertexProduction(vertexId)
    let score = 0
    
    // 1. PRIORITIZE HIGH NUMBERS (6,8 are game-winners)
    const vertex = this.state.board.vertices.get(vertexId)
    if (vertex) {
      let highNumberBonus = 0
      for (const hexCoord of vertex.position.hexes) {
        const hexId = `${hexCoord.q},${hexCoord.r},${hexCoord.s}`
        const hex = this.state.board.hexes.get(hexId)
        
        if (hex?.numberToken && hex.terrain !== 'desert') {
          if (hex.numberToken === 6 || hex.numberToken === 8) {
            highNumberBonus += 30 // HUGE bonus for 6/8
            
            // SUPER BONUS for ore/wheat on 6/8 (fastest path to victory)
            if (hex.terrain === 'mountains' || hex.terrain === 'fields') {
              highNumberBonus += 25
            }
          } else if (hex.numberToken === 5 || hex.numberToken === 9) {
            highNumberBonus += 15 // Good bonus for 5/9
          }
        }
      }
      score += highNumberBonus
    }
    
    // 2. PRIORITIZE ORE/WHEAT FOR CITIES (fastest VP path)
    const oreWheatBonus = (data.production.ore + data.production.wheat) * 20
    score += oreWheatBonus
    
    // 3. TOTAL PRODUCTION (reduced weight vs old system)
    score += data.totalExpected * 15
    
    // 4. CRITICAL DIVERSITY (must have sheep/wood for settlements!)
    const hasWood = data.production.wood > 0
    const hasBrick = data.production.brick > 0  
    const hasWheat = data.production.wheat > 0
    const hasSheep = data.production.sheep > 0
    const hasOre = data.production.ore > 0
    
    // HUGE penalty if missing sheep or wood (can't build settlements)
    if (!hasSheep) score -= 30
    if (!hasWood) score -= 30
    
    // Reward having settlement essentials
    if (hasWood && hasBrick && hasWheat && hasSheep) {
      score += 40 // Can build settlements
    }
    
    // Reward having city essentials (wheat + ore)  
    if (hasWheat && hasOre) {
      score += 20 // Can upgrade to cities
    }
    
    // 5. WOOD/BRICK PRESENCE (for initial expansion)
    const hasWoodBrick = (data.production.wood > 0 ? 8 : 0) + 
                        (data.production.brick > 0 ? 8 : 0)
    score += hasWoodBrick
    
    // 6. AGGRESSIVE PORT BONUS
    score += this.getAggressivePortBonus(vertexId, data)
    
    this.vertexScoreCache.set(vertexId, score)
    return score
  }

  /**
   * Second settlement - complement first for fast victory
   */
  private fastScoreSecondVertex(vertexId: string, firstProduction: VertexProductionData): number {
    const secondData = this.getVertexProduction(vertexId)
    let score = 0
    
    // 1. CRITICAL: Must get sheep/wood if missing (can't build settlements without them!)
    if (firstProduction.production.sheep === 0 && secondData.production.sheep > 0) {
      score += 50 // ESSENTIAL for settlements
    }
    if (firstProduction.production.wood === 0 && secondData.production.wood > 0) {
      score += 50 // ESSENTIAL for settlements and roads
    }
    
    // 2. Important: Get ore/wheat for cities (but not at expense of basics)
    if (firstProduction.production.ore === 0 && secondData.production.ore > 0) {
      score += 35 // Important for cities
    }
    if (firstProduction.production.wheat === 0 && secondData.production.wheat > 0) {
      score += 35 // Important for settlements and cities
    }
    
    // 3. Get brick if missing (for settlements and roads)
    if (firstProduction.production.brick === 0 && secondData.production.brick > 0) {
      score += 30
    }
    
    // 3. High number bonus (same as first)
    score += this.getHighNumberBonus(vertexId)
    
    // 4. Total production
    score += secondData.totalExpected * 15
    
    // 5. Ore/wheat bonus (still important for second)
    score += (secondData.production.ore + secondData.production.wheat) * 15
    
    // 6. Port bonus
    score += this.getAggressivePortBonus(vertexId, secondData)
    
    return score
  }

  /**
   * Get bonus for high probability numbers
   */
  private getHighNumberBonus(vertexId: string): number {
    const vertex = this.state.board.vertices.get(vertexId)
    if (!vertex) return 0
    
    let bonus = 0
    for (const hexCoord of vertex.position.hexes) {
      const hexId = `${hexCoord.q},${hexCoord.r},${hexCoord.s}`
      const hex = this.state.board.hexes.get(hexId)
      
      if (hex?.numberToken && hex.terrain !== 'desert') {
        if (hex.numberToken === 6 || hex.numberToken === 8) {
          bonus += 30
          // SUPER BONUS for ore/wheat on 6/8
          if (hex.terrain === 'mountains' || hex.terrain === 'fields') {
            bonus += 20
          }
        } else if (hex.numberToken === 5 || hex.numberToken === 9) {
          bonus += 15
        }
      }
    }
    return bonus
  }

  /**
   * Aggressive port scoring - only value if we produce that resource
   */
  private getAggressivePortBonus(vertexId: string, production: VertexProductionData): number {
    const vertex = this.state.board.vertices.get(vertexId)
    if (!vertex?.port) return 0
    
    if (vertex.port.type === 'generic') {
      return 10 // 3:1 is decent
    }
    
    // 2:1 port - only valuable if we produce that resource heavily
    const portResource = vertex.port.type as ResourceType
    if (production.production[portResource] >= 4) {
      return 50 // HUGE bonus - this is game-winning
    } else if (production.production[portResource] >= 2) {
      return 25 // Still good
    }
    
    return 0 // Port for resource we don't produce = useless
  }

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
        const adjData = this.getVertexProduction(adjVertex)
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

  /**
   * Pre-compute vertex production for all candidates in one pass
   */
  private precomputeVertexProduction(vertices: string[]): void {
    if (this.vertexProductionCache.size > 0) return // Already computed
    
    for (const vertexId of vertices) {
      const vertex = this.state.board.vertices.get(vertexId)
      if (!vertex) continue
      
      const production = { wood: 0, brick: 0, ore: 0, wheat: 0, sheep: 0 }
      let totalExpected = 0
      let resourceTypes = 0
      
      for (const hexCoord of vertex.position.hexes) {
        const hexId = `${hexCoord.q},${hexCoord.r},${hexCoord.s}`
        const hex = this.state.board.hexes.get(hexId)
        
        if (hex?.terrain && hex.terrain !== 'desert' && hex.numberToken) {
          const prob = NUMBER_PROBABILITIES[hex.numberToken] || 0
          const resourceType = this.getResourceForTerrain(hex.terrain)
          
          if (resourceType) {
            production[resourceType] += prob
            totalExpected += prob
          }
        }
      }
      
      resourceTypes = Object.values(production).filter(v => v > 0).length
      
      this.vertexProductionCache.set(vertexId, {
        production,
        totalExpected,
        resourceTypes
      })
    }
  }

  /**
   * Get production data for a vertex (from cache if available)
   */
  private getVertexProduction(vertexId: string): VertexProductionData {
    if (this.vertexProductionCache.has(vertexId)) {
      return this.vertexProductionCache.get(vertexId)!
    }
    
    // Compute on demand if not cached
    this.precomputeVertexProduction([vertexId])
    
    // Safety check - return default if still not found
    if (!this.vertexProductionCache.has(vertexId)) {
      return {
        production: { wood: 0, brick: 0, ore: 0, wheat: 0, sheep: 0 },
        totalExpected: 0,
        resourceTypes: 0
      }
    }
    
    return this.vertexProductionCache.get(vertexId)!
  }

  /**
   * Map terrain to resource type
   */
  private getResourceForTerrain(terrain: string): ResourceType | null {
    switch (terrain) {
      case 'forest': return 'wood'
      case 'hills': return 'brick'
      case 'mountains': return 'ore'
      case 'fields': return 'wheat'
      case 'pasture': return 'sheep'
      default: return null
    }
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