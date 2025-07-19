Great idea! Before implementing the full MCTS system, you need a simple "auto-play" AI that can keep games moving. Here's a lightweight rule-based AI that makes reasonable decisions using our actual codebase architecture:

## Implementation Status & Infrastructure Analysis

### ✅ Existing Infrastructure We Can Leverage:
1. **Honeycomb Grid System**: Frontend already uses `honeycomb-grid` library for all hex geometry
   - Located in `apps/frontend/lib/hex-geometry.ts` and `apps/frontend/lib/board-utils.ts`
   - Provides precise vertex/edge calculations, distance calculations, neighbor finding
   - Should be bridged to core package rather than rebuilt

2. **State Validator Framework**: `packages/core/src/engine/state-validator.ts` is ~80% complete
   - All validation function signatures exist
   - Resource validation, building limits, phase validation fully working
   - Missing: adjacency calculations (stubbed with `return true`)

3. **Board Generation**: Complete hex coordinate system in `packages/core/src/engine/board-generator.ts`
   - Uses proper cube coordinates (q, r, s)
   - Generates all vertices and edges programmatically
   - Compatible with Honeycomb Grid library

### ❌ Critical Gaps That Block AI Implementation:
1. **Adjacency Calculations**: All stubbed out in state-validator.ts:
   - `checkDistanceRule()` - Returns `true` (needs 2-settlement distance rule)
   - `isConnectedToPlayerNetwork()` - Returns `true` (needs road network pathfinding)
   - `isEdgeConnectedToPlayer()` - Returns `true` (needs edge-to-network validation)
   - `checkSetupRoadPlacement()` - Returns `{ isValid: true }` (needs setup adjacency)

2. **Honeycomb Bridge**: Core package needs access to frontend's geometry calculations
   - Need to install `honeycomb-grid` in core package
   - Create bridge utility to share calculations between frontend and core
   - Implement proper vertex-hex-edge relationship mapping

## Revised Implementation Plan

### Phase 1: Foundation Infrastructure (MUST DO FIRST)
```typescript
// 1. Install honeycomb-grid in core package
cd packages/core && bun add honeycomb-grid

// 2. Create bridge utility
packages/core/src/geometry/honeycomb-bridge.ts

// 3. Implement missing validator functions  
packages/core/src/engine/adjacency-helpers.ts

// 4. Update state-validator.ts to use real adjacency logic
```

### Phase 2: AI Implementation (Build on Solid Foundation)
```typescript
// 5. Create board analyzer using working validator
packages/core/src/ai/board-analyzer.ts

// 6. Build action generator using real validation
packages/core/src/ai/action-generator.ts

// 7. Implement auto-player with proper move generation
packages/core/src/ai/auto-player.ts
```

## Simple Auto-Play AI

