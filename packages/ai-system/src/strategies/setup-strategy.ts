import { GameState, GamePhase, PlayerId, GameAction, getVertexEdges } from '@settlers/game-engine'
import { BasePhaseStrategy, ScoredAction } from '../types/ai-interfaces'
import { createInitialPlacementAI } from '../initial-placement'

export class SetupPhaseStrategy extends BasePhaseStrategy {
  phase: GamePhase
  
  constructor(private _setupRound: 1 | 2) {
    super()
    this.phase = (this._setupRound === 1 ? 'setup1' : 'setup2') as GamePhase
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
    const expectedSettlements = this._setupRound === 1 ? 1 : 2
    const expectedRoads = this._setupRound === 1 ? 1 : 2

    // Determine what to place next
    if (settlements < expectedSettlements) {
      // Need to place settlement
      const placementAI = createInitialPlacementAI(state, playerId, 'hard', 'balanced')
      
      if (this._setupRound === 1) {
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