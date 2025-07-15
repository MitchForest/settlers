// Board generator - creates the hexagonal game board using Honeycomb
// Implements decoupled system: base grid + terrain assignment + number assignment

import { defineHex, Grid, fromCoordinates } from 'honeycomb-grid'
import { 
  Board, 
  Hex, 
  BaseGrid,
  PortPlacement,
  TerrainAssignment,
  NumberAssignment,
  HexCoordinate, 
  TerrainType,
  Port,
  BoardLayout
} from '../types'
import { 
  NUMBER_TOKENS,
  BOARD_LAYOUTS
} from '../constants'
import { 
  shuffleArray, 
  hexToString, 
  generateVerticesFromHexes,
  generateEdgesFromHexes
} from '../calculations'

// Define our hex class
const GameHex = defineHex()

// ============= Base Grid Generation =============

// Generate the classic 19-hex Catan board layout
export function generateClassicBaseGrid(): BaseGrid {
  const hexes: HexCoordinate[] = []
  
  // Generate hex coordinates in classic Catan pattern
  // Center hex
  hexes.push({ q: 0, r: 0, s: 0 })
  
  // Ring 1 (6 hexes around center)
  for (let i = 0; i < 6; i++) {
    const angle = i * 60
    const q = Math.round(Math.cos(angle * Math.PI / 180))
    const r = Math.round(Math.sin(angle * Math.PI / 180) * -1)
    const s = -q - r
    hexes.push({ q, r, s })
  }
  
  // Ring 2 (12 hexes around ring 1)
  for (let i = 0; i < 6; i++) {
    const angle = i * 60
    const q1 = Math.round(Math.cos(angle * Math.PI / 180) * 2)
    const r1 = Math.round(Math.sin(angle * Math.PI / 180) * -2)
    const s1 = -q1 - r1
    hexes.push({ q: q1, r: r1, s: s1 })
    
    // Add the intermediate hex
    const nextAngle = ((i + 1) % 6) * 60
    const q2 = Math.round(Math.cos(nextAngle * Math.PI / 180))
    const r2 = Math.round(Math.sin(nextAngle * Math.PI / 180) * -1)
    const s2 = -q2 - r2
    const qMid = q1 + q2
    const rMid = r1 + r2
    const sMid = s1 + s2
    hexes.push({ q: qMid, r: rMid, s: sMid })
  }
  
  // Generate port placements around the edge
  const ports: PortPlacement[] = [
    // Add specific port locations for classic board
    { position: { q: -2, r: 0, s: 2 }, direction: 'NW', type: 'generic' },
    { position: { q: -2, r: 1, s: 1 }, direction: 'SW', type: 'resource', resourceType: 'resource1' },
    { position: { q: -1, r: 2, s: -1 }, direction: 'SW', type: 'generic' },
    { position: { q: 1, r: 1, s: -2 }, direction: 'SE', type: 'resource', resourceType: 'resource2' },
    { position: { q: 2, r: -1, s: -1 }, direction: 'SE', type: 'generic' },
    { position: { q: 2, r: -2, s: 0 }, direction: 'NE', type: 'resource', resourceType: 'resource3' },
    { position: { q: 1, r: -2, s: 1 }, direction: 'NE', type: 'generic' },
    { position: { q: -1, r: -1, s: 2 }, direction: 'NW', type: 'resource', resourceType: 'resource4' },
    { position: { q: 0, r: -2, s: 2 }, direction: 'N', type: 'resource', resourceType: 'resource5' }
  ]
  
  return {
    hexes,
    ports
  }
}

// ============= Terrain Assignment =============

