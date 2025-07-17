'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Search, Users, Globe, Eye, Clock, Play } from 'lucide-react'
import { componentStyles, designSystem, ds } from '@/lib/design-system'
import { toast } from 'sonner'

interface ObserveGameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Mock data for demonstration
const MOCK_OBSERVABLE_GAMES = [
  {
    id: 'ABC123',
    hostName: 'Alice',
    hostAvatar: '🧙‍♀️',
    playerCount: 4,
    maxPlayers: 4,
    isPublic: true,
    status: 'playing',
    turnNumber: 12,
    currentPlayer: 'Bob',
    observers: 2,
  },
  {
    id: 'DEF456', 
    hostName: 'Charlie',
    hostAvatar: '🤖',
    playerCount: 3,
    maxPlayers: 4,
    isPublic: true,
    status: 'playing',
    turnNumber: 8,
    currentPlayer: 'Diana',
    observers: 0,
  },
  {
    id: 'GHI789',
    hostName: 'Eve',
    hostAvatar: '🐻',
    playerCount: 4,
    maxPlayers: 4,
    isPublic: true,
    status: 'finished',
    winner: 'Frank',
    observers: 5,
  },
  {
    id: 'JKL012',
    hostName: 'Grace',
    hostAvatar: '🧚‍♀️',
    playerCount: 2,
    maxPlayers: 4,
    isPublic: true,
    status: 'waiting',
    observers: 1,
  },
]

