'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { GameLobby } from '@/components/lobby/GameLobby'
import { useLobbyWebSocket } from '@/lib/use-lobby-websocket'
import { supabase } from '@/lib/supabase'
import type { LobbyPlayer } from '@/lib/types/lobby-types'

interface LobbyPageProps {
  params: Promise<{
    gameId: string
  }>
}

export default function LobbyPage({ params }: LobbyPageProps) {
  const { gameId } = use(params)
  const router = useRouter()
  const { user, profile } = useAuth()
  
  // Lobby state
  const [gameCode, setGameCode] = useState<string>('')
  const [players, setPlayers] = useState<LobbyPlayer[]>([])
  const [isHost, setIsHost] = useState(false)
  const [canStart, setCanStart] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionToken, setSessionToken] = useState<string>('')

  // Get session token from URL or fresh from Supabase
  useEffect(() => {
    const getSessionToken = async () => {
      // First, check if there's a session token in the URL (from auth callback)
      const urlParams = new URLSearchParams(window.location.search)
      const urlSessionToken = urlParams.get('s')
      
      if (urlSessionToken) {
        console.log('🔑 Using session token from URL')
        setSessionToken(urlSessionToken)
        return
      }
      
      // Fallback: get fresh access token from Supabase
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        console.log('🔑 Using fresh access token from Supabase')
        setSessionToken(session.access_token)
      }
    }
    getSessionToken()
  }, [])

  // 🔌 USE NEW EXTERNAL WEBSOCKET MANAGER
  const { status, isConnected, startGame, addAIBot, removeAIBot } = useLobbyWebSocket({
    sessionToken,
    gameId,
    onLobbyJoined: (data) => {
      console.log('🎮 Lobby joined:', data)
      setGameCode(data.gameCode)
      setPlayers(data.players)
      setIsHost(data.isHost)
      setCanStart(data.canStart)
      setError(null)
    },
    onLobbyUpdate: (updatedPlayers, updatedCanStart) => {
      console.log('🎮 Lobby updated:', { players: updatedPlayers.length, canStart: updatedCanStart })
      setPlayers(updatedPlayers)
      setCanStart(updatedCanStart)
    },
    onGameStarted: () => {
      console.log('🎮 Game started, redirecting...')
      router.push(`/game/${gameId}`)
    },
    onError: (errorMessage) => {
      console.error('🎮 Lobby error:', errorMessage)
      setError(errorMessage)
    }
  })

  // Auto-join is now handled by the WebSocket hook automatically

  // Redirect if no user
  useEffect(() => {
    if (!user) {
      router.push('/')
    }
  }, [user, router])

  if (!user || !profile) {
    return <div>Loading...</div>
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Connection Status */}
        <div className="mb-4 text-sm text-muted-foreground">
          Connection: {status} {isConnected && '🟢'}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-destructive">{error}</p>
          </div>
        )}

                 {/* Game Lobby */}
         <GameLobby
           gameCode={gameCode}
           players={players}
           isHost={isHost}
           canStart={canStart}
           maxPlayers={4}
           onStartGame={startGame}
           onLeave={() => router.push('/')}
           onAddAIBot={addAIBot}
           onRemoveAIBot={removeAIBot}
         />
      </div>
    </div>
  )
} 