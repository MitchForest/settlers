# Catan AI Phase 1: Game State & Legal Action Generation

## Implementation Status & Infrastructure Analysis

### ✅ Existing Infrastructure We Can Leverage:

1. **Complete State Validator Framework**: `packages/core/src/engine/state-validator.ts`
   - All validation function signatures implemented
   - Resource validation, building limits, phase validation fully working
   - Turn validation, development card logic, trading validation complete
   - **Missing**: Only adjacency calculations are stubbed (4 critical functions)

2. **Honeycomb Grid System**: Already proven in frontend
   - Located in `apps/frontend/lib/hex-geometry.ts` and `board-utils.ts`
   - Provides precise vertex/edge calculations, distance, neighbor finding
   - Should be bridged to core package for AI use

3. **Board Structure**: Fully compatible coordinate system
   - Uses proper cube coordinates (q, r, s) matching Honeycomb
   - Map-based access: `state.board.vertices.get(id)`
   - Programmatic vertex/edge generation in board-generator.ts

### ❌ Critical Implementation Gaps:

1. **Adjacency System**: 4 functions stubbed in state-validator.ts:
   ```typescript
   // All return true/valid - need real implementation
   checkDistanceRule() // 2-settlement distance rule
   isConnectedToPlayerNetwork() // Road network pathfinding  
   isEdgeConnectedToPlayer() // Edge-to-network validation
   checkSetupRoadPlacement() // Setup phase adjacency
   ```

2. **Missing Bridge**: Core package needs Honeycomb Grid access
   - Install `honeycomb-grid` in core package
   - Create geometry bridge utility
   - Implement efficient adjacency caching

## Revised Implementation Strategy

### Phase 1: Fix Foundation Infrastructure (CRITICAL FIRST)
Instead of building new systems, **fix the existing validator gaps**:

```typescript
// 1. Add Honeycomb to core
cd packages/core && bun add honeycomb-grid

// 2. Create bridge utility
packages/core/src/geometry/honeycomb-bridge.ts

// 3. Implement missing adjacency functions
packages/core/src/engine/adjacency-helpers.ts

// 4. Update state-validator.ts imports
```

### Phase 2: AI Layer (Build on Working Validator)
Once validator works properly, AI becomes straightforward:

```typescript
// 5. Action generator using working validator
packages/core/src/ai/action-generator.ts

// 6. Board analyzer with cached adjacencies  
packages/core/src/ai/board-analyzer.ts

// 7. Auto-player with real move validation
packages/core/src/ai/auto-player.ts
```

## Overview
This document defines the complete game state representation and legal action generation system for a Catan AI that works with our actual codebase. The system must work with our coordinate-based board, Map-based state structure, and existing GameAction system.

## 1. Core Game Components (Our Actual Types)

### 1.1 Resources and Development Cards
```typescript
// From packages/core/src/types.ts
export type ResourceType = 'wood' | 'brick' | 'ore' | 'wheat' | 'sheep'
export type TerrainType = 'forest' | 'hills' | 'mountains' | 'fields' | 'pasture' | 'desert' | 'sea'

export type DevelopmentCardType = 
  | 'knight'
  | 'victory'
  | 'roadBuilding'
  | 'yearOfPlenty'
  | 'monopoly'

export interface ResourceCards {
  wood: number
  brick: number
  ore: number
  wheat: number
  sheep: number
}
```

### 1.2 Board Structure (Coordinate-Based System)
Our board uses hexagonal coordinates with string-based IDs:

