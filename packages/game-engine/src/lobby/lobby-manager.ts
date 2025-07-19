// ============= Lobby Manager =============
// Handles lobby state management, player operations, and game transitions

import { 
  LobbyState, 
  LobbyPlayer, 
  LobbySettings, 
  LobbyValidation, 
  LobbyOperationResult,
  LobbyAIConfig,
  LobbyEvent
} from '../types/lobby-types'
import { PlayerId, GameState, Player } from '../types'
import { generatePlayerId } from '../core/calculations'
import { GameFlowManager } from '../core/game-flow'

// AI name generation arrays
const AI_ADJECTIVES = [
  'Clever', 'Bold', 'Swift', 'Wise', 'Sharp', 'Keen', 'Smart', 'Quick',
  'Bright', 'Cunning', 'Sly', 'Crafty', 'Astute', 'Witty', 'Savvy'
]

const AI_NOUNS = [
  'Builder', 'Trader', 'Settler', 'Explorer', 'Pioneer', 'Merchant',
  'Architect', 'Strategist', 'Planner', 'Developer', 'Colonist', 'Navigator'
]

const AI_AVATARS = ['🤖', '👾', '🎮', '⚡', '🔥', '⭐', '💎', '🚀', '🎯', '🏆']

export class LobbyManager {
  private state: LobbyState
  private eventHistory: LobbyEvent[] = []

  constructor(initialState: LobbyState) {
    this.state = initialState
  }

  // ============= Static Factory Methods =============

