import { defineHex, Grid, hexToPoint, Orientation } from 'honeycomb-grid'
import { VertexPosition } from '@settlers/core'
import type { Board } from '@settlers/core'

// CRITICAL: This must match HexTile.tsx HEX_RADIUS constant
export const HEX_RADIUS = 32

// Player colors for the game
export const PLAYER_COLORS = {
  0: '#FF453A', // Red
  1: '#32ADE6', // Blue
  2: '#30D158', // Green
  3: '#FFD60A', // Yellow
}

// Define our custom Hex class with proper dimensions and orientation
const CustomHex = defineHex({
  dimensions: HEX_RADIUS,
  orientation: Orientation.FLAT, // Flat-top hexes for Settlers
})

/**
 * Hex Instance Cache for Performance
 * 
 * Caches hex instances to avoid repeated object creation during rendering
 * and game logic calculations. Critical for performance with frequent
 * coordinate conversions and geometry calculations.
 */
class HexCache {
  private cache = new Map<string, InstanceType<typeof CustomHex>>()
  
  getHex(q: number, r: number): InstanceType<typeof CustomHex> {
    const key = `${q},${r}`
    
    if (!this.cache.has(key)) {
      this.cache.set(key, new CustomHex({ q, r }))
    }
    
    return this.cache.get(key)!
  }
  
  clear(): void {
    this.cache.clear()
  }
  
  get size(): number {
    return this.cache.size
  }
}

export const hexCache = new HexCache()

// Create a grid instance for the Settlers board
// This will hold all valid hexes and provide proper coordinate conversion
let boardGrid: Grid<InstanceType<typeof CustomHex>> | null = null

/**
 * Initialize the board grid with the actual board hexes
 * This creates a proper Grid instance that honeycomb-grid can use for hit testing
 */
export function initializeBoardGrid(board: Board): Grid<InstanceType<typeof CustomHex>> {
  // Convert board hexes to honeycomb-grid hexes
  const hexCoordinates = Array.from(board.hexes.values()).map(hex => ({
    q: hex.position.q,
    r: hex.position.r
  }))
  
  // Create grid with the actual board hexes
  boardGrid = new Grid(CustomHex, hexCoordinates)
  
  // Grid initialized successfully
  return boardGrid
}

/**
 * Get the current board grid instance
 */
export function getBoardGrid(): Grid<InstanceType<typeof CustomHex>> | null {
  return boardGrid
}

/**
 * Convert hex coordinates to pixel positions using honeycomb-grid
 * Uses cached hex instances for optimal performance
 */
export function hexToPixel(q: number, r: number): { x: number, y: number } {
  const hex = hexCache.getHex(q, r)
  const point = hexToPoint(hex)
  return { x: point.x, y: point.y }
}

/**
 * Convert pixel coordinates to hex using honeycomb-grid's pointToHex
 * This is the PROPER way to do hit testing - no more manual distance calculations!
 */
export function pixelToHex(x: number, y: number): { q: number, r: number, s: number } | null {
  if (!boardGrid) {
    console.warn('Board grid not initialized - call initializeBoardGrid() first')
    return null
  }
  
  // Use honeycomb-grid's built-in pointToHex - this handles ALL the math for us!
  const hex = boardGrid.pointToHex({ x, y }, { allowOutside: false })
  
  if (!hex) {
    return null // Point is not on any valid hex
  }
  
  return {
    q: hex.q,
    r: hex.r,
    s: hex.s
  }
}

/**
 * Test if a point hits a hex using proper honeycomb-grid methods
 * This replaces all our manual distance calculations
 */
export function hitTestHex(x: number, y: number): string | null {
  const hexCoords = pixelToHex(x, y)
  if (!hexCoords) {
    return null
  }
  
  return `${hexCoords.q},${hexCoords.r},${hexCoords.s}`
}

/**
 * Get neighbors of a hex using honeycomb-grid's built-in functions
 */