```typescript
// From packages/core/src/types.ts
export interface HexCoordinate {
  q: number  // Column
  r: number  // Row  
  s: number  // Computed: -(q + r)
}

export interface VertexPosition {
  hexes: HexCoordinate[]  // Adjacent hexes (1-3)
  direction: 'N' | 'NE' | 'SE' | 'S' | 'SW' | 'NW'  // Direction from first hex
}

export interface EdgePosition {
  hexes: HexCoordinate[]  // Two connected hexes
  direction: 'NE' | 'E' | 'SE' | 'SW' | 'W' | 'NW'  // Direction between hexes
}

export interface Hex {
  id: string  // Generated ID
  position: HexCoordinate
  terrain: TerrainType | null
  numberToken: number | null  // 2-12, or null for desert/sea
}

export interface Vertex {
  id: string  // Coordinate-based ID like "0,0,0-N"
  position: VertexPosition
  building: Building | null
  port: Port | null
}

export interface Edge {
  id: string  // Coordinate-based ID
  position: EdgePosition
  connection: Road | null  // Our roads are stored as "connection"
}

export interface Board {
  hexes: Map<string, Hex>      // String ID -> Hex
  vertices: Map<string, Vertex> // String ID -> Vertex  
  edges: Map<string, Edge>     // String ID -> Edge
  ports: Port[]
  robberPosition: HexCoordinate | null
}
```

### 1.3 Player State (Our Actual Structure)
```typescript
// From packages/core/src/types.ts
export interface Player {
  id: PlayerId
  name: string
  color: PlayerColor
  resources: ResourceCards
  developmentCards: DevelopmentCard[]
  score: Score
  buildings: BuildingInventory  // Available pieces to place
  knightsPlayed: number
  hasLongestRoad: boolean
  hasLargestArmy: boolean
  isConnected: boolean
  isAI: boolean
}

export interface Score {
  public: number    // Visible to all
  hidden: number    // Victory point cards
  total: number     // public + hidden
}

export interface BuildingInventory {
  settlements: number    // Settlements remaining (5 max)
  cities: number         // Cities remaining (4 max)  
  roads: number          // Roads remaining (15 max)
}
```

### 1.4 Game State (Our Actual Structure)
```typescript
// From packages/core/src/types.ts
export interface GameState {
  id: string
  phase: GamePhase  // 'setup1' | 'setup2' | 'roll' | 'actions' | 'discard' | 'moveRobber' | 'steal' | 'ended'
  turn: number
  currentPlayer: PlayerId
  players: Map<PlayerId, Player>  // Map, not Array!
  board: Board
  dice: DiceRoll | null
  developmentDeck: DevelopmentCard[]
  discardPile: DevelopmentCard[]
  winner: PlayerId | null
  activeTrades: Trade[]
  startedAt: Date
  updatedAt: Date
}

export type GamePhase = 
  | 'setup1'      // First settlement + road
  | 'setup2'      // Second settlement + road (reverse order)
  | 'roll'        // Roll dice
  | 'actions'     // Trade, build, play cards
  | 'discard'     // Discard half when 7 rolled
  | 'moveRobber'  // Move robber
  | 'steal'       // Steal resource
  | 'ended'       // Game over
```

## 2. Action System (Our Actual Implementation)

### 2.1 Action Types and Interface
```typescript
// From packages/core/src/types.ts
export type ActionType = 
  | 'roll'
  | 'placeBuilding'
  | 'placeRoad'
  | 'build'
  | 'bankTrade'
  | 'portTrade'
  | 'createTradeOffer'
  | 'acceptTrade'
  | 'rejectTrade'
  | 'cancelTrade'
  | 'playCard'
  | 'buyCard'
  | 'moveRobber'
  | 'stealResource'
  | 'discard'
  | 'endTurn'

export interface GameAction {
  type: ActionType
  playerId: PlayerId
  data: any  // Action-specific data
}
```

### 2.2 Action Data Structures
```typescript
// Action data examples for our system:
type ActionDataMap = {
  roll: {}
  placeBuilding: { 
    buildingType: 'settlement' | 'city'
    vertexId: string 
  }
  placeRoad: { 
    edgeId: string 
  }
  build: { 
    buildingType?: string
    vertexId?: string
    edgeId?: string
  }
  bankTrade: {
    offering: Partial<ResourceCards>
    requesting: Partial<ResourceCards>
  }
  moveRobber: {
    hexId: string
    stealFrom?: PlayerId
  }
  playCard: {
    cardId: string
    // Additional data for specific cards:
    resources?: [ResourceType, ResourceType]  // Year of Plenty
    resourceType?: ResourceType               // Monopoly
    roads?: [string, string]                  // Road Building
  }
  // ... etc
}
```

