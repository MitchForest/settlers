// Game constants for Settlers (Catan) implementation
// All identifiers use standard Settlers terminology

import { ResourceCards, DevelopmentCardType } from './types'

// ============= Terrain Distribution =============

// Standard Catan terrain distribution (19 hexes total)
export const TERRAIN_DISTRIBUTION = {
  forest: 4,    // Wood
  pasture: 4,   // Sheep
  fields: 4,    // Wheat
  hills: 3,     // Brick
  mountains: 3, // Ore
  desert: 1     // No resource
}

// ============= Number Token Distribution =============

// Standard number distribution (exclude 7, desert gets no number)
export const NUMBER_TOKENS = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12]

// Probability of rolling each number
export const NUMBER_PROBABILITIES: Record<number, number> = {
  2: 1, 12: 1,
  3: 2, 11: 2,
  4: 3, 10: 3,
  5: 4, 9: 4,
  6: 5, 8: 5
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
  maxRoads: 15,
  
  // Special achievements
  longestRoadMinimum: 5,
  largestArmyMinimum: 3,
  
  // Resource limits
  handLimitBeforeDiscard: 7,
  maxTradeRatio: 4,  // 4:1 default trade ratio
  
  // Development cards
  maxDevelopmentCards: 25,
  playCardDelay: 1  // Cannot play card same turn it was bought
}

// ============= Building Costs =============

export const BUILDING_COSTS = {
  settlement: {
    wood: 1,
    brick: 1,
    wheat: 1,
    sheep: 1,
    ore: 0
  } as ResourceCards,
  
  city: {
    wood: 0,
    brick: 0,
    wheat: 2,
    sheep: 0,
    ore: 3
  } as ResourceCards,
  
  road: {
    wood: 1,
    brick: 1,
    wheat: 0,
    sheep: 0,
    ore: 0
  } as ResourceCards,
  
  developmentCard: {
    wood: 0,
    brick: 0,
    wheat: 1,
    sheep: 1,
    ore: 1
  } as ResourceCards
}

// ============= Victory Points =============

export const VICTORY_POINTS = {
  settlement: 1,
  city: 2,
  victoryCard: 1,
  longestRoad: 2,
  largestArmy: 2
}

// ============= Development Card Distribution =============

export const DEVELOPMENT_CARD_COUNTS: Record<DevelopmentCardType, number> = {
  knight: 14,
  victory: 5,
  roadBuilding: 2,
  yearOfPlenty: 2,
  monopoly: 2
}

// ============= Bank Resources =============

// Standard Catan bank starting inventory
export const BANK_STARTING_RESOURCES = {
  wood: 19,
  brick: 19,
  ore: 19,
  wheat: 19,
  sheep: 19
} as const

// ============= Resource Creation Helpers =============

export function createResourceCards(
  wood = 0,
  brick = 0,
  ore = 0,
  wheat = 0,
  sheep = 0
): ResourceCards {
  return { wood, brick, ore, wheat, sheep }
}

// ============= Error Messages =============

export const ERROR_MESSAGES = {
  invalidPlayer: 'Invalid player',
  notPlayerTurn: 'Not your turn',
  invalidPhase: 'Invalid game phase for this action',
  insufficientResources: 'Insufficient resources',
  invalidPlacement: 'Invalid placement location',
  buildingLimitReached: 'Building limit reached',
  noCardsToPlay: 'No cards available to play',
  gameEnded: 'Game has ended',
  cardPlayDelay: 'Cannot play card on same turn it was purchased'
}

// ============= Animation Durations (ms) =============

export const ANIMATION_DURATIONS = {
  diceRoll: 1200,
  resourceCollection: 600,
  cardDraw: 400,
  buildingPlace: 800,
  connectionPlace: 600,
  robberMove: 1000
}

// ============= Port Configuration =============

export const PORT_TYPES = ['generic', 'wood', 'brick', 'ore', 'wheat', 'sheep'] as const
export const PORT_RATIOS = {
  generic: 3,  // 3:1 any resource
  wood: 2,     // 2:1 wood
  brick: 2,    // 2:1 brick
  ore: 2,      // 2:1 ore
  wheat: 2,    // 2:1 wheat
  sheep: 2     // 2:1 sheep
} 