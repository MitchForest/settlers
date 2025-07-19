'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Player, GameAction, ResourceCards } from '@settlers/game-engine'
import { ds, componentStyles, designSystem } from '@/lib/design-system'
import { Trash2, RotateCcw, CheckCircle } from 'lucide-react'

interface DiscardCardsDialogProps {
  isOpen: boolean
  onClose: () => void
  player: Player
  requiredDiscards: number
  onDiscard: (action: GameAction) => void
  localPlayerId: string
}

// Resource emojis and names
const RESOURCE_CONFIG = {
  wood: { emoji: '🌲', name: 'Wood' },
  brick: { emoji: '🧱', name: 'Brick' },
  ore: { emoji: '🪨', name: 'Ore' },
  wheat: { emoji: '🌾', name: 'Wheat' },
  sheep: { emoji: '🐑', name: 'Sheep' }
} as const

type ResourceType = keyof typeof RESOURCE_CONFIG

export function DiscardCardsDialog({
  isOpen,
  onClose,
  player,
  requiredDiscards,
  onDiscard,
  localPlayerId
}: DiscardCardsDialogProps) {
  const [selectedDiscards, setSelectedDiscards] = useState<ResourceCards>({
    wood: 0,
    brick: 0,
    ore: 0,
    wheat: 0,
    sheep: 0
  })

  const totalSelected = Object.values(selectedDiscards).reduce((sum, count) => sum + count, 0)
  const canSubmit = totalSelected === requiredDiscards

  const handleResourceChange = (resource: ResourceType, delta: number) => {
    const currentCount = selectedDiscards[resource]
    const maxAvailable = player.resources[resource]
    const newCount = Math.max(0, Math.min(maxAvailable, currentCount + delta))
    
    // Don't exceed required discards
    const currentTotal = totalSelected - currentCount + newCount
    if (currentTotal > requiredDiscards) return
    
    setSelectedDiscards(prev => ({
      ...prev,
      [resource]: newCount
    }))
  }

  const handleReset = () => {
    setSelectedDiscards({
      wood: 0,
      brick: 0,
      ore: 0,
      wheat: 0,
      sheep: 0
    })
  }

  const handleSubmit = () => {
    if (!canSubmit) return
    
    onDiscard({
      type: 'discard' as const,
      playerId: localPlayerId,
      data: {
        discardedCards: selectedDiscards
      }
    })
    
    handleReset()
    onClose()
  }

  const ResourceCounter = ({ resource }: { resource: ResourceType }) => {
    const config = RESOURCE_CONFIG[resource]
    const available = player.resources[resource]
    const selected = selectedDiscards[resource]
    const remaining = available - selected
    
    return (
      <div className={ds(
        designSystem.glass.secondary,
        'p-3 rounded-lg border border-white/20',
        'flex items-center justify-between',
        available === 0 && 'opacity-50'
      )}>
        <div className="flex items-center gap-3">
          <span className="text-lg">{config.emoji}</span>
          <div>
            <div className={ds(designSystem.text.body, 'font-medium')}>
              {config.name}
            </div>
            <div className={ds(designSystem.text.muted, 'text-xs')}>
              {remaining} remaining of {available}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleResourceChange(resource, -1)}
            disabled={selected <= 0}
            className={ds(
              'h-8 w-8 p-0',
              componentStyles.buttonSecondary,
              'hover:scale-110 transition-all duration-200'
            )}
          >
            -
          </Button>
          
          <span className={ds(
            designSystem.text.body, 
            'w-8 text-center font-medium',
            selected > 0 && 'text-red-300'
          )}>
            {selected}
          </span>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleResourceChange(resource, 1)}
            disabled={selected >= available || totalSelected >= requiredDiscards}
            className={ds(
              'h-8 w-8 p-0',
              componentStyles.buttonSecondary,
              'hover:scale-110 transition-all duration-200'
            )}
          >
            +
          </Button>
        </div>
      </div>
    )
  }

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={ds(
        componentStyles.glassCard,
        'sm:max-w-lg backdrop-blur-md text-white border-white/30'
      )}>
        <DialogHeader className="text-center">
          <DialogTitle className={ds(designSystem.text.heading, 'text-xl flex items-center gap-2 justify-center')}>
            <Trash2 className="w-5 h-5 text-orange-400" />
            Discard Cards
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className={ds(
            designSystem.glass.secondary,
            'p-4 rounded-lg text-center'
          )}>
            <div className={ds(designSystem.text.body, 'mb-2')}>
              You must discard {requiredDiscards} cards due to the robber
            </div>
            <div className={ds(designSystem.text.muted, 'text-sm')}>
              You have {Object.values(player.resources).reduce((sum, count) => sum + count, 0)} cards total
            </div>
          </div>

          {/* Progress indicator */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className={designSystem.text.muted}>Progress</span>
              <span className={ds(
                designSystem.text.body,
                canSubmit ? 'text-green-400' : totalSelected > requiredDiscards ? 'text-red-400' : 'text-white'
              )}>
                {totalSelected} / {requiredDiscards}
              </span>
            </div>
            <Progress 
              value={(totalSelected / requiredDiscards) * 100} 
              className="h-2"
            />
          </div>

          {/* Resource selection */}
          <div className="space-y-2">
            {(Object.keys(RESOURCE_CONFIG) as ResourceType[]).map(resource => (
              <ResourceCounter key={resource} resource={resource} />
            ))}
          </div>

          {/* Warning if too many selected */}
          {totalSelected > requiredDiscards && (
            <div className={ds(
              'p-3 rounded-lg border border-red-400/40 bg-red-500/20',
              'text-center text-red-300'
            )}>
              Too many cards selected! Remove {totalSelected - requiredDiscards} more.
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleReset}
              variant="outline"
              className={ds(
                componentStyles.buttonSecondary,
                'flex items-center gap-2'
              )}
              disabled={totalSelected === 0}
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </Button>
            
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={ds(
                componentStyles.buttonPrimary,
                'flex-1 flex items-center gap-2',
                canSubmit 
                  ? 'bg-green-500/20 border-green-400/30 hover:bg-green-500/30'
                  : 'opacity-50 cursor-not-allowed'
              )}
            >
              <CheckCircle className="w-4 h-4" />
              Discard Cards
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}