## 3. Honeycomb Bridge for Adjacency Calculations

Since our board uses coordinate-based IDs, we need to bridge to Honeycomb for geometry:

### 3.1 Honeycomb Bridge Utility
```typescript
// packages/core/src/geometry/honeycomb-bridge.ts
import { defineHex, Grid, Orientation } from 'honeycomb-grid'
import { HexCoordinate, VertexPosition, EdgePosition } from '../types'

// Use same configuration as frontend
const HEX_RADIUS = 50
const CustomHex = defineHex({
  dimensions: HEX_RADIUS,
  orientation: Orientation.FLAT,
})

export class HoneycombBridge {
  private hexCache = new Map<string, InstanceType<typeof CustomHex>>()
  
  getHex(coord: HexCoordinate): InstanceType<typeof CustomHex> {
    const key = `${coord.q},${coord.r}`
    if (!this.hexCache.has(key)) {
      this.hexCache.set(key, new CustomHex({ q: coord.q, r: coord.r }))
    }
    return this.hexCache.get(key)!
  }
  
  // Get hex neighbors using Honeycomb's built-in logic
  getHexNeighbors(coord: HexCoordinate): HexCoordinate[] {
    const hex = this.getHex(coord)
    return hex.neighbors().map(neighbor => ({
      q: neighbor.q,
      r: neighbor.r, 
      s: neighbor.s
    }))
  }
  
  // Get hex distance using Honeycomb's algorithm
  getHexDistance(from: HexCoordinate, to: HexCoordinate): number {
    const hex1 = this.getHex(from)
    const hex2 = this.getHex(to)
    return hex1.distance(hex2)
  }
  
  // Get hex corners (vertices) using Honeycomb's precise calculations
  getHexVertices(coord: HexCoordinate): Array<{x: number, y: number, direction: string}> {
    const hex = this.getHex(coord)
    const corners = hex.corners
    const directions = ['N', 'NE', 'SE', 'S', 'SW', 'NW']
    
    return corners.map((corner, index) => ({
      x: corner.x,
      y: corner.y, 
      direction: directions[index]
    }))
  }
}

export const honeycombBridge = new HoneycombBridge()
```

