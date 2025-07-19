import { ResourceType, TerrainType } from '@settlers/game-engine'

// ============= GAME CONSTANTS =============

/**
 * Pip values for dice numbers based on probability
 */
export const PIP_VALUES = {
  2: 1,   // 1/36 probability
  3: 2,   // 2/36 probability
  4: 3,   // 3/36 probability
  5: 4,   // 4/36 probability
  6: 5,   // 5/36 probability (highest)
  7: 0,   // Not used for resources (robber)
  8: 5,   // 5/36 probability (highest)
  9: 4,   // 4/36 probability
  10: 3,  // 3/36 probability
  11: 2,  // 2/36 probability
  12: 1   // 1/36 probability
} as const

/**
 * Standard Catan resource tile quantities
 */
export const RESOURCE_TILE_COUNTS = {
  wood: 4,
  wheat: 4,
  sheep: 4,
  ore: 3,
  brick: 3
} as const

/**
 * Building cost formulas
 */
export const BUILD_COSTS = {
  settlement: {
    wood: 1,
    brick: 1,
    sheep: 1,
    wheat: 1,
    ore: 0
  },
  city: {
    wood: 0,
    brick: 0,
    sheep: 0,
    wheat: 2,
    ore: 3
  },
  road: {
    wood: 1,
    brick: 1,
    sheep: 0,
    wheat: 0,
    ore: 0
  },
  developmentCard: {
    wood: 0,
    brick: 0,
    sheep: 1,
    wheat: 1,
    ore: 1
  }
} as const

/**
 * AI placement strategy weights
 */
export const PLACEMENT_CONFIGS = {
  firstSettlement: { number: 70, scarcity: 30 },
  firstRoad: { number: 50, diversity: 50 },
  secondSettlement: { number: 60, diversity: 40 },
  secondRoad: { number: 50, diversity: 50 }
} as const

/**
 * Hex count bonuses for vertex scoring
 */
export const HEX_COUNT_BONUS = {
  3: 8,  // 3-hex intersections get large bonus
  2: 2,  // 2-hex intersections get small bonus
  1: 0   // 1-hex intersections get no bonus
} as const

// ============= UTILITY FUNCTIONS =============

/**
 * Convert terrain type to resource type
 */
export function terrainToResource(terrain: TerrainType): ResourceType {
  const mapping: Record<TerrainType, ResourceType> = {
    forest: 'wood',
    hills: 'brick', 
    pasture: 'sheep',
    fields: 'wheat',
    mountains: 'ore',
    desert: 'wood', // fallback
    sea: 'wood' // fallback
  }
  return mapping[terrain]
}

/**
 * Get resource abbreviation for display
 */
export function getResourceAbbreviation(resource: ResourceType): string {
  const mapping: Record<ResourceType, string> = {
    wood: 'WO',
    brick: 'BR', 
    sheep: 'SH',
    wheat: 'WH',
    ore: 'OR'
  }
  return mapping[resource] || resource.toUpperCase()
}

/**
 * Get resource name from terrain for display
 */
export function getResourceName(terrain: string): string {
  switch (terrain) {
    case 'forest': return 'WO'
    case 'hills': return 'BR'
    case 'pasture': return 'SH'
    case 'fields': return 'WH'
    case 'mountains': return 'OR'
    default: return terrain.substring(0, 2).toUpperCase()
  }
}

// Re-export other helper modules
export * from './game-helpers'
export * from './vertex-scoring'
export * from './resource-manager'
export * from './expansion-tracker'
export * from './production-analyzer'
export * from './strategy-coordinator' 