'use client'

import { Player, GameState, GameAction, BUILDING_COSTS, hasResources, GamePhase } from '@settlers/core'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface PlayerSidebarProps {
  gameState: GameState
  localPlayer: Player
  isMyTurn: boolean
  onAction: (action: GameAction) => void
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

// Development card info
const DEV_CARD_INFO = {
  knight: {
    emoji: '⚔️',
    name: 'Knight',
    description: 'Move robber and steal a resource'
  },
  roadBuilding: {
    emoji: '🚧',
    name: 'Road Builder',
    description: 'Build 2 roads for free'
  },
  yearOfPlenty: {
    emoji: '🌾',
    name: 'Year of Plenty',
    description: 'Take 2 resources of your choice'
  },
  monopoly: {
    emoji: '💰',
    name: 'Monopoly',
    description: 'All players give you all of one resource type'
  },
  victory: {
    emoji: '👑',
    name: 'Victory Point',
    description: '+1 Victory Point (automatic)'
  }
} as const

export function PlayerSidebar({ 
  gameState,
  localPlayer, 
  isMyTurn, 
  onAction, 
  timeRemaining 
}: PlayerSidebarProps) {
  
  // Check what player can build
  const canBuildSettlement = hasResources(localPlayer.resources, BUILDING_COSTS.settlement) && localPlayer.buildings.settlements > 0
  const canBuildCity = hasResources(localPlayer.resources, BUILDING_COSTS.city) && localPlayer.buildings.cities > 0
  const canBuildRoad = hasResources(localPlayer.resources, BUILDING_COSTS.road) && localPlayer.buildings.roads > 0
  const canBuyCard = hasResources(localPlayer.resources, BUILDING_COSTS.developmentCard)

  // Handle building actions
  const handleBuildAction = (buildingType: 'settlement' | 'city' | 'road') => {
    const action: GameAction = {
      type: 'build',
      playerId: localPlayer.id,
      data: { buildingType }
    }
    onAction(action)
  }

  const handleBuyCard = () => {
    const action: GameAction = {
      type: 'buyCard',
      playerId: localPlayer.id,
      data: {}
    }
    onAction(action)
  }

  const handlePlayCard = (cardId: string) => {
    const action: GameAction = {
      type: 'playCard',
      playerId: localPlayer.id,
      data: { cardId }
    }
    onAction(action)
  }

  // Get total resources
  const totalResources = Object.values(localPlayer.resources).reduce((sum, count) => sum + count, 0)

  return (
    <div className="space-y-4">
      {/* Player Header */}
      <Card className="p-4 bg-white/10 backdrop-blur-sm border-white/20">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold text-white">{localPlayer.name}</h3>
            <div className="text-sm text-white/70">
              {isMyTurn ? '🔥 Your Turn' : '⏳ Waiting'}
            </div>
          </div>
          <div className={`w-8 h-8 rounded-full border-2 border-white player-color-${localPlayer.color}`} 
               style={{ backgroundColor: `var(--color-player-${localPlayer.color})` }} />
        </div>

        {/* Score Display */}
        <div className="flex items-center justify-between text-white">
          <div className="text-center">
            <div className="text-2xl font-bold">{localPlayer.score.total}</div>
            <div className="text-xs text-white/70">Victory Points</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold">{totalResources}</div>
            <div className="text-xs text-white/70">Resources</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold">{localPlayer.developmentCards.length}</div>
            <div className="text-xs text-white/70">Dev Cards</div>
          </div>
        </div>

        {/* Turn Timer */}
        {isMyTurn && timeRemaining !== undefined && (
          <div className="mt-3 p-2 bg-black/30 rounded-md">
            <div className="flex items-center justify-between text-white">
              <span className="text-sm">Time remaining:</span>
              <span className={cn(
                "font-mono text-lg font-bold",
                timeRemaining < 30 && "text-red-400",
                timeRemaining < 10 && "animate-pulse"
              )}>
                {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* Resources */}
      <Card className="p-4 bg-white/10 backdrop-blur-sm border-white/20">
        <h4 className="text-lg font-semibold text-white mb-3">Resources</h4>
        <div className="space-y-2">
          {(Object.entries(localPlayer.resources) as [keyof typeof RESOURCE_EMOJIS, number][]).map(([resource, count]) => (
            <div key={resource} className="flex items-center justify-between text-white">
              <div className="flex items-center space-x-2">
                <span className="text-lg">{RESOURCE_EMOJIS[resource]}</span>
                <span className="capitalize">{resource}</span>
              </div>
              <Badge variant={count > 0 ? "default" : "outline"}>
                {count}
              </Badge>
            </div>
          ))}
        </div>
      </Card>

      {/* Building Actions */}
      {isMyTurn && gameState.phase === 'actions' && (
        <Card className="p-4 bg-white/10 backdrop-blur-sm border-white/20">
          <h4 className="text-lg font-semibold text-white mb-3">Build</h4>
          <div className="space-y-2">
            <Button
              onClick={() => handleBuildAction('settlement')}
              disabled={!canBuildSettlement}
              className="w-full justify-between"
              variant={canBuildSettlement ? "default" : "outline"}
            >
              <span>🏠 Settlement</span>
              <div className="flex space-x-1 text-xs">
                <span>🌲🧱🌾🐑</span>
              </div>
            </Button>
            
            <Button
              onClick={() => handleBuildAction('city')}
              disabled={!canBuildCity}
              className="w-full justify-between"
              variant={canBuildCity ? "default" : "outline"}
            >
              <span>🏙️ City</span>
              <div className="flex space-x-1 text-xs">
                <span>🌾🌾🪨🪨🪨</span>
              </div>
            </Button>
            
            <Button
              onClick={() => handleBuildAction('road')}
              disabled={!canBuildRoad}
              className="w-full justify-between"
              variant={canBuildRoad ? "default" : "outline"}
            >
              <span>🛤️ Road</span>
              <div className="flex space-x-1 text-xs">
                <span>🌲🧱</span>
              </div>
            </Button>
            
            <Separator className="bg-white/20" />
            
            <Button
              onClick={handleBuyCard}
              disabled={!canBuyCard}
              className="w-full justify-between"
              variant={canBuyCard ? "default" : "outline"}
            >
              <span>📜 Dev Card</span>
              <div className="flex space-x-1 text-xs">
                <span>🌾🐑🪨</span>
              </div>
            </Button>
          </div>
          
          {/* Inventory Display */}
          <div className="mt-4 p-3 bg-black/30 rounded-md">
            <div className="text-xs text-white/70 mb-2">Remaining to build:</div>
            <div className="grid grid-cols-3 gap-2 text-xs text-white">
              <div className="text-center">
                <div className="font-bold">{localPlayer.buildings.settlements}</div>
                <div>Settlements</div>
              </div>
              <div className="text-center">
                <div className="font-bold">{localPlayer.buildings.cities}</div>
                <div>Cities</div>
              </div>
              <div className="text-center">
                <div className="font-bold">{localPlayer.buildings.roads}</div>
                <div>Roads</div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Development Cards */}
      {localPlayer.developmentCards.length > 0 && (
        <Card className="p-4 bg-white/10 backdrop-blur-sm border-white/20">
          <h4 className="text-lg font-semibold text-white mb-3">Development Cards</h4>
          <div className="space-y-2">
            {localPlayer.developmentCards.map((card, index) => {
              const cardInfo = DEV_CARD_INFO[card.type]
              const canPlay = isMyTurn && 
                gameState.phase === 'actions' && 
                !card.playedTurn && 
                card.purchasedTurn < gameState.turn &&
                card.type !== 'victory'

              return (
                <div key={index} className="flex items-center justify-between p-2 bg-black/30 rounded-md">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{cardInfo.emoji}</span>
                    <div>
                      <div className="text-sm font-semibold text-white">{cardInfo.name}</div>
                      <div className="text-xs text-white/70">{cardInfo.description}</div>
                    </div>
                  </div>
                  {canPlay && (
                    <Button
                      size="sm"
                      onClick={() => handlePlayCard(card.id)}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Play
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Achievements */}
      <Card className="p-4 bg-white/10 backdrop-blur-sm border-white/20">
        <h4 className="text-lg font-semibold text-white mb-3">Achievements</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-white">
            <span className="text-sm">🛤️ Longest Road</span>
            <Badge variant={localPlayer.hasLongestRoad ? "default" : "outline"}>
              {localPlayer.hasLongestRoad ? 'Held' : 'None'}
            </Badge>
          </div>
          <div className="flex items-center justify-between text-white">
            <span className="text-sm">⚔️ Largest Army</span>
            <Badge variant={localPlayer.hasLargestArmy ? "default" : "outline"}>
              {localPlayer.hasLargestArmy ? 'Held' : 'None'}
            </Badge>
          </div>
          <div className="flex items-center justify-between text-white">
            <span className="text-sm">🗡️ Knights Played</span>
            <Badge variant="outline">
              {localPlayer.knightsPlayed}
            </Badge>
          </div>
        </div>
      </Card>
    </div>
  )
} 