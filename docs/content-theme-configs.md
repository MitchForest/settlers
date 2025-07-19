# Content Theming System

A comprehensive plan to transform Settlers from a fixed Catan-style game into a flexible, theme-driven game engine that supports entirely different game variants through JSON configuration.

## Table of Contents

- [Overview](#overview)
- [Current State Analysis](#current-state-analysis)
- [Target Architecture](#target-architecture)
- [Implementation Phases](#implementation-phases)
- [Example Themes](#example-themes)
- [Technical Specifications](#technical-specifications)
- [Migration Strategy](#migration-strategy)

## Overview

Currently, Settlers is hardcoded to the classic Catan resource system (wood, brick, ore, wheat, sheep) with fixed terrain types, building costs, and development cards. This document outlines how to transform it into a flexible theme engine that can support entirely different game worlds through configuration files.

### Goals

- **Content Flexibility**: Support different resources, terrains, buildings, and cards per theme
- **Gameplay Variants**: Enable themes with different mechanics (e.g., 6 resources instead of 5)
- **Visual Theming**: Seamless integration with existing UI theming system
- **Backwards Compatibility**: Maintain support for classic Settlers gameplay
- **Performance**: Runtime theme switching without game restart

## Current State Analysis

### ✅ What's Already Themeable

Our existing theme system (`/themes/settlers/config.json`) already supports:

```json
{
  "resources": [
    {
      "id": "forest",
      "name": "Forest",
      "description": "Dense woodlands that produce lumber",
      "color": "#2D5016",
      "icon": "🌲",
      "resourceProduced": "wood",
      "texture": "/themes/settlers/assets/terrains/forest.png"
    }
  ],
  "resourceMapping": {
    "wood": {
      "displayName": "Wood",
      "description": "Lumber from the forests",
      "icon": "🪵",
      "color": "#8B4513"
    }
  },
  "developmentCards": {
    "knight": {
      "displayName": "Knight",
      "description": "Move the robber and steal a resource",
      "icon": "⚔️",
      "color": "#FF6B6B"
    }
  }
}
```

**Capabilities**: Display names, descriptions, icons, colors, textures for visual theming.

### ❌ What's Hardcoded

#### Resource System (`packages/core/src/types.ts`)
```typescript
export type ResourceType = 'wood' | 'brick' | 'ore' | 'wheat' | 'sheep'
export type TerrainType = 'forest' | 'hills' | 'mountains' | 'fields' | 'pasture' | 'desert' | 'sea'

export interface ResourceCards {
  wood: number
  brick: number
  ore: number
  wheat: number
  sheep: number
}
```

#### Game Constants (`packages/core/src/constants.ts`)
```typescript
export const TERRAIN_DISTRIBUTION = {
  forest: 4,    // Wood
  pasture: 4,   // Sheep
  fields: 4,    // Wheat
  hills: 3,     // Brick
  mountains: 3, // Ore
  desert: 1     // No resource
}

export const BUILDING_COSTS = {
  settlement: {
    wood: 1, brick: 1, wheat: 1, sheep: 1, ore: 0
  }
}

export const DEVELOPMENT_CARD_COUNTS = {
  knight: 14, victory: 5, roadBuilding: 2, yearOfPlenty: 2, monopoly: 2
}
```

**Problems**: 
- Fixed 5-resource system
- Hardcoded terrain distribution
- Static building costs
- Fixed development card types and counts

## Target Architecture

### Theme Configuration Schema

```typescript
interface GameThemeConfig {
  meta: {
    id: string
    name: string
    description: string
    version: string
    author: string
    gameVariant: string  // "settlers", "space", "medieval", etc.
  }
  
  gameConfig: {
    resources: ResourceDefinition[]
    terrains: TerrainDefinition[]
    buildings: BuildingDefinition[]
    developmentCards: DevelopmentCardDefinition[]
    gameRules: GameRulesConfig
    boardConfig: BoardConfiguration
  }
  
  uiConfig: {
    // Existing UI theming...
  }
}
```

### Dynamic Type System

Replace hardcoded types with runtime configuration:

```typescript
// Before (hardcoded)
export type ResourceType = 'wood' | 'brick' | 'ore' | 'wheat' | 'sheep'
export interface ResourceCards {
  wood: number
  brick: number
  ore: number
  wheat: number
  sheep: number
}

// After (dynamic)
export type ResourceCards = Record<string, number>
export interface GameTheme {
  getResourceTypes(): string[]
  getTerrainTypes(): string[]
  getBuildingTypes(): string[]
  createEmptyResourceCards(): ResourceCards
}
```

## Implementation Phases

### Phase 1: Theme Configuration Schema (Week 1-2)

**Goal**: Define comprehensive theme configuration format

#### 1.1 Core Data Structures

```typescript
// packages/core/src/theme-types.ts
export interface ResourceDefinition {
  id: string                    // "energy", "metal", "plasma"
  name: string                  // "Energy Crystals"
  description: string           // "Harvested from stellar cores"
  icon: string                  // "⚡"
  color: string                 // "#FFD700"
  category?: string             // "basic", "advanced", "rare"
}

export interface TerrainDefinition {
  id: string                    // "nebula", "asteroid_field"
  name: string                  // "Stellar Nebula"
  description: string           // "Swirling clouds of cosmic energy"
  resourceProduced: string | null  // "energy" or null for void
  color: string                 // "#9D4EDD"
  icon: string                  // "🌌"
  texture?: string              // "/themes/space/assets/nebula.png"
  rarity?: number               // 1-5 scale for procedural generation
}

export interface BuildingDefinition {
  id: string                    // "station", "megastation", "hyperlane"
  name: string                  // "Space Station"
  description: string           // "A small orbital habitat"
  icon: string                  // "🛰️"
  color: string                 // "#00D9FF"
  buildingType: 'settlement' | 'city' | 'road'  // Core mechanics mapping
  victoryPoints: number         // 1, 2, 0
  cost: ResourceCards          // { energy: 1, metal: 1, oxygen: 1 }
  maxCount: number             // 5 stations, 4 megastations, 15 hyperlanes
  upgradeFrom?: string         // "station" -> "megastation"
}

export interface DevelopmentCardDefinition {
  id: string                    // "starship", "teleport", "victory_data"
  name: string                  // "Starship Fleet"
  description: string           // "Deploy starships to move space pirates"
  icon: string                  // "🚀"
  color: string                 // "#FF6B6B"
  cardType: 'action' | 'victory' | 'reaction'  // Core mechanics
  count: number                 // 14 starships in deck
  cost: ResourceCards          // { plasma: 1, metal: 1, data: 1 }
  effect?: CardEffectDefinition // Custom card effects
}
```

#### 1.2 Game Rules Configuration

```typescript
export interface GameRulesConfig {
  victoryPoints: number         // 10 for classic, could be 12 for complex themes
  minPlayers: number           // 3-4 typically
  maxPlayers: number
  handLimit: number            // 7 cards before discard
  maxTradeRatio: number        // 4:1 bank trade
  longestRoadMinimum: number   // 5 for bonus
  largestArmyMinimum: number   // 3 for bonus
  playCardDelay: number        // 1 turn delay for dev cards
}

export interface BoardConfiguration {
  hexCount: number             // 19 for classic
  distribution: Record<string, number>  // { "nebula": 4, "asteroid": 3, ... }
  numberTokens: number[]       // [2,3,3,4,4,5,5,6,6,8,8,9,9,10,10,11,11,12]
  specialHexes?: {             // Optional special mechanics
    voidHex: string           // "void" - where robber starts
    portHexes?: PortConfig[]
  }
}
```

#### 1.3 Complete Theme Example

```json
{
  "meta": {
    "id": "space-settlers",
    "name": "Space Settlers",
    "description": "Colonize the galaxy with space stations and starships",
    "version": "1.0.0",
    "author": "Settlers Team",
    "gameVariant": "space"
  },
  "gameConfig": {
    "resources": [
      {
        "id": "energy",
        "name": "Energy Crystals",
        "description": "Pure energy harvested from stellar cores",
        "icon": "⚡",
        "color": "#FFD700",
        "category": "basic"
      },
      {
        "id": "metal",
        "name": "Refined Metals",
        "description": "Processed materials from asteroid mining",
        "icon": "🔩",
        "color": "#8E9AAF",
        "category": "basic"
      },
      {
        "id": "plasma",
        "name": "Plasma Cores",
        "description": "Highly volatile energy sources",
        "icon": "🌟",
        "color": "#FF006E",
        "category": "advanced"
      },
      {
        "id": "oxygen",
        "name": "Oxygen",
        "description": "Life-sustaining atmosphere",
        "icon": "💨",
        "color": "#00B4D8",
        "category": "basic"
      },
      {
        "id": "data",
        "name": "Quantum Data",
        "description": "Advanced computational resources",
        "icon": "💾",
        "color": "#9D4EDD",
        "category": "advanced"
      }
    ],
    "terrains": [
      {
        "id": "nebula",
        "name": "Stellar Nebula",
        "description": "Swirling clouds of cosmic energy",
        "resourceProduced": "energy",
        "color": "#FFD700",
        "icon": "🌌",
        "texture": "/themes/space/assets/nebula.png"
      },
      {
        "id": "asteroid_field",
        "name": "Asteroid Field",
        "description": "Dense clusters of metallic asteroids",
        "resourceProduced": "metal",
        "color": "#8E9AAF",
        "icon": "☄️",
        "texture": "/themes/space/assets/asteroid.png"
      },
      {
        "id": "plasma_storm",
        "name": "Plasma Storm",
        "description": "Violent energy phenomena",
        "resourceProduced": "plasma",
        "color": "#FF006E",
        "icon": "⚡",
        "texture": "/themes/space/assets/plasma.png"
      },
      {
        "id": "gas_giant",
        "name": "Gas Giant",
        "description": "Massive planet with atmospheric processing",
        "resourceProduced": "oxygen",
        "color": "#00B4D8",
        "icon": "🪐",
        "texture": "/themes/space/assets/gas_giant.png"
      },
      {
        "id": "data_hub",
        "name": "Data Nexus",
        "description": "Ancient alien computational networks",
        "resourceProduced": "data",
        "color": "#9D4EDD",
        "icon": "🧠",
        "texture": "/themes/space/assets/data_hub.png"
      },
      {
        "id": "void",
        "name": "Deep Space",
        "description": "Empty void between star systems",
        "resourceProduced": null,
        "color": "#000814",
        "icon": "🌑",
        "texture": "/themes/space/assets/void.png"
      }
    ],
    "buildings": [
      {
        "id": "station",
        "name": "Space Station",
        "description": "Basic orbital habitat for colonists",
        "icon": "🛰️",
        "color": "#00D9FF",
        "buildingType": "settlement",
        "victoryPoints": 1,
        "cost": { "energy": 1, "metal": 1, "oxygen": 1, "data": 1 },
        "maxCount": 5
      },
      {
        "id": "megastation",
        "name": "Mega Station",
        "description": "Massive space city housing thousands",
        "icon": "🏙️",
        "color": "#FF9F1C",
        "buildingType": "city",
        "victoryPoints": 2,
        "cost": { "plasma": 2, "metal": 3 },
        "maxCount": 4,
        "upgradeFrom": "station"
      },
      {
        "id": "hyperlane",
        "name": "Hyperlane",
        "description": "Faster-than-light transportation network",
        "icon": "🌉",
        "color": "#9D4EDD",
        "buildingType": "road",
        "victoryPoints": 0,
        "cost": { "energy": 1, "metal": 1 },
        "maxCount": 15
      }
    ],
    "developmentCards": [
      {
        "id": "starship",
        "name": "Starship Fleet",
        "description": "Deploy starships to move space pirates and steal resources",
        "icon": "🚀",
        "color": "#FF6B6B",
        "cardType": "action",
        "count": 14,
        "cost": { "plasma": 1, "metal": 1, "data": 1 }
      },
      {
        "id": "victory_data",
        "name": "Victory Database",
        "description": "Classified information worth 1 victory point",
        "icon": "🏆",
        "color": "#FFD93D",
        "cardType": "victory",
        "count": 5,
        "cost": { "plasma": 1, "metal": 1, "data": 1 }
      },
      {
        "id": "hyperlane_builder",
        "name": "Hyperlane Constructor",
        "description": "Build two hyperlanes instantly",
        "icon": "🛣️",
        "color": "#6BCF7F",
        "cardType": "action",
        "count": 2,
        "cost": { "plasma": 1, "metal": 1, "data": 1 }
      },
      {
        "id": "resource_drone",
        "name": "Resource Drones",
        "description": "Collect any two resources from the cosmic bank",
        "icon": "🤖",
        "color": "#4ECDC4",
        "cardType": "action",
        "count": 2,
        "cost": { "plasma": 1, "metal": 1, "data": 1 }
      },
      {
        "id": "monopoly_protocol",
        "name": "Monopoly Protocol",
        "description": "All players give you all of one resource type",
        "icon": "💰",
        "color": "#45B7D1",
        "cardType": "action",
        "count": 2,
        "cost": { "plasma": 1, "metal": 1, "data": 1 }
      }
    ],
    "gameRules": {
      "victoryPoints": 10,
      "minPlayers": 3,
      "maxPlayers": 4,
      "handLimit": 7,
      "maxTradeRatio": 4,
      "longestRoadMinimum": 5,
      "largestArmyMinimum": 3,
      "playCardDelay": 1
    },
    "boardConfig": {
      "hexCount": 19,
      "distribution": {
        "nebula": 4,
        "asteroid_field": 4,
        "plasma_storm": 4,
        "gas_giant": 3,
        "data_hub": 3,
        "void": 1
      },
      "numberTokens": [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12],
      "specialHexes": {
        "voidHex": "void"
      }
    }
  }
}
```

### Phase 2: Core Engine Refactoring (Week 3-4)

**Goal**: Make core game logic theme-aware

#### 2.1 Theme Engine Class

```typescript
// packages/core/src/engine/theme-engine.ts
export class ThemeEngine {
  constructor(private config: GameThemeConfig) {}
  
  // Resource System
  getResourceTypes(): string[] {
    return this.config.gameConfig.resources.map(r => r.id)
  }
  
  createEmptyResourceCards(): ResourceCards {
    const cards: ResourceCards = {}
    this.getResourceTypes().forEach(resourceId => {
      cards[resourceId] = 0
    })
    return cards
  }
  
  getResourceDefinition(resourceId: string): ResourceDefinition | null {
    return this.config.gameConfig.resources.find(r => r.id === resourceId) || null
  }
  
  // Terrain System
  getTerrainTypes(): string[] {
    return this.config.gameConfig.terrains.map(t => t.id)
  }
  
  getTerrainDistribution(): Record<string, number> {
    return this.config.gameConfig.boardConfig.distribution
  }
  
  getResourceProducedByTerrain(terrainId: string): string | null {
    const terrain = this.config.gameConfig.terrains.find(t => t.id === terrainId)
    return terrain?.resourceProduced || null
  }
  
  // Building System
  getBuildingTypes(): string[] {
    return this.config.gameConfig.buildings.map(b => b.id)
  }
  
  getBuildingCost(buildingId: string): ResourceCards {
    const building = this.config.gameConfig.buildings.find(b => b.id === buildingId)
    return building?.cost || {}
  }
  
  getBuildingVictoryPoints(buildingId: string): number {
    const building = this.config.gameConfig.buildings.find(b => b.id === buildingId)
    return building?.victoryPoints || 0
  }
  
  getBuildingMaxCount(buildingId: string): number {
    const building = this.config.gameConfig.buildings.find(b => b.id === buildingId)
    return building?.maxCount || 0
  }
  
  // Development Cards
  getDevelopmentCardTypes(): string[] {
    return this.config.gameConfig.developmentCards.map(c => c.id)
  }
  
  getDevelopmentCardCounts(): Record<string, number> {
    const counts: Record<string, number> = {}
    this.config.gameConfig.developmentCards.forEach(card => {
      counts[card.id] = card.count
    })
    return counts
  }
  
  getDevelopmentCardCost(): ResourceCards {
    // Assume all dev cards cost the same - could be made configurable
    const firstCard = this.config.gameConfig.developmentCards[0]
    return firstCard?.cost || {}
  }
  
  // Board Generation
  generateBoard(boardId: string): Board {
    const distribution = this.getTerrainDistribution()
    const numberTokens = [...this.config.gameConfig.boardConfig.numberTokens]
    
    // Use existing board generation logic but with theme data
    return this.generateThemedBoard(boardId, distribution, numberTokens)
  }
  
  // Game Rules
  getGameRules(): GameRulesConfig {
    return this.config.gameConfig.gameRules
  }
}
```

#### 2.2 Refactor Core Types

```typescript
// packages/core/src/types.ts - Updated types
export type ResourceCards = Record<string, number>

export interface Player {
  id: PlayerId
  name: string
  color: PlayerColor
  resources: ResourceCards  // Now dynamic
  buildings: Record<string, number>  // Dynamic building types
  developmentCards: DevelopmentCard[]
  score: Score
  hasPlayedDevelopmentCard: boolean
}

export interface GameState {
  id: string
  phase: GamePhase
  turn: number
  currentPlayer: PlayerId
  players: Map<PlayerId, Player>
  board: Board
  developmentDeck: DevelopmentCard[]
  discardPile: DevelopmentCard[]
  dice: DiceRoll | null
  winner: PlayerId | null
  activeTrades: Trade[]
  startedAt: Date
  updatedAt: Date
  theme: ThemeEngine  // Add theme engine to game state
}
```

#### 2.3 Update Resource Operations

```typescript
// packages/core/src/calculations.ts - Theme-aware operations
export function hasResources(
  playerResources: ResourceCards, 
  requiredResources: ResourceCards,
  theme: ThemeEngine
): boolean {
  // Check all required resources exist and player has enough
  for (const [resourceId, requiredAmount] of Object.entries(requiredResources)) {
    if (!theme.getResourceTypes().includes(resourceId)) {
      throw new Error(`Invalid resource type: ${resourceId}`)
    }
    if ((playerResources[resourceId] || 0) < requiredAmount) {
      return false
    }
  }
  return true
}

export function subtractResources(
  from: ResourceCards, 
  subtract: ResourceCards,
  theme: ThemeEngine
): ResourceCards {
  const result = { ...from }
  
  for (const [resourceId, amount] of Object.entries(subtract)) {
    if (!theme.getResourceTypes().includes(resourceId)) {
      throw new Error(`Invalid resource type: ${resourceId}`)
    }
    result[resourceId] = (result[resourceId] || 0) - amount
  }
  
  return result
}

export function addResources(
  to: ResourceCards, 
  add: ResourceCards,
  theme: ThemeEngine
): ResourceCards {
  const result = { ...to }
  
  for (const [resourceId, amount] of Object.entries(add)) {
    if (!theme.getResourceTypes().includes(resourceId)) {
      throw new Error(`Invalid resource type: ${resourceId}`)
    }
    result[resourceId] = (result[resourceId] || 0) + amount
  }
  
  return result
}
```

### Phase 3: Game Flow Integration (Week 5-6)

**Goal**: Update game creation and action processing to use themes

#### 3.1 Theme-Aware Game Creation

```typescript
// packages/core/src/engine/game-flow.ts - Updated
export class GameFlowManager {
  constructor(
    private state: GameState,
    private theme: ThemeEngine
  ) {}
  
  static async createThemedGame(
    themeId: string,
    options: CreateGameOptions
  ): Promise<GameFlowManager> {
    // Load theme configuration
    const themeConfig = await loadGameTheme(themeId)
    const theme = new ThemeEngine(themeConfig)
    
    // Validate player count against theme rules
    const rules = theme.getGameRules()
    if (options.playerNames.length < rules.minPlayers || 
        options.playerNames.length > rules.maxPlayers) {
      throw new Error(`Invalid player count for theme ${themeId}. Must be between ${rules.minPlayers} and ${rules.maxPlayers}`)
    }
    
    // Create players with theme-aware resources
    const players = new Map<PlayerId, Player>()
    options.playerNames.forEach((name, index) => {
      const playerId = generatePlayerId()
      const player = createThemedPlayer(playerId, name, index, theme)
      players.set(playerId, player)
    })
    
    // Generate themed board
    const board = theme.generateBoard(`board-${Date.now()}`)
    
    // Create themed development deck
    const developmentDeck = createThemedDevelopmentDeck(theme)
    
    const state: GameState = {
      id: options.gameId || generateGameId(),
      phase: 'setup1',
      turn: 0,
      currentPlayer: Array.from(players.keys())[0],
      players,
      board,
      developmentDeck,
      discardPile: [],
      dice: null,
      winner: null,
      activeTrades: [],
      startedAt: new Date(),
      updatedAt: new Date(),
      theme
    }
    
    return new GameFlowManager(state, theme)
  }
}

function createThemedPlayer(
  id: PlayerId, 
  name: string, 
  colorIndex: number, 
  theme: ThemeEngine
): Player {
  // Create empty resource cards for this theme
  const resources = theme.createEmptyResourceCards()
  
  // Create empty building counts for this theme
  const buildings: Record<string, number> = {}
  theme.getBuildingTypes().forEach(buildingId => {
    buildings[buildingId] = theme.getBuildingMaxCount(buildingId)
  })
  
  return {
    id,
    name,
    color: colorIndex as PlayerColor,
    resources,
    buildings,
    developmentCards: [],
    score: { public: 0, hidden: 0, total: 0 },
    hasPlayedDevelopmentCard: false
  }
}

function createThemedDevelopmentDeck(theme: ThemeEngine): DevelopmentCard[] {
  const deck: DevelopmentCard[] = []
  const cardCounts = theme.getDevelopmentCardCounts()
  let cardId = 0
  
  for (const [cardType, count] of Object.entries(cardCounts)) {
    for (let i = 0; i < count; i++) {
      deck.push({
        id: `card-${cardId++}`,
        type: cardType,
        purchasedTurn: -1
      })
    }
  }
  
  return shuffleArray(deck)
}
```

#### 3.2 Theme-Aware Action Processing

```typescript
// packages/core/src/engine/action-processor.ts - Updated
export function processAction(
  state: GameState, 
  action: GameAction
): ProcessResult {
  const theme = state.theme
  
  switch (action.type) {
    case 'placeBuilding':
      return processPlaceBuilding(state, action, theme)
    case 'buyCard':
      return processBuyDevelopmentCard(state, action, theme)
    // ... other actions
  }
}

function processPlaceBuilding(
  state: GameState, 
  action: GameAction,
  theme: ThemeEngine
): ProcessResult {
  const { buildingType, position } = action.data
  const player = state.players.get(action.playerId)!
  
  // Validate building type exists in theme
  if (!theme.getBuildingTypes().includes(buildingType)) {
    return {
      success: false,
      newState: state,
      events: [],
      error: `Invalid building type: ${buildingType}`
    }
  }
  
  // Check building cost using theme
  const cost = theme.getBuildingCost(buildingType)
  if (!hasResources(player.resources, cost, theme)) {
    return {
      success: false,
      newState: state,
      events: [],
      error: 'Insufficient resources'
    }
  }
  
  // Check building limit
  const maxCount = theme.getBuildingMaxCount(buildingType)
  if (player.buildings[buildingType] <= 0) {
    return {
      success: false,
      newState: state,
      events: [],
      error: `No more ${buildingType} buildings available`
    }
  }
  
  // Execute building placement
  let newState = deepCloneState(state)
  const newPlayer = { ...player }
  
  // Deduct resources
  newPlayer.resources = subtractResources(player.resources, cost, theme)
  
  // Place building
  newPlayer.buildings[buildingType]--
  
  // Add victory points
  const victoryPoints = theme.getBuildingVictoryPoints(buildingType)
  newPlayer.score.public += victoryPoints
  newPlayer.score.total = newPlayer.score.public + newPlayer.score.hidden
  
  newState.players.set(action.playerId, newPlayer)
  
  return {
    success: true,
    newState,
    events: [{
      type: 'buildingPlaced',
      playerId: action.playerId,
      data: { buildingType, position, cost, victoryPoints }
    }]
  }
}
```

### Phase 4: Frontend Integration (Week 7-8)

**Goal**: Update UI to display theme-specific content

#### 4.1 Enhanced Theme Provider

```typescript
// apps/frontend/lib/theme-provider.tsx - Updated
interface GameThemeContextType {
  visualTheme: VisualTheme | null        // Existing UI theme
  gameTheme: GameThemeConfig | null      // New game content theme
  themeEngine: ThemeEngine | null        // Theme logic engine
  loading: boolean
  loadTheme: (themeId: string) => Promise<void>
  
  // Resource helpers
  getResourceName: (resourceId: string) => string
  getResourceColor: (resourceId: string) => string
  getResourceIcon: (resourceId: string) => string
  
  // Building helpers
  getBuildingName: (buildingId: string) => string
  getBuildingIcon: (buildingId: string) => string
  getBuildingCost: (buildingId: string) => ResourceCards
  
  // Development card helpers
  getCardName: (cardId: string) => string
  getCardIcon: (cardId: string) => string
  getCardDescription: (cardId: string) => string
}

export function useGameTheme() {
  const context = React.useContext(GameThemeContext)
  if (!context) {
    throw new Error('useGameTheme must be used within a ThemeProvider')
  }
  return context
}
```

#### 4.2 Dynamic Resource Display

```typescript
// apps/frontend/components/game/ui/ResourceDisplay.tsx
interface ResourceDisplayProps {
  resources: ResourceCards
  showIcons?: boolean
  showNames?: boolean
}

export function ResourceDisplay({ resources, showIcons = true, showNames = false }: ResourceDisplayProps) {
  const { themeEngine, getResourceName, getResourceIcon, getResourceColor } = useGameTheme()
  
  if (!themeEngine) {
    return <div>Loading theme...</div>
  }
  
  const resourceTypes = themeEngine.getResourceTypes()
  
  return (
    <div className="grid grid-cols-auto gap-2">
      {resourceTypes.map(resourceId => {
        const count = resources[resourceId] || 0
        const name = getResourceName(resourceId)
        const icon = getResourceIcon(resourceId)
        const color = getResourceColor(resourceId)
        
        if (count === 0 && !showNames) return null
        
        return (
          <div key={resourceId} className="flex items-center gap-1">
            {showIcons && (
              <span className="text-lg" style={{ color }}>
                {icon}
              </span>
            )}
            <span className="font-medium">{count}</span>
            {showNames && (
              <span className="text-sm text-muted-foreground">{name}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

#### 4.3 Dynamic Building Interface with Emoji Support

```typescript
// apps/frontend/components/game/ui/BuildingInterface.tsx
export function BuildingInterface({ onBuildingSelect }: { onBuildingSelect: (buildingId: string) => void }) {
  const { 
    themeEngine, 
    getBuildingName, 
    getBuildingEmoji, 
    getBuildingDescription,
    getBuildingCost 
  } = useGameTheme()
  const { gameState, currentPlayer } = useGameStore()
  
  if (!themeEngine || !currentPlayer) return null
  
  const buildingTypes = themeEngine.getBuildingTypes()
  
  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold">Buildings</h3>
      <div className="grid grid-cols-1 gap-2">
        {buildingTypes.map(buildingId => {
          const name = getBuildingName(buildingId)
          const emoji = getBuildingEmoji(buildingId)
          const description = getBuildingDescription(buildingId)
          const cost = getBuildingCost(buildingId)
          const available = currentPlayer.buildings[buildingId] || 0
          const canAfford = hasResources(currentPlayer.resources, cost, themeEngine)
          
          return (
            <HoverCard key={buildingId}>
              <HoverCardTrigger asChild>
                <Button
                  variant="outline"
                  disabled={!canAfford || available === 0}
                  onClick={() => onBuildingSelect(buildingId)}
                  className="flex items-center justify-between p-3 h-auto"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{emoji}</span>
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {available} available
                      </Badge>
                    </div>
                  </div>
                  <ResourceDisplay resources={cost} showIcons={true} compact={true} />
                </Button>
              </HoverCardTrigger>
              <HoverCardContent side="right" className="w-80">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{emoji}</span>
                    <h4 className="font-semibold">{name}</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">{description}</p>
                  <div className="flex items-center gap-2 text-sm">
                    <span>Cost:</span>
                    <ResourceDisplay resources={cost} showIcons={true} showNames={true} />
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
          )
        })}
      </div>
    </div>
  )
}

// Building piece component with emoji support
export function BuildingPiece({ 
  buildingId, 
  playerId, 
  position 
}: { 
  buildingId: string
  playerId: string
  position: { x: number, y: number }
}) {
  const { getBuildingEmoji, getBuildingName } = useGameTheme()
  const emoji = getBuildingEmoji(buildingId)
  const name = getBuildingName(buildingId)
  
  return (
    <div 
      className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer hover:scale-110 transition-transform"
      style={{ left: position.x, top: position.y }}
      title={`${name} (Player ${playerId})`}
    >
      <div className={`text-2xl drop-shadow-lg player-color-${playerId}`}>
        {emoji}
      </div>
    </div>
  )
}
```

### Phase 5: Theme Management System (Week 9-10)

**Goal**: Runtime theme switching and validation

#### 5.1 Theme Validation

```typescript
// packages/core/src/theme/theme-validator.ts
export interface ThemeValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export function validateTheme(config: GameThemeConfig): ThemeValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Validate resources
  if (config.gameConfig.resources.length === 0) {
    errors.push("Theme must define at least one resource")
  }
  
  const resourceIds = config.gameConfig.resources.map(r => r.id)
  if (new Set(resourceIds).size !== resourceIds.length) {
    errors.push("Resource IDs must be unique")
  }
  
  // Validate terrains
  for (const terrain of config.gameConfig.terrains) {
    if (terrain.resourceProduced && !resourceIds.includes(terrain.resourceProduced)) {
      errors.push(`Terrain ${terrain.id} produces unknown resource: ${terrain.resourceProduced}`)
    }
  }
  
  // Validate building costs
  for (const building of config.gameConfig.buildings) {
    for (const resourceId of Object.keys(building.cost)) {
      if (!resourceIds.includes(resourceId)) {
        errors.push(`Building ${building.id} costs unknown resource: ${resourceId}`)
      }
    }
  }
  
  // Validate board distribution
  const terrainIds = config.gameConfig.terrains.map(t => t.id)
  for (const terrainId of Object.keys(config.gameConfig.boardConfig.distribution)) {
    if (!terrainIds.includes(terrainId)) {
      errors.push(`Board distribution includes unknown terrain: ${terrainId}`)
    }
  }
  
  // Validate hex count matches distribution
  const totalHexes = Object.values(config.gameConfig.boardConfig.distribution).reduce((sum, count) => sum + count, 0)
  if (totalHexes !== config.gameConfig.boardConfig.hexCount) {
    errors.push(`Board hex count (${config.gameConfig.boardConfig.hexCount}) doesn't match distribution total (${totalHexes})`)
  }
  
  // Warnings for balance
  if (config.gameConfig.resources.length > 6) {
    warnings.push("More than 6 resources may make the game complex")
  }
  
  if (config.gameConfig.gameRules.victoryPoints > 15) {
    warnings.push("High victory point targets may make games very long")
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}
```

#### 5.2 Theme Loader

```typescript
// apps/frontend/lib/theme-loader.ts - Enhanced
export async function loadGameTheme(themeId: string): Promise<GameThemeConfig> {
  const configUrl = `/themes/${themeId}/config.json`
  
  try {
    const response = await fetch(configUrl)
    if (!response.ok) {
      throw new Error(`Failed to load theme: ${response.status}`)
    }
    
    const config: GameThemeConfig = await response.json()
    
    // Validate theme
    const validation = validateTheme(config)
    if (!validation.isValid) {
      console.error(`Theme validation failed for ${themeId}:`, validation.errors)
      throw new Error(`Invalid theme configuration: ${validation.errors.join(', ')}`)
    }
    
    if (validation.warnings.length > 0) {
      console.warn(`Theme warnings for ${themeId}:`, validation.warnings)
    }
    
    return config
  } catch (error) {
    console.error(`Failed to load theme ${themeId}:`, error)
    throw error
  }
}

export async function listAvailableThemes(): Promise<ThemeMeta[]> {
  try {
    const response = await fetch('/api/themes')
    if (!response.ok) {
      throw new Error('Failed to fetch theme list')
    }
    return await response.json()
  } catch (error) {
    console.error('Failed to list themes:', error)
    return []
  }
}
```

#### 5.3 Enhanced Theme Selector with Background Customization

```typescript
// apps/frontend/components/lobby/ThemeSelector.tsx
interface ThemeSelectorProps {
  selectedTheme: string
  onThemeChange: (themeId: string) => void
}

export function ThemeSelector({ selectedTheme, onThemeChange }: ThemeSelectorProps) {
  const [themes, setThemes] = useState<ThemeMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [customBackgroundMode, setCustomBackgroundMode] = useState<'theme' | 'solid' | 'image'>('theme')
  const [customColor, setCustomColor] = useState('#1A1A1A')
  const { setUserBackgroundPreference, getUserBackgroundPreference } = useGameTheme()
  
  useEffect(() => {
    listAvailableThemes()
      .then(setThemes)
      .finally(() => setLoading(false))
      
    // Load user background preference
    const saved = getUserBackgroundPreference()
    if (saved) {
      if (saved === 'solid-color') setCustomBackgroundMode('solid')
      else if (saved === 'user-image') setCustomBackgroundMode('image')
    }
  }, [])
  
  const handleBackgroundModeChange = (mode: 'theme' | 'solid' | 'image') => {
    setCustomBackgroundMode(mode)
    if (mode === 'theme') {
      localStorage.removeItem('user-background-preference')
    } else {
      setUserBackgroundPreference(mode === 'solid' ? 'solid-color' : 'user-image')
    }
  }
  
  if (loading) {
    return <div>Loading themes...</div>
  }
  
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Select Game Theme</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {themes.map(theme => (
            <Card 
              key={theme.id} 
              className={cn(
                "cursor-pointer transition-all duration-200 hover:shadow-md",
                selectedTheme === theme.id && "ring-2 ring-primary"
              )}
              onClick={() => onThemeChange(theme.id)}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">🎨</span>
                  {theme.name}
                </CardTitle>
                <CardDescription>{theme.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  Version {theme.version} by {theme.author}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      
      <Separator />
      
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Background Customization</h3>
        <RadioGroup value={customBackgroundMode} onValueChange={handleBackgroundModeChange}>
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="theme" id="bg-theme" />
              <Label htmlFor="bg-theme">Use theme default background</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="solid" id="bg-solid" />
              <Label htmlFor="bg-solid">Solid color background</Label>
            </div>
            
            {customBackgroundMode === 'solid' && (
              <div className="ml-6 flex items-center gap-2">
                <Input
                  type="color"
                  value={customColor}
                  onChange={(e) => setCustomColor(e.target.value)}
                  className="w-16 h-8"
                />
                <span className="text-sm text-muted-foreground">Choose color</span>
              </div>
            )}
            
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="image" id="bg-image" />
              <Label htmlFor="bg-image">Custom background image</Label>
            </div>
            
            {customBackgroundMode === 'image' && (
              <div className="ml-6">
                <BackgroundImageUploader />
              </div>
            )}
          </div>
        </RadioGroup>
      </div>
    </div>
  )
}

// Background image uploader component
function BackgroundImageUploader() {
  const [dragActive, setDragActive] = useState(false)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files)
    }
  }, [])
  
  const handleFiles = (files: FileList) => {
    const file = files[0]
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        setUploadedImage(result)
        localStorage.setItem('user-background-image', result)
      }
      reader.readAsDataURL(file)
    }
  }
  
  return (
    <div
      className={cn(
        "relative border-2 border-dashed rounded-lg p-6 text-center transition-colors",
        dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25"
      )}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <input
        type="file"
        accept="image/*"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
        className="absolute inset-0 opacity-0 cursor-pointer"
      />
      
      {uploadedImage ? (
        <div className="space-y-2">
          <img 
            src={uploadedImage} 
            alt="Background preview" 
            className="max-w-full max-h-32 mx-auto rounded"
          />
          <p className="text-sm text-muted-foreground">Background image uploaded</p>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              setUploadedImage(null)
              localStorage.removeItem('user-background-image')
            }}
          >
            Remove
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-muted-foreground">
            📁 Drop an image here or click to browse
          </div>
          <p className="text-xs text-muted-foreground">
            Supports JPG, PNG, GIF up to 5MB
          </p>
        </div>
      )}
    </div>
  )
}
```

## Example Themes

### 1. Classic Settlers (Default)

Maintains the traditional Catan experience with light mode:

```json
{
  "meta": {
    "id": "settlers-classic",
    "name": "Classic Settlers",
    "gameVariant": "classic"
  },
  "uiConfig": {
    "mode": "light",
    "customBackgrounds": {
      "type": "gradient",
      "primary": "#F5F4ED",
      "secondary": "#E8F5E8",
      "opacity": 1.0
    },
    "glass": {
      "primary": "rgba(255, 255, 255, 0.1)",
      "secondary": "rgba(255, 255, 255, 0.05)",
      "border": "rgba(255, 255, 255, 0.2)",
      "backdropBlur": "8px"
    }
  },
  "gameConfig": {
    "resources": [
      { "id": "wood", "name": "Wood", "icon": "🪵", "color": "#8B4513" },
      { "id": "brick", "name": "Brick", "icon": "🧱", "color": "#CD5C5C" },
      { "id": "ore", "name": "Ore", "icon": "⚱️", "color": "#696969" },
      { "id": "wheat", "name": "Wheat", "icon": "🌾", "color": "#DAA520" },
      { "id": "sheep", "name": "Wool", "icon": "🧶", "color": "#F5F5DC" }
    ],
    "terrains": [
      { "id": "forest", "name": "Forest", "resourceProduced": "wood", "icon": "🌲" },
      { "id": "hills", "name": "Hills", "resourceProduced": "brick", "icon": "🏔️" },
      { "id": "mountains", "name": "Mountains", "resourceProduced": "ore", "icon": "⛰️" },
      { "id": "fields", "name": "Fields", "resourceProduced": "wheat", "icon": "🌾" },
      { "id": "pasture", "name": "Pasture", "resourceProduced": "sheep", "icon": "🐑" },
      { "id": "desert", "name": "Desert", "resourceProduced": null, "icon": "🏜️" }
    ],
    "buildings": [
      {
        "id": "settlement",
        "name": "Settlement",
        "emoji": "🏘️",
        "icon": "🏘️",
        "description": "A small village where settlers live",
        "buildingType": "settlement",
        "cost": { "wood": 1, "brick": 1, "wheat": 1, "sheep": 1 }
      },
      {
        "id": "city",
        "name": "City",
        "emoji": "🏛️",
        "icon": "🏛️", 
        "description": "A large settlement with advanced facilities",
        "buildingType": "city",
        "cost": { "wheat": 2, "ore": 3 }
      },
      {
        "id": "road",
        "name": "Road",
        "emoji": "🛤️",
        "icon": "🛤️",
        "description": "Wooden paths connecting settlements",
        "buildingType": "road",
        "cost": { "wood": 1, "brick": 1 }
      }
    ],
    "developmentCards": [
      {
        "id": "knight",
        "name": "Knight",
        "icon": "⚔️",
        "emoji": "⚔️",
        "description": "Move the robber and steal a resource"
      },
      {
        "id": "victory",
        "name": "Victory Point",
        "icon": "🏆",
        "emoji": "🏆",
        "cardType": "victory"
      },
      {
        "id": "roadBuilding",
        "name": "Road Building",
        "icon": "🛣️",
        "emoji": "🛣️",
        "description": "Build two roads for free"
      }
    ]
  }
}
```

### 2. Medieval Fantasy

Knights, castles, and magic with medieval theming:

```json
{
  "meta": {
    "id": "medieval-fantasy",
    "name": "Medieval Fantasy",
    "gameVariant": "fantasy"
  },
  "uiConfig": {
    "mode": "light",
    "customBackgrounds": {
      "type": "gradient",
      "primary": "#8B4513",
      "secondary": "#DEB887",
      "opacity": 0.8
    },
    "glass": {
      "primary": "rgba(139, 69, 19, 0.15)",
      "secondary": "rgba(139, 69, 19, 0.08)",
      "border": "rgba(139, 69, 19, 0.25)",
      "backdropBlur": "8px"
    }
  },
  "gameConfig": {
    "resources": [
      { "id": "wood", "name": "Timber", "icon": "🪵", "color": "#8B4513" },
      { "id": "stone", "name": "Stone", "icon": "🪨", "color": "#696969" },
      { "id": "iron", "name": "Iron", "icon": "⚔️", "color": "#2F4F4F" },
      { "id": "grain", "name": "Grain", "icon": "🌾", "color": "#DAA520" },
      { "id": "livestock", "name": "Livestock", "icon": "🐄", "color": "#CD853F" },
      { "id": "mana", "name": "Mana", "icon": "✨", "color": "#9370DB" }
    ],
    "terrains": [
      { "id": "enchanted_forest", "name": "Enchanted Forest", "resourceProduced": "mana", "icon": "🌲" },
      { "id": "quarry", "name": "Stone Quarry", "resourceProduced": "stone", "icon": "⛰️" },
      { "id": "iron_mine", "name": "Iron Mine", "resourceProduced": "iron", "icon": "⛏️" },
      { "id": "farmland", "name": "Farmland", "resourceProduced": "grain", "icon": "🌾" },
      { "id": "pasture", "name": "Pasture", "resourceProduced": "livestock", "icon": "🐄" },
      { "id": "forest", "name": "Forest", "resourceProduced": "wood", "icon": "🌳" }
    ],
    "buildings": [
      {
        "id": "village",
        "name": "Village",
        "emoji": "🏘️",
        "icon": "🏘️",
        "description": "A humble settlement of peasants",
        "buildingType": "settlement",
        "cost": { "wood": 1, "stone": 1, "grain": 1, "livestock": 1 }
      },
      {
        "id": "castle",
        "name": "Castle",
        "emoji": "🏰",
        "icon": "🏰",
        "description": "A mighty fortress of stone and steel",
        "buildingType": "city",
        "cost": { "stone": 3, "iron": 2 }
      },
      {
        "id": "road",
        "name": "Road",
        "emoji": "🛤️",
        "icon": "🛤️",
        "description": "Well-traveled paths between settlements",
        "buildingType": "road",
        "cost": { "wood": 1, "stone": 1 }
      }
    ],
    "developmentCards": [
      {
        "id": "knight",
        "name": "Knight",
        "icon": "⚔️",
        "emoji": "⚔️",
        "description": "Move the dragon and pillage resources"
      },
      {
        "id": "magic_scroll",
        "name": "Magic Scroll",
        "icon": "📜",
        "emoji": "📜",
        "description": "Cast powerful spells to aid your kingdom"
      },
      {
        "id": "royal_decree",
        "name": "Royal Decree",
        "icon": "👑",
        "emoji": "👑",
        "description": "Command all players to give you one resource type"
      }
    ]
  }
}
```

### 3. Underwater Civilization

Exploring the ocean depths with aquatic UI:

```json
{
  "meta": {
    "id": "underwater-civilization",
    "name": "Underwater Civilization",
    "gameVariant": "aquatic"
  },
  "uiConfig": {
    "mode": "dark",
    "customBackgrounds": {
      "type": "gradient",
      "primary": "#001845",
      "secondary": "#003d82",
      "opacity": 0.95
    },
    "glass": {
      "primary": "rgba(0, 212, 255, 0.1)",
      "secondary": "rgba(0, 212, 255, 0.05)",
      "border": "rgba(0, 212, 255, 0.3)",
      "backdropBlur": "16px"
    }
  },
  "gameConfig": {
    "resources": [
      { "id": "kelp", "name": "Kelp", "icon": "🌱", "color": "#228B22" },
      { "id": "coral", "name": "Coral", "icon": "🪸", "color": "#FF7F50" },
      { "id": "minerals", "name": "Minerals", "icon": "💎", "color": "#4169E1" },
      { "id": "plankton", "name": "Plankton", "icon": "🦠", "color": "#32CD32" },
      { "id": "pearls", "name": "Pearls", "icon": "🦪", "color": "#F0F8FF" }
    ],
    "terrains": [
      { "id": "kelp_forest", "name": "Kelp Forest", "resourceProduced": "kelp", "icon": "🌊" },
      { "id": "coral_reef", "name": "Coral Reef", "resourceProduced": "coral", "icon": "🪸" },
      { "id": "thermal_vent", "name": "Thermal Vent", "resourceProduced": "minerals", "icon": "🌋" },
      { "id": "plankton_bloom", "name": "Plankton Bloom", "resourceProduced": "plankton", "icon": "✨" },
      { "id": "pearl_bed", "name": "Pearl Bed", "resourceProduced": "pearls", "icon": "🦪" },
      { "id": "deep_trench", "name": "Deep Trench", "resourceProduced": null, "icon": "🕳️" }
    ],
    "buildings": [
      {
        "id": "sea_colony",
        "name": "Sea Colony",
        "emoji": "🏘️",
        "icon": "🏘️",
        "description": "Small underwater settlement",
        "buildingType": "settlement",
        "cost": { "kelp": 1, "coral": 1, "plankton": 1, "pearls": 1 }
      },
      {
        "id": "underwater_city",
        "name": "Underwater City",
        "emoji": "🏙️", 
        "icon": "🏙️",
        "description": "Massive underwater metropolis",
        "buildingType": "city",
        "cost": { "minerals": 3, "coral": 2 }
      },
      {
        "id": "current",
        "name": "Ocean Current",
        "emoji": "🌊",
        "icon": "🌊",
        "description": "Swift underwater transportation",
        "buildingType": "road",
        "cost": { "kelp": 1, "coral": 1 }
      }
    ],
    "developmentCards": [
      {
        "id": "guardian",
        "name": "Sea Guardian",
        "icon": "🐙",
        "emoji": "🐙",
        "description": "Summon creatures to protect your domain"
      },
      {
        "id": "treasure",
        "name": "Sunken Treasure", 
        "icon": "💰",
        "emoji": "💰",
        "cardType": "victory"
      },
      {
        "id": "current_builder",
        "name": "Current Builder",
        "icon": "🌊",
        "emoji": "🌊",
        "description": "Build two ocean currents instantly"
      }
    ]
  }
}
```

## UI Mode and Visual Theming

### Automatic UI Mode Selection

Each theme can specify its preferred UI mode based on background darkness:

```typescript
interface UIThemeConfig {
  mode: 'light' | 'dark' | 'auto'           // Preferred UI mode
  autoModeThreshold?: number                 // Lightness threshold for auto mode (0-100)
  customBackgrounds?: {
    type: 'solid' | 'gradient' | 'image'
    primary: string
    secondary?: string
    image?: string
    opacity?: number
  }
  glass: {
    primary: string                          // Glass overlay color
    secondary: string
    border: string
    backdropBlur: string
  }
}
```

### Enhanced Theme Configuration

```json
{
  "meta": {
    "id": "space-settlers",
    "name": "Space Settlers"
  },
  "uiConfig": {
    "mode": "dark",
    "customBackgrounds": {
      "type": "gradient",
      "primary": "#0F0F23",
      "secondary": "#1A1A2E",
      "opacity": 0.9
    },
    "glass": {
      "primary": "rgba(139, 92, 246, 0.1)",
      "secondary": "rgba(139, 92, 246, 0.05)",
      "border": "rgba(139, 92, 246, 0.2)",
      "backdropBlur": "12px"
    }
  },
  "gameConfig": {
    "buildings": [
      {
        "id": "station",
        "name": "Space Station",
        "emoji": "🛰️",
        "icon": "🛰️",
        "description": "Basic orbital habitat",
        "buildingType": "settlement",
        "cost": { "energy": 1, "metal": 1 }
      },
      {
        "id": "megastation", 
        "name": "Mega Station",
        "emoji": "🏙️",
        "icon": "🏙️",
        "description": "Massive space city",
        "buildingType": "city",
        "cost": { "plasma": 2, "metal": 3 }
      },
      {
        "id": "hyperlane",
        "name": "Hyperlane",
        "emoji": "🌉",
        "icon": "🌉", 
        "description": "FTL transportation network",
        "buildingType": "road",
        "cost": { "energy": 1, "metal": 1 }
      }
    ]
  }
}
```

### UI Mode Logic

```typescript
// apps/frontend/lib/theme-ui-mode.ts
export function calculateUIMode(theme: GameThemeConfig): 'light' | 'dark' {
  const { uiConfig } = theme
  
  if (uiConfig.mode === 'light' || uiConfig.mode === 'dark') {
    return uiConfig.mode
  }
  
  // Auto mode - analyze background lightness
  if (uiConfig.mode === 'auto' && uiConfig.customBackgrounds) {
    const threshold = uiConfig.autoModeThreshold || 50
    const primaryColor = uiConfig.customBackgrounds.primary
    const lightness = calculateColorLightness(primaryColor)
    
    return lightness > threshold ? 'light' : 'dark'
  }
  
  return 'dark' // Default fallback
}

function calculateColorLightness(color: string): number {
  // Convert hex/rgb to HSL and extract lightness
  // Implementation details...
}
```

### Dynamic UI Mode Application

```typescript
// apps/frontend/components/theme-provider.tsx - Enhanced
interface GameThemeContextType {
  visualTheme: VisualTheme | null
  gameTheme: GameThemeConfig | null
  uiMode: 'light' | 'dark'
  themeEngine: ThemeEngine | null
  
  // Building emoji helpers
  getBuildingEmoji: (buildingId: string) => string
  getBuildingName: (buildingId: string) => string
  getBuildingDescription: (buildingId: string) => string
  
  // UI mode helpers
  applyCustomBackground: () => void
  getGlassStyles: () => Record<string, string>
  
  // Theme switching
  switchTheme: (themeId: string) => Promise<void>
  getUserBackgroundPreference: () => string | null
  setUserBackgroundPreference: (bg: string) => void
}

function GameThemeProvider({ children }: { children: React.ReactNode }) {
  const [gameTheme, setGameTheme] = useState<GameThemeConfig | null>(null)
  const [uiMode, setUIMode] = useState<'light' | 'dark'>('dark')
  const { setTheme } = useTheme() // next-themes
  
  const loadGameTheme = async (themeId: string) => {
    const config = await loadGameTheme(themeId)
    setGameTheme(config)
    
    // Calculate and apply UI mode
    const calculatedMode = calculateUIMode(config)
    setUIMode(calculatedMode)
    setTheme(calculatedMode) // Apply to next-themes
    
    // Apply custom background
    applyCustomBackground(config.uiConfig)
  }
  
  const applyCustomBackground = (uiConfig: UIThemeConfig) => {
    const root = document.documentElement
    
    if (uiConfig.customBackgrounds) {
      const { type, primary, secondary, image, opacity } = uiConfig.customBackgrounds
      
      if (type === 'solid') {
        root.style.setProperty('--theme-bg', primary)
        document.body.style.background = primary
      } else if (type === 'gradient') {
        const gradient = `linear-gradient(135deg, ${primary}, ${secondary || primary})`
        root.style.setProperty('--theme-bg', gradient)
        document.body.style.background = gradient
      } else if (type === 'image' && image) {
        document.body.style.background = `url('${image}') center/cover no-repeat`
        if (opacity) {
          document.body.style.setProperty('--bg-overlay-opacity', opacity.toString())
        }
      }
    }
    
    // Apply glass morphism variables
    if (uiConfig.glass) {
      root.style.setProperty('--glass-bg-primary', uiConfig.glass.primary)
      root.style.setProperty('--glass-bg-secondary', uiConfig.glass.secondary)
      root.style.setProperty('--glass-border', uiConfig.glass.border)
      root.style.setProperty('--glass-backdrop-blur', uiConfig.glass.backdropBlur)
    }
  }
  
  const getBuildingEmoji = (buildingId: string): string => {
    if (!gameTheme) return '🏠' // Default fallback
    const building = gameTheme.gameConfig.buildings.find(b => b.id === buildingId)
    return building?.emoji || building?.icon || '🏠'
  }
  
  const getBuildingName = (buildingId: string): string => {
    if (!gameTheme) return buildingId
    const building = gameTheme.gameConfig.buildings.find(b => b.id === buildingId)
    return building?.name || buildingId
  }
  
  const getBuildingDescription = (buildingId: string): string => {
    if (!gameTheme) return ''
    const building = gameTheme.gameConfig.buildings.find(b => b.id === buildingId)
    return building?.description || ''
  }
  
  // User background preference management
  const getUserBackgroundPreference = (): string | null => {
    return localStorage.getItem('user-background-preference')
  }
  
  const setUserBackgroundPreference = (bg: string): void => {
    localStorage.setItem('user-background-preference', bg)
    // Apply immediately
    if (gameTheme) {
      const customConfig = { ...gameTheme.uiConfig }
      if (bg === 'solid-color') {
        customConfig.customBackgrounds = { type: 'solid', primary: '#1A1A1A' }
      } else if (bg === 'user-image') {
        customConfig.customBackgrounds = { type: 'image', image: getUserUploadedImage() }
      }
      applyCustomBackground(customConfig)
    }
  }
  
  const switchTheme = async (themeId: string): Promise<void> => {
    await loadGameTheme(themeId)
    // Theme switching logic here
  }
}
```

## Technical Specifications

### File Structure

```
/themes/
  settlers-classic/
    config.json
    assets/
      terrains/
      pieces/
      icons/
      backgrounds/
        board-bg.jpg
        ui-overlay.png
  space-settlers/
    config.json
    assets/
      terrains/
      pieces/
      icons/
      backgrounds/
        nebula-bg.jpg
        space-overlay.png
  medieval-fantasy/
    config.json
    assets/

/packages/core/src/
  theme/
    theme-types.ts
    theme-engine.ts
    theme-validator.ts
    theme-loader.ts
  engine/
    game-flow.ts (updated)
    action-processor.ts (updated)
    board-generator.ts (updated)

/apps/frontend/lib/
  theme-provider.tsx (enhanced)
  theme-loader.ts (enhanced)

/apps/frontend/components/
  lobby/
    ThemeSelector.tsx
  game/ui/
    ResourceDisplay.tsx
    BuildingInterface.tsx
    DevelopmentCards.tsx (updated)
```

### API Endpoints

```typescript
// Theme management endpoints
GET /api/themes                    // List available themes
GET /api/themes/{id}              // Get theme details
POST /api/themes/{id}/validate    // Validate theme config
GET /themes/{id}/config.json      // Static theme config (existing)
```

### Database Schema

```sql
-- Track which themes games are using
ALTER TABLE games ADD COLUMN theme_id VARCHAR(255) DEFAULT 'settlers-classic';
CREATE INDEX idx_games_theme ON games(theme_id);

-- Store theme validation results (optional caching)
CREATE TABLE theme_validation_cache (
  theme_id VARCHAR(255) PRIMARY KEY,
  is_valid BOOLEAN NOT NULL,
  errors TEXT,
  warnings TEXT,
  validated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Migration Strategy

### Backwards Compatibility

1. **Default Theme**: All existing games use `settlers-classic` theme
2. **Legacy Support**: Existing hardcoded constants remain as fallbacks
3. **Gradual Migration**: New games can opt into themes, existing games continue normally

### Rollout Plan

1. **Week 1-2**: Core theme schema and validation
2. **Week 3-4**: Engine refactoring with feature flags
3. **Week 5-6**: Game flow integration (behind feature flag)
4. **Week 7-8**: Frontend integration
5. **Week 9-10**: Theme management and testing
6. **Week 11**: Beta testing with space theme
7. **Week 12**: Full release and documentation

### Testing Strategy

1. **Unit Tests**: Theme validation, resource operations
2. **Integration Tests**: Full games with different themes
3. **Performance Tests**: Theme switching overhead
4. **User Testing**: UX for theme selection and gameplay

### Feature Flags

```typescript
export const THEME_FEATURE_FLAGS = {
  enableContentThemes: false,      // Master switch
  enableSpaceTheme: false,         // Individual theme rollout
  enableMedievalTheme: false,
  enableThemeValidation: true,     // Always validate in dev
  enableThemeSwitching: false      // Runtime theme changes
}
```

This comprehensive plan transforms Settlers from a fixed Catan clone into a flexible game engine capable of supporting entirely different resource systems, building types, and card effects through simple JSON configuration changes. 