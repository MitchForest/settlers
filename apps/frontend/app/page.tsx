'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

import { testConnection, healthCheck } from '@/lib/api'
import { toast } from 'sonner'

import { CreateGameDialog } from '@/components/lobby/CreateGameDialog'
import { JoinGameDialog } from '@/components/lobby/JoinGameDialog'
import { ObserveGameDialog } from '@/components/lobby/ObserveGameDialog'
import { MagicLinkDialog } from '@/components/auth/MagicLinkDialog'
import { ProfileSetupDialog } from '@/components/auth/ProfileSetupDialog'
import { UserAvatarMenu } from '@/components/auth/UserAvatarMenu'
import { useRouter } from 'next/navigation'
import { useGameStore } from '@/stores/gameStore'
import { useAuth } from '@/lib/auth-context'

// Terrain assets for honeycomb background
const TERRAIN_ASSETS = [
  { name: 'forest', image: '/themes/settlers/assets/terrains/forest.png' },
  { name: 'pasture', image: '/themes/settlers/assets/terrains/pasture.png' },
  { name: 'wheat', image: '/themes/settlers/assets/terrains/wheat.png' },
  { name: 'brick', image: '/themes/settlers/assets/terrains/brick.png' },
  { name: 'ore', image: '/themes/settlers/assets/terrains/ore.png' },
  { name: 'desert', image: '/themes/settlers/assets/terrains/desert.png' },
  { name: 'sea', image: '/themes/settlers/assets/terrains/sea.png' },
]

