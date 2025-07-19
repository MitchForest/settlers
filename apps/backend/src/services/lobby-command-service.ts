import { eventStore, EventType } from '../db/event-store-repository'
import type { GameEvent } from '@settlers/game-engine'
import { db } from '../db/index'
import { players } from '../../drizzle/schema'
import { eq } from 'drizzle-orm'

// Import types directly instead of from cross-package dependencies
interface LobbyState {
  gameId: string
  gameCode: string
  phase: 'lobby' | 'initial_placement' | 'main_game' | 'ended'
  players: Map<string, LobbyPlayer>
  settings: GameSettings
  isStarted: boolean
  createdAt: Date
  updatedAt: Date
}

interface LobbyPlayer {
  id: string
  userId?: string
  playerType: 'human' | 'ai'
  name: string
  avatarEmoji?: string
  color: string
  joinOrder: number
  isHost: boolean
  isConnected: boolean
  aiSettings?: AISettings
}

interface GameSettings {
  maxPlayers: number
  allowObservers: boolean
  aiEnabled: boolean
  customRules?: Record<string, unknown>
}

interface AISettings {
  difficulty: 'easy' | 'medium' | 'hard'
  personality: 'aggressive' | 'balanced' | 'defensive' | 'economic'
  autoPlay: boolean
  thinkingTimeMs: number
}

// Create local projector for this service
class LocalLobbyProjector {
  static projectLobbyState(
    gameId: string,
    gameCode: string,
    events: GameEvent[],
    createdAt: Date = new Date()
  ): LobbyState {
    let state: LobbyState = {
      gameId,
      gameCode,
      phase: 'lobby',
      players: new Map(),
      settings: {
        maxPlayers: 4,
        allowObservers: true,
        aiEnabled: true,
        customRules: {}
      },
      isStarted: false,
      createdAt,
      updatedAt: createdAt
    }

    // Apply events in sequence order
    const sortedEvents = [...events].sort((a, b) => a.sequenceNumber - b.sequenceNumber)
    
    for (const event of sortedEvents) {
      state = this.applyEvent(state, event)
    }

    return state
  }

  static applyEvent(state: LobbyState, event: GameEvent): LobbyState {
    const newState = { ...state, updatedAt: event.timestamp }

    switch (event.eventType) {
      case 'player_joined':
        return this.applyPlayerJoined(newState, event.data)
      
      case 'player_left':
        return this.applyPlayerLeft(newState, event.data)
      
      case 'ai_player_added':
        return this.applyAIPlayerAdded(newState, event.data)
      
      case 'ai_player_removed':
        return this.applyPlayerLeft(newState, { playerId: event.data.playerId, reason: 'voluntary' })
      
      case 'settings_changed':
        return this.applySettingsChanged(newState, event.data)
      
      case 'game_started':
        return { ...newState, phase: 'initial_placement', isStarted: true }
      
      default:
        return newState
    }
  }

  private static applyPlayerJoined(state: LobbyState, data: any): LobbyState {
    const newPlayers = new Map(state.players)
    
    const player: LobbyPlayer = {
      id: data.playerId,
      userId: data.userId,
      playerType: data.playerType,
      name: data.name,
      avatarEmoji: data.avatarEmoji,
      color: data.color,
      joinOrder: data.joinOrder,
      isHost: data.isHost,
      isConnected: data.playerType === 'human',
      aiSettings: data.aiSettings
    }

    newPlayers.set(data.playerId, player)
    return { ...state, players: newPlayers }
  }

  private static applyPlayerLeft(state: LobbyState, data: any): LobbyState {
    const newPlayers = new Map(state.players)
    
    if (data.reason === 'disconnected') {
      const player = newPlayers.get(data.playerId)
      if (player) {
        newPlayers.set(data.playerId, { ...player, isConnected: false })
      }
    } else {
      newPlayers.delete(data.playerId)
    }

    return { ...state, players: newPlayers }
  }

  private static applyAIPlayerAdded(state: LobbyState, data: any): LobbyState {
    const newPlayers = new Map(state.players)
    
    const aiPlayer: LobbyPlayer = {
      id: data.playerId,
      userId: undefined,
      playerType: 'ai',
      name: data.playerName, // Fix: Use playerName instead of name
      avatarEmoji: '🤖',
      color: data.color,
      joinOrder: data.joinOrder,
      isHost: false,
      isConnected: true,
      aiSettings: data.aiSettings
    }

    newPlayers.set(data.playerId, aiPlayer)
    return { ...state, players: newPlayers }
  }

