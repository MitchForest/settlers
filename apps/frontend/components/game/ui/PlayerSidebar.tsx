'use client'

import { Player, GameState, GameAction, BUILDING_COSTS, hasResources } from '@settlers/core'
import { Button } from '@/components/ui/button'
import { ds, componentStyles, designSystem } from '@/lib/design-system'

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

// Action info for consistent styling
const ACTION_INFO = {
  buildSettlement: {
    emoji: '🏠',
    name: 'Build Settlement',
    description: 'Build a new settlement',
    cost: ['🌲', '🧱', '🌾', '🐑']
  },
  buildCity: {
    emoji: '🏛️',
    name: 'Build City',
    description: 'Upgrade settlement to city',
    cost: ['🌾', '🌾', '🪨', '🪨', '🪨']
  },
  buildRoad: {
    emoji: '🛤️',
    name: 'Build Road',
    description: 'Build a new road',
    cost: ['🌲', '🧱']
  },
  buyCard: {
    emoji: '📜',
    name: 'Buy Development Card',
    description: 'Purchase a development card',
    cost: ['🌾', '🐑', '🪨']
  },
  endTurn: {
    emoji: '⏭️',
    name: 'End Turn',
    description: 'End your turn',
    cost: []
  }
} as const

export function PlayerSidebar({ gameState, localPlayer, isMyTurn, onAction, timeRemaining = 120 }: PlayerSidebarProps) {
  const canBuildSettlement = hasResources(localPlayer.resources, BUILDING_COSTS.settlement) && localPlayer.buildings.settlements > 0
  const canBuildCity = hasResources(localPlayer.resources, BUILDING_COSTS.city) && localPlayer.buildings.cities > 0
  const canBuildRoad = hasResources(localPlayer.resources, BUILDING_COSTS.road) && localPlayer.buildings.roads > 0
  const canBuyCard = hasResources(localPlayer.resources, BUILDING_COSTS.developmentCard)

  const playableCards = localPlayer.developmentCards.filter(card => 
    !card.playedTurn && 
    card.purchasedTurn < gameState.turn &&
    card.type !== 'victory' // Victory cards are passive
  )

  const handleAction = (actionType: string, data?: unknown) => {
    const action: GameAction = {
      type: actionType as GameAction['type'],
      playerId: localPlayer.id,
      data: data || {}
    }
    onAction(action)
  }

  return (
    <div className={ds(
      componentStyles.glassCard,
      'h-full flex flex-col border-white/20'
    )}>
      {/* Timer Section */}
      <div className="p-4 border-b border-white/20">
        <div className="flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-white">Turn {gameState?.turn || 0}</div>
            <div className="text-lg font-mono text-white">
              {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
            </div>
          </div>
          
          {/* Timer Progress Bar */}
          <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ${
                timeRemaining / 120 > 0.5 ? 'bg-green-500' : 
                timeRemaining / 120 > 0.25 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${(timeRemaining / 120) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Resources Section - Horizontal layout */}
      <div className="p-4 border-b border-white/20">
        <h3 className="text-sm font-semibold text-white mb-2 text-left">Resources</h3>
        <div className="flex flex-wrap gap-3 justify-center">
          {Object.entries(localPlayer.resources).map(([resource, count]) => (
            <div key={resource} className={ds(
              designSystem.glass.secondary,
              'flex items-center space-x-1 rounded-full px-3 py-1.5 border-white/10',
              'hover:bg-white/15 hover:scale-105 transition-all duration-200 cursor-pointer'
            )}>
              <span className="text-lg">{RESOURCE_EMOJIS[resource as keyof typeof RESOURCE_EMOJIS]}</span>
              <span className={ds(designSystem.text.body, 'text-sm font-medium')}>{count}</span>
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
                  variant="outline"
                  className={ds(
                    'w-full justify-start text-left text-sm p-3 h-auto',
                    'bg-blue-500/20 border-blue-400/30 hover:bg-blue-500/30',
                    'hover:scale-[1.02] transition-all duration-200',
                    designSystem.text.body
                  )}
                >
                  <div className="flex items-start space-x-3 w-full">
                    <span className="text-lg">🎲</span>
                    <div className="flex-1 text-left">
                      <div className={ds(designSystem.text.body, 'font-medium text-left')}>Roll Dice</div>
                      <div className={ds(designSystem.text.muted, 'text-xs text-left')}>Roll to start your turn</div>
                    </div>
                  </div>
                </Button>
              )}

              {gameState.phase === 'moveRobber' && (
                <Button 
                  onClick={() => handleAction('moveRobber')}
                  variant="outline"
                  className="w-full justify-start text-left text-sm p-2 h-auto bg-red-600/20 border-red-400/20 hover:bg-red-600/30 text-white"
                >
                  <div className="flex items-start space-x-2 w-full">
                    <span className="text-lg">🔥</span>
                    <div className="flex-1 text-left">
                      <div className="font-medium text-white text-left">Move Robber</div>
                      <div className="text-xs text-white/60 text-left">Click on a hex to move the robber</div>
                    </div>
                  </div>
                </Button>
              )}

              {gameState.phase === 'steal' && (
                <Button 
                  onClick={() => handleAction('stealResource')}
                  variant="outline"
                  className="w-full justify-start text-left text-sm p-2 h-auto bg-purple-600/20 border-purple-400/20 hover:bg-purple-600/30 text-white"
                >
                  <div className="flex items-start space-x-2 w-full">
                    <span className="text-lg">⚔️</span>
                    <div className="flex-1 text-left">
                      <div className="font-medium text-white text-left">Steal Resource</div>
                      <div className="text-xs text-white/60 text-left">Steal from adjacent players</div>
                    </div>
                  </div>
                </Button>
              )}

              {gameState.phase === 'discard' && (
                <Button 
                  onClick={() => handleAction('discard')}
                  variant="outline"
                  className="w-full justify-start text-left text-sm p-2 h-auto bg-orange-600/20 border-orange-400/20 hover:bg-orange-600/30 text-white"
                >
                  <div className="flex items-start space-x-2 w-full">
                    <span className="text-lg">🗑️</span>
                    <div className="flex-1 text-left">
                      <div className="font-medium text-white text-left">Discard Cards</div>
                      <div className="text-xs text-white/60 text-left">Discard half your cards (7+ total)</div>
                    </div>
                  </div>
                </Button>
              )}

              {gameState.phase === 'actions' && (
                <>
                  <Button 
                    onClick={() => handleAction('build', { buildingType: 'settlement' })}
                    disabled={!canBuildSettlement}
                    variant="outline"
                    className={ds(
                      'w-full justify-start text-left text-sm p-3 h-auto',
                      canBuildSettlement 
                        ? ds(
                            componentStyles.buttonSecondary,
                            'hover:scale-[1.02] transition-all duration-200'
                          )
                        : 'bg-white/5 border-white/20 text-white/40 cursor-not-allowed opacity-60'
                    )}
                  >
                    <div className="flex items-start space-x-3 w-full">
                      <span className="text-lg">{ACTION_INFO.buildSettlement.emoji}</span>
                      <div className="flex-1 text-left">
                        <div className={ds(designSystem.text.body, 'font-medium text-left')}>{ACTION_INFO.buildSettlement.name}</div>
                        <div className={ds(designSystem.text.muted, 'text-xs text-left')}>{ACTION_INFO.buildSettlement.description}</div>
                        <div className="flex items-center space-x-1 text-xs mt-1">
                          {ACTION_INFO.buildSettlement.cost.map((emoji, i) => (
                            <span key={i}>{emoji}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Button>

                  <Button 
                    onClick={() => handleAction('build', { buildingType: 'city' })}
                    disabled={!canBuildCity}
                    variant="outline"
                    className={`w-full justify-start text-left text-sm p-2 h-auto ${
                      canBuildCity 
                        ? 'bg-white/5 border-white/20 hover:bg-white/10 text-white' 
                        : 'bg-white/5 border-white/20 text-white/40 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-start space-x-2 w-full">
                      <span className="text-lg">{ACTION_INFO.buildCity.emoji}</span>
                      <div className="flex-1 text-left">
                        <div className="font-medium text-white text-left">{ACTION_INFO.buildCity.name}</div>
                        <div className="text-xs text-white/60 text-left">{ACTION_INFO.buildCity.description}</div>
                        <div className="flex items-center space-x-1 text-xs mt-1">
                          {ACTION_INFO.buildCity.cost.map((emoji, i) => (
                            <span key={i}>{emoji}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Button>

                  <Button 
                    onClick={() => handleAction('build', { buildingType: 'road' })}
                    disabled={!canBuildRoad}
                    variant="outline"
                    className={`w-full justify-start text-left text-sm p-2 h-auto ${
                      canBuildRoad 
                        ? 'bg-white/5 border-white/20 hover:bg-white/10 text-white' 
                        : 'bg-white/5 border-white/20 text-white/40 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-start space-x-2 w-full">
                      <span className="text-lg">{ACTION_INFO.buildRoad.emoji}</span>
                      <div className="flex-1 text-left">
                        <div className="font-medium text-white text-left">{ACTION_INFO.buildRoad.name}</div>
                        <div className="text-xs text-white/60 text-left">{ACTION_INFO.buildRoad.description}</div>
                        <div className="flex items-center space-x-1 text-xs mt-1">
                          {ACTION_INFO.buildRoad.cost.map((emoji, i) => (
                            <span key={i}>{emoji}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Button>

                  <Button 
                    onClick={() => handleAction('buyCard')}
                    disabled={!canBuyCard}
                    variant="outline"
                    className={`w-full justify-start text-left text-sm p-2 h-auto ${
                      canBuyCard 
                        ? 'bg-white/5 border-white/20 hover:bg-white/10 text-white' 
                        : 'bg-white/5 border-white/20 text-white/40 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-start space-x-2 w-full">
                      <span className="text-lg">{ACTION_INFO.buyCard.emoji}</span>
                      <div className="flex-1 text-left">
                        <div className="font-medium text-white text-left">{ACTION_INFO.buyCard.name}</div>
                        <div className="text-xs text-white/60 text-left">{ACTION_INFO.buyCard.description}</div>
                        <div className="flex items-center space-x-1 text-xs mt-1">
                          {ACTION_INFO.buyCard.cost.map((emoji, i) => (
                            <span key={i}>{emoji}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Button>

                  <Button 
                    onClick={() => handleAction('trade')}
                    variant="outline"
                    className="w-full justify-start text-left text-sm p-2 h-auto bg-white/5 border-white/20 hover:bg-white/10 text-white"
                  >
                    <div className="flex items-start space-x-2 w-full">
                      <span className="text-lg">🤝</span>
                      <div className="flex-1 text-left">
                        <div className="font-medium text-white text-left">Trade</div>
                        <div className="text-xs text-white/60 text-left">Trade resources with players or ports</div>
                      </div>
                    </div>
                  </Button>

                  <Button 
                    onClick={() => handleAction('endTurn')}
                    variant="outline"
                    className="w-full justify-start text-left text-sm p-2 h-auto bg-red-600/20 border-red-400/20 hover:bg-red-600/30 text-white"
                  >
                    <div className="flex items-start space-x-2 w-full">
                      <span className="text-lg">{ACTION_INFO.endTurn.emoji}</span>
                      <div className="flex-1 text-left">
                        <div className="font-medium text-white text-left">{ACTION_INFO.endTurn.name}</div>
                        <div className="text-xs text-white/60 text-left">{ACTION_INFO.endTurn.description}</div>
                      </div>
                    </div>
                  </Button>
                </>
              )}
              
              {!['roll', 'moveRobber', 'steal', 'discard', 'actions'].includes(gameState.phase) && (
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
                    className="w-full justify-start text-left text-sm p-2 h-auto bg-white/5 border-white/20 hover:bg-white/10 text-white"
                  >
                    <div className="flex items-start space-x-2 w-full">
                      <span className="text-lg">{cardInfo.emoji}</span>
                      <div className="flex-1 text-left">
                        <div className="font-medium text-white text-left">{cardInfo.name}</div>
                        <div className="text-xs text-white/60 text-left">{cardInfo.description}</div>
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