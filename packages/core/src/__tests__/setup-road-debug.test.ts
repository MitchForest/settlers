import { describe, it, expect } from 'vitest'
import { GameFlowManager } from '../engine/game-flow'
import { getValidSetupRoadPositions, getVertexEdges, checkSetupRoadPlacement } from '../engine/adjacency-helpers'

describe('Setup Road Debug', () => {
  it('should debug the setup road placement issue', () => {
    console.log('\n=== SETUP ROAD DEBUG TEST ===')
    
    // Create a minimal game with 4 players
    const gameFlow = GameFlowManager.createGame({
      playerNames: ['Player1', 'Player2', 'Player3', 'Player4']
    })
    
    let state = gameFlow.getState()
    console.log(`Initial state: phase=${state.phase}, currentPlayer=${state.currentPlayer}`)
    
    const playerIds = Array.from(state.players.keys())
    console.log(`Players: ${playerIds.join(', ')}`)
    
    // Have each player place their first settlement
    for (let i = 0; i < 4; i++) {
      state = gameFlow.getState()
      const currentPlayer = state.currentPlayer
      console.log(`\n--- Turn ${i}: ${currentPlayer} placing settlement in ${state.phase} ---`)
      
      // Find a valid settlement position
      const vertices = Array.from(state.board.vertices.entries())
      const validVertex = vertices.find(([vertexId, vertex]) => {
        return !vertex.building && // Not occupied
               vertex.position.hexes.some(hex => state.board.hexes.has(`${hex.q},${hex.r},${hex.s}`)) // Valid hex
      })
      
      if (!validVertex) {
        console.error('No valid vertex found!')
        return
      }
      
      const [vertexId, vertex] = validVertex
      console.log(`Placing settlement at vertex ${vertexId}`)
      console.log(`Vertex position hexes: ${vertex.position.hexes.map(h => `${h.q},${h.r},${h.s}`).join(', ')}`)
      
      // Place settlement
      const settlementResult = gameFlow.processAction({
        type: 'placeBuilding',
        playerId: currentPlayer,
        data: { buildingType: 'settlement', vertexId }
      })
      
      if (!settlementResult.success) {
        console.error(`Settlement placement failed: ${settlementResult.error}`)
        return
      }
      
      console.log('Settlement placed successfully')
      
      // Now debug road placement
      state = gameFlow.getState()
      console.log(`After settlement: phase=${state.phase}, currentPlayer=${state.currentPlayer}`)
      
      // Check what edges are connected to this vertex
      const connectedEdges = getVertexEdges(state.board, vertexId)
      console.log(`Connected edges to vertex ${vertexId}: ${connectedEdges.length} edges`)
      console.log(`Connected edges: ${connectedEdges.join(', ')}`)
      
      // Check if any edges are valid for setup roads
      const validSetupRoads = getValidSetupRoadPositions(state, currentPlayer)
      console.log(`Valid setup roads: ${validSetupRoads.length} roads`)
      console.log(`Valid roads: ${validSetupRoads.join(', ')}`)
      
      // Try each connected edge
      for (const edgeId of connectedEdges) {
        const edge = state.board.edges.get(edgeId)
        const isOccupied = !!edge?.connection
        const isValidSetup = checkSetupRoadPlacement(state, currentPlayer, edgeId)
        console.log(`Edge ${edgeId}: occupied=${isOccupied}, validSetup=${isValidSetup}`)
      }
      
      if (validSetupRoads.length > 0) {
        // Place a road
        const roadResult = gameFlow.processAction({
          type: 'placeRoad',
          playerId: currentPlayer,
          data: { edgeId: validSetupRoads[0] }
        })
        
        if (roadResult.success) {
          console.log(`Road placed successfully on edge ${validSetupRoads[0]}`)
        } else {
          console.error(`Road placement failed: ${roadResult.error}`)
        }
      } else {
        console.error('No valid setup roads found!')
        break
      }
      
      state = gameFlow.getState()
      console.log(`After road: phase=${state.phase}, currentPlayer=${state.currentPlayer}`)
    }
    
    console.log('\n=== DEBUG TEST COMPLETE ===\n')
  })
}) 