'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { GameLobby } from '@/components/lobby/GameLobby'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { use } from 'react'
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
import type { LobbyPlayer } from '@/lib/types/lobby-types'
import { ConnectionStatus } from '@/components/ui/connection-status'
import { HoneycombBackground } from '@/components/ui/honeycomb-background'
import { ds, componentStyles, designSystem } from '@/lib/design-system'
import { toast } from 'sonner'

interface PageParams {
  gameId: string
}

interface LobbyPageState {
  loading: boolean
  session: GameSessionPayload | null
  validation: SessionValidation | null
  error: SessionError | null
  lobbyData: {
    gameCode: string
    players: LobbyPlayer[]
    isHost: boolean
    canStart: boolean
  } | null
  webSocket: WebSocket | null
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error'
}

export default function LobbyPage({ params }: { params: Promise<PageParams> }) {
  const { gameId } = use(params)
  const router = useRouter()
  
  const [state, setState] = useState<LobbyPageState>({
    loading: true,
    session: null,
    validation: null,
    error: null,
    lobbyData: null,
    webSocket: null,
    connectionStatus: 'disconnected'
  })

  const [isStartingGame, setIsStartingGame] = useState(false)
  
  // Use ref to track current connection and prevent multiple connections
  const currentConnectionRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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
        
        // Set successful state
        setState(prev => ({ 
          ...prev, 
          loading: false,
          session,
          validation,
          error: null
        }))
        
        // Connect to WebSocket with session
        await connectWebSocket(token, session)
        
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId])

  // Connect to WebSocket with session token
  const connectWebSocket = useCallback(async (sessionToken: string, session: GameSessionPayload) => {
    try {
      // Close any existing connection first
      if (currentConnectionRef.current) {
        console.log('🔌 Closing existing WebSocket connection...')
        currentConnectionRef.current.close(1000, 'New connection starting')
        currentConnectionRef.current = null
      }
      
      // Clear any pending reconnection
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      
      setState(prev => ({ ...prev, connectionStatus: 'connecting' }))
      
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000'
      const ws = new WebSocket(`${wsUrl}/ws?s=${encodeURIComponent(sessionToken)}`)
      
      // Track this connection
      currentConnectionRef.current = ws
      
      ws.onopen = () => {
        console.log('🔌 WebSocket connected with session')
        // Only update state if this is still the current connection
        if (currentConnectionRef.current === ws) {
          setState(prev => ({ 
            ...prev, 
            webSocket: ws, 
            connectionStatus: 'connected' 
          }))
        }
        
        // Session is automatically validated on server, no need to send joinWithSession
      }
      
      ws.onmessage = (event) => {
        // Only handle messages if this is still the current connection
        if (currentConnectionRef.current !== ws) return
        
        try {
          const data = JSON.parse(event.data)
          console.log('📨 WebSocket message:', data.type)
          
          switch (data.type) {
            case 'lobbyJoined':
              setState(prev => ({ 
                ...prev, 
                lobbyData: {
                  gameCode: data.gameCode,
                  players: data.players,
                  isHost: data.isHost,
                  canStart: data.canStart
                }
              }))
              break
              
            case 'lobbyUpdate':
              setState(prev => ({ 
                ...prev,
                lobbyData: prev.lobbyData ? {
                  ...prev.lobbyData,
                  players: data.players,
                  canStart: data.canStart
                } : null
              }))
              break
              
            case 'gameStarted':
              // Navigate to game page with current session
              const gameUrl = `/game/${gameId}?s=${encodeURIComponent(sessionToken)}`
              router.push(gameUrl)
              break
              
            case 'error':
              const errorMessage = data?.error || 'Unknown error'
              console.error('❌ WebSocket error message:', errorMessage)
              toast.error(`Error: ${errorMessage}`)
              setState(prev => ({ ...prev, connectionStatus: 'error' }))
              break
              
            default:
              console.log('📨 Unhandled message type:', data.type)
          }
        } catch (error) {
          console.error('❌ Failed to parse WebSocket message:', error)
        }
      }
      
      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error)
        if (currentConnectionRef.current === ws) {
          setState(prev => ({ ...prev, connectionStatus: 'error' }))
        }
      }
      
      ws.onclose = (event) => {
        console.log('🔌 WebSocket closed:', event.code, event.reason)
        
        // Only handle close if this was the current connection
        if (currentConnectionRef.current === ws) {
          currentConnectionRef.current = null
          setState(prev => ({ 
            ...prev, 
            webSocket: null, 
            connectionStatus: 'disconnected' 
          }))
          
          // Only auto-reconnect for unexpected closures, not normal ones
          // Code 1005 often indicates a normal browser-initiated close
          if (event.code !== 1000 && event.code !== 1001 && event.code !== 1005) {
            console.log('🔄 Connection lost unexpectedly, will attempt to reconnect...')
            // Use a shorter timeout and prevent multiple reconnection attempts
            reconnectTimeoutRef.current = setTimeout(() => {
              if (!currentConnectionRef.current) { // Only reconnect if no current connection
                console.log('🔄 Attempting to reconnect...')
                connectWebSocket(sessionToken, session)
              }
            }, 2000)
          } else {
            console.log('🔌 WebSocket closed normally, no reconnection needed')
          }
        }
      }
      
    } catch (error) {
      console.error('WebSocket connection failed:', error)
      setState(prev => ({ ...prev, connectionStatus: 'error' }))
    }
  }, [gameId, router])

  // Handle starting game
  const handleStartGame = async () => {
    if (!state.session || !state.webSocket || !hasPermission(state.session, 'start_game')) {
      return
    }
    
    setIsStartingGame(true)
    
    try {
      state.webSocket.send(JSON.stringify({
        type: 'startGame',
        gameId: state.session.gameId
      }))
    } catch (error) {
      console.error('Failed to start game:', error)
      setIsStartingGame(false)
    }
  }

  // Handle adding AI bot
  const handleAddAIBot = async (difficulty: 'easy' | 'medium' | 'hard', personality: 'aggressive' | 'balanced' | 'defensive' | 'economic') => {
    if (!state.webSocket || !state.session) {
      toast.error('Not connected to game')
      return
    }

    try {
      state.webSocket.send(JSON.stringify({
        type: 'addAIBot',
        difficulty,
        personality
      }))
      toast.success('Adding AI bot...')
    } catch (error) {
      console.error('Failed to add AI bot:', error)
      toast.error('Failed to add AI bot')
    }
  }

  // Handle removing AI bot
  const handleRemoveAIBot = async (botPlayerId: string) => {
    if (!state.webSocket || !state.session) {
      toast.error('Not connected to game')
      return
    }

    try {
      state.webSocket.send(JSON.stringify({
        type: 'removeAIBot',
        botPlayerId
      }))
      toast.success('Removing AI bot...')
    } catch (error) {
      console.error('Failed to remove AI bot:', error)
      toast.error('Failed to remove AI bot')
    }
  }

  // Handle recovery actions
  const handleRecovery = (action: RecoveryAction) => {
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
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clean up WebSocket connection
      if (currentConnectionRef.current) {
        console.log('🔌 Cleaning up WebSocket on unmount')
        currentConnectionRef.current.close(1000, 'Component unmounting')
        currentConnectionRef.current = null
      }
      
      // Clear any pending reconnection
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
    }
  }, [])

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
            {/* Lobby component */}
            {state.lobbyData && state.session ? (
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
            ) : (
              <Card className={ds(componentStyles.glassCard)}>
                <CardContent className="flex items-center justify-center p-8">
                  <div className="text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-white" />
                    <p className={ds(designSystem.text.muted, 'text-sm')}>Loading lobby data...</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
        
        {/* Connection status in bottom right */}
        <ConnectionStatus status={state.connectionStatus} />
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