### 3.2 Adjacency Calculator Using Honeycomb
```typescript
// packages/core/src/engine/adjacency-helpers.ts
import { Board, GameState, PlayerId } from '../types'
import { honeycombBridge } from '../geometry/honeycomb-bridge'
import {
  canPlaceSettlement,
  canPlaceCity,
  canPlaceRoad
} from './state-validator'

export interface AdjacencyMaps {
  hexToVertices: Map<string, string[]>      // hexId -> vertexIds
  vertexToHexes: Map<string, string[]>      // vertexId -> hexIds  
  vertexToEdges: Map<string, string[]>      // vertexId -> edgeIds
  edgeToVertices: Map<string, [string, string]> // edgeId -> [vertex1, vertex2]
  hexToNeighbors: Map<string, string[]>     // hexId -> neighboring hexIds
}

export function calculateAdjacencies(board: Board): AdjacencyMaps {
  const maps: AdjacencyMaps = {
    hexToVertices: new Map(),
    vertexToHexes: new Map(),
    vertexToEdges: new Map(), 
    edgeToVertices: new Map(),
    hexToNeighbors: new Map()
  }
  
  // 1. Build hex-to-neighbors using Honeycomb
  for (const [hexId, hex] of board.hexes) {
    const neighbors = honeycombBridge.getHexNeighbors(hex.position)
    const neighborIds = neighbors
      .map(coord => `${coord.q},${coord.r},${coord.s}`)
      .filter(id => board.hexes.has(id))
    
    maps.hexToNeighbors.set(hexId, neighborIds)
  }
  
  // 2. Build hex-to-vertices using existing vertex position data
  for (const [vertexId, vertex] of board.vertices) {
    const hexIds = vertex.position.hexes.map(coord => 
      `${coord.q},${coord.r},${coord.s}`
    )
    
    // Add to vertex-to-hexes mapping
    maps.vertexToHexes.set(vertexId, hexIds)
    
    // Add to hex-to-vertices mapping
    hexIds.forEach(hexId => {
      if (!maps.hexToVertices.has(hexId)) {
        maps.hexToVertices.set(hexId, [])
      }
      maps.hexToVertices.get(hexId)!.push(vertexId)
    })
  }
  
  // 3. Build vertex-to-edges by analyzing existing edge data
  for (const [edgeId, edge] of board.edges) {
    const connectedVertices = findVerticesConnectedByEdge(edge, board)
    if (connectedVertices.length === 2) {
      maps.edgeToVertices.set(edgeId, [connectedVertices[0], connectedVertices[1]])
      
      // Add to vertex-to-edges mapping
      connectedVertices.forEach(vertexId => {
        if (!maps.vertexToEdges.has(vertexId)) {
          maps.vertexToEdges.set(vertexId, [])
        }
        maps.vertexToEdges.get(vertexId)!.push(edgeId)
      })
    }
  }
  
  return maps
}

// Helper to find which vertices an edge connects
function findVerticesConnectedByEdge(edge: Edge, board: Board): string[] {
  // Use the edge's hex positions to find shared vertices
  if (edge.position.hexes.length !== 2) return []
  
  const [hex1, hex2] = edge.position.hexes
  const hex1Id = `${hex1.q},${hex1.r},${hex1.s}`
  const hex2Id = `${hex2.q},${hex2.r},${hex2.s}`
  
  // Find vertices that are adjacent to both hexes
  const sharedVertices: string[] = []
  
  for (const [vertexId, vertex] of board.vertices) {
    const vertexHexIds = vertex.position.hexes.map(coord => 
      `${coord.q},${coord.r},${coord.s}`
    )
    
    if (vertexHexIds.includes(hex1Id) && vertexHexIds.includes(hex2Id)) {
      sharedVertices.push(vertexId)
    }
  }
  
  return sharedVertices
}

// Now implement the missing validator functions
export function checkDistanceRule(
  vertices: Map<string, Vertex>,
  vertexId: string,
  adjacencies: AdjacencyMaps
): boolean {
  // Settlement distance rule: no settlement within 2 edges
  const adjacentVertices = getAdjacentVertices(vertexId, adjacencies)
  
  for (const adjVertexId of adjacentVertices) {
    const adjVertex = vertices.get(adjVertexId)
    if (adjVertex?.building) {
      return false // Too close to another building
    }
  }
  
  return true
}

export function isConnectedToPlayerNetwork(
  state: GameState,
  playerId: PlayerId,
  vertexId: string,
  adjacencies: AdjacencyMaps  
): boolean {
  // BFS through player's road network to see if vertex is reachable
  const visited = new Set<string>()
  const queue: string[] = []
  
  // Start from all player's existing buildings
  for (const [vId, vertex] of state.board.vertices) {
    if (vertex.building?.owner === playerId) {
      queue.push(vId)
      visited.add(vId)
    }
  }
  
  // BFS through road network
  while (queue.length > 0) {
    const currentVertex = queue.shift()!
    
    if (currentVertex === vertexId) {
      return true // Found connection
    }
    
    // Check adjacent vertices connected by player's roads
    const adjacentEdges = adjacencies.vertexToEdges.get(currentVertex) || []
    
    for (const edgeId of adjacentEdges) {
      const edge = state.board.edges.get(edgeId)
      if (edge?.connection?.owner === playerId) {
        // This edge belongs to player, follow it
        const connectedVertices = adjacencies.edgeToVertices.get(edgeId) || []
        
        for (const connectedVertex of connectedVertices) {
          if (!visited.has(connectedVertex)) {
            visited.add(connectedVertex)
            queue.push(connectedVertex)
          }
        }
      }
    }
  }
  
  return false // No connection found
}

export function isEdgeConnectedToPlayer(
  state: GameState,
  playerId: PlayerId,
  edgeId: string,
  adjacencies: AdjacencyMaps
): boolean {
  // Edge is connected if either endpoint connects to player's network
  const connectedVertices = adjacencies.edgeToVertices.get(edgeId) || []
  
  for (const vertexId of connectedVertices) {
    const vertex = state.board.vertices.get(vertexId)
    
    // Connected if vertex has player's building
    if (vertex?.building?.owner === playerId) {
      return true
    }
    
    // Or if vertex connects to player's road network
    if (isConnectedToPlayerNetwork(state, playerId, vertexId, adjacencies)) {
      return true
    }
  }
  
  return false
}

export function checkSetupRoadPlacement(
  state: GameState,
  playerId: PlayerId,
  edgeId: string,
  adjacencies: AdjacencyMaps
): { isValid: boolean; reason?: string } {
  // During setup, road must connect to the settlement just placed
  const connectedVertices = adjacencies.edgeToVertices.get(edgeId) || []
  
  for (const vertexId of connectedVertices) {
    const vertex = state.board.vertices.get(vertexId)
    if (vertex?.building?.owner === playerId && vertex.building.type === 'settlement') {
      return { isValid: true }
    }
  }
  
  return { isValid: false, reason: 'Road must connect to your settlement' }
}

function getAdjacentVertices(vertexId: string, adjacencies: AdjacencyMaps): string[] {
  // Get vertices that are 1 edge away (adjacent)
  const adjacentEdges = adjacencies.vertexToEdges.get(vertexId) || []
  const adjacentVertices: string[] = []
  
  for (const edgeId of adjacentEdges) {
    const connectedVertices = adjacencies.edgeToVertices.get(edgeId) || []
    adjacentVertices.push(...connectedVertices.filter(v => v !== vertexId))
  }
  
  return [...new Set(adjacentVertices)] // Remove duplicates
}
```

