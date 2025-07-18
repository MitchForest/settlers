'use client'

import { Player } from '@settlers/core'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, Crown, Copy, Check, Bot, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { AddAIBotDialog } from './AddAIBotDialog'
import { ds, componentStyles, designSystem } from '@/lib/design-system'

// Extended player interface for AI players
interface AIPlayer extends Player {
  avatarEmoji?: string
  aiDifficulty?: 'easy' | 'medium' | 'hard'
  aiPersonality?: 'aggressive' | 'balanced' | 'defensive' | 'economic'
}

interface GameLobbyProps {
  gameCode: string
  players: Player[]
  isHost: boolean
  canStart: boolean
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
  onStartGame, 
  onLeave,
  onAddAIBot,
  onRemoveAIBot 
}: GameLobbyProps) {
  const [codeCopied, setCodeCopied] = useState(false)
  const [showAddBotDialog, setShowAddBotDialog] = useState(false)
  const [isAddingBot, setIsAddingBot] = useState(false)
  const [removingBotIds, setRemovingBotIds] = useState<Set<string>>(new Set())

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

  const handleAddAIBot = async (difficulty: string, personality: string) => {
    if (!onAddAIBot) return
    
    setIsAddingBot(true)
    try {
      await onAddAIBot(difficulty as 'easy' | 'medium' | 'hard', personality as 'aggressive' | 'balanced' | 'defensive' | 'economic')
      setShowAddBotDialog(false)
      toast.success('AI bot added successfully!')
    } catch (_error) {
      toast.error('Failed to add AI bot')
    } finally {
      setIsAddingBot(false)
    }
  }

  // Reset adding state when dialog closes
  const handleCloseDialog = () => {
    setShowAddBotDialog(false)
    setIsAddingBot(false)
  }

  const handleRemoveAIBot = async (botId: string) => {
    if (!onRemoveAIBot || removingBotIds.has(botId)) return
    
    setRemovingBotIds(prev => new Set(prev).add(botId))
    
    try {
      await onRemoveAIBot(botId)
      toast.success('AI bot removed')
    } catch (_error) {
      toast.error('Failed to remove AI bot')
    } finally {
      setRemovingBotIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(botId)
        return newSet
      })
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
    <div className="min-h-screen bg-gradient-to-br from-[#1a4b3a] via-[#2d5a47] to-[#1a4b3a] p-4">
      <div className="container mx-auto max-w-4xl">
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold text-white">Game Lobby</h1>
            <div className={ds(designSystem.glass.primary, 'inline-flex items-center gap-2 rounded-lg px-4 py-2')}>
              <span className={designSystem.text.body}>Game Code:</span>
              <code className="text-2xl font-mono font-bold text-yellow-400">{gameCode}</code>
              <Button
                variant="ghost"
                size="sm"
                onClick={copyGameCode}
                className={ds(designSystem.interactive.subtle.base, designSystem.interactive.subtle.hover, 'rounded-md')}
              >
                {codeCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-white/80">Share this code with friends to join the game</p>
          </div>

          {/* Players */}
          <Card className={ds(componentStyles.glassCard, 'border-white/20')}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className={ds(designSystem.text.heading, 'flex items-center gap-2')}>
                  <Users className="h-5 w-5" />
                  Players ({players.length}/4)
                </CardTitle>
                {isHost && players.length < 4 && (
                  <Button
                    onClick={() => setShowAddBotDialog(true)}
                    disabled={isAddingBot}
                    size="sm"
                    className={ds(
                      componentStyles.buttonPrimary,
                      'bg-gradient-to-r from-blue-500/20 to-purple-500/20',
                      'hover:from-blue-500/30 hover:to-purple-500/30',
                      'border-blue-400/30',
                      isAddingBot && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {isAddingBot ? (
                      <>
                        <div className="animate-spin mr-1">⚡</div>
                        Adding...
                      </>
                    ) : (
                      <>
                        <Bot className="h-4 w-4 mr-1" />
                        Add AI Bot
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                {players.map((player, index) => (
                  <div
                    key={`player-${player.id}-${index}`}
                    className={ds(
                      designSystem.glass.secondary,
                      'flex items-center gap-3 p-3 rounded-lg border-white/10',
                      designSystem.animation.normal,
                      'hover:bg-white/10 hover:border-white/20 hover:scale-[1.02]',
                      'transition-all duration-200 cursor-pointer'
                    )}
                  >
                    <div className={ds(
                      componentStyles.avatarButton,
                      'text-white font-bold border-white/20'
                    )}
                    style={{ backgroundColor: getPlayerColor(index) }}>
                      {player.isAI ? (player as AIPlayer).avatarEmoji || '🤖' : player.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className={ds(designSystem.text.body, 'font-medium flex items-center gap-2')}>
                        {player.name}
                                                 {player.isAI && (
                           <Badge variant="secondary" className="text-xs">
                             🤖 {(player as AIPlayer).aiDifficulty || 'medium'} AI
                           </Badge>
                         )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {index === 0 && (
                          <Badge variant="outline" className="text-yellow-400 border-yellow-400 text-xs">
                            <Crown className="h-3 w-3 mr-1" />
                            Host
                          </Badge>
                        )}
                                                 {player.isAI && (
                           <Badge variant="outline" className="text-xs border-white/20">
                             {(player as AIPlayer).aiPersonality || 'balanced'}
                           </Badge>
                         )}
                      </div>
                    </div>
                    {isHost && player.isAI && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveAIBot(player.id)}
                        disabled={removingBotIds.has(player.id)}
                        className={ds(
                          componentStyles.dropdownItemDestructive,
                          'h-8 w-8 p-0',
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
                ))}
                
                {/* Empty slots - only show if we can add more players */}
                {isHost && Array.from({ length: 4 - players.length }).map((_, i) => (
                  <div
                    key={`empty-slot-${i}`}
                    className={ds(
                      designSystem.glass.tertiary,
                      'flex items-center gap-3 p-3 rounded-lg border-2 border-dashed border-white/10',
                      designSystem.animation.normal,
                      'hover:bg-white/5 hover:border-white/20 hover:scale-[1.01]',
                      'transition-all duration-200 cursor-pointer'
                    )}
                  >
                    <div className={ds(
                      'w-10 h-10 rounded-md bg-white/5 flex items-center justify-center',
                      'border border-white/10'
                    )}>
                      <Plus className="h-5 w-5 text-white/40" />
                    </div>
                    <div className={ds(designSystem.text.muted, 'text-sm')}>
                      Add player or AI bot...
                    </div>
                  </div>
                )) || (!isHost && Array.from({ length: 4 - players.length }).map((_, i) => (
                  <div
                    key={`waiting-slot-${i}`}
                    className={ds(
                      designSystem.glass.tertiary,
                      'flex items-center gap-3 p-3 rounded-lg border-2 border-dashed border-white/10',
                      'hover:bg-white/5 hover:border-white/15',
                      'transition-all duration-200'
                    )}
                  >
                    <div className={ds(
                      'w-10 h-10 rounded-md bg-white/5 flex items-center justify-center',
                      'border border-white/10'
                    )}>
                      <Users className="h-5 w-5 text-white/40" />
                    </div>
                    <div className={ds(designSystem.text.muted, 'text-sm')}>
                      Waiting for player...
                    </div>
                  </div>
                )))}
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
                className={ds(
                  componentStyles.buttonPrimary,
                  'bg-green-500/20 border-green-400/30 hover:bg-green-500/30',
                  !canStart && 'opacity-50 cursor-not-allowed'
                )}
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
              className={componentStyles.buttonSecondary}
            >
              Leave Lobby
            </Button>
          </div>

          {/* Instructions */}
          <Card className={ds(componentStyles.glassCard, 'border-white/20')}>
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
      
      {/* Add AI Bot Dialog */}
      <AddAIBotDialog
        isOpen={showAddBotDialog}
        onClose={handleCloseDialog}
        onAdd={handleAddAIBot}
        isLoading={isAddingBot}
      />
    </div>
  )
} 