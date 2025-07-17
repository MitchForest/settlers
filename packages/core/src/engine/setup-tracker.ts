import { GameState, PlayerId, VertexPosition, EdgePosition } from '../types'

/**
 * Setup Phase Tracker
 * 
 * Handles the complexities of Settlers setup phase including:
 * - Tracking placement order (setup1 vs setup2)
 * - Managing reverse turn order in setup2  
 * - Ensuring roads connect to correct settlements
 * - Tracking resource collection from setup2 settlements
 */

export interface SetupPlacement {
  playerId: PlayerId
  settlementVertex: string
  roadEdge?: string
  turn: number
  round: 1 | 2
  placementIndex: number // Order within the round
}

export class SetupTracker {
  private placements: SetupPlacement[] = []
  private currentRound: 1 | 2 = 1
  private turnOrder: PlayerId[] = []
  private currentPlayerIndex = 0

  constructor(turnOrder: PlayerId[]) {
    this.turnOrder = [...turnOrder]
  }

  /**
   * Get the current player who should be placing
   */
  getCurrentPlayer(): PlayerId {
    if (this.currentRound === 1) {
      return this.turnOrder[this.currentPlayerIndex]
    } else {
      // Round 2 goes in reverse order
      const reverseIndex = this.turnOrder.length - 1 - this.currentPlayerIndex
      return this.turnOrder[reverseIndex]
    }
  }

  /**
   * Record a settlement placement
   */
  placeSettlement(playerId: PlayerId, vertexId: string): void {
    if (this.getCurrentPlayer() !== playerId) {
      throw new Error(`Not ${playerId}'s turn to place`)
    }

    const placement: SetupPlacement = {
      playerId,
      settlementVertex: vertexId,
      turn: this.currentPlayerIndex,
      round: this.currentRound,
      placementIndex: this.placements.length
    }

    this.placements.push(placement)
  }

  /**
   * Record a road placement (must be after settlement)
   */
  placeRoad(playerId: PlayerId, edgeId: string): void {
    const lastPlacement = this.placements[this.placements.length - 1]
    
    if (!lastPlacement || lastPlacement.playerId !== playerId || lastPlacement.roadEdge) {
      throw new Error('Invalid road placement - must follow settlement by same player')
    }

    lastPlacement.roadEdge = edgeId
    this.advanceTurn()
  }

  /**
   * Get the settlement that a road must connect to for the current player
   */
  getRequiredSettlementForRoad(playerId: PlayerId): string | null {
    const lastPlacement = this.placements[this.placements.length - 1]
    
    if (!lastPlacement || 
        lastPlacement.playerId !== playerId || 
        lastPlacement.roadEdge) {
      return null
    }

    return lastPlacement.settlementVertex
  }

  /**
   * Check if a road placement is valid for setup phase
   */
  isValidSetupRoad(state: GameState, playerId: PlayerId, edgeId: string): boolean {
    const requiredSettlement = this.getRequiredSettlementForRoad(playerId)
    if (!requiredSettlement) return false

    // Use the adjacency helper to check connection
    const edge = state.board.edges.get(edgeId)
    if (!edge) return false

    // Find vertices connected to this edge
    const connectedVertices: string[] = []
    state.board.vertices.forEach((vertex, vertexId) => {
      // Check if vertex shares 2 hexes with the edge
      const sharedHexes = edge.position.hexes.filter(hexA =>
        vertex.position.hexes.some(hexB =>
          hexA.q === hexB.q && hexA.r === hexB.r && hexA.s === hexB.s
        )
      )
      
      if (sharedHexes.length === 2) {
        connectedVertices.push(vertexId)
      }
    })

    return connectedVertices.includes(requiredSettlement)
  }

  /**
   * Advance to next player/round
   */
  private advanceTurn(): void {
    this.currentPlayerIndex++
    
    if (this.currentPlayerIndex >= this.turnOrder.length) {
      // End of round
      this.currentPlayerIndex = 0
      
      if (this.currentRound === 1) {
        this.currentRound = 2
      } else {
        // Setup complete
        this.currentRound = 2 // Stay at 2 to indicate completion
      }
    }
  }

  /**
   * Check if setup phase is complete
   */
  isSetupComplete(): boolean {
    const expectedPlacements = this.turnOrder.length * 2
    const completePlacements = this.placements.filter(p => p.roadEdge).length
    return completePlacements >= expectedPlacements
  }

  /**
   * Get placements for a specific player
   */
  getPlayerPlacements(playerId: PlayerId): SetupPlacement[] {
    return this.placements.filter(p => p.playerId === playerId)
  }

  /**
   * Get all settlements that should collect resources in setup2
   * (Only second settlements collect resources)
   */
  getSetup2ResourceCollectors(): Array<{playerId: PlayerId, vertexId: string}> {
    return this.placements
      .filter(p => p.round === 2 && p.roadEdge) // Only completed setup2 placements
      .map(p => ({
        playerId: p.playerId,
        vertexId: p.settlementVertex
      }))
  }

  /**
   * Get current phase name
   */
  getCurrentPhase(): 'setup1' | 'setup2' | 'completed' {
    if (this.isSetupComplete()) return 'completed'
    return this.currentRound === 1 ? 'setup1' : 'setup2'
  }

  /**
   * Get remaining placements needed
   */
  getRemainingPlacements(): Array<{playerId: PlayerId, needsSettlement: boolean, needsRoad: boolean}> {
    const remaining: Array<{playerId: PlayerId, needsSettlement: boolean, needsRoad: boolean}> = []
    
    for (const playerId of this.turnOrder) {
      const playerPlacements = this.getPlayerPlacements(playerId)
      
      // Round 1
      const round1Settlement = playerPlacements.find(p => p.round === 1)
      if (!round1Settlement) {
        remaining.push({playerId, needsSettlement: true, needsRoad: false})
      } else if (!round1Settlement.roadEdge) {
        remaining.push({playerId, needsSettlement: false, needsRoad: true})
      }
      
      // Round 2  
      const round2Settlement = playerPlacements.find(p => p.round === 2)
      if (!round2Settlement && round1Settlement?.roadEdge) {
        remaining.push({playerId, needsSettlement: true, needsRoad: false})
      } else if (round2Settlement && !round2Settlement.roadEdge) {
        remaining.push({playerId, needsSettlement: false, needsRoad: true})
      }
    }
    
    return remaining
  }

  /**
   * Export setup state for persistence
   */
  exportState() {
    return {
      placements: this.placements,
      currentRound: this.currentRound,
      turnOrder: this.turnOrder,
      currentPlayerIndex: this.currentPlayerIndex
    }
  }

  /**
   * Import setup state from persistence
   */
  importState(state: ReturnType<SetupTracker['exportState']>): void {
    this.placements = state.placements
    this.currentRound = state.currentRound
    this.turnOrder = state.turnOrder
    this.currentPlayerIndex = state.currentPlayerIndex
  }
} 