## 4. Legal Action Generation System

### 4.1 Action Generator Using Real Validation
```typescript
// packages/core/src/ai/action-generator.ts
import { GameState, GameAction, PlayerId, ActionType } from '../types'
import { 
  canPlaceSettlement,
  canPlaceCity,
  canPlaceRoad,
  canBuyDevelopmentCard,
  canPlayDevelopmentCard,
  canProposeTrade,
  mustDiscard
} from '../engine/state-validator'

export interface ActionGenerator {
  getAvailableActions(state: GameState, playerId: PlayerId): GameAction[]
  canPerformAction(state: GameState, action: GameAction): boolean
  getValidPlacements(state: GameState, playerId: PlayerId, type: 'settlement' | 'city' | 'road'): string[]
}

export class LegalActionGenerator implements ActionGenerator {
  getAvailableActions(state: GameState, playerId: PlayerId): GameAction[] {
    const actions: GameAction[] = []
    
    // Use our existing game flow logic
    switch (state.phase) {
      case 'setup1':
      case 'setup2':
        actions.push(...this.getSetupActions(state, playerId))
        break
        
      case 'roll':
        actions.push({ type: 'roll', playerId, data: {} })
        break
        
      case 'actions':
        actions.push(...this.getMainGameActions(state, playerId))
        break
        
      case 'discard':
        if (mustDiscard(state, playerId)) {
          actions.push(...this.getDiscardActions(state, playerId))
        }
        break
        
      case 'moveRobber':
        actions.push(...this.getRobberActions(state, playerId))
        break
        
      case 'steal':
        actions.push(...this.getStealActions(state, playerId))
        break
    }
    
    return actions
  }
  
  private getSetupActions(state: GameState, playerId: PlayerId): GameAction[] {
    const actions: GameAction[] = []
    
    // Settlement placement
    const validSettlementSpots = this.getValidPlacements(state, playerId, 'settlement')
    for (const vertexId of validSettlementSpots) {
      actions.push({
        type: 'placeBuilding',
        playerId,
        data: { buildingType: 'settlement', vertexId }
      })
    }
    
    // Road placement (after settlement)
    const validRoadSpots = this.getValidPlacements(state, playerId, 'road')
    for (const edgeId of validRoadSpots) {
      actions.push({
        type: 'placeRoad',
        playerId,
        data: { edgeId }
      })
    }
    
    return actions
  }
  
  private getMainGameActions(state: GameState, playerId: PlayerId): GameAction[] {
    const actions: GameAction[] = []
    const player = state.players.get(playerId)!
    
    // Building actions using real validation
    actions.push(...this.getBuildingActions(state, playerId))
    
    // Development card actions using real validation
    if (canBuyDevelopmentCard(state, playerId).isValid) {
      actions.push({ type: 'buyCard', playerId, data: {} })
    }
    
    actions.push(...this.getPlayCardActions(state, playerId))
    
    // Trade actions
    actions.push(...this.getTradeActions(state, playerId))
        
    // Always can end turn
    actions.push({ type: 'endTurn', playerId, data: {} })
    
    return actions
  }
  
  private getBuildingActions(state: GameState, playerId: PlayerId): GameAction[] {
    const actions: GameAction[] = []
    
    // Settlement actions using real validation
    const validSettlements = this.getValidPlacements(state, playerId, 'settlement')
    for (const vertexId of validSettlements) {
      actions.push({
        type: 'placeBuilding',
        playerId,
        data: { buildingType: 'settlement', vertexId }
      })
    }
    
    // City actions using real validation
    const validCities = this.getValidPlacements(state, playerId, 'city')
    for (const vertexId of validCities) {
      actions.push({
        type: 'placeBuilding',
        playerId,
        data: { buildingType: 'city', vertexId }
      })
    }
    
    // Road actions using real validation
    const validRoads = this.getValidPlacements(state, playerId, 'road')
    for (const edgeId of validRoads) {
      actions.push({
        type: 'placeRoad',
        playerId,
        data: { edgeId }
      })
    }
    
    return actions
  }
  
  getValidPlacements(state: GameState, playerId: PlayerId, type: 'settlement' | 'city' | 'road'): string[] {
    switch (type) {
      case 'settlement':
        return this.getValidSettlementPlacements(state, playerId)
      case 'city':
        return this.getValidCityPlacements(state, playerId)
      case 'road':
        return this.getValidRoadPlacements(state, playerId)
    }
  }
  
  private getValidSettlementPlacements(state: GameState, playerId: PlayerId): string[] {
    const valid: string[] = []
    
    for (const [vertexId] of state.board.vertices) {
      // Use our working validator
      const validation = canPlaceSettlement(state, playerId, vertexId)
      if (validation.isValid) {
        valid.push(vertexId)
      }
    }
    
    return valid
  }
  
  private getValidCityPlacements(state: GameState, playerId: PlayerId): string[] {
    const valid: string[] = []
    
    for (const [vertexId] of state.board.vertices) {
      const validation = canPlaceCity(state, playerId, vertexId)
      if (validation.isValid) {
        valid.push(vertexId)
      }
    }
    
    return valid
  }
  
  private getValidRoadPlacements(state: GameState, playerId: PlayerId): string[] {
    const valid: string[] = []
    
    for (const [edgeId] of state.board.edges) {
      const validation = canPlaceRoad(state, playerId, edgeId)
      if (validation.isValid) {
        valid.push(edgeId)
      }
    }
    
    return valid
  }
  
  private getTradeActions(state: GameState, playerId: PlayerId): GameAction[] {
    const actions: GameAction[] = []
    
    // Accept/reject existing trades
    for (const trade of state.activeTrades) {
      if (trade.target === playerId || trade.isOpenOffer) {
        actions.push({
          type: 'acceptTrade',
          playerId,
          data: { tradeId: trade.id }
        })
        
        actions.push({
          type: 'rejectTrade', 
          playerId,
          data: { tradeId: trade.id }
        })
      }
    }
    
    // Bank trades (4:1 and port trades)
    actions.push(...this.getBankTradeActions(state, playerId))
    
    // Create new trade offers
    actions.push(...this.getTradeOfferActions(state, playerId))
    
    return actions
  }
  
  private getPlayCardActions(state: GameState, playerId: PlayerId): GameAction[] {
    const actions: GameAction[] = []
    const player = state.players.get(playerId)!
    
    for (const card of player.developmentCards) {
      const validation = canPlayDevelopmentCard(state, playerId, card.id)
      if (validation.isValid) {
        actions.push({
          type: 'playCard',
          playerId,
          data: { cardId: card.id }
        })
      }
    }
    
    return actions
  }
  
  canPerformAction(state: GameState, action: GameAction): boolean {
    // Route to appropriate validator function
    switch (action.type) {
      case 'placeBuilding':
        if (action.data.buildingType === 'settlement') {
          return canPlaceSettlement(state, action.playerId, action.data.vertexId).isValid
        } else if (action.data.buildingType === 'city') {
          return canPlaceCity(state, action.playerId, action.data.vertexId).isValid
        }
        break
        
      case 'placeRoad':
        return canPlaceRoad(state, action.playerId, action.data.edgeId).isValid
        
      case 'buyCard':
        return canBuyDevelopmentCard(state, action.playerId).isValid
        
      case 'playCard':
        return canPlayDevelopmentCard(state, action.playerId, action.data.cardId).isValid
        
      // ... implement other action types
    }
    
    return false
  }
  
  // Implement other helper methods...
  private getBankTradeActions(state: GameState, playerId: PlayerId): GameAction[] {
    // TODO: Implement bank trade action generation
    return []
  }
  
  private getTradeOfferActions(state: GameState, playerId: PlayerId): GameAction[] {
    // TODO: Implement trade offer generation
    return []
  }
  
  private getDiscardActions(state: GameState, playerId: PlayerId): GameAction[] {
    // TODO: Implement discard action generation
    return []
  }
  
  private getRobberActions(state: GameState, playerId: PlayerId): GameAction[] {
    // TODO: Implement robber move generation
    return []
  }
  
  private getStealActions(state: GameState, playerId: PlayerId): GameAction[] {
    // TODO: Implement steal action generation
    return []
  }
}
```

