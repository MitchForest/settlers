'use client'

import { Player } from '@settlers/core'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, Crown, Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface GameLobbyProps {
  gameCode: string
  players: Player[]
  isHost: boolean
  canStart: boolean
  onStartGame: () => void
  onLeave: () => void
}

export function GameLobby({ gameCode, players, isHost, canStart, onStartGame, onLeave }: GameLobbyProps) {
  const [codeCopied, setCodeCopied] = useState(false)

  const copyGameCode = async () => {
    try {
      await navigator.clipboard.writeText(gameCode)
      setCodeCopied(true)
      toast.success('Game code copied!')
      setTimeout(() => setCodeCopied(false), 2000)
    } catch (_error) {
      toast.error('Failed to copy code')
    }
  }

  // Define player colors based on index
  const getPlayerColor = (index: number) => {
    const colors = [
      'hsl(0, 60%, 50%)',    // Red
      'hsl(120, 60%, 50%)',  // Green  
      'hsl(240, 60%, 50%)',  // Blue
      'hsl(60, 60%, 50%)'    // Yellow
    ]
    return colors[index] || 'hsl(180, 60%, 50%)'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="container mx-auto max-w-4xl">
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold text-white">Game Lobby</h1>
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2">
              <span className="text-white">Game Code:</span>
              <code className="text-2xl font-mono font-bold text-yellow-400">{gameCode}</code>
              <Button
                variant="ghost"
                size="sm"
                onClick={copyGameCode}
                className="text-white hover:bg-white/20"
              >
                {codeCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-white/80">Share this code with friends to join the game</p>
          </div>

          {/* Players */}
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="h-5 w-5" />
                Players ({players.length}/4)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {players.map((player, index) => (
                  <div
                    key={player.id}
                    className="flex items-center gap-3 p-3 bg-white/5 rounded-lg"
                  >
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: getPlayerColor(index) }}
                    >
                      {player.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="text-white font-medium">{player.name}</div>
                      {index === 0 && (
                        <Badge variant="outline" className="text-yellow-400 border-yellow-400 mt-1">
                          <Crown className="h-3 w-3 mr-1" />
                          Host
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
                
                {/* Empty slots */}
                {Array.from({ length: 4 - players.length }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border-2 border-dashed border-white/20"
                  >
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                      <Users className="h-5 w-5 text-white/40" />
                    </div>
                    <div className="text-white/40">Waiting for player...</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center justify-center gap-4">
            {isHost ? (
              <Button
                onClick={onStartGame}
                disabled={!canStart}
                size="lg"
                className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
              >
                {canStart ? 'Start Game' : `Need ${3 - players.length} more players`}
              </Button>
            ) : (
              <div className="text-center text-white/60">
                Waiting for host to start the game...
              </div>
            )}
            
            <Button
              onClick={onLeave}
              variant="outline"
              size="lg"
              className="border-white/20 text-white hover:bg-white/10"
            >
              Leave Lobby
            </Button>
          </div>

          {/* Instructions */}
          <Card className="bg-white/5 backdrop-blur-sm border-white/10">
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <h3 className="text-white font-medium">Game Rules</h3>
                <ul className="text-white/70 text-sm space-y-1">
                  <li>• First to 10 victory points wins</li>
                  <li>• Build settlements, cities, and roads to expand</li>
                  <li>• Trade resources with other players</li>
                  <li>• Use development cards for strategic advantages</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
} 