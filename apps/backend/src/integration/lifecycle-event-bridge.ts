/**
 * LIFECYCLE EVENT BRIDGE
 * 
 * Bridges between your existing event sourcing system and the lifecycle state machine.
 * Follows the Observer pattern to keep systems decoupled.
 */

import { GameLifecycleStateMachine, type GameLifecycleEvent } from '../state-machines/game-lifecycle'
import { EventStoreRepository } from '../db/event-store-repository'
import type { GameEvent, PlayerEvent } from '../types/events'

/**
 * ENTERPRISE PATTERN: Event Bridge
 * 
 * Similar to how Kafka Connect bridges systems:
 * - Listens to domain events from your event store
 * - Translates them to lifecycle events
 * - Updates the state machine
 * - Generates lifecycle events back to event store
 */
export class LifecycleEventBridge {
  constructor(
    private readonly eventStore: EventStoreRepository,
    private readonly stateMachines: Map<string, GameLifecycleStateMachine>
  ) {}

  /**
   * DOMAIN EVENT → LIFECYCLE EVENT TRANSLATION
   * 
   * Your existing events trigger lifecycle state changes
   */
  async handleDomainEvent(event: GameEvent | PlayerEvent): Promise<void> {
    const gameId = event.gameId
    const machine = this.getOrCreateStateMachine(gameId)
    
    // Translate domain events to lifecycle events
    const lifecycleEvents = this.translateDomainEvent(event)
    
    for (const lifecycleEvent of lifecycleEvents) {
      const stateChanged = machine.send(lifecycleEvent)
      
      if (stateChanged) {
        // Optionally store lifecycle events back to event store
        await this.storeLifecycleEvent(gameId, lifecycleEvent, machine.getState())
      }
    }
  }

  /**
   * TRANSLATION LOGIC
   * Maps your domain events to lifecycle state changes
   */
  private translateDomainEvent(event: GameEvent | PlayerEvent): GameLifecycleEvent[] {
    const lifecycleEvents: GameLifecycleEvent[] = []

    // Player events affect lifecycle
    if ('playerId' in event) {
      const playerEvent = event as PlayerEvent
      
      switch (playerEvent.eventType) {
        case 'player_joined':
          const isFirstPlayer = playerEvent.data?.joinOrder === 1
          if (isFirstPlayer) {
            lifecycleEvents.push({ type: 'HOST_JOINED' })
          } else {
            lifecycleEvents.push({ 
              type: 'PLAYER_JOINED', 
              playerId: playerEvent.playerId 
            })
          }
          break

        case 'player_left':
          lifecycleEvents.push({ 
            type: 'PLAYER_LEFT', 
            playerId: playerEvent.playerId 
          })
          break

        case 'ai_player_added':
          lifecycleEvents.push({ 
            type: 'PLAYER_JOINED', 
            playerId: playerEvent.playerId 
          })
          break
      }
    }

    // Game events affect lifecycle
    if ('contextPlayerId' in event) {
      const gameEvent = event as GameEvent
      
      switch (gameEvent.eventType) {
        case 'game_started':
          lifecycleEvents.push({ type: 'GAME_STARTED' })
          break

        case 'game_ended':
          const winner = gameEvent.data?.winner
          lifecycleEvents.push({ 
            type: 'GAME_ENDED', 
            reason: 'completed',
            winner 
          })
          break

        // Phase transitions within active game
        case 'turn_ended':
          const nextPhase = this.determineNextPhase(gameEvent)
          if (nextPhase) {
            lifecycleEvents.push({ 
              type: 'PHASE_COMPLETED', 
              nextPhase 
            })
          }
          break
      }
    }

    return lifecycleEvents
  }

  /**
   * BUSINESS LOGIC: Phase Determination
   * Your existing game engine determines phases, we just observe
   */
  private determineNextPhase(gameEvent: GameEvent): any {
    // This would integrate with your existing game phase logic
    // For now, simplified mapping
    const phaseMap: Record<string, string> = {
      'initial_placement_complete': 'main_game_roll',
      'dice_rolled': 'main_game_actions',
      'turn_ended': 'main_game_roll'
    }
    
    return phaseMap[gameEvent.data?.phase] || null
  }