export function ObserveGameDialog({ open, onOpenChange }: ObserveGameDialogProps) {
  const [gameCode, setGameCode] = useState('')
  const [searchMode, setSearchMode] = useState<'code' | 'browse'>('browse')
  const [isLoading, setIsLoading] = useState(false)

  const handleObserveByCode = async () => {
    if (!gameCode.trim()) {
      toast.error('Please enter a game code')
      return
    }

    setIsLoading(true)
    try {
      // TODO: Implement actual observe logic
      await new Promise(resolve => setTimeout(resolve, 1000))
      toast.success('Started observing game!')
      onOpenChange(false)
    } catch (_error) {
      toast.error('Failed to observe game')
    } finally {
      setIsLoading(false)
    }
  }

  const handleObserveGame = async (gameId: string) => {
    setIsLoading(true)
    try {
      // TODO: Implement actual observe logic
      await new Promise(resolve => setTimeout(resolve, 1000))
      toast.success(`Started observing game ${gameId}!`)
      onOpenChange(false)
    } catch (_error) {
      toast.error('Failed to observe game')
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusBadge = (game: typeof MOCK_OBSERVABLE_GAMES[0]) => {
    switch (game.status) {
      case 'playing':
        return (
          <Badge className={ds(designSystem.accents.green.subtle, 'text-xs')}>
            <Play className="w-3 h-3 mr-1" />
            Playing (Turn {game.turnNumber})
          </Badge>
        )
      case 'waiting':
        return (
          <Badge className={ds(designSystem.accents.orange.subtle, 'text-xs')}>
            <Clock className="w-3 h-3 mr-1" />
            Waiting for Players
          </Badge>
        )
      case 'finished':
        return (
          <Badge className={ds(designSystem.accents.purple.subtle, 'text-xs')}>
            🏆 Finished ({game.winner} won)
          </Badge>
        )
      default:
        return null
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={ds(
        componentStyles.glassCard,
        'max-w-md'
      )}>
        <DialogHeader>
          <DialogTitle className={ds(designSystem.text.heading, 'text-xl')}>
            Observe Game
          </DialogTitle>
          <DialogDescription className={designSystem.text.muted}>
            Watch games in real-time as a spectator
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Info Section */}
          <div className={ds(
            designSystem.glass.secondary,
            'rounded-lg p-3'
          )}>
            <div className="flex items-center space-x-2 mb-2">
              <Eye className="w-4 h-4 text-blue-400" />
              <span className={ds(designSystem.text.body, 'font-medium')}>Observer Mode</span>
            </div>
            <p className={ds(designSystem.text.muted, 'text-sm')}>
              Watch games in real-time without participating. Perfect for learning strategies or enjoying the gameplay!
            </p>
          </div>

          {/* Search Mode Toggle */}
          <div className="space-y-3">
            <Label className={designSystem.text.body}>How would you like to find a game?</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => setSearchMode('browse')}
                className={ds(
                  searchMode === 'browse' 
                    ? componentStyles.buttonSecondary
                    : componentStyles.buttonPrimary
                )}
              >
                <Globe className="w-4 h-4 mr-2" />
                Browse Games
              </Button>
              <Button
                variant="outline"
                onClick={() => setSearchMode('code')}
                className={ds(
                  searchMode === 'code' 
                    ? componentStyles.buttonSecondary
                    : componentStyles.buttonPrimary
                )}
              >
                <Search className="w-4 h-4 mr-2" />
                Enter Code
              </Button>
            </div>
          </div>

          {/* Observe by Code */}
          {searchMode === 'code' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className={designSystem.text.body}>Game Code</Label>
                <Input
                  value={gameCode}
                  onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                  placeholder="ABC123"
                  className={componentStyles.input}
                  maxLength={6}
                />
                <p className={ds(designSystem.text.muted, 'text-sm')}>
                  Enter the 6-character code of any public or private game
                </p>
              </div>
              
              <Button
                onClick={handleObserveByCode}
                disabled={isLoading || !gameCode.trim()}
                className={ds(componentStyles.buttonSecondary, 'w-full')}
              >
                {isLoading ? 'Connecting...' : 'Start Observing'}
              </Button>
            </div>
          )}

          {/* Browse Observable Games */}
          {searchMode === 'browse' && (
            <div className="space-y-4">
              <Label className={designSystem.text.body}>Observable Games</Label>
              
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {MOCK_OBSERVABLE_GAMES.length === 0 ? (
                  <div className={ds(
                    designSystem.glass.secondary,
                    'rounded-lg p-4 text-center'
                  )}>
                    <p className={designSystem.text.muted}>No games available to observe</p>
                    <p className={ds(designSystem.text.muted, 'text-sm mt-1')}>
                      Try observing with a game code instead
                    </p>
                  </div>
                ) : (
                  MOCK_OBSERVABLE_GAMES.map((game) => (
                    <div
                      key={game.id}
                      className={ds(
                        designSystem.glass.secondary,
                        'rounded-lg p-3 space-y-3'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <span className="text-xl">{game.hostAvatar}</span>
                          <div>
                            <p className={designSystem.text.body}>{game.hostName}&apos;s Game</p>
                            <p className={ds(designSystem.text.muted, 'text-sm')}>
                              Code: {game.id}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Badge className={ds(
                            designSystem.accents.blue.subtle,
                            'text-xs'
                          )}>
                            <Users className="w-3 h-3 mr-1" />
                            {game.playerCount}/{game.maxPlayers}
                          </Badge>
                          <Badge className={ds(
                            designSystem.accents.purple.subtle,
                            'text-xs'
                          )}>
                            <Eye className="w-3 h-3 mr-1" />
                            {game.observers}
                          </Badge>
                        </div>
                      </div>

                      {/* Game Status */}
                      <div className="flex items-center justify-between">
                        {getStatusBadge(game)}
                        {game.status === 'playing' && game.currentPlayer && (
                          <span className={ds(designSystem.text.muted, 'text-xs')}>
                            {game.currentPlayer}&apos;s turn
                          </span>
                        )}
                      </div>
                      
                      <Button
                        onClick={() => handleObserveGame(game.id)}
                        disabled={isLoading}
                        className={ds(componentStyles.buttonPrimary, 'w-full')}
                        size="sm"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        {game.status === 'finished' ? 'Review Game' : 'Start Observing'}
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
} 