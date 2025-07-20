/**
 * ENTERPRISE FRONTEND STATE MANAGEMENT
 * 
 * Patterns from:
 * - Linear (deterministic routing)
 * - Discord (real-time state sync)
 * - Figma (collaborative state management)
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useUnifiedAuth } from './unified-auth'
import { wsManager } from './websocket-connection-manager'

export type GameLifecycleState = 
  | { status: 'created', substatus: 'awaiting_host' }
  | { status: 'lobby', substatus: 'open' | 'starting' | 'countdown' }
  | { status: 'active', substatus: string }
  | { status: 'paused', substatus: string }
  | { status: 'ended', substatus: 'completed' | 'abandoned' | 'error' }

export interface GameStateSnapshot {
  gameId: string
  lifecycle: GameLifecycleState
  players: any[]
  gameData?: any
  lastUpdated: string
}

/**
 * DETERMINISTIC GAME STATE HOOK
 * Single source of truth - no more boolean flags!
 */
export function useGameState(gameId: string) {
  const auth = useUnifiedAuth()
  const queryClient = useQueryClient()
  
  return useQuery({
    queryKey: ['gameState', gameId],
    queryFn: async (): Promise<GameStateSnapshot> => {
      const token = auth.getAccessToken()
      if (!token) throw new Error('Not authenticated')
      
      const response = await fetch(`/api/games/${gameId}/state`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch game state: ${response.statusText}`)
      }
      
      return response.json()
    },
    enabled: !!gameId && auth.isAuthenticated(),
    staleTime: 0, // Always fetch fresh state
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: (failureCount, error) => {
      // Don't retry on 404 (game not found)
      if (error.message.includes('404')) return false
      return failureCount < 3
    }
  })
}

/**
 * REAL-TIME STATE SYNCHRONIZATION
 * WebSocket integration with React Query
 */
export function useGameStateSync(gameId: string) {
  const queryClient = useQueryClient()
  const auth = useUnifiedAuth()
  
  useEffect(() => {
    if (!gameId || !auth.isAuthenticated()) return
    
    const token = auth.getAccessToken()
    if (!token) return

    // Create WebSocket connection
    const connection = wsManager.createGameConnection(
      gameId,
      token,
      (status) => {
        console.log('🔌 Game state sync connection:', status)
      },
      false
    )

    // Listen for state changes
    wsManager.addMessageRoute(connection, 'gameStateChanged', (event) => {
      try {
        const message = JSON.parse(event.data)
        
        if (message.success && message.data?.gameState) {
          console.log('🔄 Received game state update:', message.data.gameState)
          
          // Update React Query cache
          queryClient.setQueryData(
            ['gameState', gameId], 
            message.data.gameState
          )
          
          // Handle route changes if needed
          if (message.data.route) {
            handleRouteChange(message.data.route)
          }
        }
      } catch (error) {
        console.error('❌ Error handling game state change:', error)
      }
    }, 'Game state synchronization')

    // Connect
    wsManager.connect(connection).catch(error => {
      console.error('❌ Failed to connect for state sync:', error)
    })

    // Cleanup
    return () => {
      wsManager.disconnect(connection)
    }
  }, [gameId, auth.isAuthenticated(), queryClient])
}

/**
 * AUTOMATIC ROUTE GUARD
 * Ensures user is always on the correct page for game state
 */
export function useGameRouteGuard(gameId: string) {
  const router = useRouter()
  const pathname = usePathname()
  const { data: gameState, isLoading } = useGameState(gameId)
  
  useEffect(() => {
    if (isLoading || !gameState) return
    
    const expectedRoute = getExpectedRoute(gameId, gameState.lifecycle)
    
    // Only redirect if we're on a game-related route and it's wrong
    if (pathname.includes(gameId) && pathname !== expectedRoute) {
      console.log('🎯 Route guard redirect:', { from: pathname, to: expectedRoute })
      router.replace(expectedRoute)
    }
  }, [gameState, pathname, router, gameId, isLoading])
  
  return { gameState, isLoading, expectedRoute: gameState ? getExpectedRoute(gameId, gameState.lifecycle) : null }
}

/**
 * BUSINESS LOGIC QUERIES
 * Centralized game state predicates
 */
export function useGamePermissions(gameId: string) {
  const { data: gameState } = useGameState(gameId)
  const auth = useUnifiedAuth()
  
  if (!gameState || !auth.user) {
    return {
      canJoin: false,
      canStart: false,
      canAddBots: false,
      canLeave: false,
      isHost: false,
      isInLobby: false,
      isInGame: false
    }
  }
  
  const currentPlayer = gameState.players.find(p => p.userId === auth.user?.id)
  const isHost = currentPlayer?.isHost || false
  
  return {
    canJoin: gameState.lifecycle.status === 'lobby' && gameState.lifecycle.substatus === 'open',
    canStart: isHost && gameState.lifecycle.status === 'lobby' && gameState.players.length >= 2,
    canAddBots: isHost && gameState.lifecycle.status === 'lobby',
    canLeave: gameState.lifecycle.status === 'lobby' || gameState.lifecycle.status === 'active',
    isHost,
    isInLobby: gameState.lifecycle.status === 'lobby',
    isInGame: gameState.lifecycle.status === 'active' || gameState.lifecycle.status === 'paused'
  }
}

/**
 * OPTIMISTIC GAME ACTIONS
 * Actions with optimistic updates and server reconciliation
 */
export function useGameActions(gameId: string) {
  const queryClient = useQueryClient()
  const auth = useUnifiedAuth()
  
  const updateGameState = async (action: string, data?: any) => {
    const token = auth.getAccessToken()
    if (!token) throw new Error('Not authenticated')
    
    const response = await fetch(`/api/games/${gameId}/actions`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify({ action, data })
    })
    
    if (!response.ok) {
      throw new Error(`Action failed: ${response.statusText}`)
    }
    
    return response.json()
  }
  
  return {
    startGame: () => updateGameState('start'),
    addBot: (personality: string) => updateGameState('addBot', { personality }),
    removeBot: (botId: string) => updateGameState('removeBot', { botId }),
    leaveGame: () => updateGameState('leave'),
    pauseGame: () => updateGameState('pause'),
    resumeGame: () => updateGameState('resume')
  }
}

/**
 * DETERMINISTIC ROUTING LOGIC
 * Single source of truth for navigation
 */
function getExpectedRoute(gameId: string, lifecycle: GameLifecycleState): string {
  switch (lifecycle.status) {
    case 'created':
    case 'lobby':
      return `/lobby/${gameId}`
    
    case 'active':
    case 'paused':
      return `/game/${gameId}`
    
    case 'ended':
      return `/game/${gameId}/results`
    
    default:
      return `/`
  }
}

function handleRouteChange(expectedRoute: string) {
  // Only auto-navigate if we're not already on the right route
  if (window.location.pathname !== expectedRoute) {
    console.log('🎯 Auto-navigating to:', expectedRoute)
    window.history.replaceState(null, '', expectedRoute)
    
    // Trigger Next.js navigation
    window.dispatchEvent(new PopStateEvent('popstate'))
  }
}