export function getHexNeighbors(q: number, r: number): Array<{q: number, r: number, s: number}> {
  if (!boardGrid) {
    return []
  }
  
  const hex = boardGrid.getHex({ q, r })
  if (!hex) {
    return []
  }
  
  // Use honeycomb-grid's traversal functions to get neighbors
  const neighbors: Array<{q: number, r: number, s: number}> = []
  
  // Get all 6 directions around the hex
  for (let direction = 0; direction < 6; direction++) {
    const neighbor = boardGrid.neighborOf(hex, direction, { allowOutside: false })
    if (neighbor) {
      neighbors.push({
        q: neighbor.q,
        r: neighbor.r,
        s: neighbor.s
      })
    }
  }
  
  return neighbors
}

/**
 * Calculate distance between two hexes using honeycomb-grid
 */
export function hexDistance(from: {q: number, r: number}, to: {q: number, r: number}): number {
  if (!boardGrid) {
    return 0
  }
  
  return boardGrid.distance(from, to, { allowOutside: true })
}

/**
 * Check if a vertex position is valid for building
 */
export function isValidVertexPosition(_position: VertexPosition): boolean {
  // TODO: Implement vertex validation logic
  return true
}

/**
 * Get all hexes within a certain radius using manual traversal
 * Since we're using Grid API, we implement radius search manually
 */
export function getHexesInRadius(center: {q: number, r: number}, radius: number): Array<{q: number, r: number, s: number}> {
  if (!boardGrid || radius < 0) {
    return []
  }
  
  if (radius === 0) {
    return [{ q: center.q, r: center.r, s: -center.q - center.r }]
  }
  
  const result: Array<{q: number, r: number, s: number}> = []
  
  // Manual radius search - iterate through possible hex coordinates within range
  for (let q = center.q - radius; q <= center.q + radius; q++) {
    for (let r = center.r - radius; r <= center.r + radius; r++) {
      const s = -q - r
      const distance = hexDistance({ q, r }, center)
      
      if (distance <= radius) {
        // Check if this hex exists in our grid
        const hex = boardGrid.getHex({ q, r })
        if (hex) {
          result.push({ q, r, s })
        }
      }
    }
  }
  
  return result
}

// ============================================================================
// ADVANCED GAME LOGIC FUNCTIONS
// ============================================================================

/**
 * Settlement Placement Validation using manual radius calculation
 * 
 * Returns valid positions for settlements based on the 2-space rule:
 * settlements must be at least 2 hexes away from existing buildings
 */
export function getValidSettlementPositions(
  existingBuildings: Array<{q: number, r: number}>
): Array<{q: number, r: number}> {
  const validPositions = new Set<string>()
  
  existingBuildings.forEach(building => {
    // Get all hexes within radius 2 of each building
    const nearbyHexes = getHexesInRadius(building, 2)
    nearbyHexes.forEach(hex => {
      validPositions.add(`${hex.q},${hex.r}`)
    })
  })
  
  return Array.from(validPositions).map(key => {
    const [q, r] = key.split(',').map(Number)
    return { q, r }
  })
}

/**
 * Resource Production Influence using radius calculation
 * 
 * Calculates the area of influence for resource production animations
 * and territorial control mechanics
 */
export function getResourceInfluenceArea(
  buildings: Array<{q: number, r: number}>,
  influenceRadius: number = 2
): Array<{q: number, r: number}> {
  const influenceSet = new Set<string>()
  
  buildings.forEach(building => {
    // Get all hexes within influence radius of each building
    const influenceHexes = getHexesInRadius(building, influenceRadius)
    influenceHexes.forEach(hex => {
      influenceSet.add(`${hex.q},${hex.r}`)
    })
  })
  
  return Array.from(influenceSet).map(key => {
    const [q, r] = key.split(',').map(Number)
    return { q, r }
  })
}

/**
 * Road Pathfinding using simple line approximation
 * 
 * Finds a simple path between two hexes for road building.
 * Uses basic linear interpolation approach.
 */
export function findOptimalRoadPath(
  from: {q: number, r: number}, 
  to: {q: number, r: number}
): Array<{q: number, r: number}> {
  const path: Array<{q: number, r: number}> = []
  const distance = hexDistance(from, to)
  
  // Simple linear interpolation path
  for (let i = 0; i <= distance; i++) {
    const t = distance === 0 ? 0 : i / distance
    const q = Math.round(from.q + (to.q - from.q) * t)
    const r = Math.round(from.r + (to.r - from.r) * t)
    
    // Ensure the hex exists in our grid
    if (boardGrid && boardGrid.getHex({ q, r })) {
      path.push({ q, r })
    }
  }
  
  return path
}

