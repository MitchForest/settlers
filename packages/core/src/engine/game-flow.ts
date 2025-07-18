// Game flow manager - orchestrates game lifecycle and phase transitions
// Handles game creation, player management, and high-level game flow

import {
  GameState,
  Player,
  PlayerId,
  GamePhase,
  DevelopmentCard,
  GameAction,
  GameEvent,
  PlayerColor,
  Trade
} from '../types'
import {
  GAME_RULES,
  DEVELOPMENT_CARD_COUNTS
} from '../constants'
import {
  createEmptyResources,
  shuffleArray,
  generatePlayerId
} from '../calculations'
import { generateBoard } from './board-generator'
import { processAction, ProcessResult } from './action-processor-v2'

// Game creation options
export interface CreateGameOptions {
  playerNames: string[]
  gameId?: string
  randomizePlayerOrder?: boolean
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
    // Validate player count
    if (options.playerNames.length < GAME_RULES.minPlayers || 
        options.playerNames.length > GAME_RULES.maxPlayers) {
      throw new Error(`Invalid player count. Must be between ${GAME_RULES.minPlayers} and ${GAME_RULES.maxPlayers}`)
    }
    
    // Create players
    const players = new Map<PlayerId, Player>()
    const playerIds: PlayerId[] = []
    
    options.playerNames.forEach((name, index) => {
      const playerId = generatePlayerId()
      const player = createPlayer(playerId, name, index)
      players.set(playerId, player)
      playerIds.push(playerId)
    })
    
    // Shuffle player order if requested
    const finalPlayerOrder = options.randomizePlayerOrder ? 
      shuffleArray([...playerIds]) : 
      playerIds
    
    // Generate board
    const board = generateBoard()
    
    // Create development deck
    const developmentDeck = createDevelopmentDeck()
    
    // Create initial state
    const state: GameState = {
      id: options.gameId || generateGameId(),
      phase: 'setup1',
      turn: 0,
      currentPlayer: finalPlayerOrder[0],
      players,
      board,
      developmentDeck,
      discardPile: [],
      dice: null,
      winner: null,
      activeTrades: [],
      startedAt: new Date(),
      updatedAt: new Date()
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
    return this.state.players.get(this.state.currentPlayer)!
  }
  
  getCurrentPlayerId(): PlayerId {
    return this.state.currentPlayer
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
      this.state.updatedAt = new Date()
      
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
        actions.push('placeBuilding', 'placeRoad')
        break
        
      case 'setup2':
        actions.push('placeBuilding', 'placeRoad')
        break
        
      case 'roll':
        actions.push('roll')
        break
        
      case 'actions':
        actions.push('build', 'bankTrade', 'portTrade', 'createTradeOffer', 'playCard', 'endTurn')
        if (this.canBuyDevelopmentCard(currentPlayerId)) {
          actions.push('buyCard')
        }
        break
        
      case 'discard':
        actions.push('discard')
        break
        
      case 'moveRobber':
        actions.push('moveRobber')
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
    
    // Check resources (wheat + sheep + ore)
    const hasWheat = player.resources.wheat >= 1
    const hasSheep = player.resources.sheep >= 1
    const hasOre = player.resources.ore >= 1
    
    // Check deck not empty
    const deckNotEmpty = this.state.developmentDeck.length > 0
    
    return hasWheat && hasSheep && hasOre && deckNotEmpty
  }
  
  // Get all players in turn order
  getPlayersInOrder(): Player[] {
    const playerIds = Array.from(this.state.players.keys())
    return playerIds.map(id => this.state.players.get(id)!)
  }
  
  // Get next player in turn order
  getNextPlayer(): Player {
    const playerIds = Array.from(this.state.players.keys())
    const currentIndex = playerIds.indexOf(this.state.currentPlayer)
    const nextIndex = (currentIndex + 1) % playerIds.length
    return this.state.players.get(playerIds[nextIndex])!
  }
  
