'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { use } from 'react'
import { GameLobby } from '@/components/lobby/GameLobby'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { 
  extractSessionFromURL, 
  cleanSessionFromURL, 
  hasPermission,
  analyzeSessionError 
} from '@/lib/session-utils'
import { validatePlayerSession } from '@/lib/api'
import { 
  GameSessionPayload, 
  SessionValidation, 
  SessionError,
  RecoveryAction 
} from '@/lib/session-types'
// import type { LobbyPlayer } from '@/lib/types/lobby-types'
import { ConnectionStatus } from '@/components/ui/connection-status'
import { HoneycombBackground } from '@/components/ui/honeycomb-background'
import { ds, componentStyles, designSystem } from '@/lib/design-system'
import { toast } from 'sonner'
import { useGameWebSocket, type LobbyData } from '@/lib/use-game-websocket'

interface PageParams {
  gameId: string
}

interface LobbyPageState {
  loading: boolean
  session: GameSessionPayload | null
  validation: SessionValidation | null
  error: SessionError | null
  lobbyData: LobbyData | null
}

/**
 * 🚀 REFACTORED LOBBY PAGE
 * 
 * Demonstrates the robust long-term architecture:
 * - Custom WebSocket hooks handle all connection complexity
 * - Clean separation of concerns
 * - React Strict Mode compatible
 * - Automatic reconnection and error recovery
 * - No manual WebSocket management needed
 */
