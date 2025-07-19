import {
  GameEvent, 
  LobbyState, 
  LobbyPlayer,
  GameSettings,
  PlayerJoinedData,
  PlayerLeftData,
  AIPlayerAddedData,
  SettingsChangedData
} from './event-store'

// Default settings for new lobbies
const DEFAULT_SETTINGS: GameSettings = {
  maxPlayers: 4,
  allowObservers: true,
  aiEnabled: true,
  customRules: {}
}

// Default lobby state
function createInitialLobbyState(gameId: string, gameCode: string, createdAt: Date): LobbyState {
  return {
    gameId,
    gameCode,
    phase: 'lobby',
    players: new Map(),
    settings: { ...DEFAULT_SETTINGS },
    isStarted: false,
    createdAt,
    updatedAt: createdAt
  }
}

/**
 * Projects lobby state from a stream of events
 * This is the core of event sourcing - rebuilding state from events
 */
export class LobbyProjector {
  /**
   * Build lobby state from an ordered array of events
   */
  static projectLobbyState(
    gameId: string,
    gameCode: string,
    events: GameEvent[],
    createdAt: Date = new Date()
  ): LobbyState {
    let state = createInitialLobbyState(gameId, gameCode, createdAt)

    // Apply events in sequence order
    const sortedEvents = [...events].sort((a, b) => a.sequenceNumber - b.sequenceNumber)
    
    for (const event of sortedEvents) {
      state = this.applyEvent(state, event)
    }

    return state
  }

  /**
   * Apply a single event to lobby state
   */
  static applyEvent(state: LobbyState, event: GameEvent): LobbyState {
    // Always update the timestamp
    const newState = { ...state, updatedAt: event.timestamp }

    switch (event.eventType) {
      case 'player_joined':
        return this.applyPlayerJoined(newState, event.data as PlayerJoinedData)
      
      case 'player_left':
        return this.applyPlayerLeft(newState, event.data as PlayerLeftData)
      
      case 'ai_player_added':
        return this.applyAIPlayerAdded(newState, event.data as AIPlayerAddedData)
      
      case 'ai_player_removed':
        return this.applyPlayerLeft(newState, { playerId: event.data.playerId, reason: 'voluntary' })
      
      case 'settings_changed':
        return this.applySettingsChanged(newState, event.data as SettingsChangedData)
      
      case 'game_started':
        return this.applyGameStarted(newState)
      
      default:
        // For game events (dice_rolled, etc.), lobby state doesn't change
        return newState
    }
  }

  private static applyPlayerJoined(state: LobbyState, data: PlayerJoinedData): LobbyState {
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
      isConnected: data.playerType === 'human', // Humans start connected, AI doesn't connect
      aiSettings: data.aiSettings
    }

    newPlayers.set(data.playerId, player)

    return {
      ...state,
      players: newPlayers
    }
  }

  private static applyPlayerLeft(state: LobbyState, data: PlayerLeftData): LobbyState {
    const newPlayers = new Map(state.players)
    
    if (data.reason === 'disconnected') {
      // Mark as disconnected but don't remove
      const player = newPlayers.get(data.playerId)
      if (player) {
        newPlayers.set(data.playerId, { ...player, isConnected: false })
      }
    } else {
      // Remove completely for voluntary leave or kick
      newPlayers.delete(data.playerId)
    }

    return {
      ...state,
      players: newPlayers
    }
  }

  private static applyAIPlayerAdded(state: LobbyState, data: AIPlayerAddedData): LobbyState {
    const newPlayers = new Map(state.players)
    
    const aiPlayer: LobbyPlayer = {
      id: data.playerId,
      userId: undefined, // AI players don't have user IDs
      playerType: 'ai',
      name: data.name,
      avatarEmoji: '🤖', // Default AI avatar
      color: data.color,
      joinOrder: data.joinOrder,
      isHost: false, // AI players are never hosts
      isConnected: true, // AI players are always "connected"
      aiSettings: data.aiSettings
    }

    newPlayers.set(data.playerId, aiPlayer)

    return {
      ...state,
      players: newPlayers
    }
  }

  private static applySettingsChanged(state: LobbyState, data: SettingsChangedData): LobbyState {
    return {
      ...state,
      settings: {
        ...state.settings,
        ...data.changes
      }
    }
  }

  private static applyGameStarted(state: LobbyState): LobbyState {
    return {
      ...state,
      phase: 'initial_placement',
      isStarted: true
    }
  }

  /**
   * Validate that lobby state is consistent
   */
  static validateLobbyState(state: LobbyState): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    // Check player count
    if (state.players.size > state.settings.maxPlayers) {
      errors.push(`Too many players: ${state.players.size} > ${state.settings.maxPlayers}`)
    }

    // Check for duplicate colors
    const colors = Array.from(state.players.values()).map(p => p.color)
    const uniqueColors = new Set(colors)
    if (colors.length !== uniqueColors.size) {
      errors.push('Duplicate player colors detected')
    }

    // Check for duplicate join orders
    const joinOrders = Array.from(state.players.values()).map(p => p.joinOrder)
    const uniqueJoinOrders = new Set(joinOrders)
    if (joinOrders.length !== uniqueJoinOrders.size) {
      errors.push('Duplicate join orders detected')
    }

    // Check that exactly one player is host
    const hosts = Array.from(state.players.values()).filter(p => p.isHost)
    if (hosts.length !== 1) {
      errors.push(`Expected exactly 1 host, found ${hosts.length}`)
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }
}

/**
 * Utility functions for working with lobby state
 */
export class LobbyStateUtils {
  static getPlayerCount(state: LobbyState): number {
    return state.players.size
  }

  static getConnectedPlayerCount(state: LobbyState): number {
    return Array.from(state.players.values()).filter(p => p.isConnected).length
  }

  static getAIPlayerCount(state: LobbyState): number {
    return Array.from(state.players.values()).filter(p => p.playerType === 'ai').length
  }

  static getHumanPlayerCount(state: LobbyState): number {
    return Array.from(state.players.values()).filter(p => p.playerType === 'human').length
  }

  static getHost(state: LobbyState): LobbyPlayer | undefined {
    return Array.from(state.players.values()).find(p => p.isHost)
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