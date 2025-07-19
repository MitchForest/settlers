import { GameState, PlayerId, ResourceType } from '@settlers/game-engine'
import { getCurrentResources, getOptimalBuild, getGamePhase } from '../helpers'
import { BUILD_COSTS } from '../helpers'

export interface DiscardRecommendation {
  wood: number
  brick: number
  sheep: number
  wheat: number
  ore: number
  reasoning: string
}

/**
 * Smart discard strategy based on goals, recipes, and production
 */
export function smartDiscard(gameState: GameState, playerId: PlayerId): DiscardRecommendation {
  const resources = getCurrentResources(gameState, playerId)
  const totalResources = Object.values(resources).reduce((sum, n) => sum + n, 0)
  
  if (totalResources <= 7) {
    return { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0, reasoning: 'No discard needed' }
  }
  
  const toDiscard = Math.floor(totalResources / 2)
  const phase = getGamePhase(gameState, playerId)
  const buildOption = getOptimalBuild(gameState, playerId, phase.phase)
  
  console.log(`🗃️ Smart discard: need to discard ${toDiscard} from ${totalResources} total`)
  
  // Strategy: Keep resources for current goal, discard excess/duplicates
  const discard = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 }
  let remaining = toDiscard
  
  // 1. Never discard if we can build something important immediately
  if (buildOption?.canBuild) {
    const buildCosts = BUILD_COSTS[buildOption.type]
    console.log(`🛡️ Protecting resources for ${buildOption.type}`)
    
    // Reserve resources needed for building
    const reserved = { ...buildCosts }
    const availableToDiscard = {
      wood: Math.max(0, resources.wood - reserved.wood),
      brick: Math.max(0, resources.brick - reserved.brick),
      sheep: Math.max(0, resources.sheep - reserved.sheep),
      wheat: Math.max(0, resources.wheat - reserved.wheat),
      ore: Math.max(0, resources.ore - reserved.ore)
    }
    
    return calculateSmartDiscard(availableToDiscard, remaining, phase.phase)
  }
  
  // 2. General smart discard based on phase priorities
  return calculateSmartDiscard(resources, remaining, phase.phase)
}

/**
 * Calculate smart discard based on available resources and phase
 */
function calculateSmartDiscard(
  resources: { wood: number, brick: number, sheep: number, wheat: number, ore: number },
  toDiscard: number,
  phase: string
): DiscardRecommendation {
  const discard = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 }
  let remaining = toDiscard
  
  // Phase-specific priority (lower = discard first)
  const discardPriority = getDiscardPriority(phase)
  
  // Sort resources by discard priority (highest count and lowest priority first)
  const resourceEntries = Object.entries(resources) as [ResourceType, number][]
  resourceEntries.sort((a, b) => {
    const [typeA, countA] = a
    const [typeB, countB] = b
    const priorityA = discardPriority[typeA]
    const priorityB = discardPriority[typeB]
    
    // Primary: discard lowest priority resources first
    if (priorityA !== priorityB) {
      return priorityA - priorityB
    }
    
    // Secondary: discard highest count resources first (keep variety)
    return countB - countA
  })
  
  // Discard resources in priority order
  for (const [resourceType, count] of resourceEntries) {
    if (remaining <= 0) break
    
    const canDiscard = Math.min(count, remaining)
    if (canDiscard > 0) {
      discard[resourceType] = canDiscard
      remaining -= canDiscard
    }
  }
  
  // Build reasoning
  const discardedTypes = Object.entries(discard)
    .filter(([_, count]) => count > 0)
    .map(([type, count]) => `${count} ${type}`)
    .join(', ')
  
  const reasoning = `Phase: ${phase} - Discarded ${discardedTypes} (keeping resources for current goals)`
  
  return { ...discard, reasoning }
}

/**
 * Get discard priority by phase (lower = discard first)
 */
function getDiscardPriority(phase: string): Record<ResourceType, number> {
  switch (phase) {
    case 'EXPANSION':
      // Priority: wood, brick (roads/settlements) > others
      return { wood: 5, brick: 5, sheep: 3, wheat: 3, ore: 1 }
      
    case 'GROWTH':
      // Balanced priorities, slight preference for building materials
      return { wood: 4, brick: 4, sheep: 4, wheat: 5, ore: 3 }
      
    case 'ACCELERATION':
      // Priority: wheat, ore (cities) > sheep (dev cards) > wood, brick
      return { wheat: 5, ore: 5, sheep: 4, wood: 2, brick: 2 }
      
    case 'VICTORY':
      // Keep everything that can generate points
      return { wheat: 5, ore: 5, sheep: 4, wood: 3, brick: 3 }
      
    default:
      // Default balanced priorities
      return { wood: 3, brick: 3, sheep: 3, wheat: 3, ore: 3 }
  }
} 