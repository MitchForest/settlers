// Mock event store for development testing
// This allows the backend to run without database dependencies

export interface MockGame {
  id: string
  gameCode: string
  currentPhase: 'lobby' | 'initial_placement' | 'main_game' | 'ended'
  isActive: boolean
  createdAt: Date
}

export interface MockPlayer {
  id: string
  gameId: string
  userId?: string | null
  playerType: 'human' | 'ai'
  name: string
  avatarEmoji?: string | null
  color: string
  joinOrder: number
  isHost: boolean
}

export interface MockEvent {
  id: string
  gameId: string
  playerId?: string
  eventType: string
  data: Record<string, unknown>
  sequenceNumber: number
  timestamp: Date
}

class MockEventStore {
  private games = new Map<string, MockGame>()
  private players = new Map<string, MockPlayer>()
  private events = new Map<string, MockEvent[]>()
  private sequences = new Map<string, number>()

  async createGame(gameData: {
    id: string
    gameCode: string
    hostUserId?: string | null
    hostPlayerName: string
    hostAvatarEmoji?: string | null
  }): Promise<{ game: MockGame; hostPlayer: MockPlayer }> {
    
    // Create game
    const game: MockGame = {
      id: gameData.id,
      gameCode: gameData.gameCode,
      currentPhase: 'lobby',
      isActive: true,
      createdAt: new Date()
    }
    
    this.games.set(gameData.id, game)
    this.sequences.set(gameData.id, 1)
    this.events.set(gameData.id, [])

    // Create host player
    const hostPlayerId = `player_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
    const hostPlayer: MockPlayer = {
      id: hostPlayerId,
      gameId: gameData.id,
      userId: gameData.hostUserId,
      playerType: 'human',
      name: gameData.hostPlayerName,
      avatarEmoji: gameData.hostAvatarEmoji,
      color: 'red',
      joinOrder: 1,
      isHost: true
    }
    
    this.players.set(hostPlayerId, hostPlayer)

    // Add player_joined event
    await this.appendEvent({
      gameId: gameData.id,
      playerId: hostPlayerId,
      eventType: 'player_joined',
      data: {
        playerId: hostPlayerId,
        userId: gameData.hostUserId,
        playerType: 'human',
        name: gameData.hostPlayerName,
        avatarEmoji: gameData.hostAvatarEmoji,
        color: 'red',
        joinOrder: 1,
        isHost: true
      }
    })

    return { game, hostPlayer }
  }

  async appendEvent(event: {
    gameId: string
    playerId?: string
    eventType: string
    data: Record<string, unknown>
  }): Promise<MockEvent> {
    const sequence = this.sequences.get(event.gameId) || 1
    this.sequences.set(event.gameId, sequence + 1)

    const mockEvent: MockEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      gameId: event.gameId,
      playerId: event.playerId,
      eventType: event.eventType,
      data: event.data,
      sequenceNumber: sequence,
      timestamp: new Date()
    }

    const gameEvents = this.events.get(event.gameId) || []
    gameEvents.push(mockEvent)
    this.events.set(event.gameId, gameEvents)

    return mockEvent
  }

  async getGameEvents(gameId: string): Promise<MockEvent[]> {
    return this.events.get(gameId) || []
  }

  async getCurrentSequence(gameId: string): Promise<number> {
    return this.sequences.get(gameId) || 0
  }

  async gameExists(gameId: string): Promise<boolean> {
    return this.games.has(gameId)
  }

  async getGameById(gameId: string): Promise<MockGame | null> {
    return this.games.get(gameId) || null
  }

  async getGameByCode(gameCode: string): Promise<MockGame | null> {
    for (const game of this.games.values()) {
      if (game.gameCode === gameCode.toUpperCase()) {
        return game
      }
    }
    return null
  }

  async getAllActiveGames(): Promise<MockGame[]> {
    return Array.from(this.games.values()).filter(g => g.isActive)
  }

  // Player methods
  getPlayersForGame(gameId: string): MockPlayer[] {
    return Array.from(this.players.values()).filter(p => p.gameId === gameId)
  }

  addPlayer(player: MockPlayer): void {
    this.players.set(player.id, player)
  }

  getPlayer(playerId: string): MockPlayer | undefined {
    return this.players.get(playerId)
  }
}

export const mockEventStore = new MockEventStore()