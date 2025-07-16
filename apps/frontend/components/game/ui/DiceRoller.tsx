'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { DiceRoll } from '@settlers/core'

interface DiceRollerProps {
  onRoll: (dice: DiceRoll) => void
  disabled?: boolean
  isRolling?: boolean
}

export function DiceRoller({ onRoll, disabled = false, isRolling = false }: DiceRollerProps) {
  const [lastRoll, setLastRoll] = useState<DiceRoll | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)

  const handleRoll = () => {
    if (disabled || isAnimating) return

    setIsAnimating(true)
    
    // Simple dice roll calculation (same as core engine)
    const die1 = Math.floor(Math.random() * 6) + 1
    const die2 = Math.floor(Math.random() * 6) + 1
    const roll: DiceRoll = {
      die1,
      die2,
      sum: die1 + die2,
      timestamp: Date.now()
    }

    setLastRoll(roll)
    
    // Animation delay
    setTimeout(() => {
      setIsAnimating(false)
      onRoll(roll)
    }, 1200)
  }

  return (
    <Card className="p-4 bg-white/10 backdrop-blur-sm border-white/20">
      <div className="flex flex-col items-center space-y-4">
        <h3 className="text-lg font-semibold text-white">Roll Dice</h3>
        
        {/* Dice Display */}
        <div className="flex space-x-4">
          <Die value={lastRoll?.die1} isAnimating={isAnimating} />
          <Die value={lastRoll?.die2} isAnimating={isAnimating} />
        </div>
        
        {/* Sum Display */}
        {lastRoll && !isAnimating && (
          <div className="text-center">
            <div className="text-2xl font-bold text-white">
              {lastRoll.sum}
            </div>
            <div className="text-sm text-white/70">
              Total
            </div>
          </div>
        )}
        
        {/* Roll Button */}
        <Button
          onClick={handleRoll}
          disabled={disabled || isAnimating || isRolling}
          variant="default"
          size="lg"
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isAnimating || isRolling ? 'Rolling...' : 'Roll Dice'}
        </Button>
      </div>
    </Card>
  )
}

interface DieProps {
  value?: number
  isAnimating: boolean
}

function Die({ value, isAnimating }: DieProps) {
  return (
    <div
      className={cn(
        "w-16 h-16 bg-white rounded-lg shadow-lg flex items-center justify-center border-2 border-gray-300",
        "transition-transform duration-300",
        isAnimating && "animate-bounce"
      )}
    >
      {value && !isAnimating ? (
        <DiceFace value={value} />
      ) : (
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" />
      )}
    </div>
  )
}

function DiceFace({ value }: { value: number }) {
  const dots = Array.from({ length: value }, (_, i) => i)
  
  return (
    <div className="w-12 h-12 relative">
      {value === 1 && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-black rounded-full" />
      )}
      {value === 2 && (
        <>
          <div className="absolute top-2 left-2 w-2 h-2 bg-black rounded-full" />
          <div className="absolute bottom-2 right-2 w-2 h-2 bg-black rounded-full" />
        </>
      )}
      {value === 3 && (
        <>
          <div className="absolute top-1 left-1 w-2 h-2 bg-black rounded-full" />
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-black rounded-full" />
          <div className="absolute bottom-1 right-1 w-2 h-2 bg-black rounded-full" />
        </>
      )}
      {value === 4 && (
        <>
          <div className="absolute top-2 left-2 w-2 h-2 bg-black rounded-full" />
          <div className="absolute top-2 right-2 w-2 h-2 bg-black rounded-full" />
          <div className="absolute bottom-2 left-2 w-2 h-2 bg-black rounded-full" />
          <div className="absolute bottom-2 right-2 w-2 h-2 bg-black rounded-full" />
        </>
      )}
      {value === 5 && (
        <>
          <div className="absolute top-1 left-1 w-2 h-2 bg-black rounded-full" />
          <div className="absolute top-1 right-1 w-2 h-2 bg-black rounded-full" />
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-black rounded-full" />
          <div className="absolute bottom-1 left-1 w-2 h-2 bg-black rounded-full" />
          <div className="absolute bottom-1 right-1 w-2 h-2 bg-black rounded-full" />
        </>
      )}
      {value === 6 && (
        <>
          <div className="absolute top-1 left-2 w-2 h-2 bg-black rounded-full" />
          <div className="absolute top-1 right-2 w-2 h-2 bg-black rounded-full" />
          <div className="absolute top-1/2 left-2 transform -translate-y-1/2 w-2 h-2 bg-black rounded-full" />
          <div className="absolute top-1/2 right-2 transform -translate-y-1/2 w-2 h-2 bg-black rounded-full" />
          <div className="absolute bottom-1 left-2 w-2 h-2 bg-black rounded-full" />
          <div className="absolute bottom-1 right-2 w-2 h-2 bg-black rounded-full" />
        </>
      )}
    </div>
  )
} 