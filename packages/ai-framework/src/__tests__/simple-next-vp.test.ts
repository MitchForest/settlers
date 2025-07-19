import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { GameFlowManager, GameState, GameAction, processAction } from '@settlers/game-engine'
import { InitialPlacementStrategy } from '../strategies/initial-placement'
import { SimpleNextVPStrategy } from '../strategies/simple-next-vp'
import { getSimplePhaseAction } from '../helpers/game-helpers'

interface GameResult {
  success: boolean
  turns: number
  winner: string | null
  finalVP: Record<string, number>
  timeMs: number
  error?: string
}

describe('Simple Next VP Strategy', () => {
  let gameFlow: GameFlowManager
  let playerIds: string[]
  let setupStrategy: InitialPlacementStrategy
  let mainStrategy: SimpleNextVPStrategy

  beforeEach(() => {
    // Create fresh instances for each test
    gameFlow = GameFlowManager.createGame({
      playerNames: ['SimpleAI-1', 'SimpleAI-2', 'SimpleAI-3'],
      randomizePlayerOrder: false
    })
    
    playerIds = Array.from(gameFlow.getState().players.keys())
    setupStrategy = new InitialPlacementStrategy()
    mainStrategy = new SimpleNextVPStrategy()
    
    console.log(`🎮 Game created with players: ${playerIds.join(', ')}`)
  })

  afterEach(() => {
    // Cleanup - ensure game flow is properly disposed
    gameFlow = null as any
    playerIds = []
    setupStrategy = null as any
    mainStrategy = null as any
  })

  it('should complete a full game using simple next VP strategy', async () => {
    console.log('\n🧪 Testing Simple Next VP Strategy Game Completion')
    console.log('==================================================')
    
    const result = await runSingleGame()
    
    // Assertions
    expect(result.success).toBe(true)
    expect(result.turns).toBeLessThan(150)
    expect(result.winner).toBeTruthy()
    expect(result.timeMs).toBeGreaterThan(0)
    
    console.log('\n✅ Game completed successfully!')
    console.log(`🏆 Winner: ${result.winner}`)
    console.log(`⏱️ Turns: ${result.turns}`)
    console.log(`🕒 Time: ${result.timeMs}ms`)
    
    // Log final scores
    console.log('\n📊 Final Victory Points:')
    Object.entries(result.finalVP).forEach(([player, vp]) => {
      console.log(`  ${player}: ${vp} VP`)
    })
  }, 30000) // 30 second timeout

  it('should handle all game phases without errors', async () => {
    console.log('\n🔧 Testing Game Phase Handling')
    console.log('===============================')
    
    const result = await runSingleGame()
    
    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()
    
    console.log(`✅ All phases handled successfully over ${result.turns} turns`)
  }, 30000)

  async function runSingleGame(): Promise<GameResult> {
    const startTime = Date.now()
    let turnCount = 0
    const maxTurns = 80
    let lastPhase = ''
    
    // Use the same pattern as the working test: maintain gameState directly
    let gameState = gameFlow.getState()
    
    console.log('\n🚀 Starting game simulation...')
    
    try {
      while (turnCount < maxTurns) {
        // Log phase changes
        if (gameState.phase !== lastPhase) {
          console.log(`📋 Phase: ${lastPhase} → ${gameState.phase}`)
          lastPhase = gameState.phase
        }
        
        // Check for game end
        if (gameState.winner || gameState.phase === 'ended') {
          const finalVP = getFinalVictoryPoints(gameState)
          console.log(`🏁 Game finished in ${turnCount} turns. Winner: ${gameState.winner}`)
          return {
            success: true,
            turns: turnCount,
            winner: gameState.winner,
            finalVP,
            timeMs: Date.now() - startTime
          }
        }
        
        const currentPlayer = gameState.currentPlayer
        const action = await getActionForCurrentPhase(gameState, currentPlayer)
        
        if (!action) {
          console.log(`❌ No action available for ${currentPlayer} in phase ${gameState.phase}`)
          return {
            success: false,
            turns: turnCount,
            winner: null,
            finalVP: getFinalVictoryPoints(gameState),
            timeMs: Date.now() - startTime,
            error: `No action available in phase ${gameState.phase}`
          }
        }
        
        // DEBUG: Log every action attempt with current resources
        const player = gameState.players.get(currentPlayer)!
        const totalResources = Object.values(player.resources).reduce((sum, count) => sum + count, 0)
        console.log(`\n🎯 Turn ${turnCount}: Player ${currentPlayer} attempting ${action.type} in phase ${gameState.phase}`)
        console.log(`   💰 Resources: ${totalResources} total ${JSON.stringify(player.resources)}`)
        if (action.data) {
          console.log(`   📋 Data:`, JSON.stringify(action.data, null, 2))
        }
        
        // Special logging for road building attempts
        if (action.type === 'build' && action.data?.buildingType === 'road') {
          const wood = player.resources.wood || 0
          const brick = player.resources.brick || 0
          console.log(`   🛣️ ROAD BUILD: Has ${wood} wood, ${brick} brick (needs 1 each)`)
          console.log(`   🎯 Target edge: ${action.data.edgeId}`)
        }
        
        // Execute action through game engine - SAME AS WORKING TEST
        const result = await processAction(gameState, action)
        
        if (!result.success) {
          console.log(`❌ Action failed: ${result.error}`)
          console.log(`   Action: ${action.type}`, action.data)
          console.log(`   Current player: ${currentPlayer}, Expected: ${gameState.currentPlayer}`)
          console.log(`   Phase: ${gameState.phase}`)
          return {
            success: false,
            turns: turnCount,
            winner: null,
            finalVP: getFinalVictoryPoints(gameState),
            timeMs: Date.now() - startTime,
            error: result.error
          }
        } else {
          console.log(`✅ Action succeeded: ${action.type}`)
          
          // Log dice rolls and resource distribution
          if (action.type === 'roll') {
            const rollResult = (result as any).diceResult
            if (rollResult) {
              console.log(`🎲 Rolled: ${rollResult.total}`)
              if (rollResult.total === 7) {
                console.log(`💥 7 ROLLED - Players will discard!`)
              } else {
                // Log who got resources
                const beforeResources: Record<string, any> = {}
                for (const [playerId, player] of gameState.players) {
                  beforeResources[playerId] = { ...player.resources }
                }
                
                // Check after state for resource changes
                for (const [playerId, playerAfter] of result.newState.players) {
                  const before = beforeResources[playerId]
                  const after = playerAfter.resources
                  const gained: string[] = []
                  
                  for (const [resource, afterCount] of Object.entries(after)) {
                    const beforeCount = before[resource] || 0
                    if (afterCount > beforeCount) {
                      gained.push(`+${afterCount - beforeCount} ${resource}`)
                    }
                  }
                  
                  if (gained.length > 0) {
                    const totalAfter = Object.values(after).reduce((sum: number, count: number) => sum + count, 0)
                    console.log(`📈 ${playerId}: ${gained.join(', ')} (total: ${totalAfter})`)
                  }
                }
              }
            }
          }
          
          // Log building actions in detail
          if (action.type === 'build' || action.type === 'placeBuilding' || action.type === 'placeRoad') {
            const playerAfter = result.newState.players.get(currentPlayer)!
            const totalResources = Object.values(playerAfter.resources).reduce((sum, count) => sum + count, 0)
            console.log(`🔧 ${currentPlayer} after building: ${totalResources} resources ${JSON.stringify(playerAfter.resources)}`)
          }
        }
        
        // CRITICAL: Update gameState with new state after each action - SAME AS WORKING TEST
        gameState = result.newState
        turnCount++
        
        // Progress logging every 20 turns with detailed building info
        if (turnCount % 20 === 0) {
          const currentVPs = getFinalVictoryPoints(gameState)
          const maxVP = Math.max(...Object.values(currentVPs))
          console.log(`⏰ Turn ${turnCount}: Max VP = ${maxVP}`)
          
          // Show each player's resources and buildings
          for (const [playerId, player] of gameState.players) {
            const totalResources = Object.values(player.resources).reduce((sum, count) => sum + count, 0)
            const placedSettlements = Array.from(gameState.board.vertices.values())
              .filter(vertex => vertex.building?.owner === playerId && vertex.building?.type === 'settlement').length
            const placedCities = Array.from(gameState.board.vertices.values())
              .filter(vertex => vertex.building?.owner === playerId && vertex.building?.type === 'city').length
            const placedRoads = Array.from(gameState.board.edges.values())
              .filter(edge => edge.connection?.owner === playerId).length
            
            console.log(`📊 ${playerId}: ${currentVPs[playerId]} VP | ${totalResources} resources ${JSON.stringify(player.resources)} | ${placedSettlements}S/${placedCities}C/${placedRoads}R | Available: ${player.buildings.settlements}S/${player.buildings.cities}C/${player.buildings.roads}R`)
          }
        }
      }
      
      console.log(`⏰ Game timed out after ${maxTurns} turns`)
      const finalVP = getFinalVictoryPoints(gameState)
      console.log(`🏆 Final scores:`)
      for (const [playerId, vp] of Object.entries(finalVP)) {
        console.log(`   ${playerId}: ${vp} VP`)
      }
      return {
        success: false,
        turns: maxTurns,
        winner: null,
        finalVP,
        timeMs: Date.now() - startTime,
        error: 'Game exceeded maximum turns'
      }
      
    } catch (error) {
      console.error('💥 Game crashed:', error)
      return {
        success: false,
        turns: turnCount,
        winner: null,
        finalVP: getFinalVictoryPoints(gameState),
        timeMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async function getActionForCurrentPhase(state: GameState, playerId: string): Promise<GameAction | null> {
    // Use setup strategy for setup phases
    if (state.phase === 'setup1') {
      return getSetupAction(state, playerId, 1)
    } else if (state.phase === 'setup2') {
      return getSetupAction(state, playerId, 2)
    } else if (state.phase === 'actions') {
      // Use main game strategy
      return mainStrategy.selectBestAction(state, playerId)
    } else {
      // Handle other phases with simple logic
      return getSimplePhaseAction(state, playerId)
    }
  }

    function getSetupAction(state: GameState, playerId: string, setupRound: 1 | 2): GameAction | null {
    const player = state.players.get(playerId)!
    const expectedSettlements = setupRound
    const expectedRoads = setupRound
    
    // Count settlements PLACED ON BOARD, not available in inventory
    const placedSettlements = Array.from(state.board.vertices.values())
      .filter(vertex => vertex.building?.owner === playerId && vertex.building?.type === 'settlement').length
    
    // Count roads PLACED ON BOARD, not available in inventory  
    const placedRoads = Array.from(state.board.edges.values())
      .filter(edge => edge.connection?.owner === playerId).length
    
    console.log(`🏗️ Setup Debug: Player ${playerId} has ${placedSettlements}/${expectedSettlements} settlements, ${placedRoads}/${expectedRoads} roads`)
    
    if (placedSettlements < expectedSettlements) {
      // Need to place settlement
      console.log(`🏠 Placing settlement (round ${setupRound})`)
      try {
        if (setupRound === 1) {
          const vertexId = setupStrategy.selectFirstSettlement(state, playerId)
          console.log(`📍 Selected vertex: ${vertexId}`)
          const vertex = state.board.vertices.get(vertexId)
          if (!vertex) {
            console.log(`❌ Vertex ${vertexId} not found in board`)
            return { type: 'endTurn', playerId, data: {} }
          }
          return {
            type: 'placeBuilding',
            playerId,
            data: { buildingType: 'settlement', vertexId }
          }
        } else {
          const vertexId = setupStrategy.selectSecondSettlement(state, playerId)
          console.log(`📍 Selected vertex: ${vertexId}`)
          const vertex = state.board.vertices.get(vertexId)
          if (!vertex) {
            console.log(`❌ Vertex ${vertexId} not found in board`)
            return { type: 'endTurn', playerId, data: {} }
          }
          return {
            type: 'placeBuilding',
            playerId,
            data: { buildingType: 'settlement', vertexId }
          }
        }
      } catch (error) {
        console.log(`❌ Error selecting settlement: ${error}`)
        return { type: 'endTurn', playerId, data: {} }
      }
    } else if (placedRoads < expectedRoads) {
      // Need to place road
      console.log(`🛣️ Placing road (round ${setupRound})`)
      try {
        const recentSettlement = findMostRecentSettlement(state, playerId)
        console.log(`🏠 Recent settlement: ${recentSettlement}`)
        if (recentSettlement) {
          const edgeId = setupRound === 1 
            ? setupStrategy.selectFirstRoad(state, playerId, recentSettlement)
            : setupStrategy.selectSecondRoad(state, playerId, recentSettlement)
          
          console.log(`🛣️ Selected edge: ${edgeId}`)
          if (edgeId) {
            const edge = state.board.edges.get(edgeId)
            if (!edge) {
              console.log(`❌ Edge ${edgeId} not found in board`)
              return { type: 'endTurn', playerId, data: {} }
            }
            return {
              type: 'placeRoad',
              playerId,
              data: { edgeId }
            }
          }
        }
      } catch (error) {
        console.log(`❌ Error selecting road: ${error}`)
        return { type: 'endTurn', playerId, data: {} }
      }
    }
    
    // Setup complete, end turn
    console.log(`✅ Setup complete for player ${playerId}`)
    return { type: 'endTurn', playerId, data: {} }
  }

  function findMostRecentSettlement(state: GameState, playerId: string): string | null {
    // Simple approach: find any settlement owned by player
    for (const [vertexId, vertex] of state.board.vertices) {
      if (vertex.building?.owner === playerId && vertex.building.type === 'settlement') {
        return vertexId
      }
    }
    return null
  }

  function getFinalVictoryPoints(state: GameState): Record<string, number> {
    const vp: Record<string, number> = {}
    for (const [playerId, player] of state.players) {
      vp[playerId] = player.score.total
    }
    return vp
  }
}) 