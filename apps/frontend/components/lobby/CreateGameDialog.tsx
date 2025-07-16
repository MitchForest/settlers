'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { ChevronDownIcon } from 'lucide-react'
import { toast } from 'sonner'

interface CreateGameDialogProps {
  open: boolean
  onClose: () => void
  onGameCreated: (gameCode: string, gameId: string) => void
}

export function CreateGameDialog({ open, onClose, onGameCreated }: CreateGameDialogProps) {
  const [playerCount, setPlayerCount] = useState<3 | 4>(4)
  const [playerName, setPlayerName] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const handleCreateGame = async () => {
    if (!playerName.trim()) {
      toast.error('Please enter your name')
      return
    }
    
    setIsCreating(true)
    try {
      const response = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerNames: [playerName],
          hostPlayerName: playerName
        })
      })
      
      const data = await response.json()
      if (data.success) {
        onGameCreated(data.gameCode, data.gameId)
        onClose()
        toast.success(`Game created! Code: ${data.gameCode}`)
      } else {
        toast.error(data.error || 'Failed to create game')
      }
    } catch (_error) {
      toast.error('Failed to create game')
    } finally {
      setIsCreating(false)
    }
  }

  const handleClose = () => {
    if (!isCreating) {
      setPlayerName('')
      setPlayerCount(4)
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Game</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="playerName">Your Name</Label>
            <Input 
              id="playerName"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your name"
              disabled={isCreating}
              maxLength={20}
            />
          </div>
          <div className="space-y-2">
            <Label>Number of Players</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  className="w-full justify-between"
                  disabled={isCreating}
                >
                  {playerCount} Players
                  <ChevronDownIcon className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-full">
                <DropdownMenuItem onClick={() => setPlayerCount(3)}>
                  3 Players
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPlayerCount(4)}>
                  4 Players
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button 
            onClick={handleClose} 
            variant="outline" 
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleCreateGame}
            disabled={!playerName.trim() || isCreating}
          >
            {isCreating ? 'Creating...' : 'Create Game'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 