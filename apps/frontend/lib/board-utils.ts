import { VertexPosition } from '@settlers/core'

// Player colors for the game
export const PLAYER_COLORS = {
  0: '#FF453A', // Red
  1: '#32ADE6', // Blue
  2: '#30D158', // Green
  3: '#FFD60A', // Yellow
}

// Convert hex coordinates to pixel positions
export function hexToPixel(q: number, r: number, size: number = 60): { x: number, y: number } {
  const x = size * (3/2 * q)
  const y = size * (Math.sqrt(3)/2 * q + Math.sqrt(3) * r)
  return { x, y }
}

// Convert vertex positions to pixel coordinates
export function vertexToPixel(vertex: VertexPosition): { x: number, y: number } {
  // Vertex positions are defined by adjacent hexes
  const hexPositions = vertex.hexes.map(hex => hexToPixel(hex.q, hex.r))
  
  // Calculate centroid of adjacent hex centers
  const x = hexPositions.reduce((sum, pos) => sum + pos.x, 0) / hexPositions.length
  const y = hexPositions.reduce((sum, pos) => sum + pos.y, 0) / hexPositions.length
  
  return { x, y }
}

// Generate vertex ID from position
export function vertexId(vertex: VertexPosition): string {
  return vertex.hexes
    .map(h => `${h.q},${h.r}`)
    .sort()
    .join('|')
}

// Generate edge ID from vertices
export function edgeId(v1: string, v2: string): string {
  return [v1, v2].sort().join('-')
} 