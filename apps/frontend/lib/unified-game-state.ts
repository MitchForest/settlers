/**
 * UNIFIED FRONTEND STATE MANAGEMENT - ZERO TECHNICAL DEBT
 * 
 * Single source of truth for ALL game state on the frontend.
 * Replaces scattered React state with unified, deterministic state management.
 */

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useEffect, useCallback, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useUnifiedAuth } from './unified-auth'
import { wsManager } from './websocket-connection-manager'

/**
 * UNIFIED GAME STATE TYPES
 * Mirror backend types for consistency
 */
export type GameStatus = 'created' | 'lobby' | 'active' | 'paused' | 'ended'
export type LobbySubstatus = 'awaiting_host' | 'open' | 'starting' | 'countdown'
export type GameSubstatus = 'initial_placement_1' | 'initial_placement_2' | 'main_roll' | 'main_actions' | 'discard' | 'robber' | 'victory'

export type UnifiedGameState = 
  | { status: 'created', substatus: 'awaiting_host' }
  | { status: 'lobby', substatus: LobbySubstatus }
  | { status: 'active', substatus: GameSubstatus }
  | { status: 'paused', substatus: string, previousState: GameSubstatus }
  | { status: 'ended', substatus: string, winner?: string, reason?: string }

export interface UnifiedGameContext {
  gameId: string
  gameCode: string
  state: UnifiedGameState
  players: GamePlayer[]
  spectators: GameSpectator[]
  hostUserId: string
  settings: GameSettings
  gameData?: any
  createdAt: string
  updatedAt: string
  startedAt?: string
  endedAt?: string
  lastActivity: string
  eventCount: number
  lastEventSequence: number
}

export interface GamePlayer {
  id: string
  userId?: string
  name: string
  playerType: 'human' | 'ai'
  color: string
  joinOrder: number
  isHost: boolean
  status: 'active' | 'disconnected' | 'left'
  joinedAt: string
  leftAt?: string
  aiPersonality?: string
  gameData?: any
}

export interface GameSpectator {
  userId: string
  name: string
  joinedAt: string
}

export interface GameSettings {
  maxPlayers: number
  allowSpectators: boolean
  aiEnabled: boolean
  turnTimeLimit?: number
  autoStart: boolean
  private: boolean
  victoryPoints: number
  initialResources: boolean
  robberBlocks: boolean
}

export interface GamePermissions {
  canJoin: boolean
  canStart: boolean
  canAddBots: boolean
  canLeave: boolean
  isHost: boolean
  isInLobby: boolean
  isInGame: boolean
  canPerformActions: boolean
  validActions: string[]
}

/**
 * UNIFIED GAME STATE HOOK
 * Single hook for ALL game state management
 */