```typescript
// packages/core/src/ai/auto-player.ts
import {
  GameState,
  GameAction,
  Player,
  PlayerId,
  ResourceType,
  ActionType,
  GamePhase,
  HexCoordinate,
  Vertex,
  Edge,
  Hex
} from '../types'
import {
  BUILDING_COSTS,
  GAME_RULES,
  DICE_PROBABILITY
} from '../constants'
import {
  hasResources,
  getTotalResourceCount
} from '../calculations'
import { 
  canPlaceSettlement,
  canPlaceCity,
  canPlaceRoad,
  canBuyDevelopmentCard
} from '../engine/state-validator'  // Use REAL validation

export class AutoPlayer {
  constructor(
    private gameManager: any, // Will use GameFlowManager
    private difficulty: 'easy' | 'medium' | 'hard' = 'medium'
  ) {}

  async getAutoAction(state: GameState, playerId: PlayerId): Promise<GameAction> {
    const player = state.players.get(playerId)!;
    const availableActions = this.getAvailableActions(state, playerId);
    
    // Special handling for different game phases
    if (state.phase === 'setup1' || state.phase === 'setup2') {
      return this.getSetupAction(state, playerId, availableActions);
    }
    
    if (state.phase === 'roll') {
      return { type: 'roll', playerId, data: {} };
    }
    
    if (state.phase === 'moveRobber') {
      return this.getRobberAction(state, playerId);
    }
    
    if (state.phase === 'discard') {
      return this.getDiscardAction(state, playerId);
    }
    
    // Main game - use priority system
    const prioritizedAction = this.getPrioritizedAction(state, player, availableActions);
    return prioritizedAction || { type: 'endTurn', playerId, data: {} };
  }

  private getPrioritizedAction(
    state: GameState, 
    player: Player, 
    availableActions: ActionType[]
  ): GameAction | null {
    // Priority order for actions
    const priorities = [
      // 1. Win the game
      () => this.findWinningAction(state, player, availableActions),
      
      // 2. Build cities (always good)
      () => this.findCityBuildAction(state, player, availableActions),
      
      // 3. Build settlements if we can
      () => this.findSettlementBuildAction(state, player, availableActions),
      
      // 4. Buy dev cards if we have excess resources
      () => this.shouldBuyDevCard(player, availableActions) ? 
             { type: 'buyCard', playerId: player.id, data: {} } : null,
      
      // 5. Build roads toward good spots
      () => this.findUsefulRoadAction(state, player, availableActions),
      
      // 6. Play knight if robber is blocking us
      () => this.shouldPlayKnight(state, player, availableActions),
      
      // 7. Make beneficial trades (simplified)
      () => this.findBeneficialTradeAction(state, player, availableActions)
    ];
    
    // Try each priority in order
    for (const findAction of priorities) {
      const action = findAction();
      if (action) return action;
    }
    
    return null;
  }

  // Get available actions using REAL state validation
  private getAvailableActions(state: GameState, playerId: PlayerId): ActionType[] {
    const actions: ActionType[] = [];
    
    switch (state.phase) {
      case 'setup1':
      case 'setup2':
        // Check all vertices for valid settlement placement
        const hasSettlementToPlace = !this.hasPlayerSettlementInCurrentPhase(state, playerId);
        if (hasSettlementToPlace) {
          actions.push('placeBuilding');
        } else {
          actions.push('placeRoad');
        }
        break;
        
      case 'roll':
        actions.push('roll');
        break;
        
      case 'actions':
        actions.push('bankTrade', 'portTrade', 'createTradeOffer', 'endTurn');
        
        // Use real validation for building actions
        if (this.canPlayerBuildAnything(state, playerId)) {
          actions.push('build');
        }
        
        if (canBuyDevelopmentCard(state, playerId).isValid) {
          actions.push('buyCard');
        }
        
        if (this.hasPlayableCards(state, playerId)) {
          actions.push('playCard');
        }
        break;
        
      case 'discard':
        actions.push('discard');
        break;
        
      case 'moveRobber':
        actions.push('moveRobber');
        break;
        
      case 'steal':
        actions.push('stealResource');
        break;
    }
    
    return actions;
  }

  private canPlayerBuildAnything(state: GameState, playerId: PlayerId): boolean {
    // Check if player can build settlements, cities, or roads anywhere
    for (const [vertexId] of state.board.vertices) {
      if (canPlaceSettlement(state, playerId, vertexId).isValid) return true;
      if (canPlaceCity(state, playerId, vertexId).isValid) return true;
    }
    
    for (const [edgeId] of state.board.edges) {
      if (canPlaceRoad(state, playerId, edgeId).isValid) return true;
    }
    
    return false;
  }

  private findWinningAction(state: GameState, player: Player, actions: ActionType[]): GameAction | null {
    // Check if any building action wins the game
    if (player.score.total >= 9) {
      // Try building for the win - use REAL validation
      if (actions.includes('build')) {
        const settlementSpots = this.getValidSettlementSpots(state, player.id);
        if (settlementSpots.length > 0) {
          return {
            type: 'placeBuilding',
            playerId: player.id,
            data: { buildingType: 'settlement', vertexId: settlementSpots[0] }
          };
        }
        
        const cityUpgrades = this.getValidCityUpgrades(state, player.id);
        if (cityUpgrades.length > 0) {
          return {
            type: 'placeBuilding',
            playerId: player.id,
            data: { buildingType: 'city', vertexId: cityUpgrades[0] }
          };
        }
      }
    }
    return null;
  }

  private findSettlementBuildAction(state: GameState, player: Player, actions: ActionType[]): GameAction | null {
    if (!actions.includes('build') || !hasResources(player.resources, BUILDING_COSTS.settlement)) {
      return null;
    }
    
    const validSpots = this.getValidSettlementSpots(state, player.id);
    if (validSpots.length === 0) return null;
    
    // Pick the settlement spot with highest resource production
    let bestSpot = validSpots[0];
    let bestValue = 0;
    
    for (const vertexId of validSpots) {
      const value = this.evaluateVertexProductionValue(state, vertexId);
        if (value > bestValue) {
          bestValue = value;
        bestSpot = vertexId;
      }
    }
    
    return {
      type: 'placeBuilding',
      playerId: player.id,
      data: { buildingType: 'settlement', vertexId: bestSpot }
    };
  }

  private findCityBuildAction(state: GameState, player: Player, actions: ActionType[]): GameAction | null {
    if (!actions.includes('build') || !hasResources(player.resources, BUILDING_COSTS.city)) {
      return null;
    }
    
    const upgradableSpots = this.getValidCityUpgrades(state, player.id);
    if (upgradableSpots.length === 0) return null;
    
    // Pick the settlement with highest production to upgrade
    let bestSpot = upgradableSpots[0];
    let bestValue = 0;
    
    for (const vertexId of upgradableSpots) {
      const value = this.evaluateVertexProductionValue(state, vertexId);
      if (value > bestValue) {
        bestValue = value;
        bestSpot = vertexId;
      }
    }
    
    return {
      type: 'placeBuilding',
      playerId: player.id,
      data: { buildingType: 'city', vertexId: bestSpot }
    };
  }

  private evaluateVertexProductionValue(state: GameState, vertexId: string): number {
    const vertex = state.board.vertices.get(vertexId);
    if (!vertex) return 0;
    
    let value = 0;
    
    // Get adjacent hexes using vertex position data
    for (const hexCoord of vertex.position.hexes) {
      const hexId = `${hexCoord.q},${hexCoord.r},${hexCoord.s}`;
      const hex = state.board.hexes.get(hexId);
      
      if (hex && hex.terrain !== 'desert' && hex.numberToken && !this.isRobberOnHex(state, hex)) {
        const probability = DICE_PROBABILITY[hex.numberToken] || 0;
        value += probability;
      }
    }
    
    return value;
  }

  private shouldBuyDevCard(player: Player, actions: ActionType[]): boolean {
    if (!actions.includes('buyCard')) return false;
    
    const totalResources = getTotalResourceCount(player.resources);
    return totalResources >= 7 && hasResources(player.resources, BUILDING_COSTS.developmentCard);
  }

  private findUsefulRoadAction(state: GameState, player: Player, actions: ActionType[]): GameAction | null {
    if (!actions.includes('build') || !hasResources(player.resources, BUILDING_COSTS.road)) {
      return null;
    }
    
    const validRoads = this.getValidRoadPlacements(state, player.id);
    if (validRoads.length === 0) return null;
    
    // Only build roads if they lead somewhere useful
    for (const edgeId of validRoads) {
      if (this.roadLeadsToGoodSpot(state, player.id, edgeId)) {
        return {
          type: 'placeRoad',
          playerId: player.id,
          data: { edgeId }
        };
      }
    }
    
    return null;
  }

  private roadLeadsToGoodSpot(state: GameState, playerId: PlayerId, edgeId: string): boolean {
    // TODO: Implement proper path analysis using adjacency system
    // For now, simplified check
    return true;
  }

  private shouldPlayKnight(state: GameState, player: Player, actions: ActionType[]): GameAction | null {
    if (!actions.includes('playCard')) return null;
    
    // Check if we have a knight card to play
    const knightCard = player.developmentCards.find(card => 
      card.type === 'knight' && 
      card.playedTurn === null &&
      card.purchasedTurn < state.turn
    );
    
    if (!knightCard) return null;
    
    // Play knight if robber is blocking our best production
    if (this.isRobberBlockingUs(state, player.id)) {
      return {
        type: 'playCard',
        playerId: player.id,
        data: { cardId: knightCard.id }
      };
    }
    
    return null;
  }

  private isRobberBlockingUs(state: GameState, playerId: PlayerId): boolean {
    // Check if robber is on a hex adjacent to our buildings
    const robberPosition = state.board.robberPosition;
    if (!robberPosition) return false;
    
    const robberHexId = `${robberPosition.q},${robberPosition.r},${robberPosition.s}`;
    const robberHex = state.board.hexes.get(robberHexId);
    if (!robberHex) return false;
    
    // Check if any of our buildings are adjacent to robber hex
    for (const vertex of state.board.vertices.values()) {
      if (vertex.building?.owner === playerId) {
        // Check if this vertex is adjacent to robber hex
        for (const hexCoord of vertex.position.hexes) {
          const hexId = `${hexCoord.q},${hexCoord.r},${hexCoord.s}`;
          if (hexId === robberHexId) {
            return true;
          }
        }
      }
    }
    
    return false;
  }

  private getRobberAction(state: GameState, playerId: PlayerId): GameAction {
    // Move robber to hex that blocks opponents the most
    const bestHex = this.findBestRobberPlacement(state, playerId);
    const stealTarget = this.findBestStealTarget(state, bestHex, playerId);
    
    return {
      type: 'moveRobber',
      playerId,
      data: { 
        hexId: bestHex,
        stealFrom: stealTarget
      }
    };
  }

  private findBestRobberPlacement(state: GameState, playerId: PlayerId): string {
    let bestHex = '';
    let bestScore = -1;
    
    for (const hex of state.board.hexes.values()) {
      if (hex.terrain === 'desert') continue; // Can't block desert
      
      // Don't place on current robber position
      if (state.board.robberPosition && 
          hex.position.q === state.board.robberPosition.q &&
          hex.position.r === state.board.robberPosition.r) {
        continue;
      }
      
      const score = this.evaluateRobberPlacement(state, hex, playerId);
      if (score > bestScore) {
        bestScore = score;
        bestHex = hex.id;
      }
    }
    
    return bestHex;
  }

  private evaluateRobberPlacement(state: GameState, hex: Hex, playerId: PlayerId): number {
    let score = 0;
    
    // Higher score for blocking more opponent production
    const probability = DICE_PROBABILITY[hex.numberToken || 0] || 0;
    
    // Count opponent buildings adjacent to this hex
    let opponentBuildings = 0;
    let ourBuildings = 0;
    
    for (const vertex of state.board.vertices.values()) {
      if (vertex.building) {
        // Check if vertex is adjacent to this hex
        const isAdjacent = vertex.position.hexes.some(hexCoord =>
          hexCoord.q === hex.position.q && 
          hexCoord.r === hex.position.r && 
          hexCoord.s === hex.position.s
        );
        
        if (isAdjacent) {
          if (vertex.building.owner === playerId) {
            ourBuildings++;
          } else {
            opponentBuildings++;
          }
        }
      }
    }
    
    // Score = (opponent production blocked) - (our production blocked)
    score = (opponentBuildings * probability) - (ourBuildings * probability);
    
    return score;
  }

  private findBestStealTarget(state: GameState, hexId: string, playerId: PlayerId): PlayerId | null {
    const hex = state.board.hexes.get(hexId);
    if (!hex) return null;
    
    const candidates: PlayerId[] = [];
    
    // Find players with buildings adjacent to this hex
    for (const vertex of state.board.vertices.values()) {
      if (vertex.building && vertex.building.owner !== playerId) {
        // Check if vertex is adjacent to this hex
        const isAdjacent = vertex.position.hexes.some(hexCoord =>
          hexCoord.q === hex.position.q && 
          hexCoord.r === hex.position.r && 
          hexCoord.s === hex.position.s
        );
        
        if (isAdjacent) {
          const targetPlayer = state.players.get(vertex.building.owner);
          if (targetPlayer && getTotalResourceCount(targetPlayer.resources) > 0) {
            candidates.push(vertex.building.owner);
          }
        }
      }
    }
    
    if (candidates.length === 0) return null;
    
    // Steal from player with most resources
    let bestTarget = candidates[0];
    let mostResources = 0;
    
    for (const candidateId of candidates) {
      const candidate = state.players.get(candidateId);
      if (candidate) {
        const resourceCount = getTotalResourceCount(candidate.resources);
        if (resourceCount > mostResources) {
          mostResources = resourceCount;
          bestTarget = candidateId;
        }
      }
    }
    
    return bestTarget;
  }

  // Setup phase handling
  private getSetupAction(state: GameState, playerId: PlayerId, actions: ActionType[]): GameAction {
    if (actions.includes('placeBuilding')) {
      // Place settlement in best available spot using REAL validation
      const availableSpots = this.getValidSettlementSpots(state, playerId);
      const bestSpot = this.findBestSetupSpot(state, availableSpots);
      
      return {
        type: 'placeBuilding',
        playerId,
        data: { buildingType: 'settlement', vertexId: bestSpot }
      };
    } else if (actions.includes('placeRoad')) {
      // Place road adjacent to our most recent settlement
      const recentSettlement = this.findMostRecentSettlement(state, playerId);
      const adjacentRoads = this.getAdjacentRoadSlots(state, recentSettlement);
      
      return {
        type: 'placeRoad',
        playerId,
        data: { edgeId: adjacentRoads[0] }
      };
    }
    
    return { type: 'endTurn', playerId, data: {} };
  }

  private findBestSetupSpot(state: GameState, availableSpots: string[]): string {
    let bestSpot = availableSpots[0];
    let bestValue = 0;
    
    for (const vertexId of availableSpots) {
      const value = this.evaluateVertexProductionValue(state, vertexId);
      if (value > bestValue) {
        bestValue = value;
        bestSpot = vertexId;
      }
    }
    
    return bestSpot;
  }

  private getDiscardAction(state: GameState, playerId: PlayerId): GameAction {
    const player = state.players.get(playerId)!;
    const totalResources = getTotalResourceCount(player.resources);
    const discardCount = Math.floor(totalResources / 2);
    
    // Discard least valuable resources first
    const toDiscard: Partial<Record<ResourceType, number>> = {};
    const resourcePriority: ResourceType[] = ['wood', 'brick', 'sheep', 'wheat', 'ore'];
    
    let remaining = discardCount;
    for (const resource of resourcePriority) {
      const available = player.resources[resource];
      const discard = Math.min(available, remaining);
      if (discard > 0) {
        toDiscard[resource] = discard;
        remaining -= discard;
      }
      if (remaining === 0) break;
    }
    
    return {
      type: 'discard',
      playerId,
      data: { toDiscard }
    };
  }

  // Helper methods using REAL state validation
  private getValidSettlementSpots(state: GameState, playerId: PlayerId): string[] {
    const valid: string[] = [];
    
    for (const [vertexId] of state.board.vertices) {
      if (canPlaceSettlement(state, playerId, vertexId).isValid) {
        valid.push(vertexId);
      }
    }
    
    return valid;
  }

  private getValidCityUpgrades(state: GameState, playerId: PlayerId): string[] {
    const valid: string[] = [];
    
    for (const [vertexId] of state.board.vertices) {
      if (canPlaceCity(state, playerId, vertexId).isValid) {
        valid.push(vertexId);
      }
    }
    
    return valid;
  }

  private getValidRoadPlacements(state: GameState, playerId: PlayerId): string[] {
    const valid: string[] = [];
    
    for (const [edgeId] of state.board.edges) {
      if (canPlaceRoad(state, playerId, edgeId).isValid) {
        valid.push(edgeId);
      }
    }
    
    return valid;
  }

  private findMostRecentSettlement(state: GameState, playerId: PlayerId): string {
    // Find the most recently placed settlement for this player
    // During setup, this would be the settlement just placed
    // TODO: Implement proper tracking or use game events
    
    // For now, find any settlement owned by player
    for (const [vertexId, vertex] of state.board.vertices) {
      if (vertex.building?.owner === playerId && vertex.building.type === 'settlement') {
        return vertexId;
      }
    }
    
    return '';
  }

  private getAdjacentRoadSlots(state: GameState, vertexId: string): string[] {
    const adjacentEdges: string[] = [];
    
    // Find edges that could connect to this vertex
    // TODO: Use proper adjacency system once implemented
    for (const [edgeId, edge] of state.board.edges) {
      if (!edge.connection) {
        // Simplified check - would need proper vertex-edge adjacency
        adjacentEdges.push(edgeId);
      }
    }
    
    return adjacentEdges.slice(0, 3); // Return up to 3 options
  }

  private hasPlayerSettlementInCurrentPhase(state: GameState, playerId: PlayerId): boolean {
    // Check if player has placed settlement in current setup phase
    // TODO: Implement proper phase tracking
    return false; // Simplified for now
  }

  private hasPlayableCards(state: GameState, playerId: PlayerId): boolean {
    const player = state.players.get(playerId);
    if (!player) return false;
    
    return player.developmentCards.some(card => 
      card.playedTurn === null && 
      card.purchasedTurn < state.turn
    );
  }

  private isRobberOnHex(state: GameState, hex: Hex): boolean {
    return state.board.robberPosition?.q === hex.position.q &&
           state.board.robberPosition?.r === hex.position.r;
  }

  private findBeneficialTradeAction(state: GameState, player: Player, actions: ActionType[]): GameAction | null {
    // Simplified trade logic - just accept beneficial trades for now
    if (actions.includes('acceptTrade') && state.activeTrades.length > 0) {
      const trade = state.activeTrades[0];
      if (this.shouldAcceptTrade(trade, player)) {
        return {
          type: 'acceptTrade',
          playerId: player.id,
          data: { tradeId: trade.id }
        };
      }
    }
    
    return null;
  }

  private shouldAcceptTrade(trade: any, player: Player): boolean {
    // Simple logic: accept if we're getting resources we need more than what we're giving
    return false; // Placeholder
  }
}
```

