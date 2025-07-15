// Game constants for Settlers
// Theme-agnostic values for easy customization

import { ResourceCards, BuildingCosts, TerrainType } from './types'
import type { GameSettings } from './types'

// ============= Board Configuration =============

export const BOARD_SIZE = {
  standard: {
    hexCount: 19,
    rows: [3, 4, 5, 4, 3]  // Hexes per row
  }
}

// Standard board terrain distribution
export const TERRAIN_COUNTS: Record<TerrainType, number> = {
  terrain1: 4,  // Forest (Lumber)
  terrain2: 4,  // Pasture (Wool)
  terrain3: 4,  // Fields (Grain)
  terrain4: 3,  // Hills (Brick)
  terrain5: 3,  // Mountains (Ore)
  desert: 1
}

// Number token distribution (excluding 7)
export const NUMBER_TOKENS = [
  2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12
]

// Dice roll probabilities (out of 36)
export const ROLL_PROBABILITIES: Record<number, number> = {
  2: 1,
  3: 2,
  4: 3,
  5: 4,
  6: 5,
  7: 6,  // Triggers blocker
  8: 5,
  9: 4,
  10: 3,
  11: 2,
  12: 1
}

// Red numbers (most likely to roll)
export const HIGH_PROBABILITY_NUMBERS = [6, 8]

// ============= Game Rules =============

export const GAME_RULES = {
  minPlayers: 3,
  maxPlayers: 4,
  victoryPoints: 10,
  
  // Building limits per player
  maxSettlements: 5,
  maxCities: 4,
  maxConnections: 15,
  
  // Special achievements
  longestPathMinimum: 5,
  largestForceMinimum: 3,
  
  // Resource limits
  handLimitBeforeDiscard: 7,
  discardAmount: 0.5,  // Discard half (rounded down)
  
  // Trading ratios
  bankTradeRatio: 4,     // 4:1 with bank
  genericPortRatio: 3,   // 3:1 at generic port
  specialPortRatio: 2,   // 2:1 at specific port
}

// ============= Building Costs =============

export const BUILDING_COSTS: BuildingCosts = {
  settlement: {
    resource1: 1,  // Lumber
    resource2: 1,  // Wool
    resource3: 1,  // Grain
    resource4: 1,  // Brick
    resource5: 0   // Ore
  },
  city: {
    resource3: 2,  // Grain
    resource5: 3   // Ore
  },
  connection: {
    resource1: 1,  // Lumber
    resource2: 0,  // Wool
    resource3: 0,  // Grain
    resource4: 1,  // Brick
    resource5: 0   // Ore
  },
  developmentCard: {
    resource1: 0,  // Lumber
    resource2: 1,  // Wool
    resource3: 1,  // Grain
    resource4: 0,  // Brick
    resource5: 1   // Ore
  }
}

// ============= Development Cards =============

export const DEVELOPMENT_CARD_COUNTS = {
  knight: 14,
  progress1: 2,    // Road Building
  progress2: 2,    // Year of Plenty
  progress3: 2,    // Monopoly
  victory: 5
}

export const TOTAL_DEVELOPMENT_CARDS = 25

// ============= Resource Cards =============

export const RESOURCE_CARD_COUNT = 19  // Per resource type
export const TOTAL_RESOURCE_CARDS = 95

// ============= Victory Points =============

export const VICTORY_POINTS = {
  settlement: 1,
  city: 2,
  longestPath: 2,
  largestForce: 2,
  developmentCard: 1  // Victory point cards
}

// ============= Port Configuration =============

export const PORT_LOCATIONS = 9  // Total number of ports
export const GENERIC_PORTS = 4
export const SPECIAL_PORTS = 5   // One for each resource

// ============= Animation Durations (ms) =============

export const ANIMATION_DURATIONS = {
  diceRoll: 1000,
  resourceCollection: 600,
  buildingPlacement: 400,
  cardFlip: 600,
  cardPlay: 800,
  turnTransition: 300,
  tradeSlide: 250,
  blockerMove: 500,
  victoryReveal: 2000
}

// ============= Sound Keys =============

export const SOUND_KEYS = {
  diceRoll: 'dice-roll',
  diceHit: 'dice-hit',
  resourceCollect: 'resource-collect',
  buildPlace: 'build-place',
  cardDraw: 'card-draw',
  cardPlay: 'card-play',
  tradeComplete: 'trade-complete',
  turnStart: 'turn-start',
  blockerPlace: 'blocker-place',
  victoryFanfare: 'victory-fanfare',
  buttonClick: 'button-click',
  errorBuzz: 'error-buzz'
}

// ============= UI Constants =============

