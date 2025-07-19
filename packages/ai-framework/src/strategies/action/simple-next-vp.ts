import { GameState, GameAction, PlayerId, getPossibleSettlementPositions, getPossibleRoadPositions } from '@settlers/game-engine'
import { 
  getGamePhase, 
  checkForStuckState, 
  recoverFromStuck,
  getOptimalBuild,
  findNewExpansionPaths,
  getCurrentResources,
  canBuild
} from '../../helpers'
import { scoreVertices } from '../../helpers/vertex-scoring'
import { generateTradeOffer, evaluateTradeOffer } from '../../modules/trading-strategy'

/**
 * Simple Next VP Strategy - Uses our helper modules for intelligent decisions
 * 
 * Improved phase-based strategy:
 * - EXPANSION (0-2 VP): Focus on roads and settlements systematically
 * - GROWTH (3-5 VP): Balance settlements and cities  
 * - ACCELERATION (6-8 VP): Cities and dev cards
 * - VICTORY (9+ VP): Race to 10 points
 */
export class SimpleNextVPStrategy {
  
  selectBestAction(gameState: GameState, playerId: PlayerId): GameAction | null {
    console.log(`🤔 SimpleNextVP deciding for ${playerId}`)
    
    // 1. Determine current phase and goals
    const phaseInfo = getGamePhase(gameState, playerId)
    console.log(`📋 Phase: ${phaseInfo.phase} (${phaseInfo.victoryPoints} VP) - Goal: ${phaseInfo.primaryGoal}`)
    
    // 1. Check for beneficial trade offers to accept (highest priority)
    const acceptTradeAction = this.tryAcceptTradeOffers(gameState, playerId)
    if (acceptTradeAction) {
      console.log(`🤝 Accepting beneficial trade`)
      return acceptTradeAction
    }
    
    // 2. Check for immediate settlement opportunities (high priority)
    const settlementAction = this.tryBuildSettlement(gameState, playerId)
    if (settlementAction) {
      console.log(`🏠 Building settlement immediately`)
      return settlementAction
    }
    
    // 3. Check for road building toward settlements (second priority)  
    const roadAction = this.tryBuildExpansionRoad(gameState, playerId)
    if (roadAction) {
      console.log(`🛣️ Building expansion road`)
      return roadAction
    }
    
    // 4. Try trading if we're close to a goal but missing resources
    const tradeAction = this.tryTrading(gameState, playerId)
    if (tradeAction) {
      console.log(`💱 Attempting trade: ${tradeAction.type}`)
      return tradeAction
    }
    
    // 5. If we can't expand, try other phase-specific actions
    const phaseAction = this.selectPhaseSpecificAction(gameState, playerId, phaseInfo.phase)
    if (phaseAction) {
      console.log(`📈 Phase action: ${phaseAction.type}`)
      return phaseAction
    }
    
    // 6. Check if actually stuck and need fallback
    const stuckState = this.checkIfReallyStuck(gameState, playerId)
    if (stuckState.isStuck) {
      console.log(`🔄 Player stuck: ${stuckState.reason} - attempting recovery`)
      const recovery = recoverFromStuck(gameState, playerId)
      return this.convertToGameAction(gameState, recovery, playerId)
    }
    
    // 6. Fallback: end turn if nothing else to do
    console.log(`⏭️ No actions available - ending turn`)
    return { type: 'endTurn', playerId, data: {} }
  }
  
  /**
   * Try to build a settlement if we have resources and a good location
   */
  private tryBuildSettlement(gameState: GameState, playerId: PlayerId): GameAction | null {
    if (!canBuild(gameState, playerId, 'settlement')) {
      return null
    }
    
    const possibleSettlements = getPossibleSettlementPositions(gameState, playerId)
    if (possibleSettlements.length === 0) {
      return null
    }
    
    // Use vertex scoring to pick best settlement location
    const scores = scoreVertices(gameState, playerId, [], {
      pips: 1.0,
      hexCount: 1.5,
      scarcity: 0.5,
      diversity: 1.0,
      recipes: 0.5,
      ports: 0.0 // TODO: Enable when ports are implemented
    })
    
    if (scores.length > 0) {
      return {
        type: 'placeBuilding',
        playerId,
        data: { buildingType: 'settlement', vertexId: scores[0].vertexId }
      }
    }
    
    return null
  }
  