  static createLobby(hostPlayer: LobbyPlayer, settings: LobbySettings): LobbyManager {
    const lobbyId = generatePlayerId() // Reuse the ID generation
    
    const initialState: LobbyState = {
      id: lobbyId,
      gameCode: '', // Will be set by the calling code
      hostPlayerId: hostPlayer.id,
      players: new Map([[hostPlayer.id, hostPlayer]]),
      settings,
      status: 'waiting',
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const manager = new LobbyManager(initialState)
    manager.addEvent({ type: 'playerJoined', player: hostPlayer })
    
    return manager
  }

  // ============= Player Management =============

  addPlayer(player: LobbyPlayer): LobbyOperationResult {
    // Validation checks
    if (this.state.players.has(player.id)) {
      return { success: false, error: 'Player already in lobby' }
    }

    if (this.state.players.size >= this.state.settings.maxPlayers) {
      return { success: false, error: 'Lobby is full' }
    }

    if (this.state.status !== 'waiting') {
      return { success: false, error: 'Cannot join lobby - game is starting or in progress' }
    }

    // Add player
    this.state.players.set(player.id, player)
    this.state.updatedAt = new Date()
    this.updateStatus()

    this.addEvent({ type: 'playerJoined', player })

    return { success: true, data: { playerId: player.id } }
  }

  removePlayer(playerId: PlayerId): LobbyOperationResult {
    const player = this.state.players.get(playerId)
    if (!player) {
      return { success: false, error: 'Player not found in lobby' }
    }

    // Cannot remove host if there are other human players
    if (player.isHost) {
      const humanPlayers = Array.from(this.state.players.values()).filter(p => !p.isAI)
      if (humanPlayers.length > 1) {
        return { success: false, error: 'Host cannot leave while other players are present' }
      }
    }

    // Remove player
    this.state.players.delete(playerId)
    this.state.updatedAt = new Date()
    this.updateStatus()

    this.addEvent({ type: 'playerLeft', playerId })

    return { success: true }
  }

  updatePlayer(playerId: PlayerId, updates: Partial<LobbyPlayer>): LobbyOperationResult {
    const player = this.state.players.get(playerId)
    if (!player) {
      return { success: false, error: 'Player not found' }
    }

    // Create updated player object
    const updatedPlayer = { ...player, ...updates }
    this.state.players.set(playerId, updatedPlayer)
    this.state.updatedAt = new Date()

    this.addEvent({ type: 'playerUpdated', playerId, updates })

    return { success: true }
  }

  // ============= AI Player Management =============

  addAIPlayer(aiConfig: LobbyAIConfig): LobbyOperationResult {
    if (this.state.players.size >= this.state.settings.maxPlayers) {
      return { success: false, error: 'Lobby is full' }
    }

    if (this.state.status !== 'waiting') {
      return { success: false, error: 'Cannot add AI - game is starting' }
    }

    // Generate AI player
    const aiPlayer: LobbyPlayer = {
      id: generatePlayerId(),
      name: this.generateAIName(),
      userId: undefined,
      avatarEmoji: this.getRandomAIAvatar(),
      isHost: false,
      isAI: true,
      aiConfig,
      isConnected: true,
      joinedAt: new Date()
    }

    // Add AI player
    this.state.players.set(aiPlayer.id, aiPlayer)
    this.state.updatedAt = new Date()
    this.updateStatus()

    this.addEvent({ type: 'aiBotAdded', player: aiPlayer })

    return { success: true, data: { playerId: aiPlayer.id, player: aiPlayer } }
  }

  removeAIPlayer(playerId: PlayerId): LobbyOperationResult {
    const player = this.state.players.get(playerId)
    if (!player) {
      return { success: false, error: 'AI player not found' }
    }

    if (!player.isAI) {
      return { success: false, error: 'Player is not an AI bot' }
    }

    return this.removePlayer(playerId)
  }

  // ============= Settings Management =============

  updateSettings(updates: Partial<LobbySettings>): LobbyOperationResult {
    // Validate max players change
    if (updates.maxPlayers && updates.maxPlayers < this.state.players.size) {
      return { success: false, error: 'Cannot reduce max players below current player count' }
    }

    // Update settings
    this.state.settings = { ...this.state.settings, ...updates }
    this.state.updatedAt = new Date()
    this.updateStatus()

    this.addEvent({ type: 'settingsUpdated', settings: updates })

    return { success: true }
  }

  // ============= Game Transition =============

  validateLobby(): LobbyValidation {
    const errors: string[] = []
    const warnings: string[] = []
    const playerCount = this.state.players.size

    // Check minimum players
    if (playerCount < 3) {
      errors.push('Need at least 3 players to start')
    }

    // Check maximum players
    if (playerCount > 4) {
      errors.push('Too many players (maximum 4)')
    }

    // Check if all players are connected
    const disconnectedPlayers = Array.from(this.state.players.values())
      .filter(p => !p.isConnected && !p.isAI)
    
    if (disconnectedPlayers.length > 0) {
      warnings.push(`${disconnectedPlayers.length} player(s) are disconnected`)
    }

    const canStart = errors.length === 0 && playerCount >= 3 && playerCount <= 4
    
    return {
      isValid: errors.length === 0,
      canStart,
      errors,
      warnings
    }
  }

  canStartGame(): { canStart: boolean; reason?: string } {
    const validation = this.validateLobby()
    return {
      canStart: validation.canStart,
      reason: validation.errors.length > 0 ? validation.errors[0] : undefined
    }
  }

  convertToGameState(): GameState {
    const validation = this.validateLobby()
    if (!validation.canStart) {
      throw new Error(`Cannot start game: ${validation.errors.join(', ')}`)
    }

    // Convert lobby players to game players
    const playerNames = Array.from(this.state.players.values()).map(p => p.name)
    
    // Create full game using GameFlowManager
    const gameManager = GameFlowManager.createGame({
      playerNames,
      gameId: this.state.id,
      randomizePlayerOrder: this.state.settings.gameSettings.randomizePlayerOrder
    })

    const gameState = gameManager.getState()

    // Update players with lobby information (user IDs, AI config, etc.)
    const gamePlayers = Array.from(gameState.players.entries())
    const lobbyPlayers = Array.from(this.state.players.values())

    for (let i = 0; i < gamePlayers.length; i++) {
      const [gamePlayerId, gamePlayer] = gamePlayers[i]
      const lobbyPlayer = lobbyPlayers[i]

      // Update game player with lobby data
      const updatedGamePlayer: Player = {
        ...gamePlayer,
        id: lobbyPlayer.id, // Use lobby player ID
        name: lobbyPlayer.name,
        isAI: lobbyPlayer.isAI,
        isConnected: lobbyPlayer.isConnected
      }

      // Remove old player and add updated one
      gameState.players.delete(gamePlayerId)
      gameState.players.set(lobbyPlayer.id, updatedGamePlayer)
    }

    // Update current player reference if needed
    const firstLobbyPlayer = lobbyPlayers[0]
    gameState.currentPlayer = firstLobbyPlayer.id

    return gameState
  }

  // ============= State Access =============

  getState(): LobbyState {
    return { ...this.state, players: new Map(this.state.players) } // Deep copy
  }

  getPlayers(): LobbyPlayer[] {
    return Array.from(this.state.players.values())
  }

  getPlayer(playerId: PlayerId): LobbyPlayer | undefined {
    return this.state.players.get(playerId)
  }

  isHost(playerId: PlayerId): boolean {
    return this.state.hostPlayerId === playerId
  }

  getEvents(): LobbyEvent[] {
    return [...this.eventHistory]
  }

  // ============= Private Helpers =============

  private updateStatus(): void {
    const validation = this.validateLobby()
    const newStatus: LobbyState['status'] = validation.canStart ? 'ready' : 'waiting'
    
    if (newStatus !== this.state.status) {
      this.state.status = newStatus
      this.addEvent({ type: 'statusChanged', status: newStatus })
    }
  }

  private addEvent(event: LobbyEvent): void {
    this.eventHistory.push(event)
  }

  private generateAIName(): string {
    const adjective = AI_ADJECTIVES[Math.floor(Math.random() * AI_ADJECTIVES.length)]
    const noun = AI_NOUNS[Math.floor(Math.random() * AI_NOUNS.length)]
    const number = Math.floor(Math.random() * 999) + 1
    return `${adjective}${noun}${number}`
  }

  private getRandomAIAvatar(): string {
    return AI_AVATARS[Math.floor(Math.random() * AI_AVATARS.length)]
  }
} 