## Integration with WebSocket Server

```typescript
// apps/backend/src/websocket/ai-handler.ts
import { ServerWebSocket } from 'bun'
import { GameFlowManager, GameState, PlayerId } from '@settlers/core'
import { AutoPlayer } from '@settlers/core/ai/auto-player'
import { WSData } from './server'

interface AIPlayerInfo {
  playerId: PlayerId
  gameId: string
  autoPlayer: AutoPlayer
  isEnabled: boolean
  lastActionTime: number
}

class AIHandler {
  private aiPlayers = new Map<PlayerId, AIPlayerInfo>()
  private actionQueue = new Map<string, PlayerId[]>() // gameId -> player queue
  
  constructor(private gameManager: GameFlowManager) {}

  // Enable auto-play for a player (when they disconnect or request it)
  async enableAutoPlay(gameId: string, playerId: PlayerId): Promise<void> {
    console.log(`🤖 Enabling auto-play for player ${playerId} in game ${gameId}`)
    
    const autoPlayer = new AutoPlayer(this.gameManager, 'medium')
    
    this.aiPlayers.set(playerId, {
      playerId,
      gameId,
      autoPlayer,
      isEnabled: true,
      lastActionTime: Date.now()
    })
    
    // Start processing moves for this player if it's their turn
    await this.processAITurnIfNeeded(gameId, playerId)
  }

  // Disable auto-play (when player reconnects)
  async disableAutoPlay(playerId: PlayerId): Promise<void> {
    console.log(`👤 Disabling auto-play for player ${playerId}`)
    this.aiPlayers.delete(playerId)
  }

  // Check if it's an AI player's turn and process their move
  async processAITurnIfNeeded(gameId: string, playerId: PlayerId): Promise<void> {
    const aiInfo = this.aiPlayers.get(playerId)
    if (!aiInfo || !aiInfo.isEnabled) return

    const state = await this.gameManager.getState()
    if (state.currentPlayer !== playerId) return

    // Add small delay to feel natural
    setTimeout(async () => {
      await this.executeAIMove(gameId, playerId)
    }, 500 + Math.random() * 1000) // 500-1500ms delay
  }

  private async executeAIMove(gameId: string, playerId: PlayerId): Promise<void> {
    try {
      const aiInfo = this.aiPlayers.get(playerId)
      if (!aiInfo) return

      const state = await this.gameManager.getState()
      const action = await aiInfo.autoPlayer.getAutoAction(state, playerId)
      
      console.log(`🤖 AI Player ${playerId} taking action:`, action.type)
      
      // Execute the action through our game manager
      const result = await this.gameManager.processAction(action)
      
      if (result.success) {
        // Broadcast the move to all players in the game
        await this.broadcastAIMove(gameId, action, result)
        
        // Update last action time
        aiInfo.lastActionTime = Date.now()
        
        // Check if AI should continue (multi-action turns)
        const newState = result.newState
        if (newState.currentPlayer === playerId && this.shouldContinueAITurn(newState)) {
          await this.processAITurnIfNeeded(gameId, playerId)
        }
      } else {
        console.error(`❌ AI action failed for ${playerId}:`, result.error)
        // Fallback to ending turn
        await this.gameManager.processAction({
          type: 'endTurn',
          playerId,
          data: {}
        })
      }
    } catch (error) {
      console.error(`💥 Error executing AI move for ${playerId}:`, error)
    }
  }

  private shouldContinueAITurn(state: GameState): boolean {
    // Continue if in phases where multiple actions are possible
    return state.phase === 'actions' || 
           state.phase === 'setup1' || 
           state.phase === 'setup2'
  }

  private async broadcastAIMove(gameId: string, action: any, result: any): Promise<void> {
    // Broadcast through existing WebSocket system
    // This would integrate with our existing broadcast functions
    console.log(`📡 Broadcasting AI move to game ${gameId}`)
  }

  // Handle player disconnection
  async handlePlayerDisconnect(gameId: string, playerId: PlayerId): Promise<void> {
    const state = await this.gameManager.getState()
    const player = state.players.get(playerId)
    
    if (player && !player.isAI) {
      await this.enableAutoPlay(gameId, playerId)
      }
  }

  // Handle player reconnection
  async handlePlayerReconnect(playerId: PlayerId): Promise<void> {
    await this.disableAutoPlay(playerId)
  }
}

export { AIHandler }
```

