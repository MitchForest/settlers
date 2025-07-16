// Board generation for Settlers (Catan)
// Generates randomized boards using classic Settlers terrain and number distributions

import {
  Board,
  Hex,
  HexCoordinate,
  TerrainType,
  Port,
  Vertex,
  Edge
} from '../types'
import {
  TERRAIN_DISTRIBUTION,
  NUMBER_TOKENS
} from '../constants'

// Simple shuffle function
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

// Standard Catan hex layout
const STANDARD_HEX_POSITIONS: HexCoordinate[] = [
  // Center
  { q: 0, r: 0, s: 0 },
  
  // Inner ring
  { q: 1, r: -1, s: 0 },
  { q: 1, r: 0, s: -1 },
  { q: 0, r: 1, s: -1 },
  { q: -1, r: 1, s: 0 },
  { q: -1, r: 0, s: 1 },
  { q: 0, r: -1, s: 1 },
  
  // Outer ring
  { q: 2, r: -2, s: 0 },
  { q: 2, r: -1, s: -1 },
  { q: 2, r: 0, s: -2 },
  { q: 1, r: 1, s: -2 },
  { q: 0, r: 2, s: -2 },
  { q: -1, r: 2, s: -1 },
  { q: -2, r: 2, s: 0 },
  { q: -2, r: 1, s: 1 },
  { q: -2, r: 0, s: 2 },
  { q: -1, r: -1, s: 2 },
  { q: 0, r: -2, s: 2 },
  { q: 1, r: -2, s: 1 }
]

export function generateBoard(boardId: string = `board-${Date.now()}`): Board {
  // Create terrain pool based on standard distribution
  const terrainPool: TerrainType[] = []
  
  // Add terrains according to standard distribution
  for (let i = 0; i < TERRAIN_DISTRIBUTION.forest; i++) terrainPool.push('forest')
  for (let i = 0; i < TERRAIN_DISTRIBUTION.pasture; i++) terrainPool.push('pasture')
  for (let i = 0; i < TERRAIN_DISTRIBUTION.fields; i++) terrainPool.push('fields')
  for (let i = 0; i < TERRAIN_DISTRIBUTION.hills; i++) terrainPool.push('hills')
  for (let i = 0; i < TERRAIN_DISTRIBUTION.mountains; i++) terrainPool.push('mountains')
  for (let i = 0; i < TERRAIN_DISTRIBUTION.desert; i++) terrainPool.push('desert')
  
  // Shuffle terrain and numbers
  const shuffledTerrain = shuffleArray(terrainPool)
  const shuffledNumbers = shuffleArray(NUMBER_TOKENS)
  
  // Create hexes
  const hexes = new Map<string, Hex>()
  let numberIndex = 0
  
  STANDARD_HEX_POSITIONS.forEach((position, index) => {
    const terrain = shuffledTerrain[index]
    const hexId = `${position.q},${position.r},${position.s}`
    
    // Desert gets no number token
    const numberToken = terrain === 'desert' ? null : shuffledNumbers[numberIndex++]
    
    hexes.set(hexId, {
      id: hexId,
      position,
      terrain,
      numberToken,
      hasRobber: terrain === 'desert' // Robber starts on desert
    })
  })
  
  // Generate vertices and edges (simplified for now)
  const vertices = new Map<string, Vertex>()
  const edges = new Map<string, Edge>()
  
  // Create empty ports array (would be populated with actual port placement logic)
  const ports: Port[] = []
  
  // Find desert hex for initial robber position
  const desertHex = Array.from(hexes.values()).find(hex => hex.terrain === 'desert')
  const robberPosition = desertHex ? desertHex.position : null
  
  return {
    hexes,
    vertices,
    edges,
    ports,
    robberPosition
  }
} 