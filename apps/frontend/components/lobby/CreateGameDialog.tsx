'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
// Removed unused import: Input
import { Label } from '@/components/ui/label'
// Removed unused import: Badge
import { Copy, Users, Eye, EyeOff, Globe, Lock } from 'lucide-react'
// Removed unused imports: componentStyles, designSystem, ds
import { createGame } from '@/lib/api'
import { useUnifiedAuth } from '@/lib/unified-auth'
import { getGuestSession, getGuestDisplayName, getGuestAvatar } from '@/lib/guest-session'
import { toast } from 'sonner'

interface CreateGameDialogProps {
  open: boolean
  onClose: () => void
  onGameCreated: (gameCode: string, gameId: string, hostPlayerId?: string, lobbyUrl?: string) => void
}

export function CreateGameDialog({ open, onClose, onGameCreated }: CreateGameDialogProps) {
  const { profile, user } = useUnifiedAuth()
  const isGuest = !user
  
  // Game settings
  const [playerCount, setPlayerCount] = useState<3 | 4>(4)
  const [allowObservers, setAllowObservers] = useState(true)
  const [isPublic, setIsPublic] = useState(true)
  
  // UI states
  const [isCreating, setIsCreating] = useState(false)
  const [step, setStep] = useState<'setup' | 'lobby'>('setup')
  const [gameCode, setGameCode] = useState('')
  const [gameId, setGameId] = useState('')
  const [hostPlayerId, setHostPlayerId] = useState('')
  const [lobbyUrl, setLobbyUrl] = useState('')

  const handleCreateGame = async () => {
    setIsCreating(true)
    try {
      let gameData
      
      if (isGuest) {
        // Guest user - use guest session data
        const guestSession = getGuestSession()
        gameData = {
          hostPlayerName: guestSession.name,
          hostAvatarEmoji: guestSession.avatarEmoji,
          hostUserId: null, // No user ID for guests
          maxPlayers: playerCount,
          allowObservers,
          isPublic
        }
      } else {
        // Authenticated user
        if (!user?.id) {
          toast.error('Authentication error - please try signing in again')
          return
        }
        
        gameData = {
          hostPlayerName: profile?.name || 'Player',
          hostAvatarEmoji: profile?.avatarEmoji || '🧙‍♂️',
          hostUserId: user.id,
          maxPlayers: playerCount,
          allowObservers,
          isPublic
        }
      }
      
      const data = await createGame(gameData)
      
      if (data.success) {
        setGameCode(data.data.gameCode)
        setGameId(data.data.gameId)
        setHostPlayerId(data.data.hostPlayerId)
        setLobbyUrl(data.data.sessionUrl || '')
        
        if (isPublic) {
          // Public game - go straight to lobby
          onGameCreated(data.data.gameCode, data.data.gameId, data.data.hostPlayerId, data.data.sessionUrl)
          handleClose()
          toast.success(`Game created! Code: ${data.data.gameCode}`)
        } else {
          // Private game - show invite step
          setStep('lobby')
          toast.success('Private game created! Share the code with friends')
        }
      } else {
        toast.error(data.error || 'Failed to create game')
      }
    } catch (error) {
      console.error('Create game error:', error)
      toast.error('Failed to create game')
    } finally {
      setIsCreating(false)
    }
  }

  const handleJoinLobby = () => {
    onGameCreated(gameCode, gameId, hostPlayerId, lobbyUrl)
    handleClose()
  }

  const handleClose = () => {
    setStep('setup')
    setGameCode('')
    setGameId('')
    setHostPlayerId('')
    setLobbyUrl('')
    onClose()
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copied to clipboard!')
    } catch {
      toast.error('Failed to copy to clipboard')
    }
  }

  const getCurrentPlayerName = () => {
    if (isGuest) {
      return getGuestDisplayName()
    }
    return profile?.name || user?.email || 'Player'
  }

  const getCurrentPlayerAvatar = () => {
    if (isGuest) {
      return getGuestAvatar()
    }
    return profile?.avatarEmoji || '🧙‍♂️'
  }

  if (step === 'lobby') {
    return (
      <Dialog open={open} onOpenChange={() => handleClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              🎯 Game Created!
            </DialogTitle>
            <DialogDescription>
              Your game is ready. Share the code with friends to invite them.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Game Code Display */}
            <div className="text-center space-y-3">
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-6">
                <Label className="text-sm text-muted-foreground mb-2 block">Game Code</Label>
                <div className="text-3xl font-mono font-bold text-primary tracking-wider">
                  {gameCode}
                </div>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(gameCode)}
                className="w-full"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy Game Code
              </Button>
            </div>

            {/* Game Settings Summary */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Players</span>
                <span>{playerCount} max</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Observers</span>
                <span>{allowObservers ? 'Allowed' : 'Not allowed'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Visibility</span>
                <div className="flex items-center gap-1">
                  {isPublic ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                  <span>{isPublic ? 'Public' : 'Private'}</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleJoinLobby} className="w-full">
              Join Lobby
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={() => handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            🎯 Create New Game
          </DialogTitle>
          <DialogDescription>
            Set up your game preferences and invite friends to play.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Player Info */}
          <div className="bg-muted/50 rounded-lg p-4">
            <Label className="text-sm font-medium mb-2 block">You will join as</Label>
            <div className="flex items-center gap-3">
              <div className="text-2xl">{getCurrentPlayerAvatar()}</div>
              <div>
                <div className="font-medium">{getCurrentPlayerName()}</div>
                <div className="text-sm text-muted-foreground">
                  {isGuest ? 'Guest Player' : 'Registered Player'}
                </div>
              </div>
            </div>
          </div>

          {/* Player Count */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Maximum Players</Label>
            <div className="flex gap-2">
              {[3, 4].map((count) => (
                <Button
                  key={count}
                  variant={playerCount === count ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPlayerCount(count as 3 | 4)}
                  className="flex-1"
                >
                  <Users className="w-4 h-4 mr-1" />
                  {count}
                </Button>
              ))}
            </div>
          </div>

          {/* Game Options */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Game Options</Label>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {allowObservers ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                <span className="text-sm">Allow Observers</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAllowObservers(!allowObservers)}
              >
                {allowObservers ? 'Enabled' : 'Disabled'}
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isPublic ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                <span className="text-sm">Public Game</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPublic(!isPublic)}
              >
                {isPublic ? 'Public' : 'Private'}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateGame}
            disabled={isCreating}
            className="min-w-24"
          >
            {isCreating ? 'Creating...' : 'Create Game'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 