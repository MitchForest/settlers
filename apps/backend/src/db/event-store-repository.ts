import { eq, and, asc, desc, gte, lte, inArray, or, sql } from 'drizzle-orm'
import { db } from './index'
import { games, players, gameEvents, playerEvents, gameEventSequences, friendEvents, friendEventSequences, gameInviteEvents, gameInviteEventSequences, NewGame, NewPlayer } from './schema'

// Use the core GameEvent interface directly - no more UnifiedGameEvent
import { GameEvent } from '@settlers/core/src/events/event-store'
import { FriendEvent, FriendEventType } from '@settlers/core/src/events/friend-event-store'
import { GameInviteEvent, GameInviteEventType } from '@settlers/core/src/events/game-invite-event-store'

// Event type mappings for segregated architecture
export const PLAYER_EVENT_TYPES = ['player_joined', 'player_left', 'ai_player_added', 'ai_player_removed'] as const
export const GAME_EVENT_TYPES = [
  'game_started', 'settings_changed', 'dice_rolled', 'resource_produced', 
  'building_placed', 'road_placed', 'card_drawn', 'card_played', 
  'trade_proposed', 'trade_accepted', 'trade_declined', 'robber_moved', 
  'resources_stolen', 'turn_ended', 'game_ended'
] as const
export const FRIEND_EVENT_TYPES = [
  'friend_request_sent', 'friend_request_accepted', 'friend_request_rejected',
  'friend_request_cancelled', 'friend_removed', 'presence_updated'
] as const
export const GAME_INVITE_EVENT_TYPES = [
  'game_invite_sent', 'game_invite_accepted', 'game_invite_declined',
  'game_invite_expired', 'game_invite_cancelled'
] as const

export type PlayerEventType = typeof PLAYER_EVENT_TYPES[number]
export type GameEventType = typeof GAME_EVENT_TYPES[number]
export type EventType = PlayerEventType | GameEventType | FriendEventType | GameInviteEventType

function isPlayerEvent(eventType: EventType): eventType is PlayerEventType {
  return PLAYER_EVENT_TYPES.includes(eventType as PlayerEventType)
}

function isGameEvent(eventType: EventType): eventType is GameEventType {
  return GAME_EVENT_TYPES.includes(eventType as GameEventType)
}

function isFriendEvent(eventType: EventType): eventType is FriendEventType {
  return FRIEND_EVENT_TYPES.includes(eventType as FriendEventType)
}

function isGameInviteEvent(eventType: EventType): eventType is GameInviteEventType {
  return GAME_INVITE_EVENT_TYPES.includes(eventType as GameInviteEventType)
}

// Basic validation function
function validateEventData(eventType: string, data: any): boolean {
  return typeof data === 'object' && data !== null
}

function createEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export interface EventStoreOptions {
  maxEventsPerQuery?: number
  enableConcurrencyControl?: boolean
}

/**
 * Repository for segregated event sourcing operations
 * Handles both player_events and game_events tables with unified sequence numbering
 */
export class EventStoreRepository {
  private options: Required<EventStoreOptions>

  constructor(options: EventStoreOptions = {}) {
    this.options = {
      maxEventsPerQuery: options.maxEventsPerQuery ?? 1000,
      enableConcurrencyControl: options.enableConcurrencyControl ?? true
    }
  }

  /**
   * Create a new game with initial metadata
   */
  async createGame(gameData: {
    id: string
    gameCode: string
    hostUserId?: string
    hostPlayerName: string
    hostAvatarEmoji?: string
  }): Promise<{ game: typeof games.$inferSelect; hostPlayer: typeof players.$inferSelect }> {
    
    return await db.transaction(async (tx) => {
      // Create game record
      const [game] = await tx.insert(games).values({
        id: gameData.id,
        gameCode: gameData.gameCode,
        currentPhase: 'lobby',
        isActive: true
      }).returning()

      // Initialize event sequence
      await tx.insert(gameEventSequences).values({
        gameId: gameData.id,
        nextSequence: 1
      })

      // Create host player record  
      const hostPlayerId = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const [hostPlayer] = await tx.insert(players).values({
        id: hostPlayerId,
        gameId: gameData.id,
        userId: gameData.hostUserId,
        playerType: 'human',
        name: gameData.hostPlayerName,
        avatarEmoji: gameData.hostAvatarEmoji,
        color: 'red', // Host gets red by default
        joinOrder: 1,
        isHost: true
      }).returning()

      // Append player_joined event (goes to player_events table)
      await this.appendEventInTransaction(tx, {
        gameId: gameData.id,
        playerId: hostPlayerId,
        eventType: 'player_joined',
        data: {
          playerId: hostPlayerId,
          userId: gameData.hostUserId,
          playerType: 'human' as const,
          name: gameData.hostPlayerName,
          avatarEmoji: gameData.hostAvatarEmoji,
          color: 'red',
          joinOrder: 1,
          isHost: true
        }
      })

      return { game, hostPlayer }
    })
  }