## 5. Board Analysis Using Working Validator

### 5.1 Board Analyzer with Cached Adjacencies
```typescript
// packages/core/src/ai/board-analyzer.ts
import { Board, GameState, ResourceType } from '../types'
import { DICE_PROBABILITY } from '../constants'
import { calculateAdjacencies, AdjacencyMaps } from '../engine/adjacency-helpers'

export interface BoardAnalysis {
  adjacencies: AdjacencyMaps
  vertexProduction: Map<string, ProductionValue>
  hexProbability: Map<string, number>
  // Distance matrix can be added later when needed
}

export interface ProductionValue {
  totalExpected: number
  byResource: Record<ResourceType, number>
  diversityScore: number
  highValueHexes: number
}

export class BoardAnalyzer {
  private analysis: BoardAnalysis | null = null
  
  constructor(private board: Board) {}
  
  analyze(): BoardAnalysis {
    if (this.analysis) return this.analysis
    
    console.time('Board Analysis')
    
    // Step 1: Calculate all adjacencies using Honeycomb bridge
    const adjacencies = calculateAdjacencies(this.board)
    
    // Step 2: Calculate production values for each vertex
    const vertexProduction = this.calculateVertexProduction(adjacencies)
    
    // Step 3: Calculate hex probabilities  
    const hexProbability = this.calculateHexProbabilities()
    
    this.analysis = {
      adjacencies,
      vertexProduction,
      hexProbability
    }
    
    console.timeEnd('Board Analysis')
    return this.analysis
  }
  
  private calculateVertexProduction(adjacencies: AdjacencyMaps): Map<string, ProductionValue> {
    const productionMap = new Map<string, ProductionValue>()
    
    for (const [vertexId, hexIds] of adjacencies.vertexToHexes) {
      const byResource: Record<ResourceType, number> = {
        wood: 0, brick: 0, ore: 0, wheat: 0, sheep: 0
      }
      
      let totalExpected = 0
      let highValueHexes = 0
      
      hexIds.forEach(hexId => {
        const hex = this.board.hexes.get(hexId)
        if (hex && hex.terrain !== 'desert' && hex.numberToken) {
          const probability = DICE_PROBABILITY[hex.numberToken] || 0
          const resourceType = this.getResourceForTerrain(hex.terrain)
          
          if (resourceType) {
            byResource[resourceType] += probability
            totalExpected += probability
          }
          
          if (hex.numberToken === 6 || hex.numberToken === 8) {
            highValueHexes++
          }
        }
      })
      
      const diversityScore = Object.values(byResource).filter(v => v > 0).length
      
      productionMap.set(vertexId, {
        totalExpected,
        byResource,
        diversityScore,
        highValueHexes
      })
    }
    
    return productionMap
  }
  
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
    return mapping[terrain]
  }
  
  private calculateHexProbabilities(): Map<string, number> {
    const probabilities = new Map<string, number>()
    
    for (const [hexId, hex] of this.board.hexes) {
      if (hex.numberToken) {
        probabilities.set(hexId, DICE_PROBABILITY[hex.numberToken] || 0)
      } else {
        probabilities.set(hexId, 0)
      }
    }
    
    return probabilities
  }
}
```

