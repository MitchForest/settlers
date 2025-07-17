'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Search, Users, Globe, UserCheck } from 'lucide-react'
import { componentStyles, designSystem, ds } from '@/lib/design-system'
import { toast } from 'sonner'

interface JoinGameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Mock data for demonstration
const MOCK_GAMES = [
  {
    id: 'ABC123',
    hostName: 'Alice',
    hostAvatar: '🧙‍♀️',
    playerCount: 3,
    maxPlayers: 4,
    isPublic: true,
    status: 'waiting',
  },
  {
    id: 'DEF456', 
    hostName: 'Bob',
    hostAvatar: '🤖',
    playerCount: 2,
    maxPlayers: 4,
    isPublic: true,
    status: 'waiting',
  },
  {
    id: 'GHI789',
    hostName: 'Charlie',
    hostAvatar: '🐻',
    playerCount: 4,
    maxPlayers: 4,
    isPublic: false,
    status: 'full',
  },
]

export function JoinGameDialog({ open, onOpenChange }: JoinGameDialogProps) {
  const [gameCode, setGameCode] = useState('')
  const [searchMode, setSearchMode] = useState<'code' | 'browse'>('browse')
  const [isLoading, setIsLoading] = useState(false)

  const handleJoinByCode = async () => {
    if (!gameCode.trim()) {
      toast.error('Please enter a game code')
      return
    }

    setIsLoading(true)
    try {
      // TODO: Implement actual join logic
      await new Promise(resolve => setTimeout(resolve, 1000))
      toast.success('Joined game successfully!')
      onOpenChange(false)
    } catch (_error) {
      toast.error('Failed to join game')
    } finally {
      setIsLoading(false)
    }
  }

  const handleJoinGame = async (gameId: string) => {
    setIsLoading(true)
    try {
      // TODO: Implement actual join logic
      await new Promise(resolve => setTimeout(resolve, 1000))
      toast.success(`Joined game ${gameId}!`)
      onOpenChange(false)
    } catch (_error) {
      toast.error('Failed to join game')
    } finally {
      setIsLoading(false)
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
            Join Game
          </DialogTitle>
          <DialogDescription className={designSystem.text.muted}>
            Browse public games or enter a private game code to join
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">

          {/* Join Mode Toggle */}
          <div className="space-y-3">
            <Label className={designSystem.text.body}>How would you like to join?</Label>
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

          {/* Join by Code */}
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
                  Enter the 6-character code shared by the host
                </p>
              </div>
              
              <Button
                onClick={handleJoinByCode}
                disabled={isLoading || !gameCode.trim()}
                className={ds(componentStyles.buttonSecondary, 'w-full')}
              >
                {isLoading ? 'Joining...' : 'Join Game'}
              </Button>
            </div>
          )}

          {/* Browse Public Games */}
          {searchMode === 'browse' && (
            <div className="space-y-4">
              <Label className={designSystem.text.body}>Available Games</Label>
              
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {MOCK_GAMES.filter(game => game.isPublic && game.status !== 'full').length === 0 ? (
                  <div className={ds(
                    designSystem.glass.secondary,
                    'rounded-lg p-4 text-center'
                  )}>
                    <p className={designSystem.text.muted}>No public games available</p>
                    <p className={ds(designSystem.text.muted, 'text-sm mt-1')}>
                      Try joining with a game code instead
                    </p>
                  </div>
                ) : (
                  MOCK_GAMES
                    .filter(game => game.isPublic && game.status !== 'full')
                    .map((game) => (
                      <div
                        key={game.id}
                        className={ds(
                          designSystem.glass.secondary,
                          'rounded-lg p-3 space-y-2'
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
                              designSystem.accents.green.subtle,
                              'text-xs'
                            )}>
                              <Users className="w-3 h-3 mr-1" />
                              {game.playerCount}/{game.maxPlayers}
                            </Badge>
                            <Badge className={ds(
                              designSystem.accents.blue.subtle,
                              'text-xs'
                            )}>
                              <Globe className="w-3 h-3 mr-1" />
                              Public
                            </Badge>
                          </div>
                        </div>
                        
                        <Button
                          onClick={() => handleJoinGame(game.id)}
                          disabled={isLoading}
                          className={ds(componentStyles.buttonPrimary, 'w-full')}
                          size="sm"
                        >
                          <UserCheck className="w-4 h-4 mr-2" />
                          Join Game
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