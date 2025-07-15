// Game flow manager - orchestrates game lifecycle and phase transitions
// Handles game creation, player management, and high-level game flow

import {
  GameState,
  GameSettings,
  Player,
  PlayerId,
  GamePhase,
  DevelopmentCard,
  ResourceCards,
  Board,
  GameAction,
  GameEvent,
  PlayerColor
} from '../types'
import {
  GAME_RULES,
  DEVELOPMENT_CARD_COUNTS,
  BOARD_LAYOUTS,
  DEFAULT_GAME_SETTINGS
} from '../constants'
import {
  createEmptyResources,
  shuffleArray,
  generatePlayerId
} from '../calculations'
import { generateBoard } from './board-generator'
import { processAction, ProcessResult } from './action-processor'

// Game creation options
export interface CreateGameOptions {
  settings?: Partial<GameSettings>
  playerNames: string[]
  gameId?: string
}

// Player info for game creation
export interface PlayerInfo {
  id: PlayerId
  name: string
  color: number
}

// Game flow manager class - handles game lifecycle
export class GameFlowManager {
  private state: GameState
  private eventHistory: GameEvent[] = []
  private stateHistory: GameState[] = []
  
  constructor(initialState?: GameState) {
    if (initialState) {
      this.state = initialState
    } else {
      this.state = this.createDefaultState()
    }
  }

  // ============= Game Creation =============
  
