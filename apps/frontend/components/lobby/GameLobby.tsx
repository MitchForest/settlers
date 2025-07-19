'use client'

import type { LobbyPlayer } from '@/lib/types/lobby-types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, Crown, Copy, Check, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { AddAIBotDialog } from './AddAIBotDialog'
import { ds, componentStyles, designSystem } from '@/lib/design-system'

interface GameLobbyProps {
  gameCode: string
  players: LobbyPlayer[]
  isHost: boolean
  canStart: boolean
  maxPlayers: number
  onStartGame: () => void
  onLeave: () => void
  onAddAIBot?: (difficulty: 'easy' | 'medium' | 'hard', personality: 'aggressive' | 'balanced' | 'defensive' | 'economic') => void
  onRemoveAIBot?: (botPlayerId: string) => void
}

export function GameLobby({ 
  gameCode, 
  players, 
  isHost, 
  canStart, 
  maxPlayers: _maxPlayers,
  onStartGame, 
  onLeave,
  onAddAIBot,
  onRemoveAIBot 
}: GameLobbyProps) {
  const [codeCopied, setCodeCopied] = useState(false)
  const [showAddBotDialog, setShowAddBotDialog] = useState(false)
  const [isAddingBot, setIsAddingBot] = useState(false)
  const [removingBotIds, setRemovingBotIds] = useState<Set<string>>(new Set())

  const copyGameCode = () => {
    navigator.clipboard.writeText(gameCode)
    setCodeCopied(true)
    toast.success('Game code copied to clipboard!')
    setTimeout(() => setCodeCopied(false), 2000)
  }

  // Check if a player is a guest (user ID starts with "guest_")
  const isGuestPlayer = (player: LobbyPlayer) => {
    return player.userId?.startsWith('guest_') || false
  }

  const handleAddBot = async (difficulty: 'easy' | 'medium' | 'hard', personality: 'aggressive' | 'balanced' | 'defensive' | 'economic') => {
    if (!onAddAIBot) return
    
    setIsAddingBot(true)
    try {
      await onAddAIBot(difficulty, personality)
      setShowAddBotDialog(false)
      toast.success('AI bot added to the lobby')
    } catch (_error) {
      toast.error('Failed to add AI bot')
    } finally {
      setIsAddingBot(false)
    }
  }

  const handleRemoveBot = async (botPlayerId: string) => {
    if (!onRemoveAIBot) return
    
    setRemovingBotIds(prev => new Set([...prev, botPlayerId]))
    try {
      await onRemoveAIBot(botPlayerId)
      toast.success('AI bot removed from the lobby')
    } catch (_error) {
      toast.error('Failed to remove AI bot')
    } finally {
      setRemovingBotIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(botPlayerId)
        return newSet
      })
    }
  }

  const handleCloseDialog = () => {
    setShowAddBotDialog(false)
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
    <div className="py-8 px-4">
      <div className="container mx-auto max-w-6xl">
        <div className="space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <h1 className={ds(designSystem.text.heading, 'text-4xl font-bold')}>Game Lobby</h1>
            <div className={ds(componentStyles.glassCard, 'inline-flex items-center gap-3 rounded-lg px-6 py-3 border-white/30')}>
              <span className={ds(designSystem.text.body, 'text-lg')}>Game Code:</span>
              <code className="text-3xl font-mono font-bold text-yellow-400">{gameCode}</code>
              <Button
                variant="ghost"
                size="sm"
                onClick={copyGameCode}
                className={ds(
                  componentStyles.buttonSecondary,
                  'rounded-md hover:scale-105 transition-all duration-200'
                )}
              >
                {codeCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className={ds(designSystem.text.muted, 'text-lg')}>Share this code with friends to join the game</p>
          </div>

          {/* Main Content Grid */}
          <div className="grid lg:grid-cols-2 gap-8 items-start">
            {/* Left Column - Players */}
            <Card className={ds(componentStyles.glassCard, 'border-white/20')}>
              <CardHeader>
                <CardTitle className={ds(designSystem.text.heading, 'flex items-center gap-2')}>
                  <Users className="h-5 w-5" />
                  Players ({players.length}/4)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {/* Player Slots - Always show 4 slots */}
                  {Array.from({ length: 4 }).map((_, slotIndex) => {
                    const player = players[slotIndex]
                    
                    if (player) {
                      // Occupied slot
                      return (
                        <div
                          key={`player-${player.id}-${slotIndex}`}
                          className={ds(
                            componentStyles.glassCard,
                            'flex items-center gap-3 p-4 border-white/20',
                            'hover:bg-white/10 hover:border-white/30 hover:scale-[1.02]',
                            'transition-all duration-200'
                          )}
                        >
                          <div className={ds(
                            componentStyles.avatarButton,
                            'text-white font-bold border-white/20 text-lg'
                          )}
                          style={{ backgroundColor: getPlayerColor(slotIndex) }}>
                            {player.avatarEmoji || player.name[0].toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <div className={ds(designSystem.text.body, 'font-medium flex items-center gap-2')}>
                              {player.name}
                              {player.isAI && (
                                <Badge variant="secondary" className="text-xs">
                                  🤖 {player.aiConfig?.difficulty || 'medium'} AI
                                </Badge>
                              )}
                              {!player.isAI && isGuestPlayer(player) && (
                                <Badge variant="secondary" className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">
                                  👤 Guest
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              {slotIndex === 0 && (
                                <Badge variant="outline" className="text-yellow-400 border-yellow-400 text-xs">
                                  <Crown className="h-3 w-3 mr-1" />
                                  Host
                                </Badge>
                              )}

                            </div>
                          </div>
                          {isHost && player.isAI && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveBot(player.id)}
                              disabled={removingBotIds.has(player.id)}
                              className={ds(
                                'h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/20',
                                'transition-all duration-200',
                                removingBotIds.has(player.id) && 'opacity-50 cursor-not-allowed'
                              )}
                            >
                              {removingBotIds.has(player.id) ? (
                                <div className="animate-spin">⚡</div>
                              ) : (
                                <X className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      )
                    } else {
                      // Empty slot
                      return (
                        <div
                          key={`empty-slot-${slotIndex}`}
                          onClick={isHost ? () => setShowAddBotDialog(true) : undefined}
                          className={ds(
                            componentStyles.glassCard,
                            'flex items-center gap-3 p-4 border-2 border-dashed border-white/20',
                            isHost ? 'cursor-pointer hover:bg-white/5 hover:border-white/30 hover:scale-[1.01]' : 'opacity-60',
                            'transition-all duration-200'
                          )}
                        >
                          <div className={ds(
                            'w-12 h-12 rounded-md bg-white/5 flex items-center justify-center',
                            'border border-white/10'
                          )}>
                            {isHost ? <Plus className="h-6 w-6 text-white/40" /> : <Users className="h-6 w-6 text-white/40" />}
                          </div>
                          <div className="flex-1">
                            <div className={ds(designSystem.text.body, 'font-medium text-white/60')}>
                              {isHost ? 'Add Player' : 'Waiting for player...'}
                            </div>
                            <div className={ds(designSystem.text.muted, 'text-sm')}>
                              {isHost ? 'Click to add AI bot or invite friend' : 'Host will add player'}
                            </div>
                          </div>
                        </div>
                      )
                    }
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Right Column - Rules & Actions */}
            <div className="space-y-6">
              {/* Game Rules */}
              <Card className={ds(componentStyles.glassCard, 'border-white/20')}>
                <CardHeader>
                  <CardTitle className={ds(designSystem.text.heading, 'text-xl')}>Game Rules & Resources</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Left - Core Rules */}
                    <div className="space-y-3">
                      <h4 className={ds(designSystem.text.body, 'font-semibold text-white mb-2')}>Core Rules</h4>
                      <ul className="space-y-2 text-sm text-white/80">
                        <li className="flex items-start gap-2">
                          <span className="text-yellow-400 mt-0.5">•</span>
                          <span>First to 10 victory points wins</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-yellow-400 mt-0.5">•</span>
                          <span>Build settlements, cities, and roads</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-yellow-400 mt-0.5">•</span>
                          <span>Trade resources with other players</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-yellow-400 mt-0.5">•</span>
                          <span>Use development cards strategically</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-yellow-400 mt-0.5">•</span>
                          <span>Watch out for the robber!</span>
                        </li>
                      </ul>
                    </div>
                    
                    {/* Right - Resources & Costs */}
                    <div className="space-y-3">
                      <h4 className={ds(designSystem.text.body, 'font-semibold text-white mb-2')}>Resources & Costs</h4>
                      <div className="space-y-3 text-sm">
                        <div>
                          <p className="text-white/80 mb-1">Resources:</p>
                          <div className="flex flex-wrap gap-2">
                            <span className="bg-green-500/20 px-2 py-1 rounded text-xs">🌲 Wood</span>
                            <span className="bg-red-500/20 px-2 py-1 rounded text-xs">🧱 Brick</span>
                            <span className="bg-yellow-500/20 px-2 py-1 rounded text-xs">🌾 Wheat</span>
                            <span className="bg-blue-500/20 px-2 py-1 rounded text-xs">🐑 Sheep</span>
                            <span className="bg-gray-500/20 px-2 py-1 rounded text-xs">🪨 Ore</span>
                          </div>
                        </div>
                        
                        <div>
                          <p className="text-white/80 mb-1">Building Costs:</p>
                          <div className="space-y-1 text-xs">
                            <div>🏠 Settlement: 🌲🧱🌾🐑</div>
                            <div>🏛️ City: 🌾🌾🪨🪨🪨</div>
                            <div>🛤️ Road: 🌲🧱</div>
                            <div>📜 Dev Card: 🌾🐑🪨</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex flex-col gap-4">
                {isHost ? (
                  <Button
                    onClick={onStartGame}
                    disabled={!canStart}
                    size="lg"
                    className={ds(
                      componentStyles.buttonPrimary,
                      'bg-green-500/20 border-green-400/30 hover:bg-green-500/30 hover:scale-[1.02]',
                      'transition-all duration-200 py-3 text-lg',
                      !canStart && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {canStart ? 'Start Game' : `Need ${3 - players.length} more players`}
                  </Button>
                ) : (
                  <div className={ds(
                    componentStyles.glassCard,
                    'text-center py-4 border-white/20'
                  )}>
                    <div className={ds(designSystem.text.body, 'text-white/80')}>
                      Waiting for host to start the game...
                    </div>
                  </div>
                )}
                
                <Button
                  onClick={onLeave}
                  variant="outline"
                  size="lg"
                  className={ds(
                    componentStyles.buttonSecondary,
                    'hover:scale-[1.02] transition-all duration-200'
                  )}
                >
                  Leave Lobby
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Add AI Bot Dialog */}
      <AddAIBotDialog
        isOpen={showAddBotDialog}
        onClose={handleCloseDialog}
        onAdd={handleAddBot}
        isLoading={isAddingBot}
      />
    </div>
  )
} 