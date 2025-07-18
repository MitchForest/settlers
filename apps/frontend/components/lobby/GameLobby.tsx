'use client'

import { LobbyPlayer } from '@settlers/core'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, Crown, Copy, Check, Plus, X } from 'lucide-react'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { AddAIBotDialog } from './AddAIBotDialog'
import { ds, componentStyles, designSystem } from '@/lib/design-system'

// Terrain assets for honeycomb background
const TERRAIN_ASSETS = [
  { name: 'forest', image: '/themes/settlers/assets/terrains/forest.png' },
  { name: 'pasture', image: '/themes/settlers/assets/terrains/pasture.png' },
  { name: 'wheat', image: '/themes/settlers/assets/terrains/wheat.png' },
  { name: 'brick', image: '/themes/settlers/assets/terrains/brick.png' },
  { name: 'ore', image: '/themes/settlers/assets/terrains/ore.png' },
  { name: 'desert', image: '/themes/settlers/assets/terrains/desert.png' },
  { name: 'sea', image: '/themes/settlers/assets/terrains/sea.png' },
]

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
  maxPlayers,
  onStartGame, 
  onLeave,
  onAddAIBot,
  onRemoveAIBot 
}: GameLobbyProps) {
  const [codeCopied, setCodeCopied] = useState(false)
  const [showAddBotDialog, setShowAddBotDialog] = useState(false)
  const [isAddingBot, setIsAddingBot] = useState(false)
  const [removingBotIds, setRemovingBotIds] = useState<Set<string>>(new Set())
  
  // Honeycomb background state
  const [isMounted, setIsMounted] = useState(false)
  const [honeycombBackground, setHoneycombBackground] = useState<{
    id: string;
    x: number;
    y: number;
    terrain: typeof TERRAIN_ASSETS[0];
    animationDelay: number;
    animationDuration: number;
  }[]>([])

  useEffect(() => {
    // Generate honeycomb background after component mounts
    const hexes = []
    const hexRadius = 80
    const rows = 12
    const cols = 20
    
    // Simple seeded pseudo-random function for deterministic results
    const seededRandom = (seed: number) => {
      const x = Math.sin(seed) * 10000
      return x - Math.floor(x)
    }
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = col * (hexRadius * 1.5) - hexRadius
        const y = row * (hexRadius * Math.sqrt(3)) + (col % 2) * (hexRadius * Math.sqrt(3) / 2) - hexRadius
        
        const seed = row * cols + col
        const terrainIndex = Math.floor(seededRandom(seed) * TERRAIN_ASSETS.length)
        const terrain = TERRAIN_ASSETS[terrainIndex]
        
        const animationDelay = seededRandom(seed + 1000) * 5
        const animationDuration = 3 + seededRandom(seed + 2000) * 4
        
        hexes.push({
          id: `hex-${row}-${col}`,
          x,
          y,
          terrain,
          animationDelay,
          animationDuration,
        })
      }
    }
    
    setHoneycombBackground(hexes)
    setIsMounted(true)
  }, [])

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
    <div className="min-h-screen bg-gradient-to-br from-[#1a4b3a] via-[#2d5a47] to-[#1a4b3a] relative overflow-hidden">
      {/* Honeycomb Background */}
      {isMounted && (
        <div className="absolute inset-0 overflow-hidden">
          <svg className="w-full h-full" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice">
            <defs>
              {TERRAIN_ASSETS.map(terrain => (
                <pattern key={terrain.name} id={`pattern-${terrain.name}`} patternUnits="objectBoundingBox" width="1" height="1">
                  <image href={terrain.image} x="0" y="0" width="160" height="160" preserveAspectRatio="xMidYMid slice"/>
                </pattern>
              ))}
            </defs>
            {honeycombBackground.map(hex => (
              <polygon
                key={hex.id}
                points="40,0 120,0 160,69 120,138 40,138 0,69"
                transform={`translate(${hex.x}, ${hex.y})`}
                fill={`url(#pattern-${hex.terrain.name})`}
                className="opacity-40 animate-pulse"
                style={{
                  animationDelay: `${hex.animationDelay}s`,
                  animationDuration: `${hex.animationDuration}s`
                }}
              />
            ))}
          </svg>
        </div>
      )}

      {/* Overlay gradient for better content contrast */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/40" />
      
      {/* Content */}
      <div className="relative z-10 py-8 px-4">
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
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              {slotIndex === 0 && (
                                <Badge variant="outline" className="text-yellow-400 border-yellow-400 text-xs">
                                  <Crown className="h-3 w-3 mr-1" />
                                  Host
                                </Badge>
                              )}
                              {player.isAI && (
                                <Badge variant="outline" className="text-xs border-white/20">
                                  {player.aiConfig?.personality || 'balanced'}
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