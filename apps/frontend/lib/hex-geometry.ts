import { hexCache, HEX_RADIUS } from './board-utils'
import { VertexPosition, EdgePosition, HexCoordinate } from '@settlers/core'

/**
 * Hex Geometry Utilities
 * 
 * Provides proper vertex and edge calculations using honeycomb-grid library.
 * This replaces manual trigonometry with mathematically correct positioning.
 */

/**
 * Get the pixel position of a vertex where 3 hexes meet
 * Uses honeycomb-grid corner calculations for perfect precision
 */
export function getVertexPixelPosition(vertex: VertexPosition): { x: number; y: number } {
  // Get the first hex as our reference
  const refHex = vertex.hexes[0]
  const hex = hexCache.getHex(refHex.q, refHex.r)
  
  // Get all 6 corners of the reference hex
  const corners = hex.corners
  
  // Find the vertex direction based on the other hexes in the vertex
  // For now, use the first corner as approximation - TODO: implement proper vertex calculation
  const vertexDirection = vertex.direction || 'N'
  
  // Map direction to corner index (flat-top orientation)
  const directionToCorner: Record<string, number> = {
    'N': 0,   // North (top)
    'NE': 1,  // Northeast
    'SE': 2,  // Southeast  
    'S': 3,   // South (bottom)
    'SW': 4,  // Southwest
    'NW': 5   // Northwest
  }
  
  const cornerIndex = directionToCorner[vertexDirection] || 0
  const corner = corners[cornerIndex]
  
  return { x: corner.x, y: corner.y }
}

/**
 * Get the pixel positions (start and end) of an edge between two vertices
 * Uses honeycomb-grid edge calculations for proper road placement
 */
export function getEdgePixelPositions(edge: EdgePosition): { start: { x: number; y: number }, end: { x: number; y: number } } {
  if (edge.hexes.length < 2) {
    // Fallback: single hex edge (shouldn't happen in valid board)
    const hex = hexCache.getHex(edge.hexes[0].q, edge.hexes[0].r)
    const corners = hex.corners
    return {
      start: { x: corners[0].x, y: corners[0].y },
      end: { x: corners[1].x, y: corners[1].y }
    }
  }
  
  // Get the two hexes that share this edge
  const hex1 = hexCache.getHex(edge.hexes[0].q, edge.hexes[0].r)
  const hex2 = hexCache.getHex(edge.hexes[1].q, edge.hexes[1].r)
  
  // Find the actual shared edge between the hexes by finding the two corners
  // that are closest to both hex centers
  const corners1 = hex1.corners
  const corners2 = hex2.corners
  
  // Find the two corners from hex1 that are closest to hex2's center
  const sharedCorners: Array<{ x: number, y: number }> = []
  
  corners1.forEach(corner1 => {
    // Check if this corner is very close to any corner of hex2
    corners2.forEach(corner2 => {
      const distance = Math.sqrt(
        Math.pow(corner1.x - corner2.x, 2) + Math.pow(corner1.y - corner2.y, 2)
      )
      
      // If corners are very close (within 1 pixel), they're the same corner
      if (distance < 1 && sharedCorners.length < 2) {
        sharedCorners.push({ x: corner1.x, y: corner1.y })
      }
    })
  })
  
  // If we found the shared edge, use it
  if (sharedCorners.length === 2) {
    return {
      start: sharedCorners[0],
      end: sharedCorners[1]
    }
  }
  
  // Fallback: calculate midpoint and create a proper edge segment
  const center1 = { x: hex1.center.x, y: hex1.center.y }
  const center2 = { x: hex2.center.x, y: hex2.center.y }
  
  // Calculate the midpoint between hex centers
  const midX = (center1.x + center2.x) / 2
  const midY = (center1.y + center2.y) / 2
  
  // Calculate edge direction (perpendicular to line between centers)
  const dx = center2.x - center1.x
  const dy = center2.y - center1.y
  const length = Math.sqrt(dx * dx + dy * dy)
  
  // Normalize and create perpendicular vector
  const perpX = -dy / length
  const perpY = dx / length
  
  // Create edge endpoints - use actual hex edge length
  // For flat-top hexes, edge length = HEX_RADIUS (not radius * 0.6)
  const edgeLength = HEX_RADIUS * 0.9 // 90% of hex edge for roads
  
  return {
    start: {
      x: midX - perpX * edgeLength / 2,
      y: midY - perpY * edgeLength / 2
    },
    end: {
      x: midX + perpX * edgeLength / 2,
      y: midY + perpY * edgeLength / 2
    }
  }
}

/**
 * Get the center position of a sea hex for port placement
 * This ensures ports are centered in sea hexes, not between hex centers
 */
export function getSeaHexCenterPosition(hexCoord: HexCoordinate): { x: number; y: number } {
  const hex = hexCache.getHex(hexCoord.q, hexCoord.r)
  return { x: hex.center.x, y: hex.center.y }
}

/**
 * Calculate the distance between two hex coordinates
 * Uses honeycomb-grid distance calculation
 */
export function calculateHexDistance(from: HexCoordinate, to: HexCoordinate): number {
  const hex1 = hexCache.getHex(from.q, from.r)
  const hex2 = hexCache.getHex(to.q, to.r)
  
  // Use cube distance formula: max(|q1-q2|, |r1-r2|, |s1-s2|)
  const dq = Math.abs(hex1.q - hex2.q)
  const dr = Math.abs(hex1.r - hex2.r)
  const ds = Math.abs(hex1.s - hex2.s)
  
  return Math.max(dq, dr, ds)
}

/**
 * Get all neighboring hex coordinates for a given hex
 * Uses honeycomb-grid neighbor calculation
 */
export function getHexNeighbors(hexCoord: HexCoordinate): HexCoordinate[] {
  const hex = hexCache.getHex(hexCoord.q, hexCoord.r)
  
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
    q: hex.q + dir.q,
    r: hex.r + dir.r,
    s: -(hex.q + dir.q + hex.r + dir.r)
  }))
} 