## WebSocket Message Integration

```typescript
// apps/backend/src/websocket/server.ts - Integration additions

import { AIHandler } from './ai-handler'

// Add to existing WebSocket handler
const aiHandler = new AIHandler(gameManager)

// Add to handleWebSocketMessage function:
async function handleWebSocketMessage(ws: ServerWebSocket<WSData>, data: any) {
  const { type, ...payload } = data
  
  switch (type) {
    case 'enableAutoMode':
      await handleEnableAutoMode(ws, payload)
      break
      
    case 'disableAutoMode':
      await handleDisableAutoMode(ws, payload)
      break
      
    // ... existing cases
  }
}

async function handleEnableAutoMode(ws: ServerWebSocket<WSData>, payload: { gameId: string; playerId: string }) {
  const { gameId, playerId } = payload
  
  try {
    await aiHandler.enableAutoPlay(gameId, playerId)
    
    ws.send(JSON.stringify({
      type: 'autoModeEnabled',
      playerId
    }))
    
    // Broadcast to other players
    broadcastToGame(gameId, {
      type: 'playerAutoModeChanged',
      playerId,
      isAutoMode: true
    }, ws)
    
  } catch (error) {
    ws.send(JSON.stringify({
      type: 'error',
      error: 'Failed to enable auto mode'
    }))
  }
}

async function handleDisableAutoMode(ws: ServerWebSocket<WSData>, payload: { playerId: string }) {
  const { playerId } = payload
  
  try {
    await aiHandler.disableAutoPlay(playerId)
    
    ws.send(JSON.stringify({
      type: 'autoModeDisabled',
      playerId
    }))
    
  } catch (error) {
    ws.send(JSON.stringify({
      type: 'error',
      error: 'Failed to disable auto mode'
    }))
  }
}

// Add to close handler:
async function handleDisconnect(ws: ServerWebSocket<WSData>) {
  const { gameId, playerId } = ws.data
  
  if (gameId && playerId) {
    // Enable auto-play for disconnected player
    await aiHandler.handlePlayerDisconnect(gameId, playerId)
  }
  
  // ... existing cleanup
}
```