  private static applySettingsChanged(state: LobbyState, data: any): LobbyState {
    return {
      ...state,
      settings: { ...state.settings, ...data.changes }
    }
  }
}

// Local utility functions
class LocalLobbyStateUtils {
  static getPlayerCount(state: LobbyState): number {
    return state.players.size
  }

  static getConnectedPlayerCount(state: LobbyState): number {
    return Array.from(state.players.values()).filter(p => p.isConnected).length
  }

  static canStartGame(state: LobbyState): { canStart: boolean; reason?: string } {
    const playerCount = this.getPlayerCount(state)
    const connectedCount = this.getConnectedPlayerCount(state)

    if (playerCount < 2) {
      return { canStart: false, reason: 'Need at least 2 players' }
    }

    if (playerCount > state.settings.maxPlayers) {
      return { canStart: false, reason: `Too many players (max ${state.settings.maxPlayers})` }
    }

    if (connectedCount < playerCount) {
      return { canStart: false, reason: 'Some players are disconnected' }
    }

    if (state.isStarted) {
      return { canStart: false, reason: 'Game already started' }
    }

    return { canStart: true }
  }

  static getAvailableColors(state: LobbyState): string[] {
    const usedColors = new Set(Array.from(state.players.values()).map(p => p.color))
    const allColors = ['red', 'blue', 'green', 'yellow', 'orange', 'purple']
    return allColors.filter(color => !usedColors.has(color))
  }

  static getNextJoinOrder(state: LobbyState): number {
    const joinOrders = Array.from(state.players.values()).map(p => p.joinOrder)
    return joinOrders.length === 0 ? 1 : Math.max(...joinOrders) + 1
  }
}

export interface AddAIPlayerCommand {
  gameId: string
  name: string
  difficulty: 'easy' | 'medium' | 'hard'
  personality: 'aggressive' | 'balanced' | 'defensive' | 'economic'
  requestedBy: string
}

export interface JoinGameCommand {
  gameId: string
  userId: string
  playerName: string
  avatarEmoji?: string
}

export interface LeaveGameCommand {
  gameId: string
  playerId: string
  reason: 'voluntary' | 'disconnected' | 'kicked'
}

export interface StartGameCommand {
  gameId: string
  requestedBy: string
}

/**
 * Command service for lobby operations using event sourcing
 * Handles business logic and validation, then emits events
 */
