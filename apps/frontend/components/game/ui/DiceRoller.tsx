'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { DiceRoll, GameAction } from '@settlers/core'

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
  isRolling = false, 
  canRoll = false,
  currentRoll
}: DiceRollerProps) {
  const [isAnimating, setIsAnimating] = useState(false)

  const handleRoll = () => {
    if (disabled || isAnimating || !canRoll) return

    setIsAnimating(true)
    
    // Create the roll action for the game engine
    const rollAction: GameAction = {
      type: 'roll',
      playerId: '', // Will be set by the parent component
      data: {}
    }
    
    // Animation delay to show dice rolling
    setTimeout(() => {
      setIsAnimating(false)
      onRoll(rollAction)
    }, 1200)
  }

  return (
    <Card className="p-4 bg-white/10 backdrop-blur-sm border-white/20">
      <div className="flex flex-col items-center space-y-4">
        <h3 className="text-lg font-semibold text-white">Roll Dice</h3>
        
        {/* Dice Display */}
        <div className="flex space-x-4">
          <Die value={currentRoll?.die1} isAnimating={isAnimating} />
          <Die value={currentRoll?.die2} isAnimating={isAnimating} />
        </div>

        {/* Roll Result */}
        {currentRoll && !isAnimating && (
          <div className="text-center">
            <div className="text-2xl font-bold text-white">
              {currentRoll.sum}
            </div>
            <div className="text-sm text-white/70">
              {currentRoll.die1} + {currentRoll.die2}
            </div>
          </div>
        )}

        {/* Roll Button */}
        <Button
          onClick={handleRoll}
          disabled={disabled || isAnimating || !canRoll}
          size="lg"
          className={cn(
            "transition-all duration-200",
            isAnimating && "scale-95",
            canRoll && !disabled && !isAnimating && "hover:scale-105"
          )}
        >
          {isAnimating ? (
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
          <div className="text-xs text-white/60 text-center">
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