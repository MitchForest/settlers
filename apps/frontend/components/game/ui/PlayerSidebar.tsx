'use client'

import { Player, GameState, GameAction, BUILDING_COSTS, hasResources } from '@settlers/core'
import { Button } from '@/components/ui/button'

interface PlayerSidebarProps {
  gameState: GameState
  localPlayer: Player
  isMyTurn: boolean
  onAction: (action: GameAction) => void
}

// Resource emojis mapping
const RESOURCE_EMOJIS = {
  wood: '🌲',
  brick: '🧱', 
  ore: '⛏️',
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
    emoji: '🛤️',
    name: 'Road Building',
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

export function PlayerSidebar({ gameState, localPlayer, isMyTurn, onAction }: PlayerSidebarProps) {
  // Debug logging
  console.log('PlayerSidebar Debug:', {
    isMyTurn,
    gamePhase: gameState.phase,
    playerResources: localPlayer.resources,
    playerDevCards: localPlayer.developmentCards,
    turn: gameState.turn
  })

  const canBuildSettlement = hasResources(localPlayer.resources, BUILDING_COSTS.settlement) && localPlayer.buildings.settlements > 0
  const canBuildCity = hasResources(localPlayer.resources, BUILDING_COSTS.city) && localPlayer.buildings.cities > 0
  const canBuildRoad = hasResources(localPlayer.resources, BUILDING_COSTS.road) && localPlayer.buildings.roads > 0
  const canBuyCard = hasResources(localPlayer.resources, BUILDING_COSTS.developmentCard)

  const playableCards = localPlayer.developmentCards.filter(card => 
    !card.playedTurn && 
    card.purchasedTurn < gameState.turn &&
    card.type !== 'victory' // Victory cards are passive
  )

  console.log('Dev cards debug:', {
    totalCards: localPlayer.developmentCards.length,
    playableCards: playableCards.length,
    victoryCards: localPlayer.developmentCards.filter(card => card.type === 'victory').length,
    newCards: localPlayer.developmentCards.filter(card => card.purchasedTurn === gameState.turn && card.type !== 'victory').length
  })

  const handleAction = (actionType: string, data?: unknown) => {
    const action: GameAction = {
      type: actionType as GameAction['type'],
      playerId: localPlayer.id,
      data: data || {}
    }
    onAction(action)
  }

  return (
    <div className="h-full flex flex-col bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg">
      {/* Resources Section - Horizontal layout */}
      <div className="p-4 border-b border-white/20">
        <h3 className="text-sm font-semibold text-white mb-2 text-center">Resources</h3>
        <div className="flex flex-wrap gap-3 justify-center">
          {Object.entries(localPlayer.resources).map(([resource, count]) => (
            <div key={resource} className="flex items-center space-x-1 bg-white/10 rounded-full px-2 py-1">
              <span className="text-lg">{RESOURCE_EMOJIS[resource as keyof typeof RESOURCE_EMOJIS]}</span>
              <span className="text-white text-sm font-medium">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto">
        {/* Actions Section - Always show */}
        <div className="p-4 border-b border-white/20">
          <h3 className="text-sm font-semibold text-white mb-3">Actions</h3>
          
          {!isMyTurn ? (
            <div className="text-white/60 text-sm">Not your turn</div>
          ) : (
            <div className="space-y-2">
              {gameState.phase === 'roll' && (
                <Button 
                  onClick={() => handleAction('roll')}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-sm"
                >
                  🎲 Roll Dice
                </Button>
              )}

              {gameState.phase === 'actions' && (
                <>
                  <Button 
                    onClick={() => handleAction('buildSettlement')}
                    disabled={!canBuildSettlement}
                    variant={canBuildSettlement ? "default" : "outline"}
                    className="w-full text-sm justify-start"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span>🏠 Build Settlement</span>
                      <div className="flex items-center space-x-1 text-xs">
                        <span>🌲</span><span>🧱</span><span>🌾</span><span>🐑</span>
                      </div>
                    </div>
                  </Button>

                  <Button 
                    onClick={() => handleAction('buildCity')}
                    disabled={!canBuildCity}
                    variant={canBuildCity ? "default" : "outline"}
                    className="w-full text-sm justify-start"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span>🏙️ Build City</span>
                      <div className="flex items-center space-x-1 text-xs">
                        <span>🌾🌾</span><span>⛏️⛏️⛏️</span>
                      </div>
                    </div>
                  </Button>

                  <Button 
                    onClick={() => handleAction('buildRoad')}
                    disabled={!canBuildRoad}
                    variant={canBuildRoad ? "default" : "outline"}
                    className="w-full text-sm justify-start"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span>🛤️ Build Road</span>
                      <div className="flex items-center space-x-1 text-xs">
                        <span>🌲</span><span>🧱</span>
                      </div>
                    </div>
                  </Button>

                  <Button 
                    onClick={() => handleAction('buyCard')}
                    disabled={!canBuyCard}
                    variant={canBuyCard ? "default" : "outline"}
                    className="w-full text-sm justify-start"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span>📜 Buy Development Card</span>
                      <div className="flex items-center space-x-1 text-xs">
                        <span>🌾</span><span>🐑</span><span>⛏️</span>
                      </div>
                    </div>
                  </Button>

                  <Button 
                    onClick={() => handleAction('trade')}
                    variant="outline"
                    className="w-full text-sm"
                  >
                    🤝 Trade
                  </Button>

                  <Button 
                    onClick={() => handleAction('endTurn')}
                    className="w-full bg-red-600 hover:bg-red-700 text-sm"
                  >
                    ⏭️ End Turn
                  </Button>
                </>
              )}
              
              {gameState.phase !== 'roll' && gameState.phase !== 'actions' && (
                <div className="text-white/60 text-sm">No actions available</div>
              )}
            </div>
          )}
        </div>

        {/* Development Cards Section */}
        <div className="p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Development Cards</h3>
          
          {/* Playable Cards */}
          {playableCards.length > 0 ? (
            <div className="space-y-2">
              {playableCards.map((card, index) => {
                const cardInfo = DEV_CARD_INFO[card.type]
                return (
                  <Button
                    key={index}
                    onClick={() => handleAction('playCard', { cardType: card.type })}
                    variant="outline"
                    className="w-full text-left text-sm p-2 h-auto"
                  >
                    <div className="flex items-start space-x-2">
                      <span className="text-lg">{cardInfo.emoji}</span>
                      <div className="flex-1">
                        <div className="font-medium text-white">{cardInfo.name}</div>
                        <div className="text-xs text-white/60">{cardInfo.description}</div>
                      </div>
                    </div>
                  </Button>
                )
              })}
            </div>
          ) : (
            <div className="text-white/60 text-sm bg-white/10 rounded p-2">No cards available</div>
          )}
        </div>
      </div>
    </div>
  )
} 