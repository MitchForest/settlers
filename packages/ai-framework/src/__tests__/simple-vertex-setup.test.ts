import { describe, it, expect } from 'vitest'
import { GameFlowManager, processAction, GameState } from '@settlers/game-engine'
import { InitialPlacementStrategy } from '../strategies/setup/simple-vertex'
import { PIP_VALUES, getResourceName } from '../helpers'

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
    
    // Track placements in order
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
        const hexCount1 = getVertexHexCount(gameState, p.firstSettlement)
        console.log(`   Settlement 1: ${hexInfo1} (${hexCount1} hexes, VID=${p.firstSettlement})`)
      }
      
      // Road 1  
      if (p.firstRoad) {
        console.log(`   Road 1: ${p.firstRoad}`)
      }
      
      // Settlement 2
      if (p.secondSettlement) {
        const hexInfo2 = getVertexHexInfo(gameState, p.secondSettlement)
        const hexCount2 = getVertexHexCount(gameState, p.secondSettlement)
        console.log(`   Settlement 2: ${hexInfo2} (${hexCount2} hexes, VID=${p.secondSettlement})`)
      }
      
      // Road 2
      if (p.secondRoad) {
        console.log(`   Road 2: ${p.secondRoad}`)
      }
    }

    // Detailed placement analysis
    console.log('\n📊 DETAILED PLACEMENT ANALYSIS:')
    console.log('==============================')
    
    const evaluations = playerIds.map(playerId => {
      const settlements = getPlayerSettlements(gameState, playerId)
      const totalHexes = settlements.reduce((sum, s) => sum + s.hexCount, 0)
      const totalProduction = settlements.reduce((sum, s) => sum + s.productionValue, 0)
      const uniqueResources = new Set(settlements.flatMap(s => s.resources.map(r => r.split('-')[0]))).size
      const resourceBreakdown = calculateResourceBreakdown(gameState, playerId)
      const roadAnalysis = analyzeRoadExpansion(gameState, playerId)
      
      return {
        playerId,
        settlements,
        totalHexes,
        totalProduction: Math.round(totalProduction * 10) / 10,
        uniqueResources,
        resourceBreakdown,
        roadAnalysis,
        // Simple score: production + hex bonus + diversity bonus
        score: Math.round(totalProduction + (totalHexes * 2) + (uniqueResources * 3))
      }
    }).sort((a, b) => b.score - a.score)
    
    evaluations.forEach((evaluation, rank) => {
      console.log(`\n🏅 Rank ${rank + 1}: ${evaluation.playerId}`)
      console.log(`   Score: ${evaluation.score} (prod: ${evaluation.totalProduction}, hexes: ${evaluation.totalHexes}, resources: ${evaluation.uniqueResources}/5)`)
      
      // Resource breakdown
      console.log(`   Resource Production:`)
             Object.entries(evaluation.resourceBreakdown).forEach(([resource, pips]) => {
         if ((pips as number) > 0) {
           console.log(`     ${resource.toUpperCase()}: ${pips} pips`)
         }
       })
      
      // Settlement details (show in placement order)
      const p = placements[evaluation.playerId]
      if (p.firstSettlement) {
        const firstSettlement = evaluation.settlements.find(s => s.vertexId === p.firstSettlement)
        if (firstSettlement) {
          console.log(`   Settlement 1: ${firstSettlement.hexCount} hexes → ${firstSettlement.resources.join(', ')}`)
        }
      }
      if (p.secondSettlement) {
        const secondSettlement = evaluation.settlements.find(s => s.vertexId === p.secondSettlement)
        if (secondSettlement) {
          console.log(`   Settlement 2: ${secondSettlement.hexCount} hexes → ${secondSettlement.resources.join(', ')}`)
        }
      }
      
      // Road expansion potential
      console.log(`   Road Expansion Potential:`)
      evaluation.roadAnalysis.forEach((road, i) => {
        console.log(`     Road ${i + 1} → ${road.expansionOptions} vertices reachable (avg score: ${road.avgVertexScore})`)
      })
    })
    
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
    
    // Alert if too many 2-hex settlements
    const twoHexCount = evaluations.flatMap(evaluation => evaluation.settlements).filter(s => s.hexCount === 2).length
    const totalSettlements = evaluations.flatMap(evaluation => evaluation.settlements).length
    if (twoHexCount > totalSettlements / 2) {
      console.log(`⚠️  Warning: ${twoHexCount}/${totalSettlements} settlements are only 2-hex intersections`)
    }
    
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

