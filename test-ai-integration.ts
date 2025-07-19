#!/usr/bin/env bun

// Quick verification script for AI integration
import { GameFlowManager } from '@settlers/game-engine'
import { VertexSetupNextVPBot } from './packages/ai-framework/src/bots/vertex-setup+next-vp'

console.log('🧪 Testing AI Integration...')

try {
  // Create a test game
  const gameFlow = GameFlowManager.createGame({
    playerNames: ['AI-Player', 'Human1', 'Human2'],
    randomizePlayerOrder: false
  })

  const playerIds = Array.from(gameFlow.getState().players.keys())
  console.log(`✅ Game created with players: ${playerIds.join(', ')}`)

  // Create AI bot
  const bot = new VertexSetupNextVPBot(gameFlow, {
    playerId: playerIds[0],
    thinkingTimeMs: 0,
    enableLogging: true
  })

  console.log('✅ AI bot created successfully')

  // Test action generation
  const gameState = gameFlow.getState()
  console.log(`📋 Game phase: ${gameState.phase}`)
  console.log(`👤 Current player: ${gameState.currentPlayer}`)

  const action = bot.getNextAction(gameState)
  if (action) {
    console.log(`🎯 AI generated action: ${action.type} - ${JSON.stringify(action.data)}`)
  } else {
    console.log('⚠️ AI returned no action')
  }

  console.log('🎉 AI Integration Test PASSED!')

} catch (error) {
  console.error('❌ AI Integration Test FAILED:', error)
  process.exit(1)
}