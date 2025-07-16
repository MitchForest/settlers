'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

interface JoinGameDialogProps {
  open: boolean
  onClose: () => void
  onGameJoined: (gameId: string, playerId: string) => void
}

export function JoinGameDialog({ open, onClose, onGameJoined }: JoinGameDialogProps) {
  const [gameCode, setGameCode] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [isJoining, setIsJoining] = useState(false)

  const handleJoinGame = async () => {
    if (!gameCode.trim() || !playerName.trim()) {
      toast.error('Please enter both game code and your name')
      return
    }
    
    setIsJoining(true)
    try {
      const response = await fetch('/api/games/join-by-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameCode: gameCode.toUpperCase(),
          playerName
        })
      })
      
      const data = await response.json()
      if (data.success) {
        onGameJoined(data.gameId, data.playerId)
        onClose()
        toast.success('Successfully joined game!')
      } else {
        toast.error(data.error || 'Failed to join game')
      }
    } catch (_error) {
      toast.error('Failed to join game')
    } finally {
      setIsJoining(false)
    }
  }

  const handleClose = () => {
    if (!isJoining) {
      setGameCode('')
      setPlayerName('')
      onClose()
    }
  }

  const handleGameCodeChange = (value: string) => {
    // Only allow alphanumeric characters and limit to 6 chars
    const filtered = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
    setGameCode(filtered)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Join Game</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="gameCode">Game Code</Label>
            <Input 
              id="gameCode"
              value={gameCode}
              onChange={(e) => handleGameCodeChange(e.target.value)}
              placeholder="Enter 6-character code"
              disabled={isJoining}
              className="font-mono text-center text-lg tracking-widest uppercase"
              maxLength={6}
            />
            <p className="text-xs text-muted-foreground">
              Enter the 6-character game code shared by the host
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="playerName">Your Name</Label>
            <Input 
              id="playerName"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your name"
              disabled={isJoining}
              maxLength={20}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button 
            onClick={handleClose} 
            variant="outline" 
            disabled={isJoining}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleJoinGame}
            disabled={!gameCode.trim() || !playerName.trim() || gameCode.length !== 6 || isJoining}
          >
            {isJoining ? 'Joining...' : 'Join Game'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 