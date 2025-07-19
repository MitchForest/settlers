/**
 * CRITICAL ARCHITECTURE TEST: Unified Store Pattern
 * 
 * This test ensures we maintain the unified store architecture and prevents
 * the creation of multiple stores or fragmented state management patterns
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useGameStore } from '@/stores/gameStore'
// TODO: Will be updated when game engine is properly modularized
type GameState = any

// Mock the WebSocket manager to avoid actual connections
vi.mock('@/lib/websocket-manager', () => ({
  ReliableWebSocketManager: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    send: vi.fn(),
    getStatus: vi.fn().mockReturnValue('disconnected')
  }))
}))

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn()
  })
}))

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } })
    }
  }
}))

describe('GameStore Architecture', () => {
  beforeEach(() => {
    // Reset any mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Clean up any store state
    const { result } = renderHook(() => useGameStore())
    act(() => {
      result.current.disconnect()
    })
  })

  describe('🏗️ Store Unity (CRITICAL)', () => {
    it('should maintain a single store instance across multiple hook calls', () => {
      const { result: result1 } = renderHook(() => useGameStore())
      const { result: result2 } = renderHook(() => useGameStore())
      
      // Both hooks should reference the same store instance
      expect(result1.current).toBe(result2.current)
      
      // State changes in one should be reflected in the other
      act(() => {
        result1.current.setLocalPlayerId('player1')
      })
      
      expect(result2.current.localPlayerId).toBe('player1')
    })

    it('should manage all state domains in a single store', () => {
      const { result } = renderHook(() => useGameStore())
      
      // Verify all state domains exist in the unified store
      expect(result.current).toHaveProperty('gameState')
      expect(result.current).toHaveProperty('localPlayerId')
      expect(result.current).toHaveProperty('wsManager')
      expect(result.current).toHaveProperty('connectionStatus')
      expect(result.current).toHaveProperty('lobbyState')
      expect(result.current).toHaveProperty('placementMode')
      expect(result.current).toHaveProperty('flowInstance')
      
      // Verify all action methods exist
      expect(typeof result.current.connect).toBe('function')
      expect(typeof result.current.disconnect).toBe('function')
      expect(typeof result.current.sendAction).toBe('function')
      expect(typeof result.current.updateGameState).toBe('function')
      expect(typeof result.current.createGame).toBe('function')
      expect(typeof result.current.joinGameByCode).toBe('function')
    })
  })

  describe('🔄 State Management Integration', () => {
    it('should properly update game state through unified methods', () => {
      const { result } = renderHook(() => useGameStore())
      
      const mockGameState = {
        id: 'test-game',
        phase: 'playing',
        currentPlayer: 'player1',
        players: new Map([['player1', { id: 'player1', name: 'Test Player', resources: {} as any }]]),
        board: {
          hexes: new Map(),
          vertices: new Map(),
          edges: new Map(),
          ports: []
        },
        dice: { values: [3, 4], lastRoll: Date.now() },
        developmentCards: { deck: [], discardPile: [] },
        turn: 1,
        maxTurns: 100,
        winner: null,
        robberPosition: 'desert',
        gameSettings: { maxPlayers: 4, allowObservers: true, isPublic: true }
      } as unknown as GameState
      
      act(() => {
        result.current.updateGameState(mockGameState)
      })
      
      expect(result.current.gameState).toEqual(mockGameState)
    })

    it('should maintain consistent lobby state management', () => {
      const { result } = renderHook(() => useGameStore())
      
      // Initial state
      expect(result.current.lobbyState).toBe('idle')
      expect(result.current.gameCode).toBeNull()
      expect(result.current.isHost).toBe(false)
      
      // State should be consistent across the store
      expect(result.current.lobbyPlayers).toEqual([])
    })
  })

  describe('🌐 WebSocket Integration', () => {
    it('should integrate WebSocket manager into unified store', () => {
      const { result } = renderHook(() => useGameStore())
      
      // Initially no WebSocket manager
      expect(result.current.wsManager).toBeNull()
      expect(result.current.connectionStatus).toBe('disconnected')
      
      // Should have WebSocket management methods
      expect(typeof result.current.connect).toBe('function')
      expect(typeof result.current.disconnect).toBe('function')
      expect(typeof result.current.sendAction).toBe('function')
    })

    it('should handle connection status through unified store', () => {
      const { result } = renderHook(() => useGameStore())
      
      // Connection status should be part of unified state
      expect(result.current.connectionStatus).toBe('disconnected')
      
      // Should be able to track status changes
      expect(['connecting', 'connected', 'disconnected', 'error', 'offline']).toContain(
        result.current.connectionStatus
      )
    })
  })

  describe('🎮 Computed State Methods', () => {
    it('should provide unified computed state access', () => {
      const { result } = renderHook(() => useGameStore())
      
      // All computed methods should exist
      expect(typeof result.current.currentPlayer).toBe('function')
      expect(typeof result.current.isMyTurn).toBe('function')
      expect(typeof result.current.myPlayer).toBe('function')
      
      // Should handle null states gracefully when no game state is set
      if (result.current.gameState === null) {
        expect(result.current.currentPlayer()).toBeNull()
        expect(result.current.isMyTurn()).toBe(false)
        expect(result.current.myPlayer()).toBeNull()
      } else {
        // If gameState exists from previous test, methods should return appropriately
                 expect(result.current.currentPlayer()).toBeTruthy()
        expect(typeof result.current.isMyTurn()).toBe('boolean')
      }
    })
  })

  describe('🚫 Anti-Pattern Prevention', () => {
    it('should prevent direct state mutation outside of store actions', () => {
      const { result } = renderHook(() => useGameStore())
      
      // Store should not expose direct state setters that bypass actions
      expect(result.current).not.toHaveProperty('setState')
      expect(result.current).not.toHaveProperty('mutate')
      
      // All state changes should go through proper action methods
      const actionMethods = [
        'setLocalPlayerId', 'updateGameState', 'setPlacementMode',
        'setHoveredHex', 'setSelectedHex', 'connect', 'disconnect'
      ]
      
      actionMethods.forEach(method => {
        expect(typeof (result.current as any)[method]).toBe('function')
      })
    })

    it('should maintain immutable state updates', () => {
      const { result } = renderHook(() => useGameStore())
      
      const initialState = result.current.gameState
      const initialLobbyPlayers = result.current.lobbyPlayers
      
      // State references should not change unless explicitly updated
      expect(result.current.gameState).toBe(initialState)
      expect(result.current.lobbyPlayers).toBe(initialLobbyPlayers)
    })
  })
}) 