export default function Home() {
  const [apiStatus, setApiStatus] = useState<'testing' | 'connected' | 'failed'>('testing')
  const [dbStatus, setDbStatus] = useState<'unknown' | 'connected' | 'failed'>('unknown')
  const [showCreateGame, setShowCreateGame] = useState(false)
  const [showJoinGame, setShowJoinGame] = useState(false)
  const [showObserveGame, setShowObserveGame] = useState(false)
  const [showMagicLink, setShowMagicLink] = useState(false)
  const [pendingAction, setPendingAction] = useState<'create' | 'join' | 'observe' | null>(null)
  
  const router = useRouter()
  const { connectToLobby } = useGameStore()
  const { user, profile, loading: authLoading } = useAuth()

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

  const handleGameCreated = async (gameCode: string, gameId: string, hostPlayerId?: string) => {
    if (hostPlayerId) {
      connectToLobby(gameId, hostPlayerId)
      router.push(`/lobby/${gameId}`)
    } else {
      console.error('No host player ID provided to handleGameCreated')
      toast.error('Failed to join lobby - missing player ID')
    }
  }





  // Track if component has mounted to avoid hydration issues
  const [isMounted, setIsMounted] = useState(false)
  const [honeycombBackground, setHoneycombBackground] = useState<{
    id: string;
    x: number;
    y: number;
    terrain: typeof TERRAIN_ASSETS[0];
    animationDelay: number;
    animationDuration: number;
  }[]>([])

  useEffect(() => {
    // Generate honeycomb background after component mounts
    const hexes = []
    const hexRadius = 80
    const rows = 12
    const cols = 20
    
    // Simple seeded pseudo-random function for deterministic results
    const seededRandom = (seed: number) => {
      const x = Math.sin(seed) * 10000
      return x - Math.floor(x)
    }
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = col * (hexRadius * 1.5) - hexRadius
        const y = row * (hexRadius * Math.sqrt(3)) + (col % 2) * (hexRadius * Math.sqrt(3) / 2) - hexRadius
        
        const seed = row * cols + col
        const terrainIndex = Math.floor(seededRandom(seed) * TERRAIN_ASSETS.length)
        const terrain = TERRAIN_ASSETS[terrainIndex]
        
        const animationDelay = seededRandom(seed + 1000) * 5
        const animationDuration = 3 + seededRandom(seed + 2000) * 4
        
        hexes.push({
          id: `hex-${row}-${col}`,
          x,
          y,
          terrain,
          animationDelay,
          animationDuration,
        })
      }
    }
    
    setHoneycombBackground(hexes)
    setIsMounted(true)
  }, [])

  const isSystemConnected = apiStatus === 'connected' && dbStatus === 'connected'
  const needsProfile = user && !profile && !authLoading // Only show profile setup if not loading
  const isAuthenticated = user && profile

  // Handle authentication interception
  const handleGameAction = (action: 'create' | 'join' | 'observe') => {
    if (!isAuthenticated) {
      setPendingAction(action)
      setShowMagicLink(true)
      return
    }

    // User is authenticated, proceed with action
    switch (action) {
      case 'create':
        setShowCreateGame(true)
        break
      case 'join':
        setShowJoinGame(true)
        break
      case 'observe':
        setShowObserveGame(true)
        break
    }
  }

  // Handle successful authentication
  const handleAuthSuccess = () => {
    setShowMagicLink(false)
    // Profile setup dialog will show automatically if needed
  }

  // Handle profile setup completion
  const handleProfileComplete = () => {
    // After profile is created, proceed with pending action
    if (pendingAction) {
      switch (pendingAction) {
        case 'create':
          setShowCreateGame(true)
          break
        case 'join':
          setShowJoinGame(true)
          break
        case 'observe':
          setShowObserveGame(true)
          break
      }
      setPendingAction(null)
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-[#1a4b3a] via-[#2d5a47] to-[#1a4b3a]">
      {/* Client-side Honeycomb Background */}
      {isMounted && (
        <div className="absolute inset-0 overflow-hidden opacity-30">
          <svg className="w-full h-full" viewBox="0 0 1800 1200" preserveAspectRatio="xMidYMid slice">
            <defs>
              {TERRAIN_ASSETS.map(terrain => (
                <pattern key={terrain.name} id={`pattern-${terrain.name}`} patternUnits="objectBoundingBox" width="1" height="1">
                  <image href={terrain.image} x="0" y="0" width="160" height="160" preserveAspectRatio="xMidYMid slice"/>
                </pattern>
              ))}
            </defs>
            {honeycombBackground.map(hex => (
              <polygon
                key={hex.id}
                points="40,0 120,0 160,69 120,138 40,138 0,69"
                transform={`translate(${hex.x}, ${hex.y})`}
                fill={`url(#pattern-${hex.terrain.name})`}
                className="opacity-40 animate-pulse"
                style={{
                  animationDelay: `${hex.animationDelay}s`,
                  animationDuration: `${hex.animationDuration}s`
                }}
              />
            ))}
          </svg>
        </div>
      )}

      {/* Overlay gradient for better text contrast */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/40" />

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4">
        {/* Main Content */}
        <div className="text-center space-y-8 max-w-4xl mx-auto">
          {/* Title */}
          <div className="space-y-4">
            <h1 className="text-7xl md:text-8xl font-bold text-white drop-shadow-2xl tracking-tight">
              Settlers
            </h1>
            <div className="max-w-2xl mx-auto space-y-2">
              <p className="text-xl md:text-2xl text-white/90 font-medium">
              A 3–4 player strategy game to collect, build, and dominate.
              </p>
              <p className="text-sm text-white/60 italic">
                For educational purposes only.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
            <Button 
              onClick={() => handleGameAction('create')}
              size="lg"
              disabled={!isSystemConnected}
              className="w-full sm:w-auto bg-black/30 backdrop-blur-sm border border-white/20 text-white hover:bg-black/40 hover:border-white/30 transition-all duration-200 px-8 py-4 text-lg font-medium"
            >
              Create
            </Button>
            
            <Button 
              onClick={() => handleGameAction('join')}
              size="lg"
              disabled={!isSystemConnected}
              className="w-full sm:w-auto bg-black/30 backdrop-blur-sm border border-white/20 text-white hover:bg-black/40 hover:border-white/30 transition-all duration-200 px-8 py-4 text-lg font-medium"
            >
              Join
            </Button>
            
            <Button 
              onClick={() => handleGameAction('observe')}
              size="lg"
              disabled={!isSystemConnected}
              className="w-full sm:w-auto bg-black/30 backdrop-blur-sm border border-white/20 text-white hover:bg-black/40 hover:border-white/30 transition-all duration-200 px-8 py-4 text-lg font-medium"
            >
              Observe
            </Button>
          </div>
          
          {!isSystemConnected && (
            <p className="text-white/60 text-sm bg-black/20 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/10">
              Connecting to backend... Multiplayer features will be available once connected.
            </p>
          )}
        </div>

        {/* User Avatar Menu (bottom left) */}
        <UserAvatarMenu />

        {/* Credits (center bottom) */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
          <p className="text-white/60 text-sm">
            By{' '}
            <a 
              href="https://x.com/MitchForest" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-white/80 hover:text-white transition-colors underline"
            >
              @MitchForest
            </a>
          </p>
        </div>

        {/* System Status Indicator */}
        <div className="absolute bottom-8 right-8">
          {isSystemConnected && (
            <div className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg p-3 flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-sm text-green-400">Live</span>
            </div>
          )}
        </div>
      </div>

      {/* Authentication Dialogs */}
      <MagicLinkDialog
        open={showMagicLink}
        onClose={() => {
          setShowMagicLink(false)
          setPendingAction(null)
        }}
        onSuccess={handleAuthSuccess}
        title={pendingAction ? `Sign in to ${pendingAction} game` : "Join the Game!"}
        description="Enter your email to sign in and continue"
      />

      <ProfileSetupDialog
        open={!!needsProfile}
        onComplete={handleProfileComplete}
      />

      {/* Game Dialogs */}
      <CreateGameDialog
        open={showCreateGame}
        onClose={() => setShowCreateGame(false)}
        onGameCreated={handleGameCreated}
      />

      <JoinGameDialog
        open={showJoinGame}
        onOpenChange={setShowJoinGame}
      />

      <ObserveGameDialog
        open={showObserveGame}
        onOpenChange={setShowObserveGame}
      />
    </div>
  )
}
