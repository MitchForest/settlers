#!/usr/bin/env bun
import { GameFlowManager } from './packages/core/src/engine/game-flow'
import { AutoPlayer } from './packages/core/src/ai/auto-player'
import { GameState } from './packages/core/src/types'

console.log('🎮 COMPLETE GAME INTEGRATION TEST')
console.log('==================================')

async function runGameTest() {
  try {
    console.log('🎯 Initializing game...')
    
    // Create a new game using static method
    const gameFlow = GameFlowManager.createGame({
      playerNames: ['AI Player 1', 'AI Player 2', 'AI Player 3'],
      gameId: 'test-game',
      randomizePlayerOrder: true
    })
    
    console.log('✅ Game created successfully')
    
    // Get initial state
    const state = gameFlow.getState()
    console.log(`📊 Initial state: ${state.players.size} players, phase: ${state.phase}`)
    
    // Create AI players based on the game state
    const aiPlayerConfigs = Array.from(state.players.keys()).map(playerId => ({
      playerId,
      personality: 'balanced' as const,
      difficulty: 'medium' as const,
      thinkingTimeMs: 100, // Fast for testing
      maxActionsPerTurn: 20,
      enableLogging: true
    }))
    
    const aiPlayers = aiPlayerConfigs.map(config => ({
      ai: new AutoPlayer(gameFlow, config),
      playerId: config.playerId
    }))
    
    console.log('🤖 AI players created')
    
    // Game loop
    let turnCount = 0
    const maxTurns = 100 // Prevent infinite loops
    
    while (turnCount < maxTurns) {
      const state = gameFlow.getState()
      
      // Check if game is over
      if (state.phase === 'gameOver') {
        console.log('🎉 Game completed!')
        console.log(`🏆 Winner: ${state.winner}`)
        console.log(`⏱️ Total turns: ${turnCount}`)
        
        // Display final scores
        console.log('\n📊 Final Scores:')
        for (const [playerId, player] of state.players) {
          console.log(`  ${player.name}: ${player.score.total} VP`)
        }
        
        return { success: true, winner: state.winner, turns: turnCount }
      }
      
      // Find the current player's AI
      const currentPlayerId = state.currentPlayer
      const currentAIWrapper = aiPlayers.find(wrapper => wrapper.playerId === currentPlayerId)
      
      if (!currentAIWrapper) {
        console.error(`❌ No AI found for player: ${currentPlayerId}`)
        break
      }
      
      const currentAI = currentAIWrapper.ai
      
      console.log(`\n🎯 Turn ${turnCount + 1} - Player: ${currentPlayerId}`)
      console.log(`📊 Phase: ${state.phase}`)
      
      // Log current scores
      const currentPlayer = state.players.get(currentPlayerId)
      if (currentPlayer) {
        console.log(`🏆 Score: ${currentPlayer.score.total}/10 VP`)
        console.log(`💰 Resources: ${Object.values(currentPlayer.resources).reduce((a, b) => a + b, 0)} total`)
      }
      
      // Execute AI turn
      const turnResult = await currentAI.executeTurn()
      
      if (!turnResult.success) {
        console.error(`❌ AI turn failed: ${turnResult.error}`)
        break
      }
      
      console.log(`✅ Turn completed - ${turnResult.actionsExecuted.length} actions`)
      
      turnCount++
      
      // Add a small delay to prevent overwhelming output
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    
    if (turnCount >= maxTurns) {
      console.log(`⏱️ Game reached maximum turns (${maxTurns})`)
      const state = gameFlow.getState()
      
      // Find player with highest score
      let highestScore = 0
      let leader = null
      
      for (const [playerId, player] of state.players) {
        if (player.score.total > highestScore) {
          highestScore = player.score.total
          leader = playerId
        }
      }
      
      console.log(`🏆 Game leader: ${leader} with ${highestScore} VP`)
      return { success: false, error: 'Max turns reached', leader, turns: turnCount }
    }
    
  } catch (error) {
    console.error('❌ Game test failed:', error)
    return { success: false, error: error.message }
  }
}

// Run the test
runGameTest().then(result => {
  console.log('\n📋 TEST RESULT:')
  console.log('===============')
  
  if (result?.success) {
    console.log('✅ COMPLETE GAME SUCCESS!')
    console.log(`🏆 Winner: ${result.winner}`)
    console.log(`⏱️ Turns: ${result.turns}`)
    
    // Benchmark assessment
    if (result.turns <= 60) {
      console.log('🎯 EXCELLENT: Game completed within target range!')
    } else if (result.turns <= 80) {
      console.log('✅ GOOD: Game completed in reasonable time')
    } else {
      console.log('⚠️ SLOW: Game took longer than expected')
    }
  } else {
    console.log('❌ GAME INCOMPLETE')
    console.log(`Error: ${result?.error}`)
    if (result?.leader) {
      console.log(`Leader: ${result.leader}`)
    }
  }
}).catch(error => {
  console.error('💥 Test crashed:', error)
})