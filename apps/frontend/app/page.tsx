'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { testConnection, healthCheck } from '@/lib/api'
import { toast } from 'sonner'
import Link from 'next/link'
import { CreateGameDialog } from '@/components/lobby/CreateGameDialog'
import { JoinGameDialog } from '@/components/lobby/JoinGameDialog'
import { useRouter } from 'next/navigation'
import { useGameStore } from '@/stores/gameStore'

export default function Home() {
  const [apiStatus, setApiStatus] = useState<'testing' | 'connected' | 'failed'>('testing')
  const [dbStatus, setDbStatus] = useState<'unknown' | 'connected' | 'failed'>('unknown')
  const [showCreateGame, setShowCreateGame] = useState(false)
  const [showJoinGame, setShowJoinGame] = useState(false)
  
  const router = useRouter()
  const { connectToLobby } = useGameStore()

  useEffect(() => {
    checkSystemStatus()
  }, [])

  const checkSystemStatus = async () => {
    try {
      // Test API connection
      await testConnection()
      setApiStatus('connected')
      
      // Test health endpoint
      const health = await healthCheck()
      setDbStatus(health.database ? 'connected' : 'failed')
      
      toast.success('System status checked')
    } catch {
      setApiStatus('failed')
      toast.error('Failed to connect to backend')
    }
  }

  const handleGameCreated = async (gameCode: string, gameId: string) => {
    // Get the host player ID from localStorage
    const hostPlayerId = localStorage.getItem('hostPlayerId')
    if (hostPlayerId) {
      connectToLobby(gameId, hostPlayerId)
      router.push(`/lobby/${gameId}`)
    }
  }

  const handleGameJoined = async (gameId: string, playerId: string) => {
    connectToLobby(gameId, playerId)
    router.push(`/lobby/${gameId}`)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge className="status-connected">✓ Connected</Badge>
      case 'failed':
      case 'error':
        return <Badge className="status-disconnected">✗ Failed</Badge>
      case 'testing':
        return <Badge className="status-testing">⟳ Testing...</Badge>
      default:
        return <Badge className="status-unknown">⚠ Unknown</Badge>
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center space-y-8">
          <h1 className="text-6xl font-bold text-white mb-8">
            Settlers
          </h1>
          
          <div className="flex items-center justify-center gap-6">
            <Button 
              onClick={() => setShowCreateGame(true)}
              size="lg"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={apiStatus !== 'connected'}
            >
              Create Game
            </Button>
            
            <Button 
              onClick={() => setShowJoinGame(true)}
              size="lg"
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10"
              disabled={apiStatus !== 'connected'}
            >
              Join Game
            </Button>
            
            <Link href="/game/demo">
              <Button 
                size="lg"
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10"
              >
                View Demo
              </Button>
            </Link>
          </div>
          
          {apiStatus !== 'connected' && (
            <p className="text-white/60 text-sm">
              Connecting to backend... Multiplayer features will be available once connected.
            </p>
          )}
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                System Status
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={checkSystemStatus}
                  disabled={apiStatus === 'testing'}
                >
                  Refresh
                </Button>
              </CardTitle>
              <CardDescription>
                Backend connectivity and health
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span>API Server</span>
                {getStatusBadge(apiStatus)}
              </div>
              <div className="flex justify-between items-center">
                <span>Database</span>
                {getStatusBadge(dbStatus)}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <CreateGameDialog
        open={showCreateGame}
        onClose={() => setShowCreateGame(false)}
        onGameCreated={handleGameCreated}
      />

      <JoinGameDialog
        open={showJoinGame}
        onClose={() => setShowJoinGame(false)}
        onGameJoined={handleGameJoined}
      />
    </div>
  )
}