export class LobbyCommandService {
  /**
   * Add an AI player to the lobby
   */
  async addAIPlayer(command: AddAIPlayerCommand): Promise<{ success: boolean; playerId?: string; error?: string }> {
    try {
      // Validate command
      if (!command.name || command.name.trim().length === 0) {
        return { success: false, error: 'AI player name is required' }
      }

      // Use transaction to ensure atomicity
      const result = await db.transaction(async (tx) => {
        // Load current state from events
        const events = await eventStore.getGameEvents(command.gameId)
        const game = await eventStore.getGameById(command.gameId)
        
        if (!game) {
          throw new Error('Game not found')
        }

        const lobbyState = LocalLobbyProjector.projectLobbyState(
          game.id, 
          game.gameCode, 
          events, 
          game.createdAt ? new Date(game.createdAt) : new Date()
        )

        // Business rule validations
        if (lobbyState.isStarted) {
          throw new Error('Cannot add AI player after game has started')
        }

        if (LocalLobbyStateUtils.getPlayerCount(lobbyState) >= lobbyState.settings.maxPlayers) {
          throw new Error(`Lobby is full (max ${lobbyState.settings.maxPlayers} players)`)
        }

        if (!lobbyState.settings.aiEnabled) {
          throw new Error('AI players are not enabled for this game')
        }

        // Generate AI player data
        const playerId = `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        
        // Fix: Get available colors and join order atomically within transaction
        const existingPlayers = await tx.select({ joinOrder: players.joinOrder, color: players.color })
          .from(players)
          .where(eq(players.gameId, command.gameId))
        
        const usedColors = new Set(existingPlayers.map(p => p.color))
        const allColors = ['red', 'blue', 'green', 'yellow', 'orange', 'purple']
        const availableColors = allColors.filter(color => !usedColors.has(color))
        
        if (availableColors.length === 0) {
          throw new Error('No available colors for new player')
        }

        const color = availableColors[0]
        const joinOrder = existingPlayers.length === 0 ? 1 : Math.max(...existingPlayers.map(p => p.joinOrder)) + 1

        // Create player record first (needed for foreign key constraint)
        await tx.insert(players).values({
          id: playerId,
          gameId: command.gameId,
          userId: null, // AI players don't have user IDs
          playerType: 'ai',
          name: command.name,
          avatarEmoji: undefined,
          color,
          joinOrder,
          isHost: false
        })

        return { playerId, color, joinOrder }
      })

      // Emit AI player added event after transaction
      await eventStore.appendEvent({
        gameId: command.gameId,
        playerId: result.playerId,
        eventType: 'ai_player_added',
        data: {
          playerId: result.playerId,
          playerName: command.name, // Fix: Use playerName instead of name
          playerType: 'ai', // Fix: Add missing playerType field
          difficulty: command.difficulty,
          personality: command.personality,
          color: result.color,
          joinOrder: result.joinOrder,
          aiSettings: {
            difficulty: command.difficulty,
            personality: command.personality,
            autoPlay: true,
            thinkingTimeMs: 2000
          }
        }
      })

      return { success: true, playerId: result.playerId }
    } catch (error) {
      console.error('Error adding AI player:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Failed to add AI player' }
    }
  }

  /**
   * Join a human player to the lobby
   */
  async joinGame(command: JoinGameCommand): Promise<{ success: boolean; playerId?: string; error?: string }> {
    try {
      // Use transaction to ensure atomicity  
      const result = await db.transaction(async (tx) => {
        // Load current state from events
        const events = await eventStore.getGameEvents(command.gameId)
        const game = await eventStore.getGameById(command.gameId)
        
        if (!game) {
          throw new Error('Game not found')
        }

        const lobbyState = LocalLobbyProjector.projectLobbyState(
          game.id, 
          game.gameCode, 
          events,
          game.createdAt ? new Date(game.createdAt) : new Date()
        )

        // Business rule validations
        if (lobbyState.isStarted) {
          throw new Error('Cannot join after game has started')
        }

        if (LocalLobbyStateUtils.getPlayerCount(lobbyState) >= lobbyState.settings.maxPlayers) {
          throw new Error(`Lobby is full (max ${lobbyState.settings.maxPlayers} players)`)
        }

        // Check if user already in game
        const existingPlayer = Array.from(lobbyState.players.values())
          .find(p => p.userId === command.userId)
        
        if (existingPlayer) {
          // 🔄 RECONNECTION: User is already in game, just return their existing data
          console.log('🔄 User reconnecting to game:', command.userId, 'existing player:', existingPlayer.id)
          return {
            success: true,
            playerId: existingPlayer.id,
            isHost: existingPlayer.isHost,
            message: 'Reconnected to existing game session'
          }
        }

        // Generate player data
        const playerId = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        
        // Fix: Get available colors and join order atomically within transaction
        const existingPlayers = await tx.select({ joinOrder: players.joinOrder, color: players.color })
          .from(players)
          .where(eq(players.gameId, command.gameId))
        
        const usedColors = new Set(existingPlayers.map(p => p.color))
        const allColors = ['red', 'blue', 'green', 'yellow', 'orange', 'purple']
        const availableColors = allColors.filter(color => !usedColors.has(color))
        
        if (availableColors.length === 0) {
          throw new Error('No available colors for new player')
        }

        const color = availableColors[0]
        const joinOrder = existingPlayers.length === 0 ? 1 : Math.max(...existingPlayers.map(p => p.joinOrder)) + 1

        // Create player record
        await tx.insert(players).values({
          id: playerId,
          gameId: command.gameId,
          userId: command.userId,
          playerType: 'human',
          name: command.playerName,
          avatarEmoji: command.avatarEmoji,
          color,
          joinOrder,
          isHost: false
        })

        return { playerId, color, joinOrder }
      })

      // Emit player joined event after transaction
      await eventStore.appendEvent({
        gameId: command.gameId,
        playerId: result.playerId,
        eventType: 'player_joined',
        data: {
          playerId: result.playerId,
          userId: command.userId,
          playerType: 'human' as const,
          name: command.playerName,
          avatarEmoji: command.avatarEmoji,
          color: result.color,
          joinOrder: result.joinOrder,
          isHost: false
        }
      })

      return { success: true, playerId: result.playerId }
    } catch (error) {
      console.error('Error joining game:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Failed to join game' }
    }
  }

  /**
   * Remove a player from the lobby
   */
  async leaveGame(command: LeaveGameCommand): Promise<{ success: boolean; error?: string }> {
    try {
      // Load current state from events
      const events = await eventStore.getGameEvents(command.gameId)
      const game = await eventStore.getGameById(command.gameId)
      
      if (!game) {
        return { success: false, error: 'Game not found' }
      }

      const lobbyState = LocalLobbyProjector.projectLobbyState(
        game.id, 
        game.gameCode, 
        events,
        game.createdAt ? new Date(game.createdAt) : new Date()
      )

      // Check if player exists
      const player = lobbyState.players.get(command.playerId)
      if (!player) {
        return { success: false, error: 'Player not found in lobby' }
      }

      // Business rule: Can't remove host if other players exist
      if (player.isHost && lobbyState.players.size > 1) {
        return { success: false, error: 'Host cannot leave while other players are in the lobby' }
      }

      // Emit appropriate event
      const eventType: EventType = player.playerType === 'ai' ? 'ai_player_removed' : 'player_left'
      
      await eventStore.appendEvent({
        gameId: command.gameId,
        playerId: command.playerId,
        eventType,
        data: {
          playerId: command.playerId,
          reason: command.reason
        }
      })

      return { success: true }
    } catch (error) {
      console.error('Error leaving game:', error)
      return { success: false, error: 'Failed to leave game' }
    }
  }

  /**
   * Start the game
   */
  async startGame(command: StartGameCommand): Promise<{ success: boolean; error?: string }> {
    try {
      // Load current state from events
      const events = await eventStore.getGameEvents(command.gameId)
      const game = await eventStore.getGameById(command.gameId)
      
      if (!game) {
        return { success: false, error: 'Game not found' }
      }

      const lobbyState = LocalLobbyProjector.projectLobbyState(
        game.id, 
        game.gameCode, 
        events,
        game.createdAt ? new Date(game.createdAt) : new Date()
      )

      // Validate start conditions
      const canStartResult = LocalLobbyStateUtils.canStartGame(lobbyState)
      if (!canStartResult.canStart) {
        return { success: false, error: canStartResult.reason }
      }

      // Check if requester is host
      const requester = Array.from(lobbyState.players.values())
        .find(p => p.userId === command.requestedBy)
      
      if (!requester?.isHost) {
        return { success: false, error: 'Only the host can start the game' }
      }

      // Generate player order (randomized)
      const playerIds = Array.from(lobbyState.players.keys())
      const shuffledPlayerOrder = this.shuffleArray([...playerIds])

      // Emit game started event
      await eventStore.appendEvent({
        gameId: command.gameId,
        eventType: 'game_started',
        data: {
          startedAt: new Date(),
          playerOrder: shuffledPlayerOrder,
          initialBoardState: null // Will be generated by game engine
        }
      })

      return { success: true }
    } catch (error) {
      console.error('Error starting game:', error)
      return { success: false, error: 'Failed to start game' }
    }
  }

  /**
   * Get current lobby state
   */
  async getLobbyState(gameId: string): Promise<{ 
    success: boolean; 
    state?: LobbyState; 
    error?: string 
  }> {
    try {
      const events = await eventStore.getGameEvents(gameId)
      const game = await eventStore.getGameById(gameId)
      
      if (!game) {
        return { success: false, error: 'Game not found' }
      }

      const lobbyState = LocalLobbyProjector.projectLobbyState(
        game.id, 
        game.gameCode, 
        events,
        game.createdAt ? new Date(game.createdAt) : new Date()
      )

      return { success: true, state: lobbyState }
    } catch (error) {
      console.error('Error getting lobby state:', error)
      return { success: false, error: 'Failed to get lobby state' }
    }
  }

  /**
   * Get events since a specific sequence number (for real-time updates)
   */
  async getEventsSince(gameId: string, sinceSequence: number): Promise<{
    success: boolean;
    events?: GameEvent[];
    error?: string;
  }> {
    try {
      const events = await eventStore.getGameEvents(gameId, {
        fromSequence: sinceSequence + 1
      })

      return { success: true, events }
    } catch (error) {
      console.error('Error getting events since:', error)
      return { success: false, error: 'Failed to get events' }
    }
  }

  /**
   * Utility method to shuffle array
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }
}

// Singleton instance
export const lobbyCommandService = new LobbyCommandService() 