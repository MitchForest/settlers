'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ds, designSystem } from '@/lib/design-system'
import { useTurnStore } from '@/stores/turnStore'
import { useGameStore } from '@/stores/gameStore'
import { 
  Dice1, 
  Dice6, 
  Home, 
  Building, 
  Route, 
  Scroll, 
  Users, 
  ArrowRight,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react'
import type { GameAction, GamePhase, Player } from '@settlers/game-engine'

interface TurnActionsPanelProps {
  onAction: (action: GameAction) => Promise<boolean>
  className?: string
  compactMode?: boolean
}

// Action configuration with design system integration
const ACTION_CONFIG = {
  rollDice: {
    icon: Dice6,
    label: 'Roll Dice',
    description: 'Roll dice to start your turn',
    phase: ['roll'] as GamePhase[],
    style: designSystem.accents.blue
  },
  buildSettlement: {
    icon: Home,
    label: 'Build Settlement',
    description: 'Build a new settlement (🌲🧱🌾🐑)',
    phase: ['actions', 'setup1', 'setup2'] as GamePhase[],
    style: designSystem.accents.green,
    cost: ['🌲', '🧱', '🌾', '🐑']
  },
  buildCity: {
    icon: Building,
    label: 'Build City',
    description: 'Upgrade settlement to city (🌾🌾🪨🪨🪨)',
    phase: ['actions'] as GamePhase[],
    style: designSystem.accents.purple,
    cost: ['🌾', '🌾', '🪨', '🪨', '🪨']
  },
  buildRoad: {
    icon: Route,
    label: 'Build Road',
    description: 'Build a new road (🌲🧱)',
    phase: ['actions', 'setup1', 'setup2'] as GamePhase[],
    style: designSystem.accents.orange,
    cost: ['🌲', '🧱']
  },
  buyCard: {
    icon: Scroll,
    label: 'Buy Development Card',
    description: 'Purchase a development card (🌾🐑🪨)',
    phase: ['actions'] as GamePhase[],
    style: designSystem.accents.blue,
    cost: ['🌾', '🐑', '🪨']
  },
  trade: {
    icon: Users,
    label: 'Trade',
    description: 'Trade resources with players or bank',
    phase: ['actions'] as GamePhase[],
    style: designSystem.accents.green
  },
  endTurn: {
    icon: ArrowRight,
    label: 'End Turn',
    description: 'Complete your turn and pass to next player',
    phase: ['actions'] as GamePhase[],
    style: designSystem.accents.red
  }
} as const

export function TurnActionsPanel({ onAction, className, compactMode = false }: TurnActionsPanelProps) {
  const { currentTurn, aiTurn } = useTurnStore()
  const gameState = useGameStore(state => state.gameState)
  const localPlayerId = useGameStore(state => state.localPlayerId)

  if (!gameState || !localPlayerId) {
    return null
  }

  const myPlayer = gameState.players.get(localPlayerId) as Player | undefined
  const isMyTurn = currentTurn.isMyTurn
  const currentPhase = currentTurn.phase || gameState.phase
  const availableActions = currentTurn.availableActions

  // Don't show during AI turns
  if (aiTurn.isAITurn) {
    return (
      <div className={ds(
        designSystem.glass.primary,
        'p-4 rounded-lg',
        className
      )}>
        <div className="flex items-center gap-3">
          <div className="animate-spin w-4 h-4 border-2 border-white/20 border-t-white rounded-full" />
          <div className={designSystem.text.body}>
            AI Player {aiTurn.aiActionDescription ? `- ${aiTurn.aiActionDescription}` : 'thinking...'}
          </div>
        </div>
      </div>
    )
  }

  // Filter actions based on current phase and availability
  const getFilteredActions = () => {
    return Object.entries(ACTION_CONFIG).filter(([actionType, config]) => {
      // Check if action is valid for current phase
      if (!config.phase.includes(currentPhase)) return false
      
      // Check if action is in available actions (if specified)
      if (availableActions.length > 0 && !availableActions.includes(actionType)) return false
      
      return true
    })
  }

  const handleAction = async (actionType: string) => {
    try {
      const action: GameAction = {
        type: actionType as GameAction['type'],
        playerId: localPlayerId,
        data: {}
      }
      
      await onAction(action)
    } catch (error) {
      console.error('Action failed:', error)
    }
  }

  const renderActionButton = (actionType: string, config: typeof ACTION_CONFIG[keyof typeof ACTION_CONFIG]) => {
    const Icon = config.icon
    const isDisabled = !isMyTurn

    return (
      <Button
        key={actionType}
        onClick={() => handleAction(actionType)}
        disabled={isDisabled}
        className={ds(
          designSystem.interactive.primary.base,
          designSystem.interactive.primary.hover,
          designSystem.interactive.primary.disabled,
          'flex items-center gap-2 justify-start text-left',
          compactMode ? 'px-3 py-2 text-sm' : 'px-4 py-3',
          config.style.subtle,
          config.style.hover
        )}
      >
        <Icon className={compactMode ? 'w-4 h-4' : 'w-5 h-5'} />
        <div className="flex-1">
          <div className="font-medium">{config.label}</div>
          {!compactMode && (
            <div className={ds(designSystem.text.muted, 'text-xs')}>
              {config.description}
            </div>
          )}
        </div>
        {'cost' in config && config.cost && (
          <div className="flex gap-1">
            {config.cost.map((resource: string, index: number) => (
              <span key={index} className="text-sm">{resource}</span>
            ))}
          </div>
        )}
      </Button>
    )
  }

  if (compactMode) {
    return (
      <div className={ds(
        designSystem.glass.secondary,
        'p-3 rounded-lg space-y-2',
        className
      )}>
        {/* Turn Status */}
        <div className="flex items-center justify-between">
          <div className={ds(designSystem.text.body, 'text-sm font-medium')}>
            {isMyTurn ? 'Your Turn' : 'Waiting...'}
          </div>
          <Badge 
            variant="outline" 
            className={ds(
              'text-xs',
              isMyTurn ? designSystem.accents.green.subtle : designSystem.glass.tertiary
            )}
          >
            {currentPhase}
          </Badge>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          {getFilteredActions().map(([actionType, config]) => 
            renderActionButton(actionType, config)
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={ds(
      designSystem.glass.primary,
      'p-4 rounded-lg space-y-4',
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className={ds(designSystem.text.heading, 'text-lg')}>
            Turn Actions
          </h3>
          <div className={ds(designSystem.text.muted, 'text-sm')}>
            Phase: {currentPhase} • Turn {currentTurn.turnNumber}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {isMyTurn ? (
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className={ds(designSystem.text.body, 'text-sm')}>Your turn</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-400" />
              <span className={ds(designSystem.text.muted, 'text-sm')}>Waiting</span>
            </div>
          )}
        </div>
      </div>

      {/* Actions this turn */}
      {currentTurn.actionsThisTurn.length > 0 && (
        <div className={ds(designSystem.glass.secondary, 'p-3 rounded-lg')}>
          <div className={ds(designSystem.text.body, 'text-sm font-medium mb-2')}>
            Actions This Turn ({currentTurn.actionsThisTurn.length})
          </div>
          <div className="flex flex-wrap gap-1">
            {currentTurn.actionsThisTurn.map((action, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {action.type}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Available Actions */}
      <div className="space-y-2">
        <div className={ds(designSystem.text.body, 'text-sm font-medium')}>
          Available Actions
        </div>
        
        {getFilteredActions().length === 0 ? (
          <div className={ds(
            designSystem.glass.secondary,
            'p-4 rounded-lg text-center'
          )}>
            <XCircle className="w-8 h-8 mx-auto mb-2 text-white/40" />
            <div className={designSystem.text.muted}>
              {isMyTurn ? 'No actions available in this phase' : 'Wait for your turn'}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {getFilteredActions().map(([actionType, config]) => 
              renderActionButton(actionType, config)
            )}
          </div>
        )}
      </div>

      {/* End Turn Button */}
      {isMyTurn && currentTurn.canEndTurn && (
        <div className="pt-2 border-t border-white/10">
          <Button
            onClick={() => handleAction('endTurn')}
            className={ds(
              designSystem.interactive.secondary.base,
              designSystem.interactive.secondary.hover,
              'w-full flex items-center justify-center gap-2',
              designSystem.accents.red.subtle,
              designSystem.accents.red.hover
            )}
          >
            <ArrowRight className="w-4 h-4" />
            End Turn
          </Button>
        </div>
      )}
    </div>
  )
} 