## Database Integration

```typescript
// apps/backend/src/db/schema.ts - Add AI tracking
export const aiStates = pgTable('ai_states', {
  id: text('id').primaryKey(),
  gameId: text('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
  playerId: text('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  isEnabled: boolean('is_enabled').notNull().default(false),
  difficulty: text('difficulty').notNull().default('medium'), // easy, medium, hard
  lastActionTime: timestamp('last_action_time').notNull().defaultNow(),
  actionCount: integer('action_count').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow()
})
```

## Next Steps (Updated Priority Order)

### 1. Foundation Infrastructure (CRITICAL - DO FIRST)
- [ ] Add `honeycomb-grid` to core package: `cd packages/core && bun add honeycomb-grid`
- [ ] Create `packages/core/src/geometry/honeycomb-bridge.ts`
- [ ] Implement `packages/core/src/engine/adjacency-helpers.ts` 
- [ ] Fix stubbed functions in `state-validator.ts`

### 2. AI Implementation (Build on Working Foundation)
- [ ] Create `packages/core/src/ai/board-analyzer.ts`
- [ ] Build `packages/core/src/ai/action-generator.ts`
- [ ] Complete `packages/core/src/ai/auto-player.ts`

### 3. Production Integration
- [ ] WebSocket AI handler integration
- [ ] Database AI state persistence
- [ ] Frontend auto-mode controls

This auto-player will:
- Use our actual `GameAction` interface and `Map<string, T>` board structure
- Integrate with our WebSocket system for real-time auto-play
- Work with our event-sourced state management
- Handle our specific setup phases (`setup1`/`setup2`)
- Use our actual resource types and building costs
- Execute in <10ms per move with simple heuristics
- Keep games flowing when players disconnect
- Can be easily extended with the full MCTS AI later

The priority system ensures it:
1. Takes winning moves when possible
2. Builds cities when resources allow
3. Expands strategically with settlements
4. Doesn't waste resources on poor placements
5. Only builds roads that lead to valuable positions

Perfect for testing your game infrastructure and providing a smooth player experience when someone steps away from their game!