## 6. Performance Targets & Implementation Checklist

### 6.1 Performance Benchmarks
- Adjacency calculation: < 20ms for full board (using Honeycomb)
- Legal action generation: < 5ms for any game state
- Board analysis caching: < 50ms for full analysis
- Action validation: < 1ms per action (using working validator)

### 6.2 Implementation Phases

**Phase 1: Foundation Infrastructure (CRITICAL)**
- [x] ~~BoardAnalyzer with coordinate-based adjacency mapping~~ → **Use Honeycomb Bridge**
- [ ] Install `honeycomb-grid` in core package
- [ ] Create `honeycomb-bridge.ts` utility
- [ ] Implement `adjacency-helpers.ts` with working functions
- [ ] Fix stubbed functions in `state-validator.ts`

**Phase 2: AI Layer**
- [ ] LegalActionGenerator using working validators  
- [ ] BoardAnalyzer with cached adjacencies
- [ ] ActionPrioritizer for AI move ordering
- [ ] Integration with existing GameFlowManager

**Phase 3: Optimization & Integration**
- [ ] Performance monitoring and benchmarks
- [ ] WebSocket integration for real-time AI
- [ ] Database AI state persistence
- [ ] Frontend auto-mode controls

### 6.3 Key Advantages of This Approach

**✅ SMART STRATEGY:**
1. **Leverage Existing Work**: Fix 4 stubbed functions instead of building new system
2. **Use Proven Geometry**: Bridge to working Honeycomb Grid system
3. **Build on Solid Foundation**: Working validator enables reliable AI
4. **Incremental Implementation**: Each step builds on the previous
5. **Production Ready**: Uses existing architecture patterns

**🔧 IMPLEMENTATION NOTES:**
- The AI system builds on our existing, mostly-working validator
- Honeycomb bridge provides precise geometry without rebuilding
- Adjacency calculations are cached for performance
- All AI logic works through our existing GameFlowManager

This foundation enables implementing sophisticated AI algorithms while maintaining compatibility with our production codebase and leveraging our existing infrastructure investments.