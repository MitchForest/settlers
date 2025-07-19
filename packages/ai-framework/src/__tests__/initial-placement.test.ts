import { describe, it, expect } from 'vitest'
import { GameFlowManager, processAction, GameState } from '@settlers/game-engine'
import { InitialPlacementStrategy } from '../strategies/initial-placement'

describe('Initial Placement Strategy', () => {
  it('should handle multiplayer initial placement with game state updates', async () => {
    console.log('\n🧪 Testing Initial Placement Strategy')
    console.log('=====================================')
    
    // Create a 3-player game with simple names
    const gameFlow = GameFlowManager.createGame({
      playerNames: ['P1', 'P2', 'P3'],
      randomizePlayerOrder: false
    })
    
    let gameState = gameFlow.getState()
    const playerIds = Array.from(gameState.players.keys())
    const strategy = new InitialPlacementStrategy()
    
    console.log(`\n🎮 Game created with players: ${playerIds.join(', ')}`)
    console.log(`📋 Initial game phase: ${gameState.phase}`)
    
    // Track placements
    const placements: Record<string, { firstSettlement: string, firstRoad: string, secondSettlement: string, secondRoad: string }> = {}
    
    // SETUP PHASE 1: Each player places first settlement + road
    console.log('\n📍 SETUP PHASE 1 - First Settlements & Roads:')
    
    for (let i = 0; i < playerIds.length; i++) {
      const playerId = playerIds[i]
      
      console.log(`\n👤 ${playerId} turn:`)
      
      // AI selects first settlement
      const firstSettlementId = strategy.selectFirstSettlement(gameState, playerId)
      
      // Place settlement
      const settlementAction = {
        type: 'placeBuilding' as const,
        playerId,
        data: {
          buildingType: 'settlement' as const,
          vertexId: firstSettlementId
        }
      }
      
      const settlementResult = await processAction(gameState, settlementAction)
      
      if (!settlementResult.success) {
        throw new Error(`Failed to place settlement for ${playerId}: ${settlementResult.error}`)
      }
      
      gameState = settlementResult.newState
      
      // AI selects first road
      const firstRoadId = strategy.selectFirstRoad(gameState, playerId, firstSettlementId)
      
      if (firstRoadId) {
        // Place road
        const roadAction = {
          type: 'placeRoad' as const,
          playerId,
          data: {
            edgeId: firstRoadId
          }
        }
        
        const roadResult = await processAction(gameState, roadAction)
        
        if (roadResult.success) {
          gameState = roadResult.newState
        }
      }
      
      // End turn to advance to next player
      const endTurnAction = {
        type: 'endTurn' as const,
        playerId,
        data: {}
      }
      
      const endTurnResult = await processAction(gameState, endTurnAction)
      
      if (endTurnResult.success) {
        gameState = endTurnResult.newState
      }
      
      placements[playerId] = { 
        firstSettlement: firstSettlementId, 
        firstRoad: firstRoadId || '', 
        secondSettlement: '', 
        secondRoad: '' 
      }
    }
    
    // SETUP PHASE 2: Each player places second settlement + road (reverse order)
    console.log('\n📍 SETUP PHASE 2 - Second Settlements & Roads:')
    
    for (let i = playerIds.length - 1; i >= 0; i--) {
      const playerId = playerIds[i]
      
      console.log(`\n👤 ${playerId} second turn:`)
      
      // AI selects second settlement
      const secondSettlementId = strategy.selectSecondSettlement(gameState, playerId)
      
      // Place settlement
      const settlementAction = {
        type: 'placeBuilding' as const,
        playerId,
        data: {
          buildingType: 'settlement' as const,
          vertexId: secondSettlementId
        }
      }
      
      const settlementResult = await processAction(gameState, settlementAction)
      console.log(`   ✅ Settlement result: ${settlementResult.success ? 'SUCCESS' : 'FAILED'}`)
      
      if (!settlementResult.success) {
        throw new Error(`Failed to place second settlement for ${playerId}: ${settlementResult.error}`)
      }
      
      gameState = settlementResult.newState
      
      // AI selects second road
      const secondRoadId = strategy.selectSecondRoad(gameState, playerId, secondSettlementId)
      console.log(`   🛣️ Road selected: ${secondRoadId}`)
      
      if (secondRoadId) {
        // Place road
        const roadAction = {
          type: 'placeRoad' as const,
          playerId,
          data: {
            edgeId: secondRoadId
          }
        }
        
        const roadResult = await processAction(gameState, roadAction)
        
        if (roadResult.success) {
          gameState = roadResult.newState
        }
      }
      
      // End turn to advance to next player
      const endTurnAction = {
        type: 'endTurn' as const,
        playerId,
        data: {}
      }
      
      const endTurnResult = await processAction(gameState, endTurnAction)
      
      if (endTurnResult.success) {
        gameState = endTurnResult.newState
      }
      
      placements[playerId].secondSettlement = secondSettlementId
      placements[playerId].secondRoad = secondRoadId || ''
    }
    
    // FINAL RESULTS
    console.log('\n🏆 FINAL PLACEMENT SUMMARY:')
    console.log('========================================')
    
    for (let i = 0; i < playerIds.length; i++) {
      const playerId = playerIds[i]
      const p = placements[playerId]
      
      console.log(`\n👤 Player ${i + 1} (${playerId}):`)
      
      // Settlement 1
      if (p.firstSettlement) {
        const hexInfo1 = getVertexHexInfo(gameState, p.firstSettlement)
        console.log(`   Settlement 1: ${hexInfo1} (VID=${p.firstSettlement})`)
      }
      
      // Road 1  
      if (p.firstRoad) {
        console.log(`   Road 1: ${p.firstRoad}`)
      }
      
      // Settlement 2
      if (p.secondSettlement) {
        const hexInfo2 = getVertexHexInfo(gameState, p.secondSettlement)
        console.log(`   Settlement 2: ${hexInfo2} (VID=${p.secondSettlement})`)
      }
      
      // Road 2
      if (p.secondRoad) {
        console.log(`   Road 2: ${p.secondRoad}`)
      }
    }
    
    // Final assertions
    expect(Object.keys(placements)).toHaveLength(3)
    for (const playerId of playerIds) {
      expect(placements[playerId].firstSettlement).toBeTruthy()
      expect(placements[playerId].secondSettlement).toBeTruthy()
      expect(placements[playerId].firstSettlement).not.toBe(placements[playerId].secondSettlement)
    }

    // Test that no two players have identical settlement vertices
    const allSettlements = playerIds.flatMap(id => [
      placements[id].firstSettlement,
      placements[id].secondSettlement
    ]).filter(Boolean)
    
    const uniqueSettlements = new Set(allSettlements)
    expect(uniqueSettlements.size).toBe(allSettlements.length)
    console.log(`✅ Settlement uniqueness verified: ${allSettlements.length} settlements, ${uniqueSettlements.size} unique vertices`)

    // Test that no two players have identical road edges
    const allRoads = playerIds.flatMap(id => [
      placements[id].firstRoad,
      placements[id].secondRoad
    ]).filter(Boolean)
    
    const uniqueRoads = new Set(allRoads)
    expect(uniqueRoads.size).toBe(allRoads.length)
    console.log(`✅ Road uniqueness verified: ${allRoads.length} roads, ${uniqueRoads.size} unique edges`)
    
    console.log('\n✅ Test completed successfully!')
  })
})

function getVertexHexInfo(gameState: GameState, vertexId: string): string {
  const vertex = gameState.board.vertices.get(vertexId)
  if (!vertex) return 'Unknown'
  
  const hexDescriptions: string[] = []
  
  for (const hexCoord of vertex.position.hexes) {
    const hex = Array.from(gameState.board.hexes.values()).find(
      h => h.position.q === hexCoord.q && h.position.r === hexCoord.r
    )
    
    if (hex && hex.numberToken && hex.terrain && hex.terrain !== 'desert' && hex.terrain !== 'sea') {
      const resourceName = getResourceName(hex.terrain)
      hexDescriptions.push(`${resourceName}-${hex.numberToken}`)
    }
  }
  
  return hexDescriptions.join(', ')
}

function getResourceName(terrain: string): string {
  switch (terrain) {
    case 'forest': return 'WO'
    case 'hills': return 'BR'
    case 'pasture': return 'SH'
    case 'fields': return 'WH'
    case 'mountains': return 'OR'
    default: return terrain.substring(0, 2).toUpperCase()
  }
} 