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

// Standard Catan hex layout (19 land hexes)
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

// Sea hexes forming the outermost ring (for ports and edges)
const SEA_HEX_POSITIONS: HexCoordinate[] = [
  // Top edge (clockwise from top-left)
  { q: 3, r: -3, s: 0 },
  { q: 3, r: -2, s: -1 },
  { q: 3, r: -1, s: -2 },
  { q: 3, r: 0, s: -3 },
  
  // Top-right edge
  { q: 2, r: 1, s: -3 },
  { q: 1, r: 2, s: -3 },
  { q: 0, r: 3, s: -3 },
  
  // Bottom-right edge
  { q: -1, r: 3, s: -2 },
  { q: -2, r: 3, s: -1 },
  { q: -3, r: 3, s: 0 },
  
  // Bottom edge
  { q: -3, r: 2, s: 1 },
  { q: -3, r: 1, s: 2 },
  { q: -3, r: 0, s: 3 },
  
  // Bottom-left edge
  { q: -2, r: -1, s: 3 },
  { q: -1, r: -2, s: 3 },
  { q: 0, r: -3, s: 3 },
  
  // Top-left edge
  { q: 1, r: -3, s: 2 },
  { q: 2, r: -3, s: 1 }
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
  
  // Add land hexes
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
  
  // Add sea hexes (no number tokens, no robber)
  SEA_HEX_POSITIONS.forEach(position => {
    const hexId = `${position.q},${position.r},${position.s}`
    
    hexes.set(hexId, {
      id: hexId,
      position,
      terrain: 'sea',
      numberToken: null,
      hasRobber: false
    })
  })
  
  // Generate vertices and edges
  const vertices = new Map<string, Vertex>()
  const edges = new Map<string, Edge>()
  
  // Generate vertices for each hex (6 vertices per hex)
  hexes.forEach(hex => {
    const directions: Array<'N' | 'NE' | 'SE' | 'S' | 'SW' | 'NW'> = ['N', 'NE', 'SE', 'S', 'SW', 'NW']
    
    directions.forEach(direction => {
      const vertexId = `${hex.position.q},${hex.position.r},${hex.position.s}-${direction}`
      
      if (!vertices.has(vertexId)) {
        vertices.set(vertexId, {
          id: vertexId,
          position: {
            hexes: [hex.position],
            direction
          },
          building: null,
          port: null
        })
      }
    })
  })
  
  // Generate edges between adjacent hexes
  hexes.forEach(hex => {
    const directions: Array<'NE' | 'E' | 'SE' | 'SW' | 'W' | 'NW'> = ['NE', 'E', 'SE', 'SW', 'W', 'NW']
    
    directions.forEach(direction => {
      // Calculate adjacent hex position based on direction
      let adjacentHex: HexCoordinate
      switch (direction) {
        case 'NE':
          adjacentHex = { q: hex.position.q + 1, r: hex.position.r - 1, s: hex.position.s }
          break
        case 'E':
          adjacentHex = { q: hex.position.q + 1, r: hex.position.r, s: hex.position.s - 1 }
          break
        case 'SE':
          adjacentHex = { q: hex.position.q, r: hex.position.r + 1, s: hex.position.s - 1 }
          break
        case 'SW':
          adjacentHex = { q: hex.position.q - 1, r: hex.position.r + 1, s: hex.position.s }
          break
        case 'W':
          adjacentHex = { q: hex.position.q - 1, r: hex.position.r, s: hex.position.s + 1 }
          break
        case 'NW':
          adjacentHex = { q: hex.position.q, r: hex.position.r - 1, s: hex.position.s + 1 }
          break
      }
      
      const adjacentHexId = `${adjacentHex.q},${adjacentHex.r},${adjacentHex.s}`
      
      // Only create edge if adjacent hex exists
      if (hexes.has(adjacentHexId)) {
        const edgeId = `${hex.id}-${adjacentHexId}-${direction}`
        
        if (!edges.has(edgeId)) {
          edges.set(edgeId, {
            id: edgeId,
            position: {
              hexes: [hex.position, adjacentHex],
              direction
            },
            connection: null
          })
        }
      }
    })
  })
  
  // Generate ports on sea edges (simplified port placement)
  const ports: Port[] = generatePorts()

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



// Generate standard Catan ports with alternating pattern
function generatePorts(): Port[] {
  // Standard Catan has 9 ports: 4 generic (3:1) and 5 resource-specific (2:1)
  const ports: Port[] = []
  
  // Port types in the order they should appear (alternating around the board)
  // This maintains the classic Catan distribution
  const portTypes = [
    { type: 'generic' as const, ratio: 3 },
    { type: 'wood' as const, ratio: 2 },
    { type: 'generic' as const, ratio: 3 },
    { type: 'brick' as const, ratio: 2 },
    { type: 'generic' as const, ratio: 3 },
    { type: 'sheep' as const, ratio: 2 },
    { type: 'generic' as const, ratio: 3 },
    { type: 'ore' as const, ratio: 2 },
    { type: 'wheat' as const, ratio: 2 }
  ]
  
  // Place ports in alternating sea hexes (every other hex)
  // Start at index 1, then place every 2 sea hexes (creating the alternating pattern)
  const portIndices = [1, 3, 5, 7, 9, 11, 13, 15, 17] // 9 port positions, every other sea hex
  
  portIndices.forEach((seaHexIndex, portIndex) => {
    const seaHex = SEA_HEX_POSITIONS[seaHexIndex]
    const portType = portTypes[portIndex]
    
    ports.push({
      id: `port-${portIndex + 1}`,
             position: {
         hexes: [seaHex], // Port is centered in this sea hex
         direction: 'NE' // Direction doesn't matter for rendering, just for consistency
       },
      type: portType.type,
      ratio: portType.ratio
    })
  })
  
  return ports
} 