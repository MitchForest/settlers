// Resource and scoring calculations for Settlers (Catan)
// All functions use standard Settlers terminology

import { ResourceCards, Player } from './types'

// ============= Resource Management =============

export function hasResources(playerResources: ResourceCards, requiredResources: ResourceCards): boolean {
  return playerResources.wood >= requiredResources.wood &&
         playerResources.brick >= requiredResources.brick &&
         playerResources.ore >= requiredResources.ore &&
         playerResources.wheat >= requiredResources.wheat &&
         playerResources.sheep >= requiredResources.sheep
}

export function subtractResources(from: ResourceCards, subtract: ResourceCards): ResourceCards {
  return {
    wood: from.wood - subtract.wood,
    brick: from.brick - subtract.brick,
    ore: from.ore - subtract.ore,
    wheat: from.wheat - subtract.wheat,
    sheep: from.sheep - subtract.sheep
  }
}

export function addResources(to: ResourceCards, add: ResourceCards): ResourceCards {
  return {
    wood: to.wood + add.wood,
    brick: to.brick + add.brick,
    ore: to.ore + add.ore,
    wheat: to.wheat + add.wheat,
    sheep: to.sheep + add.sheep
  }
}

export function getTotalResourceCount(resources: ResourceCards): number {
  return resources.wood + resources.brick + resources.ore + resources.wheat + resources.sheep
}

export function getResourceByType(resources: ResourceCards, type: string): number {
  switch (type) {
    case 'wood': return resources.wood
    case 'brick': return resources.brick
    case 'ore': return resources.ore
    case 'wheat': return resources.wheat
    case 'sheep': return resources.sheep
    default: return 0
  }
}

export function setResourceByType(resources: ResourceCards, type: string, amount: number): ResourceCards {
  const newResources = { ...resources }
  switch (type) {
    case 'wood': newResources.wood = amount; break
    case 'brick': newResources.brick = amount; break
    case 'ore': newResources.ore = amount; break
    case 'wheat': newResources.wheat = amount; break
    case 'sheep': newResources.sheep = amount; break
  }
  return newResources
}

// ============= Utility Functions =============

export function createEmptyResources(): ResourceCards {
  return {
    wood: 0,
    brick: 0,
    ore: 0,
    wheat: 0,
    sheep: 0
  }
}

export function rollDice() {
  const die1 = Math.floor(Math.random() * 6) + 1
  const die2 = Math.floor(Math.random() * 6) + 1
  return {
    die1,
    die2,
    sum: die1 + die2,
    timestamp: Date.now()
  }
}

export function shuffleArray<T>(array: T[]): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function randomChoice<T>(array: T[]): T | null {
  if (array.length === 0) return null
  return array[Math.floor(Math.random() * array.length)]
}

export function generatePlayerId(): string {
  return `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// ============= Discard Calculations =============

export function calculateDiscardCount(totalResources: number): number {
  return Math.floor(totalResources / 2)
}

export function isValidDiscardSelection(
  playerResources: ResourceCards,
  discardSelection: Partial<ResourceCards>,
  requiredDiscardCount: number
): boolean {
  // Check if player has enough resources to discard
  const wood = discardSelection.wood || 0
  const brick = discardSelection.brick || 0
  const ore = discardSelection.ore || 0
  const wheat = discardSelection.wheat || 0
  const sheep = discardSelection.sheep || 0
  
  if (wood > playerResources.wood ||
      brick > playerResources.brick ||
      ore > playerResources.ore ||
      wheat > playerResources.wheat ||
      sheep > playerResources.sheep) {
    return false
  }
  
  // Check if discard count matches requirement
  const totalDiscard = wood + brick + ore + wheat + sheep
  return totalDiscard === requiredDiscardCount
}

// ============= Trade Calculations =============

export function getDefaultTradeRatio(): number {
  return 4  // 4:1 default bank trade
}

export function getPortTradeRatio(portType: string, resourceType: string): number {
  if (portType === 'generic') return 3  // 3:1 for any resource
  if (portType === resourceType) return 2  // 2:1 for matching resource
  return getDefaultTradeRatio()  // 4:1 default
}

export function canAffordTrade(
  playerResources: ResourceCards,
  offeringType: string,
  offeringAmount: number
): boolean {
  const available = getResourceByType(playerResources, offeringType)
  return available >= offeringAmount
}

// ============= Victory Point Calculations =============

export function calculateVictoryPoints(player: Player): number {
  let points = 0
  
  // Buildings
  points += player.buildings.settlements * 1  // 1 point per settlement
  points += player.buildings.cities * 2       // 2 points per city
  
  // Development cards (victory point cards)
  points += player.developmentCards.filter(card => card.type === 'victory').length * 1
  
  // Special achievements
  if (player.hasLongestRoad) points += 2
  if (player.hasLargestArmy) points += 2
  
  return points
}

// ============= Building Availability =============

export function canBuildSettlement(player: Player): boolean {
  return player.buildings.settlements > 0
}

export function canBuildCity(player: Player): boolean {
  return player.buildings.cities > 0
}

export function canBuildRoad(player: Player): boolean {
  return player.buildings.roads > 0
}

export function getRemainingBuildings(player: Player) {
  return {
    settlements: player.buildings.settlements,
    cities: player.buildings.cities,
    roads: player.buildings.roads
  }
} 