  /**
   * Try to build a road that helps us reach good settlement locations
   */
  private tryBuildExpansionRoad(gameState: GameState, playerId: PlayerId): GameAction | null {
    if (!canBuild(gameState, playerId, 'road')) {
      return null
    }
    
    const possibleRoads = getPossibleRoadPositions(gameState, playerId)
    if (possibleRoads.length === 0) {
      return null
    }
    
    // Check if we should save resources for settlement instead
    const resources = getCurrentResources(gameState, playerId)
    const settlementProgress = this.calculateSettlementProgress(resources)
    
    // If we're close to affording a settlement, don't spend on roads
    if (settlementProgress.deficit <= 1 && possibleRoads.length < 3) {
      console.log(`💰 Saving for settlement (need ${settlementProgress.deficit} more resources)`)
      return null
    }
    
    // Look for roads that lead toward good settlement spots
    const expansionPaths = findNewExpansionPaths(gameState, playerId)
    const buildingPaths = expansionPaths.filter(path => path.status === 'BUILDING')
    
    if (buildingPaths.length > 0) {
      // Find the best path and see if any possible roads help us reach it
      const bestPath = buildingPaths[0] // For now, just take the first
      
      // Simple heuristic: build any road that might help expansion
      // TODO: Improve this with actual pathfinding
      return {
        type: 'placeRoad',
        playerId,
        data: { edgeId: possibleRoads[0] }
      }
    }
    
    // If no building paths, create new expansion opportunities
    if (possibleRoads.length > 0) {
      return {
        type: 'placeRoad',
        playerId,
        data: { edgeId: possibleRoads[0] }
      }
    }
    
    return null
  }
  
  /**
   * Try trading to get resources we need for our goals
   */
  private tryTrading(gameState: GameState, playerId: PlayerId): GameAction | null {
    const resources = getCurrentResources(gameState, playerId)
    console.log(`💱 Trading check: ${JSON.stringify(resources)}`)
    
    // Try smart trading: targeted player trades first, then bank trades
    const tradeOffer = generateTradeOffer(gameState, playerId)
    console.log(`💱 Trade offer result:`, tradeOffer)
    
    if (tradeOffer) {
      console.log(`💰 ${tradeOffer.reasoning}`)
      
      if (tradeOffer.type === 'player') {
        return {
          type: 'createTradeOffer',
          playerId,
          data: {
            offering: tradeOffer.offering,
            requesting: tradeOffer.requesting,
            targetPlayerId: tradeOffer.targetPlayerId,
            expiresAfterTurns: 2 // Short expiration for AI trades
          }
        }
      } else if (tradeOffer.type === 'bank') {
        return {
          type: 'bankTrade',
          playerId,
          data: {
            offering: tradeOffer.offering,
            requesting: tradeOffer.requesting
          }
        }
      } else if (tradeOffer.type === 'port') {
        return {
          type: 'portTrade',
          playerId,
          data: {
            offering: tradeOffer.offering,
            requesting: tradeOffer.requesting,
            portType: tradeOffer.portType
          }
        }
      }
    }
    
    return null
  }
  
  /**
   * Check for incoming trade offers and evaluate them
   */
  private tryAcceptTradeOffers(gameState: GameState, playerId: PlayerId): GameAction | null {
    // Get all available trade offers in the game
    const tradeOffers = (gameState as any).tradeOffers || []
    
    for (const offer of tradeOffers) {
      // Skip our own offers
      if (offer.offeringPlayerId === playerId) continue
      
      // Skip expired offers
      const turnsPassed = gameState.turn - offer.createdTurn
      if (turnsPassed > offer.expiresAfterTurns) continue
      
      // Skip targeted offers not for us
      if (offer.targetPlayerId && offer.targetPlayerId !== playerId) continue
      
      // Evaluate the trade
      const evaluation = evaluateTradeOffer(gameState, playerId, {
        type: 'player',
        offering: offer.offering,
        requesting: offer.requesting,
        reasoning: 'Evaluating incoming offer'
      })
      
      if (evaluation.shouldAccept && evaluation.priority >= 8) {
        console.log(`💱 Accepting trade: ${evaluation.reasoning}`)
        return {
          type: 'acceptTrade',
          playerId,
          data: {
            tradeOfferId: offer.id
          }
        }
      }
    }
    
    return null
  }
  
  /**
   * Calculate how close we are to affording a settlement
   */
  private calculateSettlementProgress(resources: any): { deficit: number, needed: any } {
    const settlementCost = { wood: 1, brick: 1, sheep: 1, wheat: 1 }
    const needed = {
      wood: Math.max(0, settlementCost.wood - (resources.wood || 0)),
      brick: Math.max(0, settlementCost.brick - (resources.brick || 0)),
      sheep: Math.max(0, settlementCost.sheep - (resources.sheep || 0)),
      wheat: Math.max(0, settlementCost.wheat - (resources.wheat || 0))
    }
    const deficit = Object.values(needed).reduce((sum: number, n: number) => sum + n, 0)
    return { deficit, needed }
  }
  