  static createGame(options: CreateGameOptions): GameFlowManager {
    const settings: GameSettings = {
      ...DEFAULT_GAME_SETTINGS,
      ...options.settings
    }
    
    // Validate player count
    if (options.playerNames.length < GAME_RULES.minPlayers || 
        options.playerNames.length > GAME_RULES.maxPlayers) {
      throw new Error(`Invalid player count. Must be between ${GAME_RULES.minPlayers} and ${GAME_RULES.maxPlayers}`)
    }
    
    // Create players
    const players = new Map<PlayerId, Player>()
    const playerOrder: PlayerId[] = []
    
    options.playerNames.forEach((name, index) => {
      const playerId = generatePlayerId()
      const player = createPlayer(playerId, name, index)
      players.set(playerId, player)
      playerOrder.push(playerId)
    })
    
    // Shuffle player order if randomized
    const finalPlayerOrder = settings.randomizePlayerOrder ? 
      shuffleArray([...playerOrder]) : 
      playerOrder
    
    // Generate board
    const boardLayout = settings.boardLayout === 'standard' ? 
      BOARD_LAYOUTS.standard : 
      BOARD_LAYOUTS.standard // Default to standard if not found
    const board = generateBoard(boardLayout, settings.randomizeBoard)
    
    // Create development deck
    const developmentDeck = createDevelopmentDeck()
    
    // Create initial state
    const state: GameState = {
      id: options.gameId || generateGameId(),
      phase: 'setup1',
      turn: 0,
      currentPlayerIndex: 0,
      players,
      playerOrder: finalPlayerOrder,
      board,
      developmentDeck,
      dice: null,
      trades: [],
      winner: null,
      settings,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    
    return new GameFlowManager(state)
  }
  
  // ============= State Management =============
  
  getState(): GameState {
    return this.state
  }
  
  getEvents(): GameEvent[] {
    return this.eventHistory
  }
  
  getStateHistory(): GameState[] {
    return this.stateHistory
  }
  
  getCurrentPlayer(): Player {
    const playerId = this.state.playerOrder[this.state.currentPlayerIndex]
    return this.state.players.get(playerId)!
  }
  
  getCurrentPlayerId(): PlayerId {
    return this.state.playerOrder[this.state.currentPlayerIndex]
  }
  
  getPlayer(playerId: PlayerId): Player | undefined {
    return this.state.players.get(playerId)
  }
  
  getPhase(): GamePhase {
    return this.state.phase
  }
  
  isGameEnded(): boolean {
    return this.state.phase === 'ended'
  }
  
  getWinner(): Player | null {
    if (!this.state.winner) return null
    return this.state.players.get(this.state.winner) || null
  }
  
  // ============= Action Processing =============
  
  processAction(action: GameAction): ProcessResult {
    // Store current state in history
    this.stateHistory.push(this.state)
    
    // Process the action
    const result = processAction(this.state, action)
    
    if (result.success) {
      // Update state
      this.state = result.newState
      this.state.updatedAt = Date.now()
      
      // Store events
      this.eventHistory.push(...result.events)
      
      // Limit history size
      if (this.stateHistory.length > 100) {
        this.stateHistory = this.stateHistory.slice(-50)
      }
    }
    
    return result
  }
  
  // ============= Game Flow Helpers =============
  
  canUndo(): boolean {
    return this.stateHistory.length > 0 && this.state.phase !== 'ended'
  }
  
  undo(): boolean {
    if (!this.canUndo()) return false
    
    const previousState = this.stateHistory.pop()
    if (previousState) {
      this.state = previousState
      return true
    }
    
    return false
  }
  
  // Get valid actions for current player
  getValidActions(): GameAction['type'][] {
    const actions: GameAction['type'][] = []
    const currentPlayerId = this.getCurrentPlayerId()
    
    switch (this.state.phase) {
      case 'setup1':
      case 'setup2':
        actions.push('placeSettlement', 'placeConnection')
        break
        
      case 'roll':
        actions.push('roll')
        break
        
      case 'actions':
        actions.push('build', 'trade', 'playCard', 'endTurn')
        if (this.canBuyDevelopmentCard(currentPlayerId)) {
          actions.push('buyCard')
        }
        break
        
      case 'discard':
        if (this.state.discardingPlayers?.includes(currentPlayerId)) {
          actions.push('discard')
        }
        break
        
      case 'moveBlocker':
        actions.push('moveBlocker')
        break
        
      case 'steal':
        actions.push('stealResource', 'endTurn')
        break
    }
    
    return actions
  }
  
  // Check if player can buy development card
  private canBuyDevelopmentCard(playerId: PlayerId): boolean {
    const player = this.state.players.get(playerId)
    if (!player) return false
    
    // Check resources
    const cost = { resource3: 1, resource4: 1, resource5: 1 } // Grain, Wool, Ore
    const hasResources = Object.entries(cost).every(([resource, amount]) => {
      return player.resources[resource as keyof ResourceCards] >= amount
    })
    
    // Check deck not empty
    const deckNotEmpty = this.state.developmentDeck.length > 0
    
    return hasResources && deckNotEmpty
  }
  
  // Get game statistics
  getStatistics() {
    const stats = {
      turn: this.state.turn,
      phase: this.state.phase,
      players: new Map<PlayerId, any>(),
      gameTime: Date.now() - this.state.createdAt,
      totalResources: 0,
      totalBuildings: 0,
      totalDevelopmentCards: 0
    }
    
    this.state.players.forEach((player, playerId) => {
      const playerStats = {
        name: player.name,
        score: player.score.public + player.score.hidden,
        resources: Object.values(player.resources).reduce((a, b) => a + b, 0),
        buildings: {
          settlements: GAME_RULES.maxSettlements - player.buildings.settlements,
          cities: GAME_RULES.maxCities - player.buildings.cities,
          connections: GAME_RULES.maxConnections - player.buildings.connections
        },
        developmentCards: player.developmentCards.length,
        knightsPlayed: player.knightsPlayed,
        hasLongestPath: player.hasLongestPath,
        hasLargestForce: player.hasLargestForce
      }
      
      stats.players.set(playerId, playerStats)
      stats.totalResources += playerStats.resources
      stats.totalBuildings += playerStats.buildings.settlements + 
                              playerStats.buildings.cities + 
                              playerStats.buildings.connections
      stats.totalDevelopmentCards += playerStats.developmentCards
    })
    
    return stats
  }
  
  // Serialize state for persistence
  serialize(): string {
    return JSON.stringify({
      state: this.serializeState(this.state),
      eventHistory: this.eventHistory,
      version: '1.0.0'
    })
  }
  
  // Deserialize from saved state
  static deserialize(data: string): GameFlowManager {
    const parsed = JSON.parse(data)
    const state = GameFlowManager.deserializeState(parsed.state)
    const manager = new GameFlowManager(state)
    manager.eventHistory = parsed.eventHistory || []
    return manager
  }
  
  // ============= Private Helpers =============
  
  private createDefaultState(): GameState {
    return {
      id: generateGameId(),
      phase: 'setup1',
      turn: 0,
      currentPlayerIndex: 0,
      players: new Map(),
      playerOrder: [],
      board: generateBoard(BOARD_LAYOUTS.standard, false),
      developmentDeck: [],
      dice: null,
      trades: [],
      winner: null,
      settings: DEFAULT_GAME_SETTINGS,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  }
  
  private serializeState(state: GameState): any {
    return {
      ...state,
      players: Array.from(state.players.entries()),
      board: {
        ...state.board,
        hexes: Array.from(state.board.hexes.entries()),
        vertices: Array.from(state.board.vertices.entries()),
        edges: Array.from(state.board.edges.entries())
      }
    }
  }
  
  private static deserializeState(data: any): GameState {
    return {
      ...data,
      players: new Map(data.players),
      board: {
        ...data.board,
        hexes: new Map(data.board.hexes),
        vertices: new Map(data.board.vertices),
        edges: new Map(data.board.edges)
      }
    }
  }
}

// ============= Helper Functions =============

function createPlayer(id: PlayerId, name: string, colorIndex: number): Player {
  return {
    id,
    name,
    color: colorIndex as PlayerColor,
    resources: createEmptyResources(),
    developmentCards: [],
    buildings: {
      settlements: GAME_RULES.maxSettlements,
      cities: GAME_RULES.maxCities,
      connections: GAME_RULES.maxConnections
    },
    score: {
      public: 0,
      hidden: 0,
      total: 0
    },
    knightsPlayed: 0,
    hasLongestPath: false,
    hasLargestForce: false,
    isConnected: true,
    isAI: false
  }
}

function createDevelopmentDeck(): DevelopmentCard[] {
  const deck: DevelopmentCard[] = []
  let cardId = 0
  
  // Add knights
  for (let i = 0; i < DEVELOPMENT_CARD_COUNTS.knight; i++) {
    deck.push({
      id: `card-${cardId++}`,
      type: 'knight',
      purchasedTurn: -1
    })
  }
  
  // Add progress cards
  const progressTypes: Array<'progress1' | 'progress2' | 'progress3'> = 
    ['progress1', 'progress2', 'progress3']
  
  progressTypes.forEach(type => {
    for (let i = 0; i < DEVELOPMENT_CARD_COUNTS[type]; i++) {
      deck.push({
        id: `card-${cardId++}`,
        type,
        purchasedTurn: -1
      })
    }
  })
  
  // Add victory points
  for (let i = 0; i < DEVELOPMENT_CARD_COUNTS.victory; i++) {
    deck.push({
      id: `card-${cardId++}`,
      type: 'victory',
      purchasedTurn: -1
    })
  }
  
  // Shuffle the deck
  return shuffleArray(deck)
}

function generateGameId(): string {
  return `game-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// Export for use in other modules
export { createPlayer, createDevelopmentDeck } 