  /**
   * OPTIONAL: Store lifecycle events
   * Creates audit trail for lifecycle changes
   */
  private async storeLifecycleEvent(
    gameId: string, 
    lifecycleEvent: GameLifecycleEvent, 
    newState: any
  ): Promise<void> {
    try {
      await this.eventStore.appendEvent({
        gameId,
        eventType: 'lifecycle_state_changed',
        data: {
          lifecycleEvent,
          newState,
          timestamp: new Date().toISOString()
        },
        contextPlayerId: null
      })
    } catch (error) {
      console.warn('Failed to store lifecycle event:', error)
      // Don't throw - lifecycle events are supplementary
    }
  }

  private getOrCreateStateMachine(gameId: string): GameLifecycleStateMachine {
    if (!this.stateMachines.has(gameId)) {
      const machine = new GameLifecycleStateMachine(gameId)
      this.stateMachines.set(gameId, machine)
    }
    return this.stateMachines.get(gameId)!
  }
}

/**
 * LIFECYCLE-AWARE EVENT STORE
 * 
 * Extends your existing event store to update lifecycle state
 */
export class LifecycleAwareEventStore extends EventStoreRepository {
  constructor(
    private readonly bridge: LifecycleEventBridge,
    private readonly baseEventStore: EventStoreRepository
  ) {
    super()
  }

  /**
   * INTERCEPT EVENT APPENDS
   * Update lifecycle state when events are stored
   */
  async appendEvent(event: Omit<GameEvent | PlayerEvent, 'id' | 'sequenceNumber' | 'timestamp'>): Promise<void> {
    // Store the event normally
    await this.baseEventStore.appendEvent(event)
    
    // Update lifecycle state
    const fullEvent = { ...event, id: '', sequenceNumber: 0, timestamp: new Date().toISOString() }
    await this.bridge.handleDomainEvent(fullEvent as any)
  }

  // Delegate all other methods to base store
  async getGameEvents(gameId: string): Promise<GameEvent[]> {
    return this.baseEventStore.getGameEvents(gameId)
  }

  async getPlayerEvents(gameId: string): Promise<PlayerEvent[]> {
    return this.baseEventStore.getPlayerEvents(gameId)
  }

  // ... other methods
}

/**
 * INTEGRATION FACTORY
 * Wire everything together
 */
export class LifecycleIntegration {
  private readonly stateMachines = new Map<string, GameLifecycleStateMachine>()
  private readonly bridge: LifecycleEventBridge
  private readonly lifecycleAwareEventStore: LifecycleAwareEventStore

  constructor(baseEventStore: EventStoreRepository) {
    this.bridge = new LifecycleEventBridge(baseEventStore, this.stateMachines)
    this.lifecycleAwareEventStore = new LifecycleAwareEventStore(this.bridge, baseEventStore)
  }

  /**
   * Get lifecycle state for any game
   */
  getGameLifecycleState(gameId: string): any {
    const machine = this.stateMachines.get(gameId)
    return machine ? machine.getState() : null
  }

  /**
   * Manual lifecycle control (for admin operations)
   */
  async sendLifecycleEvent(gameId: string, event: GameLifecycleEvent): Promise<boolean> {
    const machine = this.stateMachines.get(gameId)
    if (!machine) return false

    return machine.send(event)
  }

  /**
   * Rebuild lifecycle state from existing events
   * For migration/recovery
   */
  async rebuildLifecycleState(gameId: string): Promise<void> {
    const gameEvents = await this.lifecycleAwareEventStore.getGameEvents(gameId)
    const playerEvents = await this.lifecycleAwareEventStore.getPlayerEvents(gameId)
    
    // Sort all events by sequence
    const allEvents = [...gameEvents, ...playerEvents]
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber)
    
    // Replay through bridge
    for (const event of allEvents) {
      await this.bridge.handleDomainEvent(event)
    }
  }

  /**
   * Get the enhanced event store
   */
  getEventStore(): EventStoreRepository {
    return this.lifecycleAwareEventStore
  }
}

// Singleton instance
let lifecycleIntegration: LifecycleIntegration | null = null

export function getLifecycleIntegration(eventStore?: EventStoreRepository): LifecycleIntegration {
  if (!lifecycleIntegration && eventStore) {
    lifecycleIntegration = new LifecycleIntegration(eventStore)
  }
  
  if (!lifecycleIntegration) {
    throw new Error('LifecycleIntegration not initialized')
  }
  
  return lifecycleIntegration
}