export const UI_CONSTANTS = {
  hexSize: 60,  // Base hex size in pixels
  hexSpacing: 2,
  
  // Z-index layers
  zIndex: {
    board: 1,
    connections: 2,
    buildings: 3,
    blocker: 4,
    cards: 5,
    ui: 10,
    modal: 20,
    toast: 30
  },
  
  // Touch targets
  minTouchTarget: 44,  // Minimum touch target size (px)
  
  // Responsive breakpoints
  breakpoints: {
    mobile: 768,
    tablet: 1024,
    desktop: 1440
  }
}

// ============= Timing Constants =============

export const TIMING = {
  turnTimeout: 90000,        // 90 seconds per turn
  tradeTimeout: 30000,       // 30 seconds to respond to trade
  discardTimeout: 60000,     // 60 seconds to discard
  reconnectTimeout: 30000,   // 30 seconds to reconnect
  
  // Delays
  aiThinkingDelay: 2000,     // AI "thinking" time
  resourceDistributionDelay: 100,  // Delay between resource animations
}

// ============= Initial Resources =============

// Resources given for second settlement in setup
export const SETUP_RESOURCE_MULTIPLIER = 1

// ============= Error Messages =============

export const ERROR_MESSAGES = {
  invalidPlacement: 'Invalid placement location',
  insufficientResources: 'Not enough resources',
  notYourTurn: 'It\'s not your turn',
  gameNotStarted: 'Game has not started yet',
  gameFull: 'Game is full',
  disconnected: 'Connection lost',
  invalidTrade: 'Invalid trade offer',
  cantBuildMore: 'Building limit reached',
  mustDiscard: 'You must discard cards first',
  noValidTargets: 'No valid targets for this action'
}

// ============= Success Messages =============

export const SUCCESS_MESSAGES = {
  gameCreated: 'Game created successfully',
  gameJoined: 'Joined game successfully',
  buildingPlaced: 'Building placed successfully',
  tradeCompleted: 'Trade completed',
  cardPurchased: 'Development card purchased',
  turnEnded: 'Turn ended',
  gameWon: 'Congratulations! You won!'
} 

// ============= Board Layouts =============
export const BOARD_LAYOUTS = {
  standard: {
    name: 'Standard',
    hexes: [
      // Row 1
      { q: -2, r: 0, terrain: 'terrain1', number: 11 },
      { q: -1, r: 0, terrain: 'terrain2', number: 12 },
      { q: 0, r: 0, terrain: 'terrain3', number: 9 },
      // Row 2  
      { q: -2, r: 1, terrain: 'terrain4', number: 4 },
      { q: -1, r: 1, terrain: 'terrain5', number: 6 },
      { q: 0, r: 1, terrain: 'terrain4', number: 5 },
      { q: 1, r: 1, terrain: 'terrain2', number: 10 },
      // Row 3
      { q: -2, r: 2, terrain: 'desert', number: null },
      { q: -1, r: 2, terrain: 'terrain1', number: 3 },
      { q: 0, r: 2, terrain: 'terrain3', number: 11 },
      { q: 1, r: 2, terrain: 'terrain1', number: 4 },
      { q: 2, r: 2, terrain: 'terrain3', number: 8 },
      // Row 4
      { q: -1, r: 3, terrain: 'terrain4', number: 8 },
      { q: 0, r: 3, terrain: 'terrain5', number: 10 },
      { q: 1, r: 3, terrain: 'terrain2', number: 9 },
      { q: 2, r: 3, terrain: 'terrain5', number: 3 },
      // Row 5
      { q: 0, r: 4, terrain: 'terrain5', number: 5 },
      { q: 1, r: 4, terrain: 'terrain3', number: 2 },
      { q: 2, r: 4, terrain: 'terrain2', number: 6 }
    ],
    ports: [
      { position: { q: -3, r: 1, s: 2 }, type: 'generic', ratio: 3 },
      { position: { q: -2, r: -1, s: 3 }, type: 'resource1', ratio: 2 },
      { position: { q: 1, r: -1, s: 0 }, type: 'resource2', ratio: 2 },
      { position: { q: 3, r: 1, s: -4 }, type: 'generic', ratio: 3 },
      { position: { q: 3, r: 3, s: -6 }, type: 'resource4', ratio: 2 },
      { position: { q: 1, r: 5, s: -6 }, type: 'generic', ratio: 3 },
      { position: { q: -1, r: 5, s: -4 }, type: 'resource5', ratio: 2 },
      { position: { q: -3, r: 3, s: 0 }, type: 'resource3', ratio: 2 },
      { position: { q: -3, r: 2, s: 1 }, type: 'generic', ratio: 3 }
    ]
  }
}

// ============= Default Game Settings =============
export const DEFAULT_GAME_SETTINGS: GameSettings = {
  victoryPoints: 10,
  boardLayout: 'standard',
  randomizeBoard: true,
  randomizePlayerOrder: true,
  allowUndo: false,
  turnTimerSeconds: 0, // 0 = no timer
  privateTradeEnabled: true,
  developmentCardLimit: 0 // 0 = no limit
} 