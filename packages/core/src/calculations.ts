// Game calculations and utility functions

import { 
  ResourceCards, 
  HexCoordinate, 
  VertexPosition,
  EdgePosition,
  Player,
  DiceRoll
} from './types'
import { ROLL_PROBABILITIES, GAME_RULES } from './constants'

// ============= Resource Calculations =============

export function createEmptyResources(): ResourceCards {
  return {
    resource1: 0,
    resource2: 0,
    resource3: 0,
    resource4: 0,
    resource5: 0
  }
}

export function getTotalResources(resources: ResourceCards): number {
  return Object.values(resources).reduce((sum, count) => sum + count, 0)
}

export function hasResources(
  player: ResourceCards, 
  required: Partial<ResourceCards>
): boolean {
  for (const [resource, amount] of Object.entries(required)) {
    if ((player[resource as keyof ResourceCards] || 0) < (amount || 0)) {
      return false
    }
  }
  return true
}

export function subtractResources(
  from: ResourceCards,
  amount: Partial<ResourceCards>
): ResourceCards {
  const result = { ...from }
  for (const [resource, count] of Object.entries(amount)) {
    result[resource as keyof ResourceCards] -= count || 0
  }
  return result
}

export function addResources(
  to: ResourceCards,
  amount: Partial<ResourceCards>
): ResourceCards {
  const result = { ...to }
  for (const [resource, count] of Object.entries(amount)) {
    result[resource as keyof ResourceCards] += count || 0
  }
  return result
}

// ============= Hex Coordinate Calculations =============

export function hexToString(hex: HexCoordinate): string {
  return `${hex.q},${hex.r},${hex.s}`
}

export function stringToHex(str: string): HexCoordinate {
  const [q, r, s] = str.split(',').map(Number)
  return { q, r, s }
}

export function getAdjacentHexes(hex: HexCoordinate): HexCoordinate[] {
  const directions = [
    { q: 1, r: -1, s: 0 },
    { q: 1, r: 0, s: -1 },
    { q: 0, r: 1, s: -1 },
    { q: -1, r: 1, s: 0 },
    { q: -1, r: 0, s: 1 },
    { q: 0, r: -1, s: 1 }
  ]
  
  return directions.map(dir => ({
    q: hex.q + dir.q,
    r: hex.r + dir.r,
    s: hex.s + dir.s
  }))
}

export function hexDistance(a: HexCoordinate, b: HexCoordinate): number {
  return Math.max(
    Math.abs(a.q - b.q),
    Math.abs(a.r - b.r),
    Math.abs(a.s - b.s)
  )
}

// ============= Vertex Calculations =============

export function vertexToString(vertex: VertexPosition): string {
  const hexIds = vertex.hexes.map(h => hexToString(h)).sort().join('|')
  return `${hexIds}:${vertex.direction}`
}

export function getVerticesForHex(hex: HexCoordinate): VertexPosition[] {
  // Returns the 6 vertices around a hex
  // Implementation depends on vertex ID scheme
  const vertices: VertexPosition[] = []
  // TODO: Implement based on vertex ID scheme
  return vertices
}

// ============= Edge Calculations =============

export function edgeToString(v1: VertexPosition, v2: VertexPosition): string {
  const ids = [vertexToString(v1), vertexToString(v2)].sort()
  return ids.join('-')
}

export function getEdgesForHex(hex: HexCoordinate): EdgePosition[] {
  // Returns the 6 edges around a hex
  const edges: EdgePosition[] = []
  // TODO: Implement based on edge ID scheme
  return edges
}

// ============= Dice Calculations =============

export function rollDice(): DiceRoll {
  const die1 = Math.floor(Math.random() * 6) + 1
  const die2 = Math.floor(Math.random() * 6) + 1
  return {
    die1,
    die2,
    sum: die1 + die2
  }
}

export function getDiceProbability(sum: number): number {
  return (ROLL_PROBABILITIES[sum] || 0) / 36
}

// ============= Score Calculations =============

export function calculatePublicScore(player: Player): number {
  let score = 0
  
  // Count settlements and cities (would need board reference)
  // This is a placeholder - actual implementation needs board state
  
  // Add special achievements
  if (player.hasLongestPath) score += 2
  if (player.hasLargestForce) score += 2
  
  return score
}

export function calculateTotalScore(player: Player): number {
  return player.score.public + player.score.hidden
}

// ============= Discard Calculations =============

export function calculateDiscardCount(resourceCount: number): number {
  if (resourceCount <= GAME_RULES.handLimitBeforeDiscard) {
    return 0
  }
  return Math.floor(resourceCount * GAME_RULES.discardAmount)
}

// ============= Path Calculations =============

export function isValidConnectionPath(
  edges: EdgePosition[],
  connections: Map<string, { owner: string }>
): boolean {
  // Check if edges form a continuous path
  // TODO: Implement path validation
  return true
}

export function calculateLongestPath(
  playerId: string,
  edges: Map<string, EdgePosition>,
  connections: Map<string, { owner: string }>
): number {
  // Calculate longest continuous path for player
  // TODO: Implement longest path algorithm
  return 0
}

// ============= Trade Calculations =============

export function calculateTradeRatio(
  player: Player,
  resourceType: keyof ResourceCards,
  ports: Set<string>
): number {
  // Check if player has access to special ports
  // TODO: Implement based on board state
  return GAME_RULES.bankTradeRatio
}

export function isValidTrade(
  offering: Partial<ResourceCards>,
  requesting: Partial<ResourceCards>,
  fromResources: ResourceCards
): boolean {
  // Check if player has resources to offer
  return hasResources(fromResources, offering)
}

// ============= Random Utilities =============

export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export function randomChoice<T>(array: T[]): T | undefined {
  if (array.length === 0) return undefined
  return array[Math.floor(Math.random() * array.length)]
} 

// ============= ID Generation =============

export function generatePlayerId(): string {
  return `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
} 