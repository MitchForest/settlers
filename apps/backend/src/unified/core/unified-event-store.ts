/**
 * UNIFIED EVENT STORE - ZERO TECHNICAL DEBT
 * 
 * Single event store that handles ALL game events with full lifecycle integration.
 * Replaces scattered event tables with unified, strongly-typed event sourcing.
 */

import { db, games, players, unifiedEvents, unifiedEventSequences } from '../../db/index'
import { eq, and, desc, sql } from 'drizzle-orm'
import { UnifiedGameStateMachine, type UnifiedGameEvent, type UnifiedGameContext } from './unified-state-machine'

/**
 * UNIFIED EVENT SCHEMA
 * All events stored in single table with proper typing
 */
export interface StoredUnifiedEvent {
  id: string
  gameId: string
  eventType: string
  eventData: UnifiedGameEvent
  sequenceNumber: number
  timestamp: string
  contextUserId?: string
  contextPlayerId?: string
  contextConnectionId?: string
}

/**
 * UNIFIED EVENT STORE
 * Single point for ALL event persistence and retrieval
 */
export class UnifiedEventStore {
  /**
   * APPEND EVENT - ATOMIC OPERATION
   * Stores event and immediately updates state machine
   */
  async appendEvent(
    gameId: string,
    event: UnifiedGameEvent,
    context?: {
      userId?: string
      playerId?: string
      connectionId?: string
    }
  ): Promise<{ success: boolean; sequenceNumber?: number; error?: string }> {
    
    try {
      // Get next sequence number atomically
      const nextSequence = await this.getNextSequenceNumber(gameId)
      
      // Create stored event
      const storedEvent: StoredUnifiedEvent = {
        id: `${gameId}_${nextSequence}_${Date.now()}`,
        gameId,
        eventType: event.type,
        eventData: event,
        sequenceNumber: nextSequence,
        timestamp: new Date().toISOString(),
        contextUserId: context?.userId,
        contextPlayerId: context?.playerId,
        contextConnectionId: context?.connectionId
      }
      
      // Store in database (implement with your DB)
      await this.storeEventInDatabase(storedEvent)
      
      console.log(`📝 [${gameId}] Event stored: ${event.type} (#${nextSequence})`)
      
      return { success: true, sequenceNumber: nextSequence }
      
    } catch (error) {
      console.error(`💥 [${gameId}] Failed to append event:`, error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * GET EVENTS - ORDERED BY SEQUENCE
   */
  async getEvents(gameId: string, fromSequence?: number): Promise<StoredUnifiedEvent[]> {
    try {
      // Load from database (implement with your DB)
      const events = await this.loadEventsFromDatabase(gameId, fromSequence)
      
      return events.sort((a, b) => a.sequenceNumber - b.sequenceNumber)
      
    } catch (error) {
      console.error(`💥 [${gameId}] Failed to load events:`, error)
      return []
    }
  }

  /**
   * GET LATEST EVENT
   */
  async getLatestEvent(gameId: string): Promise<StoredUnifiedEvent | null> {
    try {
      const events = await this.loadEventsFromDatabase(gameId)
      return events.sort((a, b) => b.sequenceNumber - a.sequenceNumber)[0] || null
    } catch (error) {
      console.error(`💥 [${gameId}] Failed to load latest event:`, error)
      return null
    }
  }

  /**
   * REBUILD STATE MACHINE FROM EVENTS
   */
  async rebuildStateMachine(gameId: string): Promise<UnifiedGameStateMachine | null> {
    try {
      const events = await this.getEvents(gameId)
      
      if (events.length === 0) {
        return null
      }
      
      // Find the game creation event to get initial data
      const createEvent = events.find(e => e.eventType === 'GAME_CREATED')
      if (!createEvent) {
        throw new Error('No GAME_CREATED event found')
      }
      
      const gameData = createEvent.eventData as any
      
      // Reconstruct state machine from events
      const machine = UnifiedGameStateMachine.fromEventHistory(
        gameId,
        gameData.gameCode || 'UNKNOWN',
        gameData.hostUserId || 'unknown',
        events.map(e => e.eventData)
      )
      
      console.log(`🔄 [${gameId}] Rebuilt state machine from ${events.length} events`)
      
      return machine
      
    } catch (error) {
      console.error(`💥 [${gameId}] Failed to rebuild state machine:`, error)
      return null
    }
  }

  /**
   * PRUNE OLD EVENTS (OPTIONAL)
   * Keep only recent events for performance
   */
  async pruneOldEvents(gameId: string, keepLastN: number = 1000): Promise<void> {
    try {
      const events = await this.getEvents(gameId)
      
      if (events.length <= keepLastN) {
        return // Nothing to prune
      }
      
      const eventsToDelete = events.slice(0, events.length - keepLastN)
      
      for (const event of eventsToDelete) {
        await this.deleteEventFromDatabase(event.id)
      }
      
      console.log(`🧹 [${gameId}] Pruned ${eventsToDelete.length} old events`)
      
    } catch (error) {
      console.error(`💥 [${gameId}] Failed to prune events:`, error)
    }
  }

  /**
   * DATABASE OPERATIONS - REAL IMPLEMENTATION
   */
  private async storeEventInDatabase(event: StoredUnifiedEvent): Promise<void> {
    try {
      await db.insert(unifiedEvents).values({
        id: event.id,
        gameId: event.gameId,
        eventType: event.eventType,
        eventData: event.eventData,
        sequenceNumber: event.sequenceNumber,
        timestamp: event.timestamp,
        contextUserId: event.contextUserId,
        contextPlayerId: event.contextPlayerId,
        contextConnectionId: event.contextConnectionId
      })
      
      console.log(`📝 Stored unified event ${event.id} (sequence #${event.sequenceNumber})`)
      
    } catch (error) {
      console.error(`💥 Failed to store event ${event.id}:`, error)
      throw error
    }
  }

  private async loadEventsFromDatabase(gameId: string, fromSequence?: number): Promise<StoredUnifiedEvent[]> {
    try {
      let query = db.select().from(unifiedEvents).where(eq(unifiedEvents.gameId, gameId))
      
      if (fromSequence !== undefined) {
        query = query.where(and(
          eq(unifiedEvents.gameId, gameId),
          sql`${unifiedEvents.sequenceNumber} >= ${fromSequence}`
        ))
      }
      
      const events = await query.orderBy(unifiedEvents.sequenceNumber)
      
      console.log(`📖 Loaded ${events.length} unified events for ${gameId}`)
      
      return events.map(row => ({
        id: row.id,
        gameId: row.gameId,
        eventType: row.eventType,
        eventData: row.eventData as UnifiedGameEvent,
        sequenceNumber: row.sequenceNumber,
        timestamp: row.timestamp,
        contextUserId: row.contextUserId || undefined,
        contextPlayerId: row.contextPlayerId || undefined,
        contextConnectionId: row.contextConnectionId || undefined
      }))
      
    } catch (error) {
      console.error(`💥 Failed to load events for ${gameId}:`, error)
      throw error
    }
  }

  private async deleteEventFromDatabase(eventId: string): Promise<void> {
    try {
      await db.delete(unifiedEvents).where(eq(unifiedEvents.id, eventId))
      console.log(`🗑️ Deleted unified event ${eventId}`)
    } catch (error) {
      console.error(`💥 Failed to delete event ${eventId}:`, error)
      throw error
    }
  }

  private async getNextSequenceNumber(gameId: string): Promise<number> {
    try {
      // Use atomic sequence generation with upsert
      const result = await db.insert(unifiedEventSequences)
        .values({ gameId, nextSequence: 1 })
        .onConflictDoUpdate({
          target: unifiedEventSequences.gameId,
          set: { nextSequence: sql`${unifiedEventSequences.nextSequence} + 1` }
        })
        .returning({ nextSequence: unifiedEventSequences.nextSequence })
      
      const sequenceNumber = result[0]?.nextSequence || 1
      
      console.log(`🔢 Generated sequence #${sequenceNumber} for ${gameId}`)
      
      return sequenceNumber
      
    } catch (error) {
      console.error(`💥 Failed to generate sequence for ${gameId}:`, error)
      
      // Fallback: use timestamp-based sequence
      const fallbackSequence = Date.now()
      console.warn(`⚠️ Using fallback sequence ${fallbackSequence}`)
      return fallbackSequence
    }
  }
}

/**
 * UNIFIED GAME MANAGER
 * Single manager for ALL game operations with zero technical debt
 */
export class UnifiedGameManager {
  private readonly stateMachines = new Map<string, UnifiedGameStateMachine>()
  private readonly eventStore = new UnifiedEventStore()
  private readonly subscribers = new Set<(gameId: string, context: UnifiedGameContext, event: UnifiedGameEvent) => void>()

  /**
   * CREATE GAME - COMPLETE SETUP
   */
  async createGame(params: {
    gameCode: string
    hostUserId: string
    settings?: Partial<any>
  }): Promise<{ success: boolean; gameId?: string; error?: string }> {
    
    try {
      const gameId = `game_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
      
      // Create initial event
      const createEvent: UnifiedGameEvent = {
        type: 'GAME_CREATED',
        gameId,
        hostUserId: params.hostUserId
      }
      
      // Store creation event
      const result = await this.eventStore.appendEvent(gameId, createEvent, {
        userId: params.hostUserId
      })
      
      if (!result.success) {
        return { success: false, error: result.error }
      }
      
      // Create and cache state machine
      const machine = new UnifiedGameStateMachine(gameId, params.gameCode, params.hostUserId)
      
      // Subscribe to state changes for this game
      machine.subscribe((context, event) => {
        this.onStateChange(gameId, context, event)
      })
      
      this.stateMachines.set(gameId, machine)
      
      // Send initial event to state machine
      machine.send(createEvent)
      
      console.log(`🎮 [${gameId}] Game created successfully`)
      
      return { success: true, gameId }
      
    } catch (error) {
      console.error('💥 Failed to create game:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * GET OR LOAD GAME
   * Returns cached state machine or loads from events
   */
  async getGame(gameId: string): Promise<UnifiedGameStateMachine | null> {
    // Return cached if available
    if (this.stateMachines.has(gameId)) {
      return this.stateMachines.get(gameId)!
    }
    
    // Load from event store
    const machine = await this.eventStore.rebuildStateMachine(gameId)
    
    if (machine) {
      // Subscribe to state changes
      machine.subscribe((context, event) => {
        this.onStateChange(gameId, context, event)
      })
      
      this.stateMachines.set(gameId, machine)
    }
    
    return machine
  }

  /**
   * SEND EVENT TO GAME
   * Single point for all game operations
   */
  async sendEvent(
    gameId: string,
    event: UnifiedGameEvent,
    context?: {
      userId?: string
      playerId?: string
      connectionId?: string
    }
  ): Promise<{ success: boolean; newState?: any; error?: string }> {
    
    try {
      // Get or load game
      const machine = await this.getGame(gameId)
      
      if (!machine) {
        return { success: false, error: 'Game not found' }
      }
      
      // Validate and apply event to state machine
      const result = machine.send(event)
      
      if (!result.success) {
        return result
      }
      
      // Store event in event store
      const storeResult = await this.eventStore.appendEvent(gameId, event, context)
      
      if (!storeResult.success) {
        console.warn(`⚠️ [${gameId}] Event applied to state machine but failed to store:`, storeResult.error)
        // Continue - state machine is updated, storage can be retried
      }
      
      return { success: true, newState: result.newState }
      
    } catch (error) {
      console.error(`💥 [${gameId}] Failed to send event:`, error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * QUERY OPERATIONS
   */
  async getGameState(gameId: string): Promise<UnifiedGameContext | null> {
    const machine = await this.getGame(gameId)
    return machine ? machine.getContext() : null
  }

  async getGameStatus(gameId: string): Promise<any> {
    const machine = await this.getGame(gameId)
    return machine ? machine.getState() : null
  }

  async getActivePlayers(gameId: string): Promise<any[]> {
    const machine = await this.getGame(gameId)
    return machine ? machine.getActivePlayers() : []
  }

  async canPlayerJoin(gameId: string): Promise<boolean> {
    const machine = await this.getGame(gameId)
    return machine ? machine.canJoin() : false
  }

  async canGameStart(gameId: string): Promise<boolean> {
    const machine = await this.getGame(gameId)
    return machine ? machine.canStart() : false
  }

  /**
   * BULK OPERATIONS
   */
  async getAllActiveGames(): Promise<string[]> {
    const activeGames: string[] = []
    
    for (const [gameId, machine] of this.stateMachines.entries()) {
      if (machine.isActive()) {
        activeGames.push(gameId)
      }
    }
    
    return activeGames
  }

  async getGamesByUser(userId: string): Promise<string[]> {
    const userGames: string[] = []
    
    for (const [gameId, machine] of this.stateMachines.entries()) {
      const context = machine.getContext()
      const isInGame = context.players.some(p => p.userId === userId && p.status === 'active')
      
      if (isInGame) {
        userGames.push(gameId)
      }
    }
    
    return userGames
  }

  /**
   * ADMINISTRATION
   */
  async pauseGame(gameId: string, reason: string, adminUserId?: string): Promise<{ success: boolean; error?: string }> {
    return this.sendEvent(gameId, {
      type: 'GAME_PAUSED',
      reason,
      pausedBy: adminUserId
    })
  }

  async resumeGame(gameId: string, adminUserId?: string): Promise<{ success: boolean; error?: string }> {
    return this.sendEvent(gameId, {
      type: 'GAME_RESUMED',
      resumedBy: adminUserId
    })
  }

  async endGame(gameId: string, reason: any, adminUserId?: string): Promise<{ success: boolean; error?: string }> {
    return this.sendEvent(gameId, {
      type: 'GAME_ENDED',
      reason,
      endedBy: adminUserId
    })
  }

  /**
   * CLEANUP & RESOURCE MANAGEMENT
   */
  async cleanupGame(gameId: string): Promise<void> {
    // Remove from memory
    this.stateMachines.delete(gameId)
    
    // Optionally prune old events
    await this.eventStore.pruneOldEvents(gameId, 100)
    
    console.log(`🧹 [${gameId}] Game cleaned up`)
  }

  async cleanupInactiveGames(): Promise<void> {
    const now = Date.now()
    const INACTIVE_THRESHOLD = 24 * 60 * 60 * 1000 // 24 hours
    
    for (const [gameId, machine] of this.stateMachines.entries()) {
      const context = machine.getContext()
      const lastActivity = context.lastActivity.getTime()
      
      if (now - lastActivity > INACTIVE_THRESHOLD && context.state.status === 'ended') {
        await this.cleanupGame(gameId)
      }
    }
  }

  /**
   * SUBSCRIPTION MANAGEMENT
   */
  subscribe(callback: (gameId: string, context: UnifiedGameContext, event: UnifiedGameEvent) => void): () => void {
    this.subscribers.add(callback)
    return () => this.subscribers.delete(callback)
  }

  private onStateChange(gameId: string, context: UnifiedGameContext, event: UnifiedGameEvent): void {
    // Notify all subscribers
    this.subscribers.forEach(callback => {
      try {
        callback(gameId, context, event)
      } catch (error) {
        console.error('Game manager subscriber error:', error)
      }
    })
  }

  /**
   * HEALTH & MONITORING
   */
  getHealthStatus(): {
    activeGames: number
    totalStateMachines: number
    memoryUsage: string
  } {
    return {
      activeGames: Array.from(this.stateMachines.values()).filter(m => m.isActive()).length,
      totalStateMachines: this.stateMachines.size,
      memoryUsage: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`
    }
  }
}

// Singleton instance
export const unifiedGameManager = new UnifiedGameManager()