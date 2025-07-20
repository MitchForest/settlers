'use client'

import { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, Users, Globe, Heart, Clock } from 'lucide-react'
import { componentStyles, designSystem, ds } from '@/lib/design-system'
import { toast } from 'sonner'
import { getAvailableGames, getGameByCode, type GameInfo, type AvailableGamesFilters } from '@/lib/api'
import { useUnifiedAuth } from '@/lib/unified-auth'

interface JoinGameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface GameFilters extends AvailableGamesFilters {
  showFullGames: boolean
}

function GameCard({ game, onJoin, isLoading }: { 
  game: GameInfo
  onJoin: (gameId: string) => void
  isLoading: boolean
}) {
  const isFull = game.playerCount >= game.maxPlayers
  const isFriend = !!game.hostFriend
  
  return (
    <Card className={ds(
      componentStyles.glassCard,
      isFriend && 'ring-2 ring-blue-500/50 bg-blue-500/5'
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{game.hostAvatarEmoji}</span>
            <div>
              <CardTitle className="text-sm text-white flex items-center gap-2">
                {game.hostPlayerName}
                {isFriend && (
                  <Badge variant="secondary" className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">
                    <Heart className="w-3 h-3 mr-1" />
                    Friend
                  </Badge>
                )}
              </CardTitle>
              <p className="text-xs text-white/60">Game: {game.gameCode}</p>
            </div>
          </div>
          <Badge 
            variant="secondary" 
            className={ds(
              isFull 
                ? 'bg-red-500/20 text-red-300 border-red-500/30'
                : 'bg-green-500/20 text-green-300 border-green-500/30'
            )}
          >
            {game.playerCount}/{game.maxPlayers}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs text-white/60">
            <div className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {game.phase === 'lobby' ? 'Waiting' : 'In Game'}
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(game.createdAt).toLocaleTimeString()}
            </div>
          </div>
          <Button
            onClick={() => onJoin(game.id)}
            disabled={isFull || isLoading}
            size="sm"
            className={ds(
              isFriend 
                ? componentStyles.buttonPrimary
                : componentStyles.buttonSecondary,
              'h-8 px-3'
            )}
          >
            {isFull ? 'Full' : 'Join'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function GamesList({ 
  title, 
  games, 
  onJoin, 
  isLoading, 
  emptyMessage 
}: {
  title: string
  games: GameInfo[]
  onJoin: (gameId: string) => void
  isLoading: boolean
  emptyMessage: string
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    )
  }

  if (games.length === 0) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <div className="text-center py-8 text-white/60">
          <p className="text-sm">{emptyMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
        {title}
        <Badge variant="secondary" className="bg-white/10 text-white/70 text-xs">
          {games.length}
        </Badge>
      </h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {games.map(game => (
          <GameCard
            key={game.id}
            game={game}
            onJoin={onJoin}
            isLoading={isLoading}
          />
        ))}
      </div>
    </div>
  )
}

export function JoinGameDialog({ open, onOpenChange }: JoinGameDialogProps) {
  const { user } = useUnifiedAuth()
  const isGuest = !user
  const [gameCode, setGameCode] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState<GameFilters>({
    phase: 'lobby',
    showFullGames: false,
    limit: 20
  })
  const [games, setGames] = useState<{ friendsGames: GameInfo[]; publicGames: GameInfo[] }>({
    friendsGames: [],
    publicGames: []
  })
  const [isLoading, setIsLoading] = useState(false)
  const [joinLoading, setJoinLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load available games
  const loadGames = useCallback(async () => {
    if (!open) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      const apiFilters: AvailableGamesFilters = {
        phase: filters.phase,
        search: searchQuery || undefined,
        limit: filters.limit
      }
      
      const response = await getAvailableGames(apiFilters)
      
      // Filter out full games if needed
      const filterFullGames = (gameList: GameInfo[]) => 
        filters.showFullGames ? gameList : gameList.filter(g => g.playerCount < g.maxPlayers)
      
      setGames({
        friendsGames: filterFullGames(response.friendsGames),
        publicGames: filterFullGames(response.publicGames)
      })
    } catch (err) {
      let errorMessage = 'Failed to load games'
      
      if (err instanceof Error) {
        // Handle specific error types
        if (err.message.includes('fetch')) {
          errorMessage = 'Network error - please check your connection'
        } else if (err.message.includes('401') || err.message.includes('unauthorized')) {
          errorMessage = 'Session expired - please refresh the page'
        } else if (err.message.includes('500')) {
          errorMessage = 'Server error - please try again in a moment'
        } else {
          errorMessage = err.message
        }
      }
      
      setError(errorMessage)
      toast.error(errorMessage)
      
      // Log error for debugging
      console.error('Error loading games:', err)
    } finally {
      setIsLoading(false)
    }
  }, [filters, open, searchQuery])

  // Load games when dialog opens or filters change
  useEffect(() => {
    loadGames()
  }, [open, searchQuery, filters, loadGames])

  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => {
      if (error && error.includes('Network error')) {
        toast.success('Connection restored! Refreshing games...')
        loadGames()
      }
    }

    const handleOffline = () => {
      toast.error('You are offline. Some features may not work.')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [error, loadGames])

  const handleJoinByCode = async () => {
    const trimmedCode = gameCode.trim().toUpperCase()
    
    if (!trimmedCode) {
      toast.error('Please enter a game code')
      return
    }

    if (trimmedCode.length !== 6) {
      toast.error('Game code must be 6 characters long')
      return
    }

    setJoinLoading(true)
    try {
      // First verify the game exists
      const game = await getGameByCode(trimmedCode)
      
      if (game.playerCount >= game.maxPlayers) {
        toast.error(`This game is full (${game.playerCount}/${game.maxPlayers} players)`)
        return
      }

      if (game.phase !== 'lobby') {
        toast.error('This game has already started and cannot be joined')
        return
      }
      
      // TODO: Implement actual join logic with lobby integration
      toast.success(`Found game hosted by ${game.hostPlayerName}! Joining...`)
      
      // For now, just navigate to the game
      window.location.href = `/lobby/${game.id}`
      onOpenChange(false)
    } catch (err) {
      let errorMessage = 'Failed to join game'
      
      if (err instanceof Error) {
        if (err.message.includes('Game not found') || err.message.includes('404')) {
          errorMessage = `Game "${trimmedCode}" not found. Check the code and try again.`
        } else if (err.message.includes('401') || err.message.includes('unauthorized')) {
          errorMessage = 'Session expired - please refresh the page'
        } else if (err.message.includes('fetch') || err.message.includes('network')) {
          errorMessage = 'Network error - please check your connection and try again'
        } else if (err.message.includes('500')) {
          errorMessage = 'Server error - please try again in a moment'
        } else {
          errorMessage = err.message
        }
      }
      
      toast.error(errorMessage)
      console.error('Error joining game by code:', err)
    } finally {
      setJoinLoading(false)
    }
  }

  const handleJoinGame = async (gameId: string) => {
    setJoinLoading(true)
    try {
      // TODO: Implement actual join logic with lobby integration
      toast.success('Joining game...')
      
      // For now, just navigate to the game
      window.location.href = `/lobby/${gameId}`
      onOpenChange(false)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to join game'
      toast.error(errorMessage)
    } finally {
      setJoinLoading(false)
    }
  }

  const totalGames = games.friendsGames.length + games.publicGames.length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={ds(
        componentStyles.glassCard,
        'max-w-2xl max-h-[80vh] overflow-hidden flex flex-col'
      )}>
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className={ds(designSystem.text.heading, 'text-xl')}>
            Join Game
          </DialogTitle>
          <DialogDescription className={designSystem.text.muted}>
            {isGuest 
              ? 'Browse public games or enter a game code to join as a guest'
              : 'Find games hosted by friends or browse public games'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="browse" className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
              <TabsTrigger value="browse" className="flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Browse Games
                {totalGames > 0 && (
                  <Badge variant="secondary" className="bg-blue-500/20 text-blue-300 text-xs">
                    {totalGames}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="code" className="flex items-center gap-2">
                <Search className="w-4 h-4" />
                Game Code
              </TabsTrigger>
            </TabsList>

            <TabsContent value="browse" className="flex-1 mt-4 overflow-hidden flex flex-col">
              {/* Search and Filters */}
              <div className="space-y-3 flex-shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/60" />
                  <Input
                    placeholder="Search games by host name or code..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={ds(componentStyles.input, 'pl-10')}
                  />
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-white/60">Phase:</Label>
                    <select
                      value={filters.phase || 'lobby'}
                      onChange={(e) => setFilters(prev => ({ 
                        ...prev, 
                        phase: e.target.value as 'lobby' | 'initial_placement' | 'main_game' 
                      }))}
                      className="bg-white/10 border border-white/20 rounded px-2 py-1 text-xs text-white"
                    >
                      <option value="lobby">Waiting to Start</option>
                      <option value="initial_placement">Starting</option>
                      <option value="main_game">In Progress</option>
                    </select>
                  </div>
                  
                  <label className="flex items-center gap-2 text-xs text-white/60">
                    <input
                      type="checkbox"
                      checked={filters.showFullGames}
                      onChange={(e) => setFilters(prev => ({ ...prev, showFullGames: e.target.checked }))}
                      className="rounded"
                    />
                    Show full games
                  </label>
                </div>
              </div>

              {/* Games List */}
              <div className="flex-1 overflow-y-auto mt-4 space-y-4">
                {error ? (
                  <div className="text-center py-8">
                    <p className="text-red-400 text-sm">{error}</p>
                    <Button 
                      onClick={loadGames} 
                      variant="outline" 
                      size="sm" 
                      className="mt-2"
                    >
                      Retry
                    </Button>
                  </div>
                ) : (
                  <>
                    {!isGuest && (
                      <GamesList
                        title="Friends' Games"
                        games={games.friendsGames}
                        onJoin={handleJoinGame}
                        isLoading={isLoading}
                        emptyMessage="No friends are currently hosting games"
                      />
                    )}
                    
                    <GamesList
                      title="Public Games"
                      games={games.publicGames}
                      onJoin={handleJoinGame}
                      isLoading={isLoading}
                      emptyMessage="No public games available"
                    />
                  </>
                )}
              </div>
            </TabsContent>

            <TabsContent value="code" className="mt-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className={designSystem.text.body}>Game Code</Label>
                  <Input
                    placeholder="Enter 6-character game code (e.g. ABC123)"
                    value={gameCode}
                    onChange={(e) => setGameCode(e.target.value.toUpperCase().slice(0, 6))}
                    className={componentStyles.input}
                    maxLength={6}
                  />
                  <p className="text-xs text-white/60">
                    Ask the host for their game code to join a private game
                  </p>
                </div>

                <Button
                  onClick={handleJoinByCode}
                  disabled={!gameCode.trim() || joinLoading}
                  className={componentStyles.buttonPrimary}
                >
                  {joinLoading ? 'Joining...' : 'Join Game'}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
} 