  /**
   * Append a single event to the appropriate event store table
   */
  async appendEvent(event: {
    gameId: string
    playerId?: string
    contextPlayerId?: string  // For game events that need player context
    eventType: EventType
    data: Record<string, any>
  }): Promise<GameEvent> {
    return await db.transaction(async (tx) => {
      return await this.appendEventInTransaction(tx, event)
    })
  }

  /**
   * Append multiple events atomically
   */
  async appendEvents(events: Array<{
    gameId: string
    playerId?: string
    contextPlayerId?: string
    eventType: EventType
    data: Record<string, any>
  }>): Promise<GameEvent[]> {
    if (events.length === 0) return []

    return await db.transaction(async (tx) => {
      const appendedEvents: GameEvent[] = []
      
      for (const event of events) {
        const appendedEvent = await this.appendEventInTransaction(tx, event)
        appendedEvents.push(appendedEvent)
      }
      
      return appendedEvents
    })
  }

  /**
   * Get all events for a game from both tables, merged chronologically
   */
  async getGameEvents(gameId: string, options?: {
    fromSequence?: number
    toSequence?: number
    eventTypes?: EventType[]
    limit?: number
  }): Promise<GameEvent[]> {
    const limit = options?.limit 
      ? Math.min(options.limit, this.options.maxEventsPerQuery)
      : this.options.maxEventsPerQuery

    // Build common where conditions
    const buildWhereConditions = (table: any) => {
      let whereConditions = [eq(table.gameId, gameId)]

      if (options?.fromSequence !== undefined) {
        whereConditions.push(gte(table.sequenceNumber, options.fromSequence))
      }

      if (options?.toSequence !== undefined) {
        whereConditions.push(lte(table.sequenceNumber, options.toSequence))
      }

      return whereConditions
    }

    // Fetch player events
    let playerEventsPromise = Promise.resolve<any[]>([])
    if (!options?.eventTypes || options.eventTypes.some(t => isPlayerEvent(t))) {
      const playerEventTypeFilter = options?.eventTypes?.filter(isPlayerEvent)
      let playerWhereConditions = buildWhereConditions(playerEvents)
      
      if (playerEventTypeFilter && playerEventTypeFilter.length > 0) {
        playerWhereConditions.push(inArray(playerEvents.eventType, playerEventTypeFilter))
      }

      playerEventsPromise = db
        .select()
        .from(playerEvents)
        .where(and(...playerWhereConditions))
        .orderBy(asc(playerEvents.sequenceNumber))
        .limit(limit)
    }

    // Fetch game events
    let gameEventsPromise = Promise.resolve<any[]>([])
    if (!options?.eventTypes || options.eventTypes.some(t => isGameEvent(t))) {
      const gameEventTypeFilter = options?.eventTypes?.filter(isGameEvent)
      let gameWhereConditions = buildWhereConditions(gameEvents)
      
      if (gameEventTypeFilter && gameEventTypeFilter.length > 0) {
        gameWhereConditions.push(inArray(gameEvents.eventType, gameEventTypeFilter))
      }

      gameEventsPromise = db
        .select()
        .from(gameEvents)
        .where(and(...gameWhereConditions))
        .orderBy(asc(gameEvents.sequenceNumber))
        .limit(limit)
    }

    // Wait for both queries
    const [dbPlayerEvents, dbGameEvents] = await Promise.all([
      playerEventsPromise,
      gameEventsPromise
    ])

    // Merge and sort by sequence number
    const allEvents: GameEvent[] = [
      ...dbPlayerEvents.map(e => this.mapDbPlayerEventToGameEvent(e)),
      ...dbGameEvents.map(e => this.mapDbGameEventToGameEvent(e))
    ]

    // Sort by sequence number and apply limit
    return allEvents
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber)
      .slice(0, limit)
  }

  /**
   * Get latest events for a game (useful for live updates)
   */
  async getLatestGameEvents(gameId: string, count: number = 10): Promise<GameEvent[]> {
    // Get latest from both tables
    const playerEventsPromise = db
      .select()
      .from(playerEvents)
      .where(eq(playerEvents.gameId, gameId))
      .orderBy(desc(playerEvents.sequenceNumber))
      .limit(count)

    const gameEventsPromise = db
      .select()
      .from(gameEvents)
      .where(eq(gameEvents.gameId, gameId))
      .orderBy(desc(gameEvents.sequenceNumber))
      .limit(count)

    const [dbPlayerEvents, dbGameEvents] = await Promise.all([
      playerEventsPromise,
      gameEventsPromise
    ])

    // Merge and sort by sequence number (newest first)
    const allEvents: GameEvent[] = [
      ...dbPlayerEvents.map(e => this.mapDbPlayerEventToGameEvent(e)),
      ...dbGameEvents.map(e => this.mapDbGameEventToGameEvent(e))
    ]

    return allEvents
      .sort((a, b) => b.sequenceNumber - a.sequenceNumber)
      .slice(0, count)
      .reverse() // Return in chronological order
  }

  /**
   * Get current sequence number for a game
   */
  async getCurrentSequence(gameId: string): Promise<number> {
    const [result] = await db
      .select({ nextSequence: gameEventSequences.nextSequence })
      .from(gameEventSequences)
      .where(eq(gameEventSequences.gameId, gameId))

    return result ? result.nextSequence - 1 : 0
  }

  /**
   * Check if a game exists
   */
  async gameExists(gameId: string): Promise<boolean> {
    const [result] = await db
      .select({ id: games.id })
      .from(games)
      .where(eq(games.id, gameId))

    return !!result
  }

  /**
   * Get game by code (case insensitive)
   */
  async getGameByCode(gameCode: string): Promise<typeof games.$inferSelect | null> {
    const [game] = await db
      .select()
      .from(games)
      .where(eq(games.gameCode, gameCode.toUpperCase()))

    return game || null
  }

  /**
   * Get game by ID
   */
  async getGameById(gameId: string): Promise<typeof games.$inferSelect | null> {
    const [game] = await db
      .select()
      .from(games)
      .where(eq(games.id, gameId))

    return game || null
  }

  /**
   * Get all active games
   */
  async getAllActiveGames(): Promise<typeof games.$inferSelect[]> {
    const allGames = await db
      .select()
      .from(games)
      .where(eq(games.isActive, true))
      .orderBy(desc(games.createdAt))

    return allGames
  }

  /**
   * Internal method to append event within a transaction to the correct table
   */
  private async appendEventInTransaction(
    tx: any, // Transaction type
    event: {
      gameId: string
      playerId?: string
      contextPlayerId?: string
      eventType: EventType
      data: Record<string, any>
    }
  ): Promise<GameEvent> {
    // Validate event data
    if (!validateEventData(event.eventType, event.data)) {
      throw new Error(`Invalid event data for type ${event.eventType}`)
    }

    // Validate event routing
    if (isPlayerEvent(event.eventType) && !event.playerId) {
      throw new Error(`Player events must have a playerId: ${event.eventType}`)
    }

    // Get and increment sequence number atomically using UPDATE...RETURNING
    const [sequenceResult] = await tx
      .update(gameEventSequences)
      .set({ nextSequence: sql`${gameEventSequences.nextSequence} + 1` })
      .where(eq(gameEventSequences.gameId, event.gameId))
      .returning({ sequenceNumber: gameEventSequences.nextSequence })

    if (!sequenceResult) {
      throw new Error(`Game ${event.gameId} not found`)
    }

    // The returned value is the NEW sequence number (after increment)
    // We want the OLD value (before increment) for this event
    const sequenceNumber = sequenceResult.sequenceNumber - 1

    const eventId = createEventId()

    // Route to correct table based on event type
    if (isPlayerEvent(event.eventType)) {
      // Insert into player_events table
      const [dbEvent] = await tx.insert(playerEvents).values({
        id: eventId,
        gameId: event.gameId,
        playerId: event.playerId!, // Required for player events
        eventType: event.eventType,
        data: event.data,
        sequenceNumber
      }).returning()

      return this.mapDbPlayerEventToGameEvent(dbEvent)
    } else {
      // Insert into game_events table
      const [dbEvent] = await tx.insert(gameEvents).values({
        id: eventId,
        gameId: event.gameId,
        eventType: event.eventType,
        data: event.data,
        sequenceNumber,
        contextPlayerId: event.contextPlayerId || null
      }).returning()

      return this.mapDbGameEventToGameEvent(dbEvent)
    }
  }

  /**
   * Map database player event to GameEvent
   */
  private mapDbPlayerEventToGameEvent(dbEvent: typeof playerEvents.$inferSelect): GameEvent {
    return {
      id: dbEvent.id,
      gameId: dbEvent.gameId,
      playerId: dbEvent.playerId,
      eventType: dbEvent.eventType as PlayerEventType,
      data: dbEvent.data as Record<string, any>,
      sequenceNumber: Number(dbEvent.sequenceNumber),
      timestamp: new Date(dbEvent.timestamp),
      eventTable: 'player_events'
    }
  }

  /**
   * Map database game event to GameEvent
   */
  private mapDbGameEventToGameEvent(dbEvent: typeof gameEvents.$inferSelect): GameEvent {
    return {
      id: dbEvent.id,
      gameId: dbEvent.gameId,
      contextPlayerId: dbEvent.contextPlayerId || undefined,
      eventType: dbEvent.eventType as GameEventType,
      data: dbEvent.data as Record<string, any>,
      sequenceNumber: Number(dbEvent.sequenceNumber),
      timestamp: new Date(dbEvent.timestamp),
      eventTable: 'game_events'
    }
  }

  // **FRIEND EVENT METHODS** - Following exact same patterns as game events

  /**
   * Append a friend event to the friend events table
   */
  async appendFriendEvent(event: {
    aggregateId: string
    eventType: FriendEventType
    data: Record<string, any>
  }): Promise<FriendEvent> {
    if (!isFriendEvent(event.eventType)) {
      throw new Error(`Invalid friend event type: ${event.eventType}`)
    }

    if (!validateEventData(event.eventType, event.data)) {
      throw new Error(`Invalid event data for type: ${event.eventType}`)
    }

    return await db.transaction(async (tx) => {
      // Get next sequence number for this user
      const [sequence] = await tx
        .select({ nextSequence: friendEventSequences.nextSequence })
        .from(friendEventSequences)
        .where(eq(friendEventSequences.aggregateId, event.aggregateId))

      let sequenceNumber = 1
      if (sequence) {
        sequenceNumber = Number(sequence.nextSequence)
        // Update sequence
        await tx
          .update(friendEventSequences)
          .set({ nextSequence: sequenceNumber + 1 })
          .where(eq(friendEventSequences.aggregateId, event.aggregateId))
      } else {
        // Initialize sequence for new user
        await tx.insert(friendEventSequences).values({
          aggregateId: event.aggregateId,
          nextSequence: 2
        })
      }

      // Insert friend event
      const eventId = createEventId()
      const [dbEvent] = await tx.insert(friendEvents).values({
        id: eventId,
        aggregateId: event.aggregateId,
        eventType: event.eventType,
        data: event.data,
        sequenceNumber
      }).returning()

      return this.mapDbFriendEventToFriendEvent(dbEvent)
    })
  }

  /**
   * Get all friend events for a user
   */
  async getFriendEvents(aggregateId: string): Promise<FriendEvent[]> {
    const dbEvents = await db
      .select()
      .from(friendEvents)
      .where(eq(friendEvents.aggregateId, aggregateId))
      .orderBy(asc(friendEvents.sequenceNumber))
      .limit(this.options.maxEventsPerQuery)

    return dbEvents.map(event => this.mapDbFriendEventToFriendEvent(event))
  }

  /**
   * Get friend events for multiple users (for cross-user events)
   */
  async getFriendEventsForUsers(aggregateIds: string[]): Promise<FriendEvent[]> {
    if (aggregateIds.length === 0) return []

    const dbEvents = await db
      .select()
      .from(friendEvents)
      .where(inArray(friendEvents.aggregateId, aggregateIds))
      .orderBy(asc(friendEvents.timestamp))
      .limit(this.options.maxEventsPerQuery)

    return dbEvents.map(event => this.mapDbFriendEventToFriendEvent(event))
  }

  /**
   * Map database friend event to FriendEvent
   */
  private mapDbFriendEventToFriendEvent(dbEvent: typeof friendEvents.$inferSelect): FriendEvent {
    return {
      id: dbEvent.id,
      aggregateId: dbEvent.aggregateId,
      eventType: dbEvent.eventType as FriendEventType,
      data: dbEvent.data as Record<string, any>,
      sequenceNumber: Number(dbEvent.sequenceNumber),
      timestamp: new Date(dbEvent.timestamp)
    }
  }

  // **GAME INVITE EVENT METHODS** - Following exact same patterns as friend events

  /**
   * Append a game invite event to the game invite events table
   */
  async appendGameInviteEvent(event: {
    aggregateId: string
    eventType: GameInviteEventType
    data: Record<string, any>
  }): Promise<GameInviteEvent> {
    if (!isGameInviteEvent(event.eventType)) {
      throw new Error(`Invalid game invite event type: ${event.eventType}`)
    }

    if (!validateEventData(event.eventType, event.data)) {
      throw new Error(`Invalid event data for type: ${event.eventType}`)
    }

    return await db.transaction(async (tx) => {
      // Get next sequence number for this user
      const [sequence] = await tx
        .select({ nextSequence: gameInviteEventSequences.nextSequence })
        .from(gameInviteEventSequences)
        .where(eq(gameInviteEventSequences.aggregateId, event.aggregateId))

      let sequenceNumber = 1
      if (sequence) {
        sequenceNumber = Number(sequence.nextSequence)
        // Update sequence
        await tx
          .update(gameInviteEventSequences)
          .set({ nextSequence: sequenceNumber + 1 })
          .where(eq(gameInviteEventSequences.aggregateId, event.aggregateId))
      } else {
        // Initialize sequence for new user
        await tx.insert(gameInviteEventSequences).values({
          aggregateId: event.aggregateId,
          nextSequence: 2
        })
      }

      // Insert game invite event
      const eventId = createEventId()
      const [dbEvent] = await tx.insert(gameInviteEvents).values({
        id: eventId,
        aggregateId: event.aggregateId,
        eventType: event.eventType,
        data: event.data,
        sequenceNumber
      }).returning()

      return this.mapDbGameInviteEventToGameInviteEvent(dbEvent)
    })
  }

  /**
   * Get all game invite events for a user
   */
  async getGameInviteEvents(aggregateId: string): Promise<GameInviteEvent[]> {
    const dbEvents = await db
      .select()
      .from(gameInviteEvents)
      .where(eq(gameInviteEvents.aggregateId, aggregateId))
      .orderBy(asc(gameInviteEvents.sequenceNumber))
      .limit(this.options.maxEventsPerQuery)

    return dbEvents.map(event => this.mapDbGameInviteEventToGameInviteEvent(event))
  }

  /**
   * Get game invite events for multiple users
   */
  async getGameInviteEventsForUsers(aggregateIds: string[]): Promise<GameInviteEvent[]> {
    if (aggregateIds.length === 0) return []

    const dbEvents = await db
      .select()
      .from(gameInviteEvents)
      .where(inArray(gameInviteEvents.aggregateId, aggregateIds))
      .orderBy(asc(gameInviteEvents.timestamp))
      .limit(this.options.maxEventsPerQuery)

    return dbEvents.map(event => this.mapDbGameInviteEventToGameInviteEvent(event))
  }

  /**
   * Map database game invite event to GameInviteEvent
   */
  private mapDbGameInviteEventToGameInviteEvent(dbEvent: typeof gameInviteEvents.$inferSelect): GameInviteEvent {
    return {
      id: dbEvent.id,
      aggregateId: dbEvent.aggregateId,
      eventType: dbEvent.eventType as GameInviteEventType,
      data: dbEvent.data as Record<string, any>,
      sequenceNumber: Number(dbEvent.sequenceNumber),
      timestamp: dbEvent.timestamp
    }
  }
}

// Singleton instance
export const eventStore = new EventStoreRepository() 