  // Get game statistics
  getStatistics() {
    const stats = {
      turn: this.state.turn,
      phase: this.state.phase,
      players: new Map<PlayerId, any>(),
      gameTime: Date.now() - this.state.startedAt.getTime(),
      totalResources: 0,
      totalBuildings: 0,
      totalDevelopmentCards: 0
    }
    
    this.state.players.forEach((player, playerId) => {
      const playerStats = {
        name: player.name,
        score: player.score.total,
        resources: Object.values(player.resources).reduce((a, b) => a + b, 0),
        buildings: {
          settlements: GAME_RULES.maxSettlements - player.buildings.settlements,
          cities: GAME_RULES.maxCities - player.buildings.cities,
          roads: GAME_RULES.maxRoads - player.buildings.roads
        },
        developmentCards: player.developmentCards.length,
        knightsPlayed: player.knightsPlayed,
        hasLongestRoad: player.hasLongestRoad,
        hasLargestArmy: player.hasLargestArmy
      }
      
      stats.players.set(playerId, playerStats)
      stats.totalResources += playerStats.resources
      stats.totalBuildings += playerStats.buildings.settlements + 
                              playerStats.buildings.cities + 
                              playerStats.buildings.roads
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

  // ============= Trading Management =============
  
  cleanupExpiredTrades(): boolean {
    if (!this.state.activeTrades || this.state.activeTrades.length === 0) {
      return false
    }
    
    const now = new Date()
    const beforeCount = this.state.activeTrades.length
    
    // Filter out expired trades
    this.state.activeTrades = this.state.activeTrades.filter(trade => {
      if (trade.expiresAt && trade.expiresAt <= now) {
        // Add event for expired trade
        this.eventHistory.push({
          id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'tradeExpired',
          gameId: this.state.id,
          playerId: trade.initiator,
          data: { tradeId: trade.id },
          timestamp: now
        })
        return false // Remove this trade
      }
      return true // Keep this trade
    })
    
    const afterCount = this.state.activeTrades.length
    const expiredCount = beforeCount - afterCount
    
    if (expiredCount > 0) {
      this.state.updatedAt = new Date()
      return true
    }
    
    return false
  }
  
  // Get active trades for a specific player
  getActiveTradesForPlayer(playerId: PlayerId): Trade[] {
    return this.state.activeTrades.filter(trade => 
      trade.initiator === playerId || 
      trade.target === playerId || 
      (trade.isOpenOffer && trade.initiator !== playerId)
    )
  }
  
  // Get trade by ID
  getTradeById(tradeId: string): Trade | null {
    return this.state.activeTrades.find(trade => trade.id === tradeId) || null
  }

  // ============= Private Helpers =============
  
  private createDefaultState(): GameState {
    const board = generateBoard()
    const firstPlayerId = generatePlayerId()
    
    return {
      id: generateGameId(),
      phase: 'setup1',
      turn: 0,
      currentPlayer: firstPlayerId,
      players: new Map(),
      board,
      developmentDeck: [],
      discardPile: [],
      dice: null,
      winner: null,
      activeTrades: [],
      startedAt: new Date(),
      updatedAt: new Date()
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
      },
      startedAt: state.startedAt.toISOString(),
      updatedAt: state.updatedAt.toISOString()
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
      },
      startedAt: new Date(data.startedAt),
      updatedAt: new Date(data.updatedAt)
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
      roads: GAME_RULES.maxRoads
    },
    score: {
      public: 0,
      hidden: 0,
      total: 0
    },
    knightsPlayed: 0,
    hasLongestRoad: false,
    hasLargestArmy: false,
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
  for (let i = 0; i < DEVELOPMENT_CARD_COUNTS.roadBuilding; i++) {
    deck.push({
      id: `card-${cardId++}`,
      type: 'roadBuilding',
      purchasedTurn: -1
    })
  }
  
  for (let i = 0; i < DEVELOPMENT_CARD_COUNTS.yearOfPlenty; i++) {
    deck.push({
      id: `card-${cardId++}`,
      type: 'yearOfPlenty',
      purchasedTurn: -1
    })
  }
  
  for (let i = 0; i < DEVELOPMENT_CARD_COUNTS.monopoly; i++) {
    deck.push({
      id: `card-${cardId++}`,
      type: 'monopoly',
      purchasedTurn: -1
    })
  }
  
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