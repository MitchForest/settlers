'use client'

import { Player, GameState, GameAction, BUILDING_COSTS, hasResources } from '@settlers/game-engine'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ds, componentStyles, designSystem } from '@/lib/design-system'
import { useTurnStore } from '@/stores/turnStore'
import { Clock, User, Bot, AlertTriangle, CheckCircle } from 'lucide-react'

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

export function PlayerSidebar({ gameState, localPlayer, isMyTurn, onAction }: PlayerSidebarProps) {
  // Get real-time turn data from turn store
  const { currentTurn, aiTurn, notifications } = useTurnStore()
  
  // Use turn store timing if available, fallback to default
  const timeRemaining = currentTurn.timing?.remainingMs || 120000
  const turnNumber = currentTurn.turnNumber || gameState?.turn || 0
  
  // Check building capabilities
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
      {/* Enhanced Timer Section with Turn Info */}
      <div className="p-4 border-b border-white/20">
        <div className="flex flex-col space-y-3">
          {/* Turn Status Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={ds(designSystem.text.body, 'text-sm font-semibold')}>
                Turn {turnNumber}
              </div>
              {currentTurn.phase && (
                <Badge variant="outline" className={ds(
                  'text-xs px-2 py-0.5',
                  designSystem.accents.blue.subtle
                )}>
                  {currentTurn.phase}
                </Badge>
              )}
            </div>
            
            {/* Turn Status Indicator */}
            <div className="flex items-center gap-2">
              {isMyTurn ? (
                <div className="flex items-center gap-1">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className={ds(designSystem.text.body, 'text-sm')}>Your turn</span>
                </div>
              ) : aiTurn.isAITurn ? (
                <div className="flex items-center gap-1">
                  <Bot className="w-4 h-4 text-blue-400" />
                  <span className={ds(designSystem.text.body, 'text-sm')}>AI thinking</span>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4 text-orange-400" />
                  <span className={ds(designSystem.text.muted, 'text-sm')}>Waiting</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Timer Display */}
          <div className="flex items-center justify-between">
            <div className={ds(designSystem.text.muted, 'text-sm')}>
              Time Remaining
            </div>
            <div className="text-lg font-mono text-white">
              {Math.floor(timeRemaining / 60000)}:{Math.floor((timeRemaining % 60000) / 1000).toString().padStart(2, '0')}
            </div>
          </div>
          
          {/* Enhanced Timer Progress Bar */}
          <div className="w-full h-3 bg-white/20 rounded-full overflow-hidden relative">
            <div 
              className={`h-full transition-all duration-1000 ${
                timeRemaining / 120000 > 0.5 ? 'bg-green-500' : 
                timeRemaining / 120000 > 0.25 ? 'bg-yellow-500' : 'bg-red-500'
              } ${timeRemaining / 120000 < 0.1 ? 'animate-pulse' : ''}`}
              style={{ width: `${Math.max(0, (timeRemaining / 120000) * 100)}%` }}
            />
            {timeRemaining / 120000 < 0.25 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <AlertTriangle className="w-3 h-3 text-white animate-pulse" />
              </div>
            )}
          </div>

          {/* Action Count for Current Turn */}
          {currentTurn.actionsThisTurn.length > 0 && (
            <div className={ds(designSystem.glass.secondary, 'px-3 py-2 rounded-lg')}>
              <div className={ds(designSystem.text.body, 'text-xs')}>
                Actions this turn: {currentTurn.actionsThisTurn.length}
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                {currentTurn.actionsThisTurn.slice(-3).map((action, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {action.type}
                  </Badge>
                ))}
                {currentTurn.actionsThisTurn.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{currentTurn.actionsThisTurn.length - 3}
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Resources Section - Enhanced with hover effects */}
      <div className="p-4 border-b border-white/20">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-white">Resources</h3>
          <div className={ds(designSystem.text.muted, 'text-xs')}>
            Total: {Object.values(localPlayer.resources).reduce((a, b) => a + b, 0)}
          </div>
        </div>
        <div className="flex flex-wrap gap-3 justify-center">
          {Object.entries(localPlayer.resources).map(([resource, count]) => (
            <div key={resource} className={ds(
              designSystem.glass.secondary,
              'flex items-center space-x-1 rounded-full px-3 py-1.5 border-white/10',
              'hover:bg-white/15 hover:scale-105 transition-all duration-200 cursor-pointer',
              count === 0 && 'opacity-50'
            )}>
              <span className="text-lg">{RESOURCE_EMOJIS[resource as keyof typeof RESOURCE_EMOJIS]}</span>
              <span className={ds(designSystem.text.body, 'text-sm font-medium')}>{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto">
        {/* Turn Actions Section - Enhanced with turn state */}
        <div className="p-4 border-b border-white/20">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">Turn Actions</h3>
            {!isMyTurn && (
              <Badge variant="outline" className={ds(
                'text-xs',
                aiTurn.isAITurn ? designSystem.accents.blue.subtle : designSystem.accents.orange.subtle
              )}>
                {aiTurn.isAITurn ? 'AI Turn' : 'Waiting'}
              </Badge>
            )}
          </div>
          
          {!isMyTurn ? (
            <div className={ds(
              designSystem.glass.secondary,
              'p-4 rounded-lg text-center'
            )}>
              <div className={ds(designSystem.text.muted, 'text-sm')}>
                {aiTurn.isAITurn ? (
                  <>
                    <Bot className="w-6 h-6 mx-auto mb-2 text-blue-400" />
                    AI Player {aiTurn.aiActionDescription || 'is thinking...'}
                    {aiTurn.estimatedRemainingMs && (
                      <div className="text-xs mt-1">
                        ~{Math.ceil(aiTurn.estimatedRemainingMs / 1000)}s remaining
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <User className="w-6 h-6 mx-auto mb-2 text-orange-400" />
                    Waiting for other player's turn
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {gameState.phase === 'roll' && (
                <Button 
                  onClick={() => handleAction('roll')}
                  variant="outline"
                  className={ds(
                    'w-full justify-start text-left text-sm p-3 h-auto',
                    designSystem.accents.blue.subtle,
                    designSystem.accents.blue.hover,
                    'hover:scale-[1.02] transition-all duration-200'
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
                  className={ds(
                    'w-full justify-start text-left text-sm p-3 h-auto',
                    designSystem.accents.red.subtle,
                    designSystem.accents.red.hover,
                    'hover:scale-[1.02] transition-all duration-200'
                  )}
                >
                  <div className="flex items-start space-x-3 w-full">
                    <span className="text-lg">🔥</span>
                    <div className="flex-1 text-left">
                      <div className={ds(designSystem.text.body, 'font-medium text-left')}>Move Robber</div>
                      <div className={ds(designSystem.text.muted, 'text-xs text-left')}>Click on a hex to move the robber</div>
                    </div>
                  </div>
                </Button>
              )}

              {gameState.phase === 'steal' && (
                <Button 
                  onClick={() => handleAction('stealResource')}
                  variant="outline"
                  className={ds(
                    'w-full justify-start text-left text-sm p-3 h-auto',
                    designSystem.accents.purple.subtle,
                    designSystem.accents.purple.hover,
                    'hover:scale-[1.02] transition-all duration-200'
                  )}
                >
                  <div className="flex items-start space-x-3 w-full">
                    <span className="text-lg">⚔️</span>
                    <div className="flex-1 text-left">
                      <div className={ds(designSystem.text.body, 'font-medium text-left')}>Steal Resource</div>
                      <div className={ds(designSystem.text.muted, 'text-xs text-left')}>Steal from adjacent players</div>
                    </div>
                  </div>
                </Button>
              )}

              {gameState.phase === 'discard' && (
                <Button 
                  onClick={() => handleAction('discard')}
                  variant="outline"
                  className={ds(
                    'w-full justify-start text-left text-sm p-3 h-auto',
                    designSystem.accents.orange.subtle,
                    designSystem.accents.orange.hover,
                    'hover:scale-[1.02] transition-all duration-200'
                  )}
                >
                  <div className="flex items-start space-x-3 w-full">
                    <span className="text-lg">🗑️</span>
                    <div className="flex-1 text-left">
                      <div className={ds(designSystem.text.body, 'font-medium text-left')}>Discard Cards</div>
                      <div className={ds(designSystem.text.muted, 'text-xs text-left')}>Discard half your cards (7+ total)</div>
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
                            designSystem.accents.green.subtle,
                            designSystem.accents.green.hover,
                            'hover:scale-[1.02] transition-all duration-200'
                          )
                        : ds(
                            designSystem.glass.tertiary,
                            'opacity-60 cursor-not-allowed',
                            designSystem.text.muted
                          )
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
                    className={ds(
                      'w-full justify-start text-left text-sm p-3 h-auto',
                      canBuildCity 
                        ? ds(
                            designSystem.accents.purple.subtle,
                            designSystem.accents.purple.hover,
                            'hover:scale-[1.02] transition-all duration-200'
                          )
                        : ds(
                            designSystem.glass.tertiary,
                            'opacity-60 cursor-not-allowed',
                            designSystem.text.muted
                          )
                    )}
                  >
                    <div className="flex items-start space-x-3 w-full">
                      <span className="text-lg">{ACTION_INFO.buildCity.emoji}</span>
                      <div className="flex-1 text-left">
                        <div className={ds(designSystem.text.body, 'font-medium text-left')}>{ACTION_INFO.buildCity.name}</div>
                        <div className={ds(designSystem.text.muted, 'text-xs text-left')}>{ACTION_INFO.buildCity.description}</div>
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
                    className={ds(
                      'w-full justify-start text-left text-sm p-3 h-auto',
                      canBuildRoad 
                        ? ds(
                            designSystem.accents.orange.subtle,
                            designSystem.accents.orange.hover,
                            'hover:scale-[1.02] transition-all duration-200'
                          )
                        : ds(
                            designSystem.glass.tertiary,
                            'opacity-60 cursor-not-allowed',
                            designSystem.text.muted
                          )
                    )}
                  >
                    <div className="flex items-start space-x-3 w-full">
                      <span className="text-lg">{ACTION_INFO.buildRoad.emoji}</span>
                      <div className="flex-1 text-left">
                        <div className={ds(designSystem.text.body, 'font-medium text-left')}>{ACTION_INFO.buildRoad.name}</div>
                        <div className={ds(designSystem.text.muted, 'text-xs text-left')}>{ACTION_INFO.buildRoad.description}</div>
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
                    className={ds(
                      'w-full justify-start text-left text-sm p-3 h-auto',
                      canBuyCard 
                        ? ds(
                            designSystem.accents.blue.subtle,
                            designSystem.accents.blue.hover,
                            'hover:scale-[1.02] transition-all duration-200'
                          )
                        : ds(
                            designSystem.glass.tertiary,
                            'opacity-60 cursor-not-allowed',
                            designSystem.text.muted
                          )
                    )}
                  >
                    <div className="flex items-start space-x-3 w-full">
                      <span className="text-lg">{ACTION_INFO.buyCard.emoji}</span>
                      <div className="flex-1 text-left">
                        <div className={ds(designSystem.text.body, 'font-medium text-left')}>{ACTION_INFO.buyCard.name}</div>
                        <div className={ds(designSystem.text.muted, 'text-xs text-left')}>{ACTION_INFO.buyCard.description}</div>
                        <div className="flex items-center space-x-1 text-xs mt-1">
                          {ACTION_INFO.buyCard.cost.map((emoji, i) => (
                            <span key={i}>{emoji}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Button>

                  {currentTurn.canEndTurn && (
                    <div className="pt-2 border-t border-white/10">
                      <Button 
                        onClick={() => handleAction('endTurn')}
                        variant="outline"
                        className={ds(
                          'w-full justify-center text-sm p-3 h-auto',
                          designSystem.accents.red.subtle,
                          designSystem.accents.red.hover,
                          'hover:scale-[1.02] transition-all duration-200'
                        )}
                      >
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">{ACTION_INFO.endTurn.emoji}</span>
                          <span className={ds(designSystem.text.body, 'font-medium')}>
                            {ACTION_INFO.endTurn.name}
                          </span>
                        </div>
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Development Cards Section - Enhanced */}
        {localPlayer.developmentCards.length > 0 && (
          <div className="p-4 border-b border-white/20">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">Development Cards</h3>
              <Badge variant="outline" className="text-xs">
                {localPlayer.developmentCards.length}
              </Badge>
            </div>
            
            <div className="space-y-2">
              {playableCards.length > 0 ? (
                playableCards.map((card, index) => (
                  <Button
                    key={index}
                    onClick={() => handleAction('playCard', { cardType: card.type })}
                    disabled={!isMyTurn}
                    variant="outline"
                    className={ds(
                      'w-full justify-start text-left text-sm p-3 h-auto',
                      isMyTurn 
                        ? ds(
                            designSystem.accents.purple.subtle,
                            designSystem.accents.purple.hover,
                            'hover:scale-[1.02] transition-all duration-200'
                          )
                        : ds(
                            designSystem.glass.tertiary,
                            'opacity-60 cursor-not-allowed'
                          )
                    )}
                  >
                    <div className="flex items-start space-x-3 w-full">
                      <span className="text-lg">{DEV_CARD_INFO[card.type].emoji}</span>
                      <div className="flex-1 text-left">
                        <div className={ds(designSystem.text.body, 'font-medium text-left')}>
                          {DEV_CARD_INFO[card.type].name}
                        </div>
                        <div className={ds(designSystem.text.muted, 'text-xs text-left')}>
                          {DEV_CARD_INFO[card.type].description}
                        </div>
                      </div>
                    </div>
                  </Button>
                ))
              ) : (
                <div className={ds(
                  designSystem.glass.secondary,
                  'p-3 rounded-lg text-center'
                )}>
                  <div className={ds(designSystem.text.muted, 'text-sm')}>
                    {localPlayer.developmentCards.length > 0 
                      ? 'Cards cannot be played this turn' 
                      : 'No development cards'
                    }
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Turn Notifications - Show recent notifications */}
        {notifications.length > 0 && (
          <div className="p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Recent Events</h3>
            <div className="space-y-2">
              {notifications.slice(-2).map((notification) => (
                <div
                  key={notification.id}
                  className={ds(
                    designSystem.glass.secondary,
                    'p-3 rounded-lg border-l-4',
                    notification.type === 'actionCompleted' && 'border-l-green-400',
                    notification.type === 'turnTimeout' && 'border-l-orange-400',
                    notification.type === 'error' && 'border-l-red-400',
                    (notification.type === 'turnStarted' || notification.type === 'turnEnded' || notification.type === 'phaseChanged') && 'border-l-blue-400'
                  )}
                >
                  <div className={ds(designSystem.text.body, 'text-sm')}>
                    {notification.message}
                  </div>
                  <div className={ds(designSystem.text.muted, 'text-xs mt-1')}>
                    {new Date(notification.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 