export default function LobbyPageRefactored({ params }: { params: Promise<PageParams> }) {
  const { gameId } = use(params)
  const router = useRouter()
  
  const [state, setState] = useState<LobbyPageState>({
    loading: true,
    session: null,
    validation: null,
    error: null,
    lobbyData: null
  })

  const [isStartingGame, setIsStartingGame] = useState(false)
  const [sessionToken, setSessionToken] = useState<string>('')

  // 🎮 ROBUST WEBSOCKET CONNECTION
  // This hook handles ALL WebSocket complexity internally
  const gameWebSocket = useGameWebSocket({
    sessionToken,
    gameId,
    session: state.session!,
    onLobbyJoined: (data) => {
      console.log('🎮 Lobby joined successfully:', data)
      setState(prev => ({ ...prev, lobbyData: data }))
    },
    onLobbyUpdate: (players, canStart) => {
      console.log('🎮 Lobby updated:', { players: players.length, canStart })
      setState(prev => ({ 
        ...prev,
        lobbyData: prev.lobbyData ? { ...prev.lobbyData, players, canStart } : null
      }))
    },
    onGameStarted: () => {
      console.log('🎮 Game started, navigating...')
      const gameUrl = `/game/${gameId}?s=${encodeURIComponent(sessionToken)}`
      router.push(gameUrl)
    },
    onError: (error) => {
      console.error('🎮 WebSocket error:', error)
      const errorMessage = typeof error === 'string' ? error : error.message || 'Unknown error'
      toast.error(`Game error: ${errorMessage}`)
    }
  })

  // Initialize session from URL and validate
  useEffect(() => {
    const initializeSession = async () => {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }))
        
        // Extract session from URL
        const { token, session, error: urlError } = extractSessionFromURL()
        
        if (urlError || !session || !token) {
          setState(prev => ({ 
            ...prev, 
            loading: false, 
            error: urlError || { 
              type: 'malformed_token', 
              message: 'No valid session found in URL',
              gameId,
              canRecover: true
            }
          }))
          return
        }
        
        // Validate session with backend
        const validation = await validatePlayerSession(token)
        
        if (!validation.valid) {
          setState(prev => ({ 
            ...prev, 
            loading: false,
            error: {
              type: 'invalid_signature',
              message: validation.reason || 'Session validation failed',
              gameId,
              canRecover: true
            }
          }))
          return
        }
        
        // Check if this session is for the correct game
        if (session.gameId !== gameId) {
          setState(prev => ({ 
            ...prev, 
            loading: false,
            error: {
              type: 'game_not_found',
              message: 'Session is for a different game',
              gameId,
              canRecover: false
            }
          }))
          return
        }
        
        // Clean session from URL for cleaner appearance
        cleanSessionFromURL()
        
        // Set successful state - WebSocket will connect automatically
        setState(prev => ({ 
          ...prev, 
          loading: false,
          session,
          validation,
          error: null
        }))
        
        setSessionToken(token)
        
      } catch (error) {
        console.error('Session initialization error:', error)
        setState(prev => ({ 
          ...prev, 
          loading: false,
          error: {
            type: 'malformed_token',
            message: 'Failed to initialize session',
            gameId,
            canRecover: true
          }
        }))
      }
    }
    
    initializeSession()
  }, [gameId])

  // 🎯 GAME ACTIONS - Simplified with robust hooks
  const handleStartGame = useCallback(async () => {
    if (!state.session || !gameWebSocket.isConnected || !hasPermission(state.session, 'start_game')) {
      toast.error('Cannot start game - missing permissions or not connected')
      return
    }
    
    setIsStartingGame(true)
    
    const success = gameWebSocket.startGame()
    if (!success) {
      setIsStartingGame(false)
      toast.error('Failed to start game')
    }
    // Success will be handled by onGameStarted callback
  }, [state.session, gameWebSocket])

  const handleAddAIBot = useCallback(async (
    difficulty: 'easy' | 'medium' | 'hard', 
    personality: 'aggressive' | 'balanced' | 'defensive' | 'economic'
  ) => {
    if (!gameWebSocket.isConnected) {
      toast.error('Not connected to game')
      return
    }

    const success = gameWebSocket.addAIBot(difficulty, personality)
    if (success) {
      toast.success('Adding AI bot...')
    } else {
      toast.error('Failed to add AI bot')
    }
  }, [gameWebSocket])

  const handleRemoveAIBot = useCallback(async (botPlayerId: string) => {
    if (!gameWebSocket.isConnected) {
      toast.error('Not connected to game')
      return
    }

    const success = gameWebSocket.removeAIBot(botPlayerId)
    if (success) {
      toast.success('Removing AI bot...')
    } else {
      toast.error('Failed to remove AI bot')
    }
  }, [gameWebSocket])

  // Handle recovery actions
  const handleRecovery = useCallback((action: RecoveryAction) => {
    switch (action.type) {
      case 'redirect_home':
        router.push('/')
        break
      case 'rejoin_by_code':
        router.push('/?action=join')
        break
      case 'refresh_session':
        window.location.reload()
        break
      default:
        router.push('/')
    }
  }, [router])

  // Loading state
  if (state.loading) {
    return (
      <HoneycombBackground>
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className={ds(componentStyles.glassCard, 'w-full max-w-md')}>
            <CardContent className="flex flex-col items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin mb-4 text-white" />
              <h2 className={ds(designSystem.text.heading, 'text-lg mb-2')}>Loading Lobby</h2>
              <p className={ds(designSystem.text.muted, 'text-sm text-center')}>
                Validating your session and connecting to the game...
              </p>
            </CardContent>
          </Card>
        </div>
      </HoneycombBackground>
    )
  }

  // Error state
  if (state.error) {
    const recovery = analyzeSessionError(state.error, gameId)
    
    return (
      <HoneycombBackground>
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className={ds(componentStyles.glassCard, 'w-full max-w-md')}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-400" />
                <CardTitle className={ds(designSystem.text.heading)}>Session Error</CardTitle>
              </div>
              <CardDescription className={ds(designSystem.text.muted)}>
                {state.error.message}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button 
                  onClick={() => handleRecovery(recovery)} 
                  className={ds(componentStyles.buttonPrimary, 'flex-1')}
                >
                  {recovery.type === 'refresh_session' ? (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  ) : (
                    <Home className="h-4 w-4 mr-2" />
                  )}
                  {recovery.buttonText}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </HoneycombBackground>
    )
  }

  // Main lobby content when successfully connected
  if (state.session && state.validation && state.lobbyData) {
    return (
      <HoneycombBackground>
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="w-full max-w-4xl">
            <GameLobby
              gameCode={state.lobbyData.gameCode}
              players={state.lobbyData.players}
              isHost={state.lobbyData.isHost}
              canStart={state.lobbyData.canStart && !isStartingGame}
              maxPlayers={4}
              onStartGame={handleStartGame}
              onLeave={() => router.push('/')}
              onAddAIBot={handleAddAIBot}
              onRemoveAIBot={handleRemoveAIBot}
            />
            
            {/* 🔧 DEBUG PANEL (remove in production) */}
            {process.env.NODE_ENV === 'development' && (
              <Card className={ds(componentStyles.glassCard, 'mt-4 opacity-80')}>
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>🔌 WebSocket Status: {gameWebSocket.status}</div>
                    <div>🎮 Connected: {gameWebSocket.isConnected ? '✅' : '❌'}</div>
                                         <div>👤 Player: {state.validation?.playerData?.name || 'Unknown'} ({state.session.playerId})</div>
                    <div>🎯 Game: {state.session.gameId}</div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
        
        {/* Connection status */}
        <ConnectionStatus status={gameWebSocket.status === 'failed' ? 'error' : gameWebSocket.status as 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error' | 'offline'} />
      </HoneycombBackground>
    )
  }

  // Fallback loading state
  return (
    <HoneycombBackground>
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className={ds(componentStyles.glassCard, 'w-full max-w-md')}>
          <CardContent className="flex flex-col items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin mb-4 text-white" />
            <h2 className={ds(designSystem.text.heading, 'text-lg mb-2')}>Connecting to Lobby</h2>
            <p className={ds(designSystem.text.muted, 'text-sm text-center')}>
              Please wait while we connect you to the game...
            </p>
          </CardContent>
        </Card>
      </div>
    </HoneycombBackground>
  )
} 