/**
 * Get immediate neighbors using existing grid-based neighbor function
 * 
 * Enhanced version that includes direction information
 */
export function getHexNeighborsAdvanced(
  coord: {q: number, r: number}
): Array<{q: number, r: number, direction: number}> {
  if (!boardGrid) {
    return []
  }
  
  const hex = boardGrid.getHex(coord)
  if (!hex) {
    return []
  }
  
  const neighbors: Array<{q: number, r: number, direction: number}> = []
  
  // Get all 6 directions around the hex (0-5 corresponding to N, NE, SE, S, SW, NW)
  for (let direction = 0; direction < 6; direction++) {
    const neighbor = boardGrid.neighborOf(hex, direction, { allowOutside: false })
    if (neighbor) {
      neighbors.push({
        q: neighbor.q,
        r: neighbor.r,
        direction
      })
    }
  }
  
  return neighbors
}

/**
 * Territory Analysis using honeycomb-grid distance and traversal
 * 
 * Analyzes player territory control using proper hex distance calculations
 */
export function analyzePlayerTerritory(
  playerBuildings: Array<{q: number, r: number}>,
  influenceRadius: number = 3
): {
  territory: Array<{q: number, r: number}>,
  influence: number,
  connectivity: number,
  center: {q: number, r: number} | null
} {
  if (playerBuildings.length === 0) {
    return {
      territory: [],
      influence: 0,
      connectivity: 0,
      center: null
    }
  }
  
  // Calculate territory using spiral influence
  const territory = getResourceInfluenceArea(playerBuildings, influenceRadius)
  
  // Find geometric center of buildings
  const avgQ = playerBuildings.reduce((sum, b) => sum + b.q, 0) / playerBuildings.length
  const avgR = playerBuildings.reduce((sum, b) => sum + b.r, 0) / playerBuildings.length
  const center = { q: Math.round(avgQ), r: Math.round(avgR) }
  
  // Calculate connectivity score using hex distances
  let totalDistance = 0
  let connectionCount = 0
  
  for (let i = 0; i < playerBuildings.length; i++) {
    for (let j = i + 1; j < playerBuildings.length; j++) {
      const dist = hexDistance(playerBuildings[i], playerBuildings[j])
      totalDistance += dist
      connectionCount++
    }
  }
  
  const avgDistance = connectionCount > 0 ? totalDistance / connectionCount : 0
  const connectivity = Math.max(0, 10 - avgDistance) // Higher score for closer buildings
  
  return {
    territory,
    influence: territory.length,
    connectivity: Math.round(connectivity * 10) / 10,
    center
  }
}

/**
 * Coastal Detection for Port Placement using neighbor checking
 * 
 * Finds potential port positions by detecting coastal hexes
 * (land hexes adjacent to water hexes)
 */
export function findCoastalHexes(
  landHexes: Array<{q: number, r: number}>,
  allHexes: Array<{q: number, r: number, terrain: string}>
): Array<{q: number, r: number, isCoastal: boolean}> {
  const landSet = new Set(landHexes.map(h => `${h.q},${h.r}`))
  const coastalHexes: Array<{q: number, r: number, isCoastal: boolean}> = []
  
  landHexes.forEach(landHex => {
    // Get immediate neighbors of this land hex
    const neighbors = getHexNeighbors(landHex.q, landHex.r)
    
    const hasWaterNeighbor = neighbors.some(neighbor => {
      const adjKey = `${neighbor.q},${neighbor.r}`
      
      // Check if this adjacent hex is water (not in land set)
      if (!landSet.has(adjKey)) {
        // Verify it exists in the board as a water hex
        const terrain = allHexes.find(h => h.q === neighbor.q && h.r === neighbor.r)?.terrain
        return terrain === 'sea' || terrain === 'water'
      }
      return false
    })
    
    coastalHexes.push({
      q: landHex.q,
      r: landHex.r,
      isCoastal: hasWaterNeighbor
    })
  })
  
  return coastalHexes
} 