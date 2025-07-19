// Resource and scoring calculations for Settlers (Catan)
// All functions use standard Settlers terminology

import { ResourceCards, Player, GameState, PlayerId, ResourceType, Board, Building, Port, HexCoordinate, Edge } from '../types'
import { getEdgeVertices } from '../board/geometry'

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

// ============= Trading Calculations =============

export function generateTradeId(): string {
  return `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export function calculateTradeValue(resources: Partial<ResourceCards>): number {
  return Object.values(resources).reduce((sum, count) => sum + (count || 0), 0)
}

export function isValidBankTrade(offering: Partial<ResourceCards>, requesting: Partial<ResourceCards>): boolean {
  const offeringCount = calculateTradeValue(offering)
  const requestingCount = calculateTradeValue(requesting)
  
  // Bank trades must be 4:1 ratio
  return offeringCount === 4 && requestingCount === 1
}

export function isValidPortTrade(offering: Partial<ResourceCards>, requesting: Partial<ResourceCards>, ratio: number, portType: 'generic' | string): boolean {
  const offeringCount = calculateTradeValue(offering)
  const requestingCount = calculateTradeValue(requesting)
  
  // Port trades must match the ratio (2:1 or 3:1)
  if (offeringCount !== ratio || requestingCount !== 1) {
    return false
  }
  
  // For specific port types, all offered resources must match the port type
  if (portType !== 'generic') {
    const offeredResourceTypes = Object.keys(offering).filter(key => {
      const value = offering[key as keyof typeof offering]
      return typeof value === 'number' && value > 0
    })
    return offeredResourceTypes.length === 1 && offeredResourceTypes[0] === portType
  }
  
  return true
}

export function hasAccessToPort(playerId: string, portType: 'generic' | string, board: Board): boolean {
  // All players have access to generic 4:1 bank trading
  if (portType === 'generic') {
    return true
  }
  
  // Check if player has a settlement or city adjacent to the specific port
  if (board && board.vertices && board.ports) {
    for (const [vertexId, vertex] of board.vertices) {
      // Check if player owns this vertex
      if (vertex.building && vertex.building.owner === playerId) {
        // Check if this vertex has a port of the desired type
        if (vertex.port && vertex.port.type === portType) {
          return true
        }
      }
    }
  }
  
  return false
} 

// ============= Port Access Validation =============

/**
 * Check if a player has access to a specific port type and ratio
 */
export function hasPortAccess(
  state: GameState, 
  playerId: PlayerId, 
  portType: 'generic' | ResourceType,
  ratio: number
): boolean {
  const player = state.players.get(playerId)
  if (!player) return false

  // Get all player's settlements and cities
  const playerBuildings = getPlayerBuildings(state, playerId)

  // Check each building for adjacent port access
  for (const building of playerBuildings) {
    const adjacentPorts = getAdjacentPorts(state.board, building.vertexId)
    for (const port of adjacentPorts) {
      if (matchesPortRequirements(port, portType, ratio)) {
        return true
      }
    }
  }

  return false
}

/**
 * Get all buildings owned by a player
 */
function getPlayerBuildings(state: GameState, playerId: PlayerId): Array<{vertexId: string, building: Building}> {
  const playerBuildings: Array<{vertexId: string, building: Building}> = []
  
  state.board.vertices.forEach((vertex, vertexId) => {
    if (vertex.building && vertex.building.owner === playerId) {
      playerBuildings.push({ vertexId, building: vertex.building })
    }
  })

  return playerBuildings
}

/**
 * Get all ports adjacent to a vertex (within 1 edge distance)
 */
function getAdjacentPorts(board: Board, vertexId: string): Port[] {
  const adjacentPorts: Port[] = []
  const vertex = board.vertices.get(vertexId)
  if (!vertex) return adjacentPorts

  // Ports are placed on sea edges adjacent to the coast
  // A vertex has access to a port if:
  // 1. The vertex is adjacent to a sea edge that contains a port
  // 2. One of the vertex's adjacent vertices is adjacent to a port edge

  // Get all edges connected to this vertex
  const connectedEdges = getVertexConnectedEdges(board, vertexId)
  
  // Check if any connected edge leads to a port
  for (const edge of connectedEdges) {
    // Get the other vertex of this edge
    const edgeVertices = getEdgeVertices(board, edge.id)
    const otherVertexId = edgeVertices.find(vId => vId !== vertexId)
    
    if (otherVertexId) {
      // Check if the other vertex is adjacent to any ports
      const otherVertex = board.vertices.get(otherVertexId)
      if (otherVertex) {
        // Check all ports to see if they're accessible from the other vertex
        for (const port of board.ports) {
          if (isVertexAdjacentToPort(board, otherVertexId, port)) {
            adjacentPorts.push(port)
          }
        }
      }
    }
  }

  // Remove duplicates
  const uniquePorts = adjacentPorts.filter((port, index, self) => 
    index === self.findIndex(p => p.id === port.id)
  )

  return uniquePorts
}

/**
 * Get all edges connected to a vertex
 */
function getVertexConnectedEdges(board: Board, vertexId: string): Edge[] {
  const connectedEdges: Edge[] = []
  
  board.edges.forEach((edge, edgeId) => {
    const edgeVertices = getEdgeVertices(board, edgeId)
    if (edgeVertices.includes(vertexId)) {
      connectedEdges.push(edge)
    }
  })
  
  return connectedEdges
}

/**
 * Check if a vertex is adjacent to a port (within trading distance)
 */
function isVertexAdjacentToPort(board: Board, vertexId: string, port: Port): boolean {
  const vertex = board.vertices.get(vertexId)
  if (!vertex) return false

  // A vertex is adjacent to a port if it shares hex coordinates with the port's position
  // Ports are positioned on sea edges, and vertices can access them if they're on the coast
  
  // Get the vertex's hex coordinates
  const vertexHexes = vertex.position.hexes
  
  // Get the port's hex coordinates (ports are on sea edges)
  const portHexes = port.position.hexes
  
  // Check if any of the vertex's hexes are adjacent to the port's hexes
  for (const vertexHex of vertexHexes) {
    for (const portHex of portHexes) {
      // If they share the same hex or are adjacent hexes, the vertex has port access
      if (hexesAreAdjacent(vertexHex, portHex) || hexesAreEqual(vertexHex, portHex)) {
        return true
      }
    }
  }

  return false
}

/**
 * Check if two hexes are adjacent (1 distance apart)
 */
function hexesAreAdjacent(hex1: HexCoordinate, hex2: HexCoordinate): boolean {
  const dx = hex1.q - hex2.q
  const dy = hex1.r - hex2.r
  const dz = hex1.s - hex2.s
  
  // In cube coordinates, adjacent hexes have exactly one coordinate difference of ±1
  // and the sum of absolute differences equals 2
  return Math.abs(dx) + Math.abs(dy) + Math.abs(dz) === 2
}

/**
 * Check if two hexes are the same
 */
function hexesAreEqual(hex1: HexCoordinate, hex2: HexCoordinate): boolean {
  return hex1.q === hex2.q && hex1.r === hex2.r && hex1.s === hex2.s
}

/**
 * Check if a port matches the required type and ratio
 */
function matchesPortRequirements(
  port: Port, 
  requiredType: 'generic' | ResourceType, 
  requiredRatio: number
): boolean {
  // Generic 3:1 ports work for any resource at 3:1 ratio
  if (port.type === 'generic' && requiredRatio === 3 && requiredType !== 'generic') {
    return true
  }
  
  // Specific 2:1 ports work only for their resource at 2:1 ratio
  if (port.type === requiredType && port.ratio === requiredRatio) {
    return true
  }
  
  return false
}

/**
 * Get the best available port trade ratio for a resource
 */
export function getBestPortRatio(
  state: GameState, 
  playerId: PlayerId, 
  resourceType: ResourceType
): number {
  // Check for 2:1 specific port first
  if (hasPortAccess(state, playerId, resourceType, 2)) {
    return 2
  }
  
  // Check for 3:1 generic port
  if (hasPortAccess(state, playerId, 'generic', 3)) {
    return 3
  }
  
  // Default to 4:1 bank trade
  return 4
}

/**
 * Get all available port trades for a player
 */
export function getAvailablePortTrades(state: GameState, playerId: PlayerId): Array<{
  portType: 'generic' | ResourceType
  ratio: number
  resourcesCanTrade: ResourceType[]
}> {
  const availableTrades: Array<{
    portType: 'generic' | ResourceType
    ratio: number
    resourcesCanTrade: ResourceType[]
  }> = []

  const resourceTypes: ResourceType[] = ['wood', 'brick', 'ore', 'wheat', 'sheep']

  // Check each resource type for specific 2:1 ports
  for (const resourceType of resourceTypes) {
    if (hasPortAccess(state, playerId, resourceType, 2)) {
      availableTrades.push({
        portType: resourceType,
        ratio: 2,
        resourcesCanTrade: [resourceType]
      })
    }
  }

  // Check for generic 3:1 port access
  if (hasPortAccess(state, playerId, 'generic', 3)) {
    availableTrades.push({
      portType: 'generic',
      ratio: 3,
      resourcesCanTrade: resourceTypes
    })
  }

  return availableTrades
} 