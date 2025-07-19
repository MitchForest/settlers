'use client'

import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ds, designSystem } from '@/lib/design-system'
import { useTurnStore } from '@/stores/turnStore'
import { useGameStore } from '@/stores/gameStore'
import { 
  Clock, 
  Users, 
  Activity, 
  Trophy, 
  Wifi, 
  WifiOff,
  Crown,
  Target,
  TrendingUp,
  Pause,
  Play,
  Eye
} from 'lucide-react'
import type { GameState, Player } from '@settlers/game-engine'

interface GameStatusIndicatorProps {
  className?: string
  compactMode?: boolean
  showConnectionStatus?: boolean
  isConnected?: boolean
}

export function GameStatusIndicator({ 
  className, 
  compactMode = false, 
  showConnectionStatus = true,
  isConnected = true 
}: GameStatusIndicatorProps) {
  const { currentTurn, aiTurn } = useTurnStore()
  const gameState = useGameStore(state => state.gameState)
  const localPlayerId = useGameStore(state => state.localPlayerId)

  if (!gameState) {
    return (
      <div className={ds(
        designSystem.glass.primary,
        'p-4 rounded-lg text-center',
        className
      )}>
        <div className={designSystem.text.muted}>
          Loading game state...
        </div>
      </div>
    )
  }

  // Convert Map to Array for easier processing
  const players = Array.from(gameState.players.entries()).map(([id, player]) => ({
    ...player as Player,
    id
  }))

  const currentPlayer = players.find(p => p.id === gameState.currentPlayer)
  const localPlayer = localPlayerId ? players.find(p => p.id === localPlayerId) : null
  const isMyTurn = gameState.currentPlayer === localPlayerId

  // Victory progress calculation
  const getVictoryProgress = (player: Player & { id: string }) => {
    // Basic victory points calculation (simplified)
    const settlementPoints = (5 - player.buildings.settlements) * 1 // Each settlement = 1 VP
    const cityPoints = (4 - player.buildings.cities) * 2 // Each city = 2 VP  
    const devCardPoints = player.developmentCards.filter(card => card.type === 'victory').length
    
    return {
      current: settlementPoints + cityPoints + devCardPoints,
      target: 10,
      percentage: Math.min(((settlementPoints + cityPoints + devCardPoints) / 10) * 100, 100)
    }
  }

  // Game progress calculation
  const gameProgress = {
    turn: gameState.turn,
    phase: gameState.phase,
    estimatedTurnsRemaining: Math.max(0, 30 - gameState.turn), // Rough estimate
    gameTimeElapsed: '25:30' // This would come from game start time
  }

  if (compactMode) {
    return (
      <div className={ds(
        designSystem.glass.secondary,
        'px-4 py-2 rounded-lg flex items-center gap-4',
        className
      )}>
        {/* Connection Status */}
        {showConnectionStatus && (
          <div className="flex items-center gap-1">
            {isConnected ? (
              <Wifi className="w-4 h-4 text-green-400" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-400" />
            )}
            <span className={ds(
              designSystem.text.muted, 
              'text-xs',
              isConnected ? 'text-green-400' : 'text-red-400'
            )}>
              {isConnected ? 'Connected' : 'Offline'}
            </span>
          </div>
        )}

        {/* Game Phase */}
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-400" />
          <Badge variant="outline" className={ds(
            'text-xs',
            designSystem.accents.blue.subtle
          )}>
            {gameState.phase}
          </Badge>
        </div>

        {/* Turn Info */}
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-orange-400" />
          <div className={ds(designSystem.text.body, 'text-sm')}>
            Turn {gameState.turn}
          </div>
        </div>

        {/* Current Player */}
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-purple-400" />
          <div className={ds(designSystem.text.body, 'text-sm')}>
            {isMyTurn ? 'Your turn' : `${currentPlayer?.name || 'Unknown'}'s turn`}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={ds(
      designSystem.glass.primary,
      'p-6 rounded-lg space-y-6',
      className
    )}>
      {/* Header with Connection Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-blue-400" />
          <div>
            <h3 className={ds(designSystem.text.heading, 'text-lg')}>
              Game Status
            </h3>
            <div className={ds(designSystem.text.muted, 'text-sm')}>
              Turn {gameState.turn} • {gameProgress.gameTimeElapsed} elapsed
            </div>
          </div>
        </div>

        {showConnectionStatus && (
          <div className="flex items-center gap-2">
            {isConnected ? (
              <>
                <Wifi className="w-5 h-5 text-green-400" />
                <div className="text-sm">
                  <div className={ds(designSystem.text.body, 'font-medium')}>Connected</div>
                  <div className={ds(designSystem.text.muted, 'text-xs')}>Real-time sync</div>
                </div>
              </>
            ) : (
              <>
                <WifiOff className="w-5 h-5 text-red-400" />
                <div className="text-sm">
                  <div className={ds(designSystem.text.body, 'font-medium text-red-400')}>Disconnected</div>
                  <div className={ds(designSystem.text.muted, 'text-xs')}>Reconnecting...</div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Current Turn Status */}
      <div className={ds(designSystem.glass.secondary, 'p-4 rounded-lg')}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-orange-400" />
            <span className={ds(designSystem.text.body, 'font-medium')}>
              Current Turn
            </span>
          </div>
          
          <Badge variant="outline" className={ds(
            'text-sm',
            isMyTurn ? designSystem.accents.green.subtle : designSystem.accents.blue.subtle
          )}>
            {isMyTurn ? 'Your Turn' : aiTurn.isAITurn ? 'AI Turn' : 'Waiting'}
          </Badge>
        </div>

        <div className="space-y-3">
          {/* Player and Phase Info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={ds(designSystem.text.body)}>
                Player: {currentPlayer?.name || 'Unknown'}
              </div>
              {aiTurn.isAITurn && (
                <Badge variant="outline" className={ds(
                  'text-xs',
                  designSystem.accents.blue.subtle
                )}>
                  AI
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <span className={ds(designSystem.text.muted, 'text-sm')}>Phase:</span>
              <Badge variant="outline" className={ds(
                'text-xs',
                designSystem.accents.purple.subtle
              )}>
                {gameState.phase}
              </Badge>
            </div>
          </div>

          {/* Turn Timer */}
          {currentTurn.timing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className={ds(designSystem.text.muted, 'text-sm')}>
                  Time Remaining
                </span>
                <span className={ds(designSystem.text.body, 'text-sm font-mono')}>
                  {Math.floor(currentTurn.timing.remainingMs / 60000)}:
                  {Math.floor((currentTurn.timing.remainingMs % 60000) / 1000).toString().padStart(2, '0')}
                </span>
              </div>
              
              <Progress 
                value={Math.max(0, (currentTurn.timing.remainingMs / currentTurn.timing.durationMs) * 100)}
                className="h-2"
              />
            </div>
          )}

          {/* AI Status */}
          {aiTurn.isAITurn && (
            <div className={ds(designSystem.glass.tertiary, 'p-3 rounded-lg')}>
              <div className="flex items-center gap-2 mb-2">
                <div className="animate-spin w-4 h-4 border-2 border-white/20 border-t-white rounded-full" />
                <span className={ds(designSystem.text.body, 'text-sm')}>
                  AI Thinking...
                </span>
              </div>
              
              {aiTurn.aiActionDescription && (
                <div className={ds(designSystem.text.muted, 'text-xs')}>
                  {aiTurn.aiActionDescription}
                </div>
              )}
              
              {aiTurn.estimatedRemainingMs && (
                <div className={ds(designSystem.text.muted, 'text-xs mt-1')}>
                  Estimated: ~{Math.ceil(aiTurn.estimatedRemainingMs / 1000)}s remaining
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Victory Progress */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-400" />
          <span className={ds(designSystem.text.body, 'font-medium')}>
            Victory Progress
          </span>
        </div>

        <div className="space-y-3">
          {players
            .sort((a, b) => {
              const aProgress = getVictoryProgress(a)
              const bProgress = getVictoryProgress(b)
              return bProgress.current - aProgress.current
            })
            .slice(0, 4) // Show top 4 players
            .map((player) => {
              const progress = getVictoryProgress(player)
              const isLocal = player.id === localPlayerId
              const isCurrent = player.id === gameState.currentPlayer
              
              return (
                <div key={player.id} className={ds(
                  designSystem.glass.secondary,
                  'p-3 rounded-lg',
                  isLocal && 'ring-2 ring-blue-400/30',
                  isCurrent && 'ring-2 ring-green-400/30'
                )}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={ds(designSystem.text.body, 'text-sm font-medium')}>
                        {player.name}
                      </span>
                      
                      <div className="flex gap-1">
                        {isLocal && (
                          <Badge variant="outline" className={ds(
                            'text-xs',
                            designSystem.accents.blue.subtle
                          )}>
                            You
                          </Badge>
                        )}
                        {isCurrent && (
                          <Badge variant="outline" className={ds(
                            'text-xs',
                            designSystem.accents.green.subtle
                          )}>
                            Current
                          </Badge>
                        )}
                        {progress.current >= 8 && (
                          <Crown className="w-4 h-4 text-yellow-400" />
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-orange-400" />
                      <span className={ds(designSystem.text.body, 'text-sm font-mono')}>
                        {progress.current}/10
                      </span>
                    </div>
                  </div>
                  
                  <Progress 
                    value={progress.percentage}
                    className="h-2"
                  />
                </div>
              )
            })}
        </div>
      </div>

      {/* Game Statistics */}
      <div className={ds(designSystem.glass.secondary, 'p-4 rounded-lg')}>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-5 h-5 text-green-400" />
          <span className={ds(designSystem.text.body, 'font-medium')}>
            Game Statistics
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className={ds(designSystem.text.muted, 'text-xs')}>
              Total Players
            </div>
            <div className={ds(designSystem.text.body, 'text-lg font-bold')}>
              {players.length}
            </div>
          </div>

          <div className="space-y-1">
            <div className={ds(designSystem.text.muted, 'text-xs')}>
              Actions This Turn
            </div>
            <div className={ds(designSystem.text.body, 'text-lg font-bold')}>
              {currentTurn.actionsThisTurn.length}
            </div>
          </div>

          <div className="space-y-1">
            <div className={ds(designSystem.text.muted, 'text-xs')}>
              Game Duration
            </div>
            <div className={ds(designSystem.text.body, 'text-lg font-bold')}>
              {gameProgress.gameTimeElapsed}
            </div>
          </div>

          <div className="space-y-1">
            <div className={ds(designSystem.text.muted, 'text-xs')}>
              Est. Remaining
            </div>
            <div className={ds(designSystem.text.body, 'text-lg font-bold')}>
              ~{gameProgress.estimatedTurnsRemaining} turns
            </div>
          </div>
        </div>
      </div>

      {/* Game Controls */}
      <div className="flex items-center justify-between pt-2 border-t border-white/10">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-blue-400" />
          <span className={ds(designSystem.text.muted, 'text-sm')}>
            Spectator mode available
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className={ds(designSystem.text.muted, 'text-sm')}>
            Real-time updates
          </div>
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
        </div>
      </div>
    </div>
  )
} 