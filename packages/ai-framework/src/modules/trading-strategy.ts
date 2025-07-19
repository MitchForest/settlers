import { GameState, PlayerId, ResourceType } from '@settlers/game-engine'
import { getCurrentResources, BUILD_COSTS } from '../helpers'

export interface TradeOffer {
  type: 'player' | 'bank' | 'port'
  offering: Record<ResourceType, number>
  requesting: Record<ResourceType, number>
  targetPlayerId?: string // for player trades
  portType?: ResourceType // for port trades
  reasoning: string
}

export interface TradeEvaluation {
  shouldAccept: boolean
  reasoning: string
  priority: number // higher = more important
}

/**
 * Determine what resource the player needs most for their next goal
 */
export function getMostNeededResource(gameState: GameState, playerId: PlayerId): { resource: ResourceType, need: string } | null {
  const resources = getCurrentResources(gameState, playerId)
  
  // Check what we're closest to building
  const buildingOptions = [
    { type: 'road', cost: BUILD_COSTS.road, priority: 1 },
    { type: 'settlement', cost: BUILD_COSTS.settlement, priority: 3 },
    { type: 'city', cost: BUILD_COSTS.city, priority: 2 },
    { type: 'developmentCard', cost: BUILD_COSTS.developmentCard, priority: 1 }
  ]
  
  for (const option of buildingOptions.sort((a, b) => b.priority - a.priority)) {
    const missing = []
    for (const [resource, needed] of Object.entries(option.cost) as [ResourceType, number][]) {
      const have = resources[resource] || 0
      if (have < needed) {
        for (let i = have; i < needed; i++) {
          missing.push(resource)
        }
      }
    }
    
    // If we're only missing 1 resource for this building, prioritize it
    if (missing.length === 1) {
      return { resource: missing[0] as ResourceType, need: option.type }
    }
  }
  
  // If not close to any building, prioritize settlement resources
  const settlementNeeds = ['wood', 'brick', 'sheep', 'wheat'] as ResourceType[]
  for (const resource of settlementNeeds) {
    if ((resources[resource] || 0) === 0) {
      return { resource, need: 'settlement' }
    }
  }
  
  return null
}

/**
 * Analyze opponents to find the best trade target
 */
export function findBestTradeTarget(gameState: GameState, playerId: PlayerId, neededResource: ResourceType): { playerId: PlayerId, confidence: number } | null {
  const opponents = Array.from(gameState.players.keys()).filter(id => id !== playerId)
  
  const targets = opponents.map(opponentId => {
    const opponent = gameState.players.get(opponentId)!
    const opponentResources = getCurrentResources(gameState, opponentId)
    
    // Score based on how much of the needed resource they have
    const resourceCount = opponentResources[neededResource] || 0
    const totalResources = Object.values(opponentResources).reduce((sum, count) => sum + count, 0)
    
    // Confidence factors:
    // 1. Has the resource we need (higher = better)
    // 2. Has multiple of that resource (more likely to trade)
    // 3. Not hoarding (has reasonable total resources)
    let confidence = 0
    
    if (resourceCount >= 2) confidence += 50 // Has multiple of what we need
    else if (resourceCount >= 1) confidence += 20 // Has at least one
    
    if (resourceCount >= 3) confidence += 20 // Likely has excess
    if (totalResources >= 6 && totalResources <= 12) confidence += 10 // Good trading range
    
    return {
      playerId: opponentId,
      confidence,
      resourceCount
    }
  })
  
  // Sort by confidence (highest first)
  targets.sort((a, b) => b.confidence - a.confidence)
  
  // Return best target if confidence is reasonable
  const best = targets[0]
  return best && best.confidence >= 20 ? { playerId: best.playerId, confidence: best.confidence } : null
}

/**
 * Generate a targeted trade offer to a specific player
 */
export function generateTargetedTradeOffer(gameState: GameState, playerId: PlayerId, targetPlayerId: PlayerId, offerRatio: number = 1): TradeOffer | null {
  const mostNeeded = getMostNeededResource(gameState, playerId)
  if (!mostNeeded) return null
  
  const resources = getCurrentResources(gameState, playerId)
  const { resource: neededResource, need } = mostNeeded
  
  // Find what we have excess of (can offer)
  const excess = findExcessResources(resources, neededResource)
  if (excess.length === 0) return null
  
  // Check if we have enough to offer at this ratio
  const excessResource = excess[0]
  if (resources[excessResource] < offerRatio) return null
  
  // Check if target player actually has what we need
  const targetResources = getCurrentResources(gameState, targetPlayerId)
  if ((targetResources[neededResource] || 0) === 0) return null
  
  const offering = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 }
  const requesting = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 }
  
  offering[excessResource] = offerRatio
  requesting[neededResource] = 1
  
  // Check if we'd still be able to build our goal after this trade
  const wouldHaveAfterTrade = { ...resources }
  wouldHaveAfterTrade[excessResource] -= offerRatio
  wouldHaveAfterTrade[neededResource] += 1
  
  if (!canStillBuildAfterTrade(wouldHaveAfterTrade, need)) {
    return null
  }
  
  return {
    type: 'player',
    offering,
    requesting,
    targetPlayerId,
    reasoning: `Need ${neededResource} for ${need}, offering ${offerRatio} ${excessResource} to ${targetPlayerId}`
  }
}