// Generate random terrain assignment for the board
export function generateTerrainAssignment(baseGrid: BaseGrid, options: {
  useBalancedDistribution?: boolean
} = {}): TerrainAssignment {
  const { useBalancedDistribution = true } = options
  
  // Classic Catan terrain distribution
  const terrainPool: TerrainType[] = [
    'terrain1', 'terrain1', 'terrain1', 'terrain1', // 4 forests
    'terrain2', 'terrain2', 'terrain2', 'terrain2', // 4 pastures  
    'terrain3', 'terrain3', 'terrain3', 'terrain3', // 4 fields
    'terrain4', 'terrain4', 'terrain4',             // 3 hills
    'terrain5', 'terrain5', 'terrain5',             // 3 mountains
    'desert'                                        // 1 desert
  ]
  
  const shuffledTerrain = shuffleArray(terrainPool)
  const assignment: TerrainAssignment = {}
  
  baseGrid.hexes.forEach((hex, index) => {
    const key = hexToString(hex)
    assignment[key] = shuffledTerrain[index] || 'desert'
  })
  
  return assignment
}

// ============= Number Assignment =============

// Generate random number token assignment for the board
export function generateNumberAssignment(
  baseGrid: BaseGrid, 
  terrainAssignment: TerrainAssignment,
  options: {
    avoidAdjacentRedNumbers?: boolean
  } = {}
): NumberAssignment {
  const { avoidAdjacentRedNumbers = true } = options
  
  // Classic Catan number distribution (no 7s, one of each except 6 and 8)
  const numberPool: number[] = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12]
  const shuffledNumbers = shuffleArray(numberPool)
  
  const assignment: NumberAssignment = {}
  let numberIndex = 0
  
  baseGrid.hexes.forEach(hex => {
    const key = hexToString(hex)
    const terrain = terrainAssignment[key]
    
    // Desert gets no number token
    if (terrain === 'desert') {
      assignment[key] = null
    } else {
      assignment[key] = shuffledNumbers[numberIndex++] || null
    }
  })
  
  return assignment
}

// ============= Board Assembly =============

// Combine all layers into a complete board
export function assembleBoard(
  id: string,
  baseGrid: BaseGrid,
  terrainAssignment: TerrainAssignment,
  numberAssignment: NumberAssignment
): Board {
  // Create hex objects
  const hexes: Hex[] = baseGrid.hexes.map(position => {
    const key = hexToString(position)
    return {
      id: key,
      position,
      terrain: terrainAssignment[key] || 'desert',
      numberToken: numberAssignment[key] || null,
      hasBlocker: terrainAssignment[key] === 'desert' // Robber starts on desert
    }
  })
  
  // Generate vertices and edges
  const hexPositions = hexes.map(hex => hex.position)
  const vertices = generateVerticesFromHexes(hexPositions)
  const edges = generateEdgesFromHexes(hexPositions)
  
  // Find initial blocker position (on desert)
  const desertHex = hexes.find(hex => hex.terrain === 'desert')
  const blockerPosition = desertHex ? desertHex.position : hexes[0].position
  
  // Create port objects
  const ports: Port[] = baseGrid.ports.map((placement, index) => ({
    id: `port-${index}`,
    position: placement.position,
    type: placement.type === 'generic' ? 'generic' : (placement.resourceType as any) || 'generic',
    ratio: placement.type === 'generic' ? 3 : 2
  }))
  
  return {
    id,
    baseGrid,
    terrainAssignment,
    numberAssignment,
    hexes,
    vertices,
    edges,
    ports,
    blockerPosition
  }
}

// ============= Main Generation Function =============

// Generate a complete board using the specified layout
export function generateBoard(options: {
  layout?: 'classic'
  id?: string
  terrainSeed?: string
  numberSeed?: string
} = {}): Board {
  const { 
    layout = 'classic',
    id = `board-${Date.now()}`,
    terrainSeed,
    numberSeed
  } = options
  
  // Generate base grid
  const baseGrid = layout === 'classic' 
    ? generateClassicBaseGrid()
    : generateClassicBaseGrid() // Add more layouts later
  
  // Generate terrain assignment
  const terrainAssignment = generateTerrainAssignment(baseGrid)
  
  // Generate number assignment
  const numberAssignment = generateNumberAssignment(baseGrid, terrainAssignment)
  
  // Assemble complete board
  return assembleBoard(id, baseGrid, terrainAssignment, numberAssignment)
} 