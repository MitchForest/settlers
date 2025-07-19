import { defineHex, Orientation } from 'honeycomb-grid'
import { HexCoordinate } from '../types'

/**
 * Honeycomb Grid Bridge for Core Package
 * 
 * Provides geometry calculations using the same Honeycomb Grid library
 * and configuration as the frontend, ensuring consistent calculations
 * across the entire application.
 */

// Use the same configuration as frontend (from apps/frontend/lib/board-utils.ts)
const HEX_RADIUS = 50
const CustomHex = defineHex({
  dimensions: HEX_RADIUS,
  orientation: Orientation.FLAT, // Flat-top hexes for Settlers
})

/**
 * Honeycomb Bridge Class
 * 
 * Provides efficient geometry calculations with caching for performance.
 * All calculations use the proven Honeycomb Grid algorithms for accuracy.
 */
export class HoneycombBridge {
  private hexCache = new Map<string, InstanceType<typeof CustomHex>>()
  
  /**
   * Get a cached Honeycomb hex instance for the given coordinates
   */
  getHex(coord: HexCoordinate): InstanceType<typeof CustomHex> {
    const key = `${coord.q},${coord.r}`
    if (!this.hexCache.has(key)) {
      this.hexCache.set(key, new CustomHex({ q: coord.q, r: coord.r }))
    }
    const hex = this.hexCache.get(key)
    if (!hex) {
      throw new Error(`Hex not found in cache for key: ${key}`)
    }
    return hex
  }
  
  /**
   * Get all neighboring hex coordinates using manual cube coordinate math
   * Returns the 6 hexes adjacent to the given hex coordinate
   */
  getHexNeighbors(coord: HexCoordinate): HexCoordinate[] {
    // Direction vectors for flat-top orientation
    const directions = [
      { q: 1, r: -1 }, // NE
      { q: 1, r: 0 },  // E
      { q: 0, r: 1 },  // SE
      { q: -1, r: 1 }, // SW
      { q: -1, r: 0 }, // W
      { q: 0, r: -1 }  // NW
    ]
    
    return directions.map(dir => ({
      q: coord.q + dir.q,
      r: coord.r + dir.r,
      s: -(coord.q + dir.q + coord.r + dir.r)
    }))
  }
  
  /**
   * Calculate distance between two hexes using cube coordinate distance formula
   * Returns the number of hex steps between two coordinates
   */
  getHexDistance(from: HexCoordinate, to: HexCoordinate): number {
    // Use cube distance formula: max(|q1-q2|, |r1-r2|, |s1-s2|)
    const dq = Math.abs(from.q - to.q)
    const dr = Math.abs(from.r - to.r)
    const ds = Math.abs(from.s - to.s)
    
    return Math.max(dq, dr, ds)
  }
  
  /**
   * Get the 6 corner vertices of a hex using Honeycomb's precise calculations
   * Returns vertices with pixel coordinates and direction labels
   */
  getHexVertices(coord: HexCoordinate): Array<{x: number, y: number, direction: string}> {
    const hex = this.getHex(coord)
    const corners = hex.corners
    const directions = ['N', 'NE', 'SE', 'S', 'SW', 'NW']
    
    return corners.map((corner, index) => ({
      x: corner.x,
      y: corner.y, 
      direction: directions[index]
    }))
  }
  
  /**
   * Get the center point of a hex
   * Useful for distance calculations and rendering
   */
  getHexCenter(coord: HexCoordinate): {x: number, y: number} {
    const hex = this.getHex(coord)
    return { x: hex.center.x, y: hex.center.y }
  }
  
  /**
   * Calculate the pixel distance between two hex centers
   * Useful for strategic analysis and UI positioning
   */
  getPixelDistance(from: HexCoordinate, to: HexCoordinate): number {
    const hex1 = this.getHex(from)
    const hex2 = this.getHex(to)
    
    const dx = hex2.center.x - hex1.center.x
    const dy = hex2.center.y - hex1.center.y
    
    return Math.sqrt(dx * dx + dy * dy)
  }
  
