'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Copy, Users, Eye, EyeOff, Globe, Lock, Check } from 'lucide-react'
import { toast } from 'sonner'

// Avatar emojis for selection
const AVATAR_EMOJIS = [
  '🧙‍♂️', '🧙‍♀️', '👨‍🌾', '👩‍🌾', '👨‍🏭', '👩‍🏭', '👨‍💼', '👩‍💼',
  '👨‍🔬', '👩‍🔬', '👨‍🎨', '👩‍🎨', '👨‍🍳', '👩‍🍳', '👨‍⚕️', '👩‍⚕️',
  '🤴', '👸', '👨‍🚀', '👩‍🚀', '👨‍✈️', '👩‍✈️', '🕵️‍♂️', '🕵️‍♀️',
  '👨‍🦱', '👩‍🦱', '👨‍🦰', '👩‍🦰', '👨‍🦳', '👩‍🦳', '👨‍🦲', '👩‍🦲'
]

interface CreateGameDialogProps {
  open: boolean
  onClose: () => void
  onGameCreated: (gameCode: string, gameId: string) => void
}

export function CreateGameDialog({ open, onClose, onGameCreated }: CreateGameDialogProps) {
  // Game settings
  const [playerCount, setPlayerCount] = useState<3 | 4>(4)
  const [allowObservers, setAllowObservers] = useState(true)
  const [isPublic, setIsPublic] = useState(true)
  
  // Player info
  const [playerName, setPlayerName] = useState('')
  const [selectedAvatar, setSelectedAvatar] = useState('🧙‍♂️')
  
  // UI states
  const [isCreating, setIsCreating] = useState(false)
  const [step, setStep] = useState<'setup' | 'lobby'>('setup')
  const [gameCode, setGameCode] = useState('')
  const [gameId, setGameId] = useState('')

  const handleCreateGame = async () => {
    if (!playerName.trim()) {
      toast.error('Please enter your display name')
      return
    }
    
    setIsCreating(true)
    try {
      const response = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostPlayerName: playerName.trim(),
          hostPlayerAvatar: selectedAvatar,
          maxPlayers: playerCount,
          allowObservers,
          isPublic,
          playerNames: [playerName.trim()]
        })
      })
      
      const data = await response.json()
      if (data.success) {
        setGameCode(data.gameCode)
        setGameId(data.gameId)
        
        if (isPublic) {
          // Public game - go straight to lobby
          onGameCreated(data.gameCode, data.gameId)
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
    onGameCreated(gameCode, gameId)
    handleClose()
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(gameCode)
    toast.success('Game code copied to clipboard!')
  }

  const handleClose = () => {
    if (!isCreating) {
      setPlayerName('')
      setSelectedAvatar('🧙‍♂️')
      setPlayerCount(4)
      setAllowObservers(true)
      setIsPublic(true)
      setStep('setup')
      setGameCode('')
      setGameId('')
      onClose()
    }
  }

  const isFormValid = playerName.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-black/30 backdrop-blur-sm border border-white/20 text-white">
        <DialogHeader>
          <DialogTitle className="text-white text-xl font-semibold">
            {step === 'setup' ? 'Create New Game' : 'Game Created!'}
          </DialogTitle>
        </DialogHeader>

        {step === 'setup' ? (
          <div className="space-y-6">
            {/* Player Info Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-white/90 border-b border-white/20 pb-2">
                Your Player Info
              </h3>
              
              {/* Avatar Picker */}
              <div className="space-y-2">
                <Label className="text-white/80">Avatar</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start bg-white/5 border-white/20 text-white hover:bg-white/10 hover:border-white/30"
                      disabled={isCreating}
                    >
                      <span className="text-2xl mr-3">{selectedAvatar}</span>
                      <span>Choose your avatar</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 bg-black/90 backdrop-blur-sm border border-white/20">
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-white">Choose Avatar</h4>
                      <div className="grid grid-cols-8 gap-2">
                        {AVATAR_EMOJIS.map((emoji) => (
                          <Button
                            key={emoji}
                            variant="ghost"
                            size="sm"
                            className={`w-10 h-10 p-0 text-xl transition-all ${
                              selectedAvatar === emoji 
                                ? 'bg-white/20 border border-white/40' 
                                : 'hover:bg-white/10'
                            }`}
                            onClick={() => setSelectedAvatar(emoji)}
                          >
                            {emoji}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Display Name */}
              <div className="space-y-2">
                <Label htmlFor="playerName" className="text-white/80">Display Name</Label>
                <Input 
                  id="playerName"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Enter your display name"
                  disabled={isCreating}
                  maxLength={20}
                  className="bg-white/5 border-white/20 text-white placeholder:text-white/50 focus:bg-white/10 focus:border-white/40"
                />
              </div>
            </div>

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
                disabled={!isFormValid || isCreating}
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