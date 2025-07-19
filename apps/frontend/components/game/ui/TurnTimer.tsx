'use client'

import React, { useEffect, useState } from 'react'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Clock, Bot, User, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTurnStore } from '@/stores/turnStore'
import type { GamePhase, PlayerId } from '@settlers/game-engine'

interface TurnTimerProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  showPhase?: boolean
  showPlayerName?: boolean
  animated?: boolean
  compactMode?: boolean
}

interface TimerState {
  remainingMs: number
  totalMs: number
  percentage: number
  isWarning: boolean
  isCritical: boolean
  isExpired: boolean
}

/**
 * 🕐 TURN TIMER COMPONENT
 * 
 * Visual turn timer with:
 * - Real-time countdown with smooth progress bar
 * - Phase-specific styling and warnings
 * - Different displays for human vs AI turns  
 * - Warning states for low time remaining
 * - Animated transitions and pulse effects
 */
export function TurnTimer({ 
  className,
  size = 'md',
  showPhase = true,
  showPlayerName = true,
  animated = true,
  compactMode = false
}: TurnTimerProps) {
  const {
    currentTurn,
    aiTurn,
    getRemainingTime,
    getTurnDuration
  } = useTurnStore()

  const [timerState, setTimerState] = useState<TimerState>({
    remainingMs: 0,
    totalMs: 0,
    percentage: 100,
    isWarning: false,
    isCritical: false,
    isExpired: false
  })

  // Update timer state every 100ms for smooth animation
  useEffect(() => {
    if (!currentTurn.isActive || !currentTurn.timing) {
      setTimerState({
        remainingMs: 0,
        totalMs: 0,
        percentage: 100,
        isWarning: false,
        isCritical: false,
        isExpired: false
      })
      return
    }

    const updateTimer = () => {
      const remainingMs = getRemainingTime()
      const totalMs = currentTurn.timing!.durationMs
      const percentage = totalMs > 0 ? (remainingMs / totalMs) * 100 : 0
      
      // Warning thresholds
      const warningThreshold = totalMs * 0.3  // 30% remaining
      const criticalThreshold = totalMs * 0.1 // 10% remaining
      
      setTimerState({
        remainingMs,
        totalMs,
        percentage: Math.max(0, percentage),
        isWarning: remainingMs <= warningThreshold && remainingMs > criticalThreshold,
        isCritical: remainingMs <= criticalThreshold && remainingMs > 0,
        isExpired: remainingMs <= 0
      })
    }

    // Initial update
    updateTimer()

    // Set up interval for smooth updates
    const interval = setInterval(updateTimer, 100)
    return () => clearInterval(interval)
  }, [currentTurn.isActive, currentTurn.timing, getRemainingTime])

  // Format time display
  const formatTime = (ms: number): string => {
    const seconds = Math.ceil(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60

    if (minutes > 0) {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
    }
    return `${seconds}s`
  }

  // Get phase display info
  const getPhaseInfo = (phase: GamePhase | null) => {
    switch (phase) {
      case 'setup1': return { label: 'Setup Round 1', color: 'bg-blue-500' }
      case 'setup2': return { label: 'Setup Round 2', color: 'bg-blue-600' }
      case 'roll': return { label: 'Roll Dice', color: 'bg-yellow-500' }
      case 'actions': return { label: 'Main Turn', color: 'bg-green-500' }
      case 'discard': return { label: 'Discard', color: 'bg-red-500' }
      case 'moveRobber': return { label: 'Move Robber', color: 'bg-purple-500' }
      case 'steal': return { label: 'Steal', color: 'bg-red-600' }
      case 'ended': return { label: 'Game Over', color: 'bg-gray-600' }
      default: return { label: 'Game', color: 'bg-gray-500' }
    }
  }

  // Get timer color based on state
  const getTimerColor = () => {
    if (timerState.isExpired) return 'destructive'
    if (timerState.isCritical) return 'destructive'
    if (timerState.isWarning) return 'warning'
    if (aiTurn.isAITurn) return 'info'
    return 'primary'
  }

  // Get progress bar color class
  const getProgressColorClass = () => {
    if (timerState.isExpired) return 'bg-destructive'
    if (timerState.isCritical) return 'bg-destructive'
    if (timerState.isWarning) return 'bg-warning'
    if (aiTurn.isAITurn) return 'bg-info'
    return 'bg-primary'
  }

  // Size configuration
  const sizeConfig = {
    sm: {
      container: 'h-16 text-xs',
      progress: 'h-1',
      icon: 'h-3 w-3',
      text: 'text-xs',
      badge: 'text-xs px-1 py-0.5'
    },
    md: {
      container: 'h-20 text-sm',
      progress: 'h-2',
      icon: 'h-4 w-4',
      text: 'text-sm',
      badge: 'text-xs px-2 py-1'
    },
    lg: {
      container: 'h-24 text-base',
      progress: 'h-3',
      icon: 'h-5 w-5',
      text: 'text-base',
      badge: 'text-sm px-3 py-1'
    }
  }

  const config = sizeConfig[size]
  const phaseInfo = getPhaseInfo(currentTurn.phase)

  // Don't render if no active turn
  if (!currentTurn.isActive) {
    return null
  }

  // Compact mode rendering
  if (compactMode) {
    return (
      <div className={cn(
        'flex items-center gap-2 p-2 rounded-lg bg-card border',
        animated && timerState.isCritical && 'animate-pulse',
        className
      )}>
        {aiTurn.isAITurn ? (
          <Bot className={cn(config.icon, 'text-info')} />
        ) : (
          <User className={cn(config.icon, currentTurn.isMyTurn ? 'text-primary' : 'text-muted-foreground')} />
        )}
        
        <div className="flex-1 min-w-0">
          <Progress 
            value={timerState.percentage} 
            className={cn(config.progress, 'w-full')}
            style={{
              '--progress-foreground': timerState.isCritical ? 'hsl(var(--destructive))' : 
                                      timerState.isWarning ? 'hsl(var(--warning))' :
                                      aiTurn.isAITurn ? 'hsl(var(--info))' : 'hsl(var(--primary))'
            } as React.CSSProperties}
          />
        </div>
        
        <div className={cn(config.text, 'font-mono font-medium')}>
          {formatTime(timerState.remainingMs)}
        </div>
      </div>
    )
  }

  // Full mode rendering
  return (
    <div className={cn(
      'bg-card border rounded-lg shadow-sm transition-all duration-200',
      config.container,
      animated && timerState.isCritical && 'animate-pulse border-destructive',
      animated && timerState.isWarning && 'border-warning',
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 pb-2">
        <div className="flex items-center gap-2">
          {/* Player Type Icon */}
          {aiTurn.isAITurn ? (
            <Bot className={cn(config.icon, 'text-info')} />
          ) : (
            <User className={cn(config.icon, currentTurn.isMyTurn ? 'text-primary' : 'text-muted-foreground')} />
          )}
          
          {/* Player Name */}
          {showPlayerName && (
            <span className={cn(config.text, 'font-medium')}>
              {aiTurn.isAITurn ? (
                <span className="flex items-center gap-1">
                  AI Player
                  {aiTurn.aiThinking && (
                    <span className="text-info animate-pulse">thinking...</span>
                  )}
                </span>
              ) : (
                currentTurn.isMyTurn ? 'Your Turn' : `${currentTurn.playerId}'s Turn`
              )}
            </span>
          )}
        </div>

        {/* Status Icons */}
        <div className="flex items-center gap-1">
          {timerState.isExpired && (
            <XCircle className={cn(config.icon, 'text-destructive')} />
          )}
          {timerState.isCritical && !timerState.isExpired && (
            <AlertTriangle className={cn(config.icon, 'text-destructive animate-pulse')} />
          )}
          {!timerState.isWarning && !timerState.isCritical && !timerState.isExpired && (
            <Clock className={cn(config.icon, 'text-muted-foreground')} />
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="px-3 pb-2">
        <Progress 
          value={timerState.percentage} 
          className={cn(config.progress, 'w-full')}
          style={{
            '--progress-foreground': timerState.isCritical ? 'hsl(var(--destructive))' : 
                                    timerState.isWarning ? 'hsl(var(--warning))' :
                                    aiTurn.isAITurn ? 'hsl(var(--info))' : 'hsl(var(--primary))'
          } as React.CSSProperties}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 pb-3">
        {/* Phase Badge */}
        {showPhase && currentTurn.phase && (
          <Badge 
            variant="outline" 
            className={cn(
              config.badge,
              'flex items-center gap-1'
            )}
          >
            <div className={cn('w-2 h-2 rounded-full', phaseInfo.color)} />
            {phaseInfo.label}
          </Badge>
        )}

        {/* Time Display */}
        <div className={cn(
          config.text,
          'font-mono font-bold',
          timerState.isExpired && 'text-destructive',
          timerState.isCritical && 'text-destructive',
          timerState.isWarning && 'text-warning'
        )}>
          {timerState.isExpired ? 'EXPIRED' : formatTime(timerState.remainingMs)}
        </div>
      </div>

      {/* AI Status */}
      {aiTurn.isAITurn && aiTurn.aiActionDescription && (
        <div className="px-3 pb-2">
          <div className={cn(
            config.text,
            'text-info bg-info/10 rounded px-2 py-1 text-center'
          )}>
            {aiTurn.aiActionDescription}
          </div>
        </div>
      )}
    </div>
  )
}

// Export timer utilities for other components
export const TurnTimerUtils = {
  formatTime: (ms: number): string => {
    const seconds = Math.ceil(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60

    if (minutes > 0) {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
    }
    return `${seconds}s`
  },

  getTimeColor: (remainingMs: number, totalMs: number): 'default' | 'warning' | 'critical' | 'expired' => {
    if (remainingMs <= 0) return 'expired'
    if (remainingMs <= totalMs * 0.1) return 'critical'
    if (remainingMs <= totalMs * 0.3) return 'warning'
    return 'default'
  },

  getProgressPercentage: (remainingMs: number, totalMs: number): number => {
    return totalMs > 0 ? Math.max(0, (remainingMs / totalMs) * 100) : 0
  }
} 