  /**
   * Check if two hex coordinates are neighbors (adjacent)
   */
  areHexesAdjacent(coord1: HexCoordinate, coord2: HexCoordinate): boolean {
    return this.getHexDistance(coord1, coord2) === 1
  }
  
  /**
   * Get all hex coordinates within a given distance
   * Uses spiral traversal for efficiency
   */
  getHexesWithinDistance(center: HexCoordinate, maxDistance: number): HexCoordinate[] {
    const result: HexCoordinate[] = []
    
    // Include the center hex
    result.push(center)
    
    // Add hexes at each distance ring using manual calculation
    for (let distance = 1; distance <= maxDistance; distance++) {
      // Start at one neighbor and spiral around
      const current = {
        q: center.q + distance,
        r: center.r - distance,
        s: center.s
      }
      
      // The 6 directions to move around the ring
      const ringDirections = [
        { q: -1, r: 1 }, // SW
        { q: -1, r: 0 }, // W
        { q: 0, r: -1 }, // NW
        { q: 1, r: -1 }, // NE
        { q: 1, r: 0 },  // E
        { q: 0, r: 1 }   // SE
      ]
      
      // For each side of the hex ring
      for (let side = 0; side < 6; side++) {
        const direction = ringDirections[side]
        
        // Walk along this side of the ring
        for (let step = 0; step < distance; step++) {
          result.push({
            q: current.q,
            r: current.r,
            s: -(current.q + current.r)
          })
          
          // Move to next position
          current.q += direction.q
          current.r += direction.r
        }
      }
    }
    
    return result
  }
  
  /**
   * Clear the hex cache (useful for memory management in long-running processes)
   */
  clearCache(): void {
    this.hexCache.clear()
  }
  
  /**
   * Get cache statistics for monitoring
   */
  getCacheStats(): {size: number, memoryEstimate: string} {
    const size = this.hexCache.size
    const memoryEstimate = `~${Math.round(size * 0.5)}KB` // Rough estimate
    return { size, memoryEstimate }
  }
}

// Export a singleton instance for use throughout the core package
export const honeycombBridge = new HoneycombBridge()

/**
 * Utility functions for common geometry operations
 */

/**
 * Convert a vertex direction to an angle in degrees
 * Useful for geometric calculations and rendering
 */
export function vertexDirectionToAngle(direction: string): number {
  const angles: Record<string, number> = {
    'N': 90,   // North (top)
    'NE': 30,  // Northeast
    'SE': 330, // Southeast  
    'S': 270,  // South (bottom)
    'SW': 210, // Southwest
    'NW': 150  // Northwest
  }
  return angles[direction] || 0
}

/**
 * Get the opposite vertex direction
 * Useful for edge calculations
 */
export function getOppositeDirection(direction: string): string {
  const opposites: Record<string, string> = {
    'N': 'S',
    'NE': 'SW', 
    'SE': 'NW',
    'S': 'N',
    'SW': 'NE',
    'NW': 'SE'
  }
  return opposites[direction] || direction
}

/**
 * Check if a coordinate is valid (within reasonable bounds)
 * Helps prevent infinite loops in pathfinding
 */
export function isValidHexCoordinate(coord: HexCoordinate): boolean {
  // Check cube coordinate constraint: q + r + s = 0
  if (Math.abs(coord.q + coord.r + coord.s) > 0.001) {
    return false
  }
  
  // Check reasonable bounds (for a standard Catan board)
  const maxDistance = 10 // Allow some buffer beyond standard board
  return Math.abs(coord.q) <= maxDistance && 
         Math.abs(coord.r) <= maxDistance && 
         Math.abs(coord.s) <= maxDistance
}

/**
 * Normalize a hex coordinate (ensure s = -(q + r))
 * Fixes any floating point errors in coordinates
 */
export function normalizeHexCoordinate(coord: HexCoordinate): HexCoordinate {
  return {
    q: coord.q,
    r: coord.r,
    s: -(coord.q + coord.r)
  }
} 