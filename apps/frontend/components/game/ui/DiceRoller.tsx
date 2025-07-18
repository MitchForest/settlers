'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { DiceRoll, GameAction } from '@settlers/core'
import { ds, componentStyles, designSystem } from '@/lib/design-system'

interface DiceRollerProps {
  onRoll: (action: GameAction) => void
  disabled?: boolean
  isRolling?: boolean
  canRoll?: boolean
  currentRoll?: DiceRoll | null
}

export function DiceRoller({
  onRoll,
  disabled = false,
  canRoll = false,
  currentRoll
}: DiceRollerProps) {
  const [_isRolling, setIsRolling] = useState(false)

  const handleRoll = () => {
    if (disabled || _isRolling || !canRoll) return

    setIsRolling(true)
    
    // Create the roll action for the game engine
    const rollAction: GameAction = {
      type: 'roll',
      playerId: '', // Will be set by the parent component
      data: {}
    }
    
    // Animation delay to show dice rolling
    setTimeout(() => {
      setIsRolling(false)
      onRoll(rollAction)
    }, 1200)
  }

  return (
    <Card className={ds(componentStyles.glassCard, 'p-6 border-white/30')}>
      <div className="flex flex-col items-center space-y-4">
        <h3 className={ds(designSystem.text.heading, 'text-lg font-semibold')}>Roll Dice</h3>
        
        {/* Dice Display */}
        <div className="flex space-x-4">
          <Die value={currentRoll?.die1} isAnimating={_isRolling} />
          <Die value={currentRoll?.die2} isAnimating={_isRolling} />
        </div>

        {/* Roll Result */}
        {currentRoll && !_isRolling && (
          <div className="text-center">
            <div className={ds(designSystem.text.heading, 'text-2xl font-bold')}>
              {currentRoll.sum}
            </div>
            <div className={ds(designSystem.text.muted, 'text-sm')}>
              {currentRoll.die1} + {currentRoll.die2}
            </div>
          </div>
        )}

        {/* Roll Button */}
        <Button
          onClick={handleRoll}
          disabled={disabled || _isRolling || !canRoll}
          size="lg"
          className={ds(
            componentStyles.buttonPrimary,
            'bg-blue-500/20 border-blue-400/30 hover:bg-blue-500/30',
            'transition-all duration-200',
            _isRolling && 'scale-95',
            canRoll && !disabled && !_isRolling && 'hover:scale-105'
          )}
        >
          {_isRolling ? (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              <span>Rolling...</span>
            </div>
          ) : (
            'Roll Dice'
          )}
        </Button>

        {/* Roll Status */}
        {!canRoll && !disabled && (
          <div className={ds(designSystem.text.muted, 'text-xs text-center')}>
            Not your turn to roll
          </div>
        )}
      </div>
    </Card>
  )
}

interface DieProps {
  value?: number
  isAnimating?: boolean
}

function Die({ value, isAnimating }: DieProps) {
  return (
    <div className={cn(
      "w-16 h-16 bg-white rounded-lg shadow-lg flex items-center justify-center text-2xl font-bold text-black transition-all duration-300",
      isAnimating && "animate-bounce"
    )}>
      {isAnimating ? (
        <div className="animate-spin">⚄</div>
      ) : (
        value ? getDieFace(value) : '?'
      )}
    </div>
  )
}

function getDieFace(value: number): string {
  const faces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅']
  return faces[value - 1] || '?'
} 