import { GameFlowManager, GameState } from '@settlers/core'

/**
 * Generates a realistic demo game state for UI testing and development.
 * Creates a mid-game scenario with:
 * - 4 players with varied resources
 * - Some buildings placed
 * - Development cards distributed
 * - Game in active play state
 */
export function generateDemoGame(): GameState {
  // Create base game with 4 players using fixed seed for consistent IDs
  const gameFlow = GameFlowManager.createGame({
    playerNames: ['Alice', 'Bob', 'Charlie', 'Diana'],
    gameId: 'demo-game-12345', // Fixed ID for demo
    randomizePlayerOrder: false
  })

  const state = gameFlow.getState()
  
  console.log('Demo game created with players:', Array.from(state.players.keys()))
  
  // Get players for modification
  const players = Array.from(state.players.values())
  const playerIds = Array.from(state.players.keys())

  // Give players realistic mid-game resources
  if (players.length >= 4) {
    // Alice (Player 1) - Leading player
    players[0].resources = {
      wood: 4,
      brick: 3,
      ore: 2,
      wheat: 3,
      sheep: 2
    }
    players[0].score = { public: 6, hidden: 2, total: 8 }
    
    // Bob (Player 2) - Competitive player
    players[1].resources = {
      wood: 2,
      brick: 2,
      ore: 4,
      wheat: 1,
      sheep: 3
    }
    players[1].score = { public: 4, hidden: 1, total: 5 }
    
    // Charlie (Player 3) - Resource-focused player
    players[2].resources = {
      wood: 6,
      brick: 1,
      ore: 1,
      wheat: 4,
      sheep: 0
    }
    players[2].score = { public: 3, hidden: 0, total: 3 }
    
    // Diana (Player 4) - Development card player
    players[3].resources = {
      wood: 1,
      brick: 4,
      ore: 3,
      wheat: 2,
      sheep: 5
    }
    players[3].score = { public: 5, hidden: 3, total: 8 }
    players[3].knightsPlayed = 2
    players[3].hasLargestArmy = true
  }

  // Set game to active phase (not setup)
  const modifiedState: GameState = {
    ...state,
    phase: 'actions', // Active gameplay phase
    turn: 12, // Mid-game turn count
    currentPlayer: playerIds[0], // Alice's turn
    
    // Add some dice history
    dice: {
      die1: 3,
      die2: 4,
      sum: 7,
      timestamp: Date.now() - 5000 // 5 seconds ago
    },

    // Reduce development deck (some cards have been purchased)
    developmentDeck: state.developmentDeck.slice(8), // Remove first 8 cards
    
    // Add some active trades to showcase trading UI
    activeTrades: [
      {
        id: 'demo-trade-1',
        type: 'player',
        initiator: playerIds[1], // Bob
        target: playerIds[0], // Alice
        offering: { wheat: 2 },
        requesting: { ore: 1 },
        status: 'pending',
        createdAt: new Date(Date.now() - 30000), // 30 seconds ago
        expiresAt: new Date(Date.now() + 90000), // Expires in 90 seconds
        isOpenOffer: false
      }
    ]
  }

  return modifiedState
}

/**
 * Creates a demo GameFlowManager instance with the demo state.
 * This is the main function to call from the demo page.
 */
export function createDemoGameManager(): GameFlowManager {
  const demoState = generateDemoGame()
  return new GameFlowManager(demoState)
} 