/**
 * Generate a trade offer based on current needs and strategy
 */
export function generateTradeOffer(gameState: GameState, playerId: PlayerId): TradeOffer | null {
  // Check if player already has active trade offers - don't spam
  const existingOffers = (gameState as any).tradeOffers || []
  const playerOffers = existingOffers.filter((offer: any) => 
    offer.offeringPlayerId === playerId &&
    (gameState.turn - offer.createdTurn) <= offer.expiresAfterTurns
  )
  
  if (playerOffers.length >= 2) {
    // Player already has 2+ active offers, don't create more
    return null
  }
  
  const mostNeeded = getMostNeededResource(gameState, playerId)
  if (!mostNeeded) return null
  
  const { resource: neededResource, need } = mostNeeded
  
  // Check if we already have an offer for this exact resource
  const hasOfferForResource = playerOffers.some((offer: any) => 
    offer.requesting[neededResource] > 0
  )
  
  if (hasOfferForResource) {
    // Already have an offer requesting this resource, don't duplicate
    return null
  }
  
  // First, try to find the best target for a 1:1 trade
  const bestTarget = findBestTradeTarget(gameState, playerId, neededResource)
  if (bestTarget) {
    const targetedOffer = generateTargetedTradeOffer(gameState, playerId, bestTarget.playerId, 1)
    if (targetedOffer) {
      return targetedOffer
    }
  }
  
  // If no good 1:1 target, fall back to broadcast or bank trade
  const resources = getCurrentResources(gameState, playerId)
  const excess = findExcessResources(resources, neededResource)
  if (excess.length === 0) return null
  
  // Try 4:1 bank trade if we have enough resources
  if (resources[excess[0]] >= 4) {
    const offering = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 }
    const requesting = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 }
    
    offering[excess[0]] = 4
    requesting[neededResource] = 1
    
    const wouldHaveAfterTrade = { ...resources }
    wouldHaveAfterTrade[excess[0]] -= 4
    wouldHaveAfterTrade[neededResource] += 1
    
    if (canStillBuildAfterTrade(wouldHaveAfterTrade, need)) {
      return {
        type: 'bank',
        offering,
        requesting,
        reasoning: `Need ${neededResource} for ${need}, bank 4:1 trade`
      }
    }
  }
  
  return null
}

/**
 * Generate escalating trade offers (1:1 → 2:1 → 3:1 → 4:1/port)
 */
export function generateEscalatingTradeOffer(
  gameState: GameState, 
  playerId: PlayerId, 
  attemptNumber: number
): TradeOffer | null {
  const mostNeeded = getMostNeededResource(gameState, playerId)
  if (!mostNeeded) return null
  
  const resources = getCurrentResources(gameState, playerId)
  const { resource: neededResource, need } = mostNeeded
  const excess = findExcessResources(resources, neededResource)
  
  if (excess.length === 0) return null
  
  const offering = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 }
  const requesting = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 }
  requesting[neededResource] = 1
  
  // Check if we would still have what we need after the trade
  const wouldHaveAfterTrade = { ...resources }
  
  switch (attemptNumber) {
    case 1: // 1:1 player trade
      if (excess.length > 0) {
        offering[excess[0]] = 1
        wouldHaveAfterTrade[excess[0]] -= 1
        wouldHaveAfterTrade[neededResource] += 1
        
        if (canStillBuildAfterTrade(wouldHaveAfterTrade, need)) {
          return {
            type: 'player',
            offering,
            requesting,
            reasoning: `Need ${neededResource} for ${need}, offering ${excess[0]} 1:1`
          }
        }
      }
      break
      
    case 2: // 2:1 player trade
      if (excess.length > 0 && resources[excess[0]] >= 2) {
        offering[excess[0]] = 2
        wouldHaveAfterTrade[excess[0]] -= 2
        wouldHaveAfterTrade[neededResource] += 1
        
        if (canStillBuildAfterTrade(wouldHaveAfterTrade, need)) {
          return {
            type: 'player',
            offering,
            requesting,
            reasoning: `Need ${neededResource} for ${need}, offering 2 ${excess[0]} for 1`
          }
        }
      }
      break
      
    case 3: // 3:1 player trade  
      if (excess.length > 0 && resources[excess[0]] >= 3) {
        offering[excess[0]] = 3
        wouldHaveAfterTrade[excess[0]] -= 3
        wouldHaveAfterTrade[neededResource] += 1
        
        if (canStillBuildAfterTrade(wouldHaveAfterTrade, need)) {
          return {
            type: 'player',
            offering,
            requesting,
            reasoning: `Need ${neededResource} for ${need}, offering 3 ${excess[0]} for 1`
          }
        }
      }
      break
      
    case 4: // 4:1 bank trade (skip ports for now until we test bank trades)
      // Fall back to 4:1 bank trade - try different combinations
      for (const excessResource of excess) {
        if (resources[excessResource] >= 4) {
          offering[excessResource] = 4
          wouldHaveAfterTrade[excessResource] -= 4
          wouldHaveAfterTrade[neededResource] += 1
          
          if (canStillBuildAfterTrade(wouldHaveAfterTrade, need)) {
            return {
              type: 'bank',
              offering,
              requesting,
              reasoning: `Need ${neededResource} for ${need}, bank 4:1 trade (4 ${excessResource})`
            }
          }
          
          // Reset for next attempt
          offering[excessResource] = 0
          wouldHaveAfterTrade[excessResource] = resources[excessResource]
          wouldHaveAfterTrade[neededResource] = resources[neededResource]
        }
      }
      break
  }
  
  return null
}

