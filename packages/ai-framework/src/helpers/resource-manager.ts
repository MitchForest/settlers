import { GameState, PlayerId, ResourceType } from '@settlers/game-engine'
import { BUILD_COSTS } from './index'

export interface ResourceCount {
  wood: number
  brick: number
  sheep: number
  wheat: number
  ore: number
}

export interface BuildOption {
  type: 'settlement' | 'city' | 'road' | 'developmentCard'
  canBuild: boolean
  missingResources: ResourceType[]
  priority: number // higher = better option
}

/**
 * Get current resources for a player
 */
export function getCurrentResources(gameState: GameState, playerId: PlayerId): ResourceCount {
  const player = gameState.players.get(playerId)
  if (!player) {
    return { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 }
  }
  
  return {
    wood: player.resources.wood || 0,
    brick: player.resources.brick || 0,
    sheep: player.resources.sheep || 0,
    wheat: player.resources.wheat || 0,
    ore: player.resources.ore || 0
  }
}

/**
 * Calculate what the player can build with current resources
 */
export function getBuildOptions(gameState: GameState, playerId: PlayerId): BuildOption[] {
  const resources = getCurrentResources(gameState, playerId)
  const options: BuildOption[] = []
  
  // Check each building type
  for (const [buildingType, costs] of Object.entries(BUILD_COSTS)) {
    const missingResources: ResourceType[] = []
    let canBuild = true
    
    // Check if we have enough of each resource
    for (const [resource, needed] of Object.entries(costs) as [ResourceType, number][]) {
      const available = resources[resource] || 0
      if (available < needed) {
        canBuild = false
        // Add missing resources (repeat for quantity)
        for (let i = 0; i < needed - available; i++) {
          missingResources.push(resource)
        }
      }
    }
    
    options.push({
      type: buildingType as 'settlement' | 'city' | 'road' | 'developmentCard',
      canBuild,
      missingResources,
      priority: calculateBuildPriority(buildingType as any, canBuild, missingResources.length)
    })
  }
  
  return options.sort((a, b) => b.priority - a.priority)
}

/**
 * Calculate surplus resources after reserving for a specific building goal
 */
export function calculateSurplus(
  resources: ResourceCount, 
  reserveFor?: 'settlement' | 'city' | 'road' | 'developmentCard'
): ResourceCount {
  const surplus = { ...resources }
  
  if (reserveFor && BUILD_COSTS[reserveFor]) {
    const costs = BUILD_COSTS[reserveFor]
    for (const [resource, needed] of Object.entries(costs) as [ResourceType, number][]) {
      surplus[resource] = Math.max(0, surplus[resource] - needed)
    }
  }
  
  return surplus
}

/**
 * Check if player can build a specific item
 */
export function canBuild(
  gameState: GameState, 
  playerId: PlayerId, 
  buildingType: 'settlement' | 'city' | 'road' | 'developmentCard'
): boolean {
  const resources = getCurrentResources(gameState, playerId)
  const costs = BUILD_COSTS[buildingType]
  
  if (!costs) return false
  
  for (const [resource, needed] of Object.entries(costs) as [ResourceType, number][]) {
    if ((resources[resource] || 0) < needed) {
      return false
    }
  }
  
  return true
}

/**
 * Get the optimal build order based on current phase and resources
 */
export function getOptimalBuild(
  gameState: GameState, 
  playerId: PlayerId, 
  phase: 'EXPANSION' | 'GROWTH' | 'ACCELERATION' | 'VICTORY'
): BuildOption | null {
  const options = getBuildOptions(gameState, playerId)
  const buildableOptions = options.filter(opt => opt.canBuild)
  
  if (buildableOptions.length === 0) return null
  
  // Phase-specific priorities
  switch (phase) {
    case 'EXPANSION':
      // Prioritize roads and settlements for expansion
      return buildableOptions.find(opt => opt.type === 'road') ||
             buildableOptions.find(opt => opt.type === 'settlement') ||
             buildableOptions[0]
             
    case 'GROWTH':
      // Balanced approach: settlements, then cities, then roads
      return buildableOptions.find(opt => opt.type === 'settlement') ||
             buildableOptions.find(opt => opt.type === 'city') ||
             buildableOptions.find(opt => opt.type === 'road') ||
             buildableOptions[0]
             
    case 'ACCELERATION':
      // Cities and dev cards for points
      return buildableOptions.find(opt => opt.type === 'city') ||
             buildableOptions.find(opt => opt.type === 'developmentCard') ||
             buildableOptions.find(opt => opt.type === 'settlement') ||
             buildableOptions[0]
             
    case 'VICTORY':
      // Whatever gets points fastest
      return buildableOptions.find(opt => opt.type === 'city') ||
             buildableOptions.find(opt => opt.type === 'developmentCard') ||
             buildableOptions.find(opt => opt.type === 'settlement') ||
             buildableOptions[0]
             
    default:
      return buildableOptions[0]
  }
}

/**
 * Calculate build priority score
 */
function calculateBuildPriority(
  buildingType: string, 
  canBuild: boolean, 
  missingCount: number
): number {
  if (!canBuild) return -missingCount // Negative priority if can't build
  
  // Base priorities for different building types
  const basePriorities = {
    settlement: 100, // High priority for expansion
    road: 80,        // Medium-high for enabling settlements
    city: 60,        // Medium for upgrades
    developmentCard: 40 // Lower for dev cards
  }
  
  return basePriorities[buildingType as keyof typeof basePriorities] || 0
} 