// Board generation for Settlers (Catan)
// Uses Honeycomb library properly for all geometric calculations

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
import { honeycombBridge } from './honeycomb-bridge'

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

export function generateBoard(): Board {
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
  const shuffledNumbers = shuffleArray([...NUMBER_TOKENS])
  
  // Create hex map using ALL hex positions (land + sea)
  const allHexPositions = [...STANDARD_HEX_POSITIONS, ...SEA_HEX_POSITIONS]
  const hexes = new Map<string, Hex>()
  
  // Generate land hexes with terrain and numbers
  STANDARD_HEX_POSITIONS.forEach((position, index) => {
    const hexId = `${position.q},${position.r},${position.s}`
    const terrain = shuffledTerrain[index]
    const numberToken = terrain === 'desert' ? null : shuffledNumbers.shift() || null
    
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
  
  // Generate vertices using proper Honeycomb geometry
  const vertices = generateVertices(allHexPositions)
  
  // Generate edges using proper Honeycomb geometry  
  const edges = generateEdges(allHexPositions)

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

/**
 * Generate vertices using proper hexagon geometry
 * Each vertex is the intersection of 3 hexagons
 * Uses canonical IDs to prevent duplicates
 */
function generateVertices(hexPositions: HexCoordinate[]): Map<string, Vertex> {
  const vertexHexSets = new Map<string, { hexes: HexCoordinate[], direction: 'N' | 'NE' | 'SE' | 'S' | 'SW' | 'NW' }>()
  
  // Collect all possible vertex positions
  hexPositions.forEach(hexCoord => {
    const directions: Array<'N' | 'NE' | 'SE' | 'S' | 'SW' | 'NW'> = ['N', 'NE', 'SE', 'S', 'SW', 'NW']
    
    directions.forEach(direction => {
      const touchingHexes = getHexesTouchingVertex(hexCoord, direction)
      const canonicalId = createCanonicalVertexId(touchingHexes)
      
      // Only store if we haven't seen this vertex yet
      if (!vertexHexSets.has(canonicalId)) {
        vertexHexSets.set(canonicalId, { hexes: touchingHexes, direction })
      }
    })
  })
  
  // Create deduplicated vertices
  const vertices = new Map<string, Vertex>()
  vertexHexSets.forEach(({ hexes, direction }, vertexId) => {
    vertices.set(vertexId, {
      id: vertexId,
      position: {
        hexes,
        direction
      },
      building: null,
      port: null
    })
  })
  
  return vertices
}

/**
 * Calculate which 3 hexes touch a vertex at a given direction from a hex
 * This uses proper cube coordinate math
 */
function getHexesTouchingVertex(centerHex: HexCoordinate, direction: 'N' | 'NE' | 'SE' | 'S' | 'SW' | 'NW'): HexCoordinate[] {
  const hexes = [centerHex] // Always includes the center hex
  
  // Get the two neighboring directions for this vertex
  // Each vertex is where 3 hexes meet - the center and its 2 adjacent neighbors
  let neighbor1: HexCoordinate, neighbor2: HexCoordinate
  
  switch (direction) {
    case 'N':
      neighbor1 = { q: centerHex.q, r: centerHex.r - 1, s: centerHex.s + 1 } // NW neighbor
      neighbor2 = { q: centerHex.q + 1, r: centerHex.r - 1, s: centerHex.s }   // NE neighbor
      break
    case 'NE':
      neighbor1 = { q: centerHex.q + 1, r: centerHex.r - 1, s: centerHex.s }   // NE neighbor
      neighbor2 = { q: centerHex.q + 1, r: centerHex.r, s: centerHex.s - 1 }   // E neighbor
      break
    case 'SE':
      neighbor1 = { q: centerHex.q + 1, r: centerHex.r, s: centerHex.s - 1 }   // E neighbor
      neighbor2 = { q: centerHex.q, r: centerHex.r + 1, s: centerHex.s - 1 }   // SE neighbor
      break
    case 'S':
      neighbor1 = { q: centerHex.q, r: centerHex.r + 1, s: centerHex.s - 1 }   // SE neighbor
      neighbor2 = { q: centerHex.q - 1, r: centerHex.r + 1, s: centerHex.s }   // SW neighbor
      break
    case 'SW':
      neighbor1 = { q: centerHex.q - 1, r: centerHex.r + 1, s: centerHex.s }   // SW neighbor
      neighbor2 = { q: centerHex.q - 1, r: centerHex.r, s: centerHex.s + 1 }   // W neighbor
      break
    case 'NW':
      neighbor1 = { q: centerHex.q - 1, r: centerHex.r, s: centerHex.s + 1 }   // W neighbor
      neighbor2 = { q: centerHex.q, r: centerHex.r - 1, s: centerHex.s + 1 }   // NW neighbor
      break
  }
  
  hexes.push(neighbor1, neighbor2)
  return hexes
}

/**
 * Generate edges using proper hexagon geometry
 * Each edge is the boundary between 2 adjacent hexagons
 */
function generateEdges(hexPositions: HexCoordinate[]): Map<string, Edge> {
  const edges = new Map<string, Edge>()
  
  // For each hex, check all 6 directions for adjacent hexes
  hexPositions.forEach(hexCoord => {
    // Get the 6 neighboring hex positions using Honeycomb's neighbor calculation
    const neighbors = honeycombBridge.getHexNeighbors(hexCoord)
    
    neighbors.forEach((neighborCoord, directionIndex) => {
      // Create a canonical edge ID (always use the "smaller" hex first to avoid duplicates)
      const edgeId = createCanonicalEdgeId(hexCoord, neighborCoord)
      
      if (!edges.has(edgeId)) {
        // Get the direction name for this edge
        const direction = ['NE', 'E', 'SE', 'SW', 'W', 'NW'][directionIndex]
        
        edges.set(edgeId, {
          id: edgeId,
          position: {
            hexes: [hexCoord, neighborCoord],
            direction: direction as 'NE' | 'E' | 'SE' | 'SW' | 'W' | 'NW'
          },
          connection: null
        })
      }
    })
  })
  
  return edges
}

/**
 * Create a canonical edge ID to avoid duplicates
 * Always puts the "smaller" hex coordinate first
 */
function createCanonicalEdgeId(hex1: HexCoordinate, hex2: HexCoordinate): string {
  // Compare hexes to determine order (canonical form)
  const compareResult = compareHexCoords(hex1, hex2)
  
  if (compareResult <= 0) {
    return `${hex1.q},${hex1.r},${hex1.s}|${hex2.q},${hex2.r},${hex2.s}`
  } else {
    return `${hex2.q},${hex2.r},${hex2.s}|${hex1.q},${hex1.r},${hex1.s}`
  }
}

/**
 * Compare two hex coordinates for canonical ordering
 */
function compareHexCoords(a: HexCoordinate, b: HexCoordinate): number {
  if (a.q !== b.q) return a.q - b.q
  if (a.r !== b.r) return a.r - b.r
  return a.s - b.s
}

/**
 * Create a canonical vertex ID based on the hexes it touches
 * This ensures the same vertex gets the same ID regardless of creation order
 */
function createCanonicalVertexId(hexes: HexCoordinate[]): string {
  // Sort hexes to create consistent ID regardless of creation order
  const sortedHexes = [...hexes].sort(compareHexCoords)
  return sortedHexes.map(h => `${h.q},${h.r},${h.s}`).join('|')
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