/**
 * Evaluate whether to accept an incoming trade offer
 */
export function evaluateTradeOffer(
  gameState: GameState, 
  playerId: PlayerId, 
  offer: TradeOffer
): TradeEvaluation {
  const mostNeeded = getMostNeededResource(gameState, playerId)
  
  if (!mostNeeded) {
    return {
      shouldAccept: false,
      reasoning: 'No immediate resource needs',
      priority: 0
    }
  }
  
  const resources = getCurrentResources(gameState, playerId)
  
  // Check if they're offering what we need
  const offeringNeeded = offer.offering[mostNeeded.resource] > 0
  
  if (!offeringNeeded) {
    return {
      shouldAccept: false,
      reasoning: `They're not offering ${mostNeeded.resource} which we need for ${mostNeeded.need}`,
      priority: 0
    }
  }
  
  // Check if we can afford what they're requesting
  const canAfford = Object.entries(offer.requesting).every(([resource, amount]) => {
    return (resources[resource as ResourceType] || 0) >= amount
  })
  
  if (!canAfford) {
    return {
      shouldAccept: false,
      reasoning: 'Cannot afford what they are requesting',
      priority: 0
    }
  }
  
  // Check if we'd still be able to build our goal after the trade
  const wouldHaveAfterTrade = { ...resources }
  for (const [resource, amount] of Object.entries(offer.requesting) as [ResourceType, number][]) {
    wouldHaveAfterTrade[resource] -= amount
  }
  for (const [resource, amount] of Object.entries(offer.offering) as [ResourceType, number][]) {
    wouldHaveAfterTrade[resource] += amount
  }
  
  if (!canStillBuildAfterTrade(wouldHaveAfterTrade, mostNeeded.need)) {
    return {
      shouldAccept: false,
      reasoning: `Trade would prevent us from building ${mostNeeded.need}`,
      priority: 0
    }
  }
  
  // Calculate priority based on how much this helps us
  const priority = offer.offering[mostNeeded.resource] * 10 // High priority for needed resource
  
  return {
    shouldAccept: true,
    reasoning: `Accepts trade to get ${mostNeeded.resource} for ${mostNeeded.need}`,
    priority
  }
}

/**
 * Find resources we have excess of (more than needed for immediate goals)
 */
function findExcessResources(resources: Record<ResourceType, number>, excludeResource?: ResourceType): ResourceType[] {
  const excess: ResourceType[] = []
  
  // For bank trades, we need 4 of a resource, so look for resources with 4+
  for (const [resource, count] of Object.entries(resources) as [ResourceType, number][]) {
    if (resource !== excludeResource && count >= 4) {
      excess.push(resource)
    }
  }
  
  // If no resource has 4+, try resources with 3+ (less optimal but still useful)
  if (excess.length === 0) {
    for (const [resource, count] of Object.entries(resources) as [ResourceType, number][]) {
      if (resource !== excludeResource && count >= 3) {
        excess.push(resource)
      }
    }
  }
  
  // If no resource has 3+, try resources with 2+ (for player trades later)
  if (excess.length === 0) {
    for (const [resource, count] of Object.entries(resources) as [ResourceType, number][]) {
      if (resource !== excludeResource && count >= 2) {
        excess.push(resource)
      }
    }
  }
  
  // Sort by count (highest first)
  excess.sort((a, b) => (resources[b] || 0) - (resources[a] || 0))
  
  return excess
}

/**
 * Check if we can still build our goal after a trade
 */
function canStillBuildAfterTrade(resources: Record<ResourceType, number>, buildingType: string): boolean {
  const costs = BUILD_COSTS[buildingType as keyof typeof BUILD_COSTS]
  if (!costs) return true
  
  for (const [resource, needed] of Object.entries(costs) as [ResourceType, number][]) {
    if ((resources[resource] || 0) < needed) {
      return false
    }
  }
  
  return true
}

/**
 * Check what port types are available to the player
 */
function getAvailablePortType(gameState: GameState, playerId: PlayerId, neededResource: ResourceType): string | null {
  // TODO: Implement port detection based on player's settlements
  // For now, assume all players have access to 4:1 bank trading
  return 'any'
}

/**
 * Get the trading rate for a port
 */
function getPortRate(portType: string, resource: ResourceType): number {
  if (portType === resource) return 2 // 2:1 specific resource port
  if (portType === 'any') return 3 // 3:1 general port
  return 4 // 4:1 bank rate
} 