  /**
   * More intelligent stuck detection - considers if player is working toward goals
   */
  private checkIfReallyStuck(gameState: GameState, playerId: PlayerId): { isStuck: boolean, reason: string } {
    const resources = getCurrentResources(gameState, playerId)
    const totalResources = Object.values(resources).reduce((sum, count) => sum + count, 0)
    
    // If player has resources and possible expansion, they're not stuck
    const possibleRoads = getPossibleRoadPositions(gameState, playerId)
    const possibleSettlements = getPossibleSettlementPositions(gameState, playerId)
    
    // Can build roads now
    if (canBuild(gameState, playerId, 'road') && possibleRoads.length > 0) {
      return { isStuck: false, reason: 'Can build roads for expansion' }
    }
    
    // Can build settlement now  
    if (canBuild(gameState, playerId, 'settlement') && possibleSettlements.length > 0) {
      return { isStuck: false, reason: 'Can build settlement' }
    }
    
    // Working toward settlement (need 1 wood, 1 brick, 1 sheep, 1 wheat)
    const settlementProgress = this.calculateSettlementProgress(resources)
    
    if (settlementProgress.deficit <= 2 && possibleSettlements.length > 0) {
      return { isStuck: false, reason: `Close to settlement (need ${settlementProgress.deficit} more resources)` }
    }
    
    // Working toward road (need 1 wood, 1 brick)  
    const roadNeeded = {
      wood: Math.max(0, 1 - (resources.wood || 0)),
      brick: Math.max(0, 1 - (resources.brick || 0))
    }
    const roadDeficit = Object.values(roadNeeded).reduce((sum, n) => sum + n, 0)
    
    if (roadDeficit <= 1 && possibleRoads.length > 0) {
      return { isStuck: false, reason: `Close to road (need ${roadDeficit} more resources)` }
    }
    
    // If we have a lot of resources but can't build expansion items, we might be stuck
    if (totalResources >= 5 && !canBuild(gameState, playerId, 'road') && !canBuild(gameState, playerId, 'settlement')) {
      return { isStuck: true, reason: 'Have resources but no expansion options' }
    }
    
    // Default fallback to original stuck detection
    const originalStuck = checkForStuckState(gameState, playerId)
    return { isStuck: originalStuck.isStuck, reason: originalStuck.reason }
  }

  /**
   * Phase-specific action selection - only after expansion is not viable
   */
  private selectPhaseSpecificAction(gameState: GameState, playerId: PlayerId, phase: string): GameAction | null {
    const resources = getCurrentResources(gameState, playerId)
    const totalResources = Object.values(resources).reduce((sum, count) => sum + count, 0)
    
    // Check if we're working toward a settlement - don't waste resources on dev cards
    const settlementProgress = this.calculateSettlementProgress(resources)
    const possibleSettlements = getPossibleSettlementPositions(gameState, playerId)
    
    // If we can build toward settlements, prioritize that over dev cards
    if (possibleSettlements.length > 0 && settlementProgress.deficit <= 3) {
      console.log(`🎯 Working toward settlement (${settlementProgress.deficit} resources needed), skipping dev cards`)
      return null
    }
    
    // Only consider non-expansion actions if we have lots of resources and can't expand
    if (totalResources >= 6) {
      const buildOption = getOptimalBuild(gameState, playerId, phase as any)
      
      if (buildOption && buildOption.canBuild) {
        switch (buildOption.type) {
          case 'city':
            return this.tryBuildCity(gameState, playerId)
          case 'developmentCard':
            // Only buy dev cards if we're not close to settlement expansion
            if (settlementProgress.deficit > 3 || possibleSettlements.length === 0) {
              return { type: 'buyCard', playerId, data: {} }
            }
        }
      }
    }
    
    return null
  }
  
  /**
   * Try to build a city
   */
  private tryBuildCity(gameState: GameState, playerId: PlayerId): GameAction | null {
    if (!canBuild(gameState, playerId, 'city')) {
      return null
    }
    
    // Find settlements to upgrade
    const playerSettlements: string[] = []
    for (const [vertexId, vertex] of gameState.board.vertices) {
      if (vertex.building?.owner === playerId && vertex.building.type === 'settlement') {
        playerSettlements.push(vertexId)
      }
    }
    
    if (playerSettlements.length > 0) {
      // For now, just upgrade the first settlement found
      return {
        type: 'placeBuilding',
        playerId,
        data: { buildingType: 'city', vertexId: playerSettlements[0] }
      }
    }
    
    return null
  }
  
  /**
   * Convert recovery action to GameAction format
   */
  private convertToGameAction(gameState: GameState, recovery: { type: string, data: any, reasoning: string }, playerId: PlayerId): GameAction | null {
    switch (recovery.type) {
      case 'buildRoad':
        // Fallback road building - find any available road
        const possibleRoads = getPossibleRoadPositions(gameState, playerId)
        if (possibleRoads.length > 0) {
          return {
            type: 'placeRoad',
            playerId,
            data: { edgeId: possibleRoads[0] }
          }
        }
        return null
        
             case 'buyDevelopmentCard':
         return {
           type: 'buyCard',
           playerId,
           data: {}
         }
        
      case 'endTurn':
      default:
        return {
          type: 'endTurn',
          playerId,
          data: {}
        }
    }
  }
} 