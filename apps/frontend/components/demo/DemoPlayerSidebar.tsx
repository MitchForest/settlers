'use client'

import { Button } from '@/components/ui/button'
import { ds, componentStyles, designSystem } from '@/lib/design-system'
import { toast } from 'sonner'

interface DemoPlayer {
  id: string
  name: string
  color: string
  resources: Record<string, number>
  developmentCards: any[]
  victoryPoints: number
  settlements: any[]
  cities: any[]
  roads: any[]
  longestRoad: number
  hasLongestRoad: boolean
  hasLargestArmy: boolean
  knightsPlayed: number
}

interface DemoGameState {
  id: string
  phase: string
  currentPlayer: string
  players: Map<string, DemoPlayer>
}

interface DemoPlayerSidebarProps {
  gameState: DemoGameState
  localPlayer: DemoPlayer
  isMyTurn: boolean
  onAction: (action: any) => void
  timeRemaining?: number
}

// Resource emojis mapping
const RESOURCE_EMOJIS = {
  wood: '🌲',
  brick: '🧱', 
  ore: '🪨',
  wheat: '🌾',
  sheep: '🐑'
} as const

export function DemoPlayerSidebar({ 
  gameState, 
  localPlayer, 
  isMyTurn, 
  onAction,
  timeRemaining 
}: DemoPlayerSidebarProps) {
  
  const totalResources = Object.values(localPlayer.resources).reduce((sum, count) => sum + count, 0)
  const totalDevCards = localPlayer.developmentCards.length

  const handleBuildAction = (buildingType: string) => {
    toast.info(`Demo: Build ${buildingType} clicked`)
    onAction({
      type: 'build',
      playerId: localPlayer.id,
      data: { buildingType }
    })
  }

  const handleBuyDevCard = () => {
    toast.info('Demo: Buy development card clicked')
    onAction({
      type: 'buyCard',
      playerId: localPlayer.id,
      data: {}
    })
  }

  const handleEndTurn = () => {
    toast.info('Demo: End turn clicked')
    onAction({
      type: 'endTurn',
      playerId: localPlayer.id,
      data: {}
    })
  }

  return (
    <div className={ds(
      componentStyles.glassCard,
      'p-4 space-y-4 border-white/20 max-h-full overflow-y-auto'
    )}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className={ds(designSystem.text.heading, 'text-lg')}>
          {localPlayer.name}
        </h3>
        {isMyTurn && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-green-300 text-sm">Your Turn</span>
          </div>
        )}
      </div>

      {/* Victory Points */}
      <div className={ds(componentStyles.glassCard, 'p-3 border-yellow-400/30 bg-yellow-400/5')}>
        <div className="flex items-center justify-between">
          <span className="text-yellow-300 font-medium">Victory Points</span>
          <span className="text-yellow-300 text-xl font-bold">{localPlayer.victoryPoints}</span>
        </div>
      </div>

      {/* Resources */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className={ds(designSystem.text.body, 'font-medium')}>
            Resources ({totalResources})
          </h4>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(RESOURCE_EMOJIS).map(([resourceType, emoji]) => {
            const count = localPlayer.resources[resourceType] || 0
            return (
              <div
                key={resourceType}
                className={ds(
                  componentStyles.glassCard,
                  'p-2 border-white/20 text-center',
                  count === 0 && 'opacity-50'
                )}
              >
                <div className="text-lg">{emoji}</div>
                <div className="text-sm text-white/80 capitalize">{resourceType}</div>
                <div className="text-lg font-bold text-white">{count}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Development Cards */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className={ds(designSystem.text.body, 'font-medium')}>
            Dev Cards ({totalDevCards})
          </h4>
        </div>
        
        {totalDevCards === 0 ? (
          <div className={ds(
            componentStyles.glassCard,
            'p-3 border-white/20 text-center text-white/60'
          )}>
            No development cards
          </div>
        ) : (
          <div className={ds(componentStyles.glassCard, 'p-3 border-white/20')}>
            <div className="text-center">
              <div className="text-2xl mb-1">📜</div>
              <div className="text-sm text-white/80">{totalDevCards} cards</div>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      {isMyTurn && (
        <div className="space-y-3">
          <h4 className={ds(designSystem.text.body, 'font-medium')}>Actions</h4>
          
          {/* Building Actions */}
          <div className="space-y-2">
            <Button
              onClick={() => handleBuildAction('settlement')}
              className={ds(componentStyles.buttonSecondary, 'w-full justify-between')}
              variant="outline"
            >
              <span>🏠 Settlement</span>
              <span className="text-xs">🌲🧱🌾🐑</span>
            </Button>
            
            <Button
              onClick={() => handleBuildAction('city')}
              className={ds(componentStyles.buttonSecondary, 'w-full justify-between')}
              variant="outline"
            >
              <span>🏛️ City</span>
              <span className="text-xs">🌾🌾🪨🪨🪨</span>
            </Button>
            
            <Button
              onClick={() => handleBuildAction('road')}
              className={ds(componentStyles.buttonSecondary, 'w-full justify-between')}
              variant="outline"
            >
              <span>🛤️ Road</span>
              <span className="text-xs">🌲🧱</span>
            </Button>
          </div>

          {/* Other Actions */}
          <div className="space-y-2">
            <Button
              onClick={handleBuyDevCard}
              className={ds(componentStyles.buttonSecondary, 'w-full justify-between')}
              variant="outline"
            >
              <span>📜 Buy Dev Card</span>
              <span className="text-xs">🌾🐑🪨</span>
            </Button>
          </div>

          {/* End Turn */}
          <Button
            onClick={handleEndTurn}
            className={ds(componentStyles.buttonPrimary, 'w-full')}
          >
            End Turn
          </Button>
        </div>
      )}

      {/* Turn Timer */}
      {timeRemaining && timeRemaining > 0 && (
        <div className={ds(componentStyles.glassCard, 'p-2 border-orange-400/30 bg-orange-400/5')}>
          <div className="text-center">
            <div className="text-orange-300 text-sm">Time Remaining</div>
            <div className="text-orange-300 text-lg font-bold">
              {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}