// Board generator - creates the hexagonal game board
// Handles hex placement, number tokens, and port locations

import { 
  Board, 
  Hex, 
  Vertex, 
  Edge, 
  HexCoordinate, 
  VertexPosition, 
  EdgePosition,
  TerrainType,
  Port
} from '../types'
import { 
  NUMBER_TOKENS,
  BOARD_LAYOUTS
} from '../constants'
import { shuffleArray, hexToString } from '../calculations'

// Board layout definition
export interface BoardLayout {
  name: string
  hexes: Array<{
    q: number
    r: number
    terrain: string
    number: number | null
  }>
  ports: Array<{
    position: HexCoordinate
    type: string
    ratio: number
  }>
}

// Generate a complete board from layout
export function generateBoard(layout: BoardLayout, randomize: boolean = true): Board {
  const board: Board = {
    hexes: new Map(),
    vertices: new Map(),
    edges: new Map(),
    ports: [],
    blockerPosition: { q: 0, r: 0, s: 0 } // Will be set to desert hex
  }

  // Process hexes
  const hexData = randomize ? randomizeHexes(layout.hexes) : layout.hexes
  
  hexData.forEach(data => {
    const hex: Hex = {
      id: hexToString({ q: data.q, r: data.r, s: -data.q - data.r }),
      position: { q: data.q, r: data.r, s: -data.q - data.r },
      terrain: data.terrain as TerrainType,
      numberToken: data.number,
      hasBlocker: data.terrain === 'desert'
    }
    
    board.hexes.set(hex.id, hex)
    
    // Set blocker position on desert
    if (hex.terrain === 'desert') {
      board.blockerPosition = hex.position
    }
  })

  // Generate vertices for all hexes
  board.hexes.forEach(hex => {
    const vertices = getVerticesForHex(hex.position)
    vertices.forEach(pos => {
      const id = vertexToString(pos)
      if (!board.vertices.has(id)) {
        board.vertices.set(id, {
          id,
          position: pos,
          building: null,
          port: null
        })
      }
    })
  })

  // Generate edges between vertices
  board.vertices.forEach(vertex => {
    const neighbors = getNeighborVertices(vertex.position)
    neighbors.forEach(neighborPos => {
      const neighborId = vertexToString(neighborPos)
      if (board.vertices.has(neighborId)) {
        const edgeId = edgeToString(vertex.position, neighborPos)
        const reverseEdgeId = edgeToString(neighborPos, vertex.position)
        
        // Only add edge once (check both directions)
        if (!board.edges.has(edgeId) && !board.edges.has(reverseEdgeId)) {
          board.edges.set(edgeId, {
            id: edgeId,
            position: [vertex.position, neighborPos],
            connection: null
          })
        }
      }
    })
  })

  // Add ports
  layout.ports.forEach(portData => {
    const port: Port = {
      position: portData.position,
      type: portData.type as Port['type'],
      ratio: portData.ratio
    }
    board.ports.push(port)
    
    // Assign port to nearest vertices
    // (Simplified - would need proper coastal vertex detection)
  })

  return board
}

// Randomize hex terrains and numbers while maintaining game balance
function randomizeHexes(hexes: BoardLayout['hexes']): BoardLayout['hexes'] {
  // Separate terrain and numbers
  const terrains = hexes.filter(h => h.terrain !== 'desert').map(h => h.terrain)
  const numbers = hexes.filter(h => h.number !== null).map(h => h.number!)
  
  // Shuffle both
  const shuffledTerrains = shuffleArray([...terrains])
  const shuffledNumbers = shuffleArray([...numbers])
  
  // Reconstruct hexes
  let terrainIndex = 0
  let numberIndex = 0
  
  return hexes.map(hex => {
    if (hex.terrain === 'desert') {
      return hex // Desert stays in place
    }
    
    return {
      q: hex.q,
      r: hex.r,
      terrain: shuffledTerrains[terrainIndex++],
      number: shuffledNumbers[numberIndex++]
    }
  })
}

// Get all 6 vertices around a hex
function getVerticesForHex(hex: HexCoordinate): VertexPosition[] {
  return [
    { hexes: [hex], direction: 'N' },
    { hexes: [hex], direction: 'NE' },
    { hexes: [hex], direction: 'SE' },
    { hexes: [hex], direction: 'S' },
    { hexes: [hex], direction: 'SW' },
    { hexes: [hex], direction: 'NW' }
  ]
}

// Get neighboring vertices (connected by an edge)
function getNeighborVertices(vertex: VertexPosition): VertexPosition[] {
  // This is simplified - real implementation would calculate
  // based on hex grid geometry
  const neighbors: VertexPosition[] = []
  
  // Each vertex connects to 2-3 other vertices
  const directions = ['N', 'NE', 'SE', 'S', 'SW', 'NW'] as const
  const currentIndex = directions.indexOf(vertex.direction)
  
  // Add adjacent directions
  const prevIndex = (currentIndex - 1 + 6) % 6
  const nextIndex = (currentIndex + 1) % 6
  
  neighbors.push({
    hexes: vertex.hexes,
    direction: directions[prevIndex]
  })
  
  neighbors.push({
    hexes: vertex.hexes,
    direction: directions[nextIndex]
  })
  
  return neighbors
}

// Convert vertex position to string ID
function vertexToString(vertex: VertexPosition): string {
  const hexIds = vertex.hexes.map(h => hexToString(h)).sort().join(',')
  return `${hexIds}:${vertex.direction}`
}

// Convert edge to string ID
function edgeToString(v1: VertexPosition, v2: VertexPosition): string {
  const ids = [vertexToString(v1), vertexToString(v2)].sort()
  return ids.join('-')
}

// Create standard board layout
export function createStandardBoard(): Board {
  return generateBoard(BOARD_LAYOUTS.standard, true)
}

// Validate board integrity
export function validateBoard(board: Board): boolean {
  // Check hex count
  if (board.hexes.size !== 19) return false
  
  // Check for exactly one desert
  let desertCount = 0
  board.hexes.forEach(hex => {
    if (hex.terrain === 'desert') desertCount++
  })
  if (desertCount !== 1) return false
  
  // Check number token distribution
  const numberCounts = new Map<number, number>()
  board.hexes.forEach(hex => {
    if (hex.numberToken) {
      numberCounts.set(hex.numberToken, (numberCounts.get(hex.numberToken) || 0) + 1)
    }
  })
  
  // Verify correct number distribution (2 of each except 2 and 12)
  for (const [num, count] of numberCounts) {
    if ((num === 2 || num === 12) && count !== 1) return false
    if (num !== 2 && num !== 12 && count !== 2) return false
  }
  
  return true
} 