function getVertexHexCount(gameState: GameState, vertexId: string): number {
  const vertex = gameState.board.vertices.get(vertexId)
  if (!vertex) return 0
  
  let count = 0
  for (const hexCoord of vertex.position.hexes) {
    const hex = Array.from(gameState.board.hexes.values()).find(
      h => h.position.q === hexCoord.q && h.position.r === hexCoord.r
    )
    
    if (hex && hex.terrain && hex.terrain !== 'desert' && hex.terrain !== 'sea') {
      count++
    }
  }
  
  return count
}

function getPlayerSettlements(gameState: GameState, playerId: string) {
  const settlements: Array<{
    vertexId: string
    hexCount: number
    resources: string[]
    productionValue: number
  }> = []
  
  for (const [vertexId, vertex] of gameState.board.vertices) {
    if (vertex.building?.owner === playerId && vertex.building.type === 'settlement') {
      const hexCount = getVertexHexCount(gameState, vertexId)
      const hexInfo = getVertexHexInfo(gameState, vertexId)
      const resources = hexInfo.split(', ').filter(Boolean)
      
      // Calculate production value based on number weights
      const productionValue = calculateVertexProduction(gameState, vertexId)
      
      settlements.push({
        vertexId,
        hexCount,
        resources,
        productionValue
      })
    }
  }
  
  return settlements
}

function calculateVertexProduction(gameState: GameState, vertexId: string): number {
  const vertex = gameState.board.vertices.get(vertexId)
  if (!vertex) return 0
  
  let total = 0
  for (const hexCoord of vertex.position.hexes) {
    const hex = Array.from(gameState.board.hexes.values()).find(
      h => h.position.q === hexCoord.q && h.position.r === hexCoord.r
    )
    
    if (hex && hex.numberToken && hex.terrain && hex.terrain !== 'desert' && hex.terrain !== 'sea') {
      total += PIP_VALUES[hex.numberToken as keyof typeof PIP_VALUES] || 0
    }
  }
  
  return total
}

function calculateResourceBreakdown(gameState: GameState, playerId: string): Record<string, number> {
  const breakdown = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 }
  
  for (const [vertexId, vertex] of gameState.board.vertices) {
    if (vertex.building?.owner === playerId && vertex.building.type === 'settlement') {
      for (const hexCoord of vertex.position.hexes) {
        const hex = Array.from(gameState.board.hexes.values()).find(
          h => h.position.q === hexCoord.q && h.position.r === hexCoord.r
        )
        
        if (hex && hex.numberToken && hex.terrain && hex.terrain !== 'desert' && hex.terrain !== 'sea') {
          const resource = getResourceName(hex.terrain).toLowerCase()
          const pips = PIP_VALUES[hex.numberToken as keyof typeof PIP_VALUES] || 0
          
          if (resource === 'wo') breakdown.wood += pips
          else if (resource === 'br') breakdown.brick += pips  
          else if (resource === 'sh') breakdown.sheep += pips
          else if (resource === 'wh') breakdown.wheat += pips
          else if (resource === 'or') breakdown.ore += pips
        }
      }
    }
  }
  
  return breakdown
}

function analyzeRoadExpansion(gameState: GameState, playerId: string): Array<{expansionOptions: number, avgVertexScore: number}> {
  const roads: Array<{expansionOptions: number, avgVertexScore: number}> = []
  
  // This is a simplified analysis - in a full implementation we'd:
  // 1. Find each road owned by the player
  // 2. Simulate building a second road from each endpoint
  // 3. Score the potential settlement vertices reachable
  // For now, just return placeholder data
  
  let roadCount = 0
  for (const [edgeId, edge] of gameState.board.edges) {
    if (edge.connection?.owner === playerId && edge.connection.type === 'road') {
      roadCount++
      // Placeholder analysis
      roads.push({
        expansionOptions: Math.floor(Math.random() * 3) + 1, // 1-3 options
        avgVertexScore: Math.floor(Math.random() * 20) + 10 // 10-30 score
      })
    }
  }
  
  return roads
} 