'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Copy, Users, Eye, EyeOff, Globe, Lock, Check } from 'lucide-react'
import { componentStyles, designSystem, ds } from '@/lib/design-system'
import { createGame } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { toast } from 'sonner'

interface CreateGameDialogProps {
  open: boolean
  onClose: () => void
  onGameCreated: (gameCode: string, gameId: string, hostPlayerId?: string) => void
}

export function CreateGameDialog({ open, onClose, onGameCreated }: CreateGameDialogProps) {
  const { profile, user } = useAuth()
  
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

  const handleCreateGame = async () => {
    if (!profile?.display_name || !user?.id) {
      toast.error('You must be logged in to create a game')
      return
    }
    
    setIsCreating(true)
    try {
      const data = await createGame({
        hostUserId: user.id,
        maxPlayers: playerCount,
        allowObservers,
        isPublic
      })
      
      if (data.success) {
        setGameCode(data.gameCode)
        setGameId(data.gameId)
        setHostPlayerId(data.hostPlayerId)
        
        if (isPublic) {
          // Public game - go straight to lobby
          onGameCreated(data.gameCode, data.gameId, data.hostPlayerId)
          handleClose()
          toast.success(`Game created! Code: ${data.gameCode}`)
        } else {
          // Private game - show invite step
          setStep('lobby')
          toast.success('Private game created! Share the code with friends')
        }
      } else {
        toast.error(data.error || 'Failed to create game')
      }
    } catch (_error) {
      toast.error('Failed to create game')
    } finally {
      setIsCreating(false)
    }
  }

  const handleJoinLobby = () => {
    onGameCreated(gameCode, gameId, hostPlayerId)
    handleClose()
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(gameCode)
    toast.success('Game code copied to clipboard!')
  }

  const handleClose = () => {
    if (!isCreating) {
      setPlayerCount(4)
      setAllowObservers(true)
      setIsPublic(true)
      setStep('setup')
      setGameCode('')
      setGameId('')
      setHostPlayerId('')
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={ds(componentStyles.glassCard, 'sm:max-w-md')}>
        <DialogHeader>
          <DialogTitle className={ds(designSystem.text.heading, 'text-xl')}>
            {step === 'setup' ? 'Create New Game' : 'Game Created!'}
          </DialogTitle>
          <DialogDescription className={designSystem.text.muted}>
            {step === 'setup' ? 'Configure your game settings and invite friends' : 'Share your game code with friends to join'}
          </DialogDescription>
        </DialogHeader>

        {step === 'setup' ? (
          <div className="space-y-6">
            {/* Player info removed - using user profile */}

            {/* Game Settings Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-white/90 border-b border-white/20 pb-2">
                Game Settings
              </h3>

              {/* Player Count */}
              <div className="space-y-2">
                <Label className="text-white/80">Number of Players</Label>
                <div className="flex gap-2">
                  <Button
                    variant={playerCount === 3 ? "default" : "outline"}
                    onClick={() => setPlayerCount(3)}
                    disabled={isCreating}
                    className={`flex-1 ${
                      playerCount === 3 
                        ? 'bg-white/20 text-white border-white/40' 
                        : 'bg-white/5 border-white/20 text-white hover:bg-white/10'
                    }`}
                  >
                    <Users className="w-4 h-4 mr-2" />
                    3 Players
                  </Button>
                  <Button
                    variant={playerCount === 4 ? "default" : "outline"}
                    onClick={() => setPlayerCount(4)}
                    disabled={isCreating}
                    className={`flex-1 ${
                      playerCount === 4 
                        ? 'bg-white/20 text-white border-white/40' 
                        : 'bg-white/5 border-white/20 text-white hover:bg-white/10'
                    }`}
                  >
                    <Users className="w-4 h-4 mr-2" />
                    4 Players
                  </Button>
                </div>
              </div>

              {/* Observers Toggle */}
              <div className="space-y-2">
                <Label className="text-white/80">Observers</Label>
                <div className="flex gap-2">
                  <Button
                    variant={allowObservers ? "default" : "outline"}
                    onClick={() => setAllowObservers(true)}
                    disabled={isCreating}
                    className={`flex-1 ${
                      allowObservers 
                        ? 'bg-white/20 text-white border-white/40' 
                        : 'bg-white/5 border-white/20 text-white hover:bg-white/10'
                    }`}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Allow
                  </Button>
                  <Button
                    variant={!allowObservers ? "default" : "outline"}
                    onClick={() => setAllowObservers(false)}
                    disabled={isCreating}
                    className={`flex-1 ${
                      !allowObservers 
                        ? 'bg-white/20 text-white border-white/40' 
                        : 'bg-white/5 border-white/20 text-white hover:bg-white/10'
                    }`}
                  >
                    <EyeOff className="w-4 h-4 mr-2" />
                    No Observers
                  </Button>
                </div>
              </div>

              {/* Public/Private Toggle */}
              <div className="space-y-2">
                <Label className="text-white/80">Game Visibility</Label>
                <div className="flex gap-2">
                  <Button
                    variant={isPublic ? "default" : "outline"}
                    onClick={() => setIsPublic(true)}
                    disabled={isCreating}
                    className={`flex-1 ${
                      isPublic 
                        ? 'bg-white/20 text-white border-white/40' 
                        : 'bg-white/5 border-white/20 text-white hover:bg-white/10'
                    }`}
                  >
                    <Globe className="w-4 h-4 mr-2" />
                    Public
                  </Button>
                  <Button
                    variant={!isPublic ? "default" : "outline"}
                    onClick={() => setIsPublic(false)}
                    disabled={isCreating}
                    className={`flex-1 ${
                      !isPublic 
                        ? 'bg-white/20 text-white border-white/40' 
                        : 'bg-white/5 border-white/20 text-white hover:bg-white/10'
                    }`}
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    Private
                  </Button>
                </div>
                <p className="text-xs text-white/60">
                  {isPublic 
                    ? 'Other players can find and join your game'
                    : 'Only players with the game code can join'
                  }
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Lobby/Invite Step */
          <div className="space-y-6">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-green-500/20 rounded-full flex items-center justify-center">
                <Check className="w-8 h-8 text-green-400" />
              </div>
              
              <div className="space-y-2">
                <p className="text-white/90">Your private game has been created!</p>
                <p className="text-sm text-white/60">Share this code with your friends:</p>
              </div>

              {/* Game Code Display */}
              <div className="bg-white/10 border border-white/20 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="text-center flex-1">
                    <p className="text-xs text-white/60 mb-1">Game Code</p>
                    <p className="text-2xl font-mono font-bold text-white tracking-wider">{gameCode}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyCode}
                    className="text-white/60 hover:text-white hover:bg-white/10"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Game Settings Summary */}
              <div className="flex flex-wrap gap-2 justify-center">
                <Badge className="bg-white/10 border-white/20 text-white">
                  <Users className="w-3 h-3 mr-1" />
                  {playerCount} Players
                </Badge>
                <Badge className="bg-white/10 border-white/20 text-white">
                  {allowObservers ? <Eye className="w-3 h-3 mr-1" /> : <EyeOff className="w-3 h-3 mr-1" />}
                  {allowObservers ? 'Observers' : 'No Observers'}
                </Badge>
                <Badge className="bg-white/10 border-white/20 text-white">
                  <Lock className="w-3 h-3 mr-1" />
                  Private
                </Badge>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 pt-4 border-t border-white/20">
          {step === 'setup' ? (
            <>
              <Button 
                onClick={handleClose} 
                variant="outline" 
                disabled={isCreating}
                className="bg-white/5 border-white/20 text-white hover:bg-white/10 hover:border-white/30"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleCreateGame}
                disabled={isCreating}
                className="bg-white/20 text-white border border-white/40 hover:bg-white/30 disabled:opacity-50"
              >
                {isCreating ? 'Creating...' : 'Create Game'}
              </Button>
            </>
          ) : (
            <>
              <Button 
                onClick={handleClose} 
                variant="outline"
                className="bg-white/5 border-white/20 text-white hover:bg-white/10 hover:border-white/30"
              >
                Close
              </Button>
              <Button 
                onClick={handleJoinLobby}
                className="bg-white/20 text-white border border-white/40 hover:bg-white/30"
              >
                Join Lobby
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 