export function useUnifiedGameState(gameId: string) {
  const auth = useUnifiedAuth()
  const queryClient = useQueryClient()
  
  return useQuery({
    queryKey: ['unifiedGameState', gameId],
    queryFn: async (): Promise<UnifiedGameContext> => {
      const token = auth.getAccessToken()
      if (!token) throw new Error('Not authenticated')
      
      const response = await fetch(`/api/unified/games/${gameId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Game not found')
        }
        if (response.status === 403) {
          throw new Error('Access denied')
        }
        throw new Error(`Failed to fetch game state: ${response.statusText}`)
      }
      
      const result = await response.json()
      return result.data.gameState
    },
    enabled: !!gameId && auth.isAuthenticated(),
    staleTime: 0, // Always fetch fresh state
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: (failureCount, error) => {
      if (error.message.includes('not found') || error.message.includes('denied')) {
        return false
      }
      return failureCount < 3
    }
  })
}

/**
 * UNIFIED GAME PERMISSIONS HOOK
 * Business logic queries based on unified state
 */
export function useUnifiedGamePermissions(gameId: string): GamePermissions {
  const { data: gameState } = useUnifiedGameState(gameId)
  const auth = useUnifiedAuth()
  
  if (!gameState || !auth.user) {
    return {
      canJoin: false,
      canStart: false,
      canAddBots: false,
      canLeave: false,
      isHost: false,
      isInLobby: false,
      isInGame: false,
      canPerformActions: false,
      validActions: []
    }
  }
  
  const currentPlayer = gameState.players.find(p => p.userId === auth.user?.id)
  const isHost = currentPlayer?.isHost || false
  const activePlayers = gameState.players.filter(p => p.status === 'active')
  
  return {
    canJoin: gameState.state.status === 'lobby' && 
             gameState.state.substatus === 'open' && 
             activePlayers.length < gameState.settings.maxPlayers,
    canStart: isHost && 
              gameState.state.status === 'lobby' && 
              gameState.state.substatus === 'open' && 
              activePlayers.length >= 2,
    canAddBots: isHost && 
                gameState.state.status === 'lobby' && 
                gameState.settings.aiEnabled,
    canLeave: gameState.state.status === 'lobby' || 
              gameState.state.status === 'active',
    isHost,
    isInLobby: gameState.state.status === 'lobby',
    isInGame: gameState.state.status === 'active' || 
              gameState.state.status === 'paused',
    canPerformActions: gameState.state.status === 'active' && 
                       currentPlayer && 
                       gameState.gameData?.currentPlayer === currentPlayer.id,
    validActions: getValidActionsForPhase(gameState.state.status === 'active' ? gameState.state.substatus : null)
  }
}

/**
 * UNIFIED GAME ACTIONS HOOK
 * All game operations through unified commands
 */
export function useUnifiedGameActions(gameId: string) {
  const queryClient = useQueryClient()
  const auth = useUnifiedAuth()
  
  const executeCommand = useCallback(async (command: any) => {
    const token = auth.getAccessToken()
    if (!token) throw new Error('Not authenticated')
    
    const response = await fetch(`/api/unified/games/${gameId}/commands`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify({ command })
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Command failed')
    }
    
    const result = await response.json()
    
    // Update cache with new state
    if (result.data.gameState) {
      queryClient.setQueryData(['unifiedGameState', gameId], result.data.gameState)
    }
    
    return result.data
  }, [gameId, auth, queryClient])
  
  // Optimistic mutations for better UX
  const joinGame = useMutation({
    mutationFn: (playerName: string) => executeCommand({
      type: 'JOIN_GAME',
      userId: auth.user?.id,
      playerName
    }),
    onMutate: async () => {
      // Optimistic update
      const previousState = queryClient.getQueryData(['unifiedGameState', gameId])
      
      queryClient.setQueryData(['unifiedGameState', gameId], (old: any) => {
        if (!old) return old
        return {
          ...old,
          players: [...old.players, {
            id: 'temp_' + Date.now(),
            userId: auth.user?.id,
            name: auth.user?.email?.split('@')[0] || 'Player',
            playerType: 'human',
            status: 'active',
            isHost: old.players.length === 0
          }]
        }
      })
      
      return { previousState }
    },
    onError: (error, variables, context) => {
      // Rollback optimistic update
      if (context?.previousState) {
        queryClient.setQueryData(['unifiedGameState', gameId], context.previousState)
      }
    }
  })
  
  const leaveGame = useMutation({
    mutationFn: () => executeCommand({
      type: 'LEAVE_GAME',
      reason: 'manual'
    })
  })
  
  const startGame = useMutation({
    mutationFn: () => executeCommand({
      type: 'START_GAME',
      requestedBy: auth.user?.id
    })
  })
  
  const addAIBot = useMutation({
    mutationFn: (params: { name?: string; personality?: string; difficulty?: string }) => 
      executeCommand({
        type: 'ADD_AI_PLAYER',
        name: params.name || 'AI Bot',
        personality: params.personality || 'balanced',
        difficulty: params.difficulty || 'normal',
        requestedBy: auth.user?.id
      })
  })
  
  const removeAIBot = useMutation({
    mutationFn: (playerId: string) => executeCommand({
      type: 'REMOVE_AI_PLAYER',
      playerId,
      requestedBy: auth.user?.id
    })
  })
  
  const performAction = useMutation({
    mutationFn: (params: { action: string; data?: any }) => {
      const gameState = queryClient.getQueryData(['unifiedGameState', gameId]) as UnifiedGameContext
      const currentPlayer = gameState?.players.find(p => p.userId === auth.user?.id)
      
      return executeCommand({
        type: 'PERFORM_ACTION',
        playerId: currentPlayer?.id,
        action: params.action,
        data: params.data
      })
    }
  })
  
  const endTurn = useMutation({
    mutationFn: () => {
      const gameState = queryClient.getQueryData(['unifiedGameState', gameId]) as UnifiedGameContext
      const currentPlayer = gameState?.players.find(p => p.userId === auth.user?.id)
      
      return executeCommand({
        type: 'END_TURN',
        playerId: currentPlayer?.id
      })
    }
  })
  
  return {
    joinGame,
    leaveGame,
    startGame,
    addAIBot,
    removeAIBot,
    performAction,
    endTurn,
    executeCommand
  }
}

/**
 * AUTOMATIC ROUTE GUARD
 * Ensures user is always on correct page for game state
 */
export function useUnifiedGameRouteGuard(gameId: string) {
  const router = useRouter()
  const pathname = usePathname()
  const { data: gameState, isLoading, error } = useUnifiedGameState(gameId)
  
  const expectedRoute = gameState ? getRouteForGameState(gameId, gameState.state) : null
  
  useEffect(() => {
    if (isLoading || !gameState || !expectedRoute) return
    
    // Only redirect if we're on a game-related route and it's wrong
    if (pathname.includes(gameId) && pathname !== expectedRoute) {
      console.log('🎯 Unified route guard redirect:', { from: pathname, to: expectedRoute })
      router.replace(expectedRoute)
    }
  }, [gameState, pathname, router, gameId, isLoading, expectedRoute])
  
  return { 
    gameState, 
    isLoading, 
    error,
    expectedRoute,
    shouldRedirect: expectedRoute && pathname !== expectedRoute
  }
}

/**
 * REAL-TIME STATE SYNCHRONIZATION
 * WebSocket integration with React Query
 */
export function useUnifiedGameSync(gameId: string) {
  const queryClient = useQueryClient()
  const auth = useUnifiedAuth()
  const connectionRef = useRef<any>(null)
  
  useEffect(() => {
    if (!gameId || !auth.isAuthenticated()) return
    
    const token = auth.getAccessToken()
    if (!token) return
    
    // Use connection manager for consistency
    const connection = wsManager.createGameConnection(
      gameId,
      token,
      (status) => {
        console.log('🔌 Unified game sync status:', status)
      }
    )
    
    connectionRef.current = connection
    
    // Set up message routes for React Query cache updates
    wsManager.addMessageRoute(connection, 'gameStateChanged', (event) => {
      try {
        const message = JSON.parse(event.data)
        if (message.success && message.data?.state) {
          queryClient.invalidateQueries(['unifiedGameState', gameId])
        }
      } catch (error) {
        console.error('❌ Failed to parse game state message:', error)
      }
    }, 'Game state cache invalidation')
    
    wsManager.addMessageRoute(connection, 'lobbyState', (event) => {
      try {
        const message = JSON.parse(event.data)
        if (message.success && message.data?.lobby) {
          queryClient.setQueryData(['unifiedGameState', gameId], (old: any) => ({
            ...old,
            ...message.data.lobby
          }))
        }
      } catch (error) {
        console.error('❌ Failed to parse lobby state message:', error)
      }
    }, 'Lobby state cache update')
    
    // Connect using the manager
    wsManager.connect(connection).catch(console.error)
    
    // Cleanup
    return () => {
      if (connectionRef.current) {
        wsManager.disconnect(connectionRef.current)
        connectionRef.current = null
      }
    }
  }, [gameId, auth.isAuthenticated(), queryClient])
}

/**
 * UNIFIED GAME CREATION
 */
export function useCreateGame() {
  const auth = useUnifiedAuth()
  const router = useRouter()
  
  return useMutation({
    mutationFn: async (params: { gameCode?: string; settings?: any }) => {
      const token = auth.getAccessToken()
      if (!token) throw new Error('Not authenticated')
      
      const response = await fetch('/api/unified/games', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          gameCode: params.gameCode,
          hostUserId: auth.user?.id,
          settings: params.settings
        })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to create game')
      }
      
      const result = await response.json()
      return result.data
    },
    onSuccess: (data) => {
      // Navigate to the game
      router.push(data.route)
    }
  })
}

/**
 * UTILITY FUNCTIONS
 */
function getRouteForGameState(gameId: string, state: UnifiedGameState): string {
  switch (state.status) {
    case 'created':
    case 'lobby':
      return `/lobby/${gameId}`
    
    case 'active':
    case 'paused':
      return `/game/${gameId}`
    
    case 'ended':
      return `/game/${gameId}/results`
    
    default:
      return '/'
  }
}

function getValidActionsForPhase(phase: GameSubstatus | null): string[] {
  if (!phase) return []
  
  const actionMap: Record<GameSubstatus, string[]> = {
    'initial_placement_1': ['place_settlement', 'place_road'],
    'initial_placement_2': ['place_settlement', 'place_road'],
    'main_roll': ['roll_dice'],
    'main_actions': ['build_settlement', 'build_city', 'build_road', 'buy_card', 'play_card', 'trade', 'end_turn'],
    'discard': ['discard_cards'],
    'robber': ['move_robber', 'steal_resource'],
    'victory': []
  }
  
  return actionMap[phase] || []
}

/**
 * USER'S GAMES QUERY
 */
export function useUserGames() {
  const auth = useUnifiedAuth()
  
  return useQuery({
    queryKey: ['userGames'],
    queryFn: async () => {
      const token = auth.getAccessToken()
      if (!token) throw new Error('Not authenticated')
      
      const response = await fetch('/api/unified/games/user/games', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch user games')
      }
      
      const result = await response.json()
      return result.data.games
    },
    enabled: auth.isAuthenticated()
  })
}