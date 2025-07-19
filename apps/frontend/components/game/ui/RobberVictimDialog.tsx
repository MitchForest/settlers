'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { GameState, Player, GameAction } from '@settlers/game-engine'
import { ds, componentStyles, designSystem } from '@/lib/design-system'
import { Sword, User, ArrowRight } from 'lucide-react'

interface RobberVictimDialogProps {
  isOpen: boolean
  onClose: () => void
  gameState: GameState
  robberHexId: string
  onSelectVictim: (action: GameAction) => void
  localPlayerId: string
}

export function RobberVictimDialog({
  isOpen,
  onClose,
  gameState,
  robberHexId,
  onSelectVictim,
  localPlayerId
}: RobberVictimDialogProps) {
  const [selectedVictim, setSelectedVictim] = useState<string | null>(null)

  // Find players with settlements/cities adjacent to the robber hex
  const getValidTargets = () => {
    const targets: Player[] = []
    
    // Find the hex position
    const hex = Array.from(gameState.board.hexes.values()).find(h => 
      `${h.position.q},${h.position.r},${h.position.s}` === robberHexId
    )
    
    if (!hex) return targets

    // Check each vertex adjacent to this hex for buildings
    gameState.board.vertices.forEach((vertex, vertexId) => {
      if (!vertex.building || vertex.building.owner === localPlayerId) return
      
      // Check if this vertex is adjacent to the robber hex
      const isAdjacent = vertex.position.hexes.some(vertexHex =>
        vertexHex.q === hex.position.q && 
        vertexHex.r === hex.position.r && 
        vertexHex.s === hex.position.s
      )
      
      if (isAdjacent) {
        const player = gameState.players.get(vertex.building.owner)
        if (player && !targets.find(t => t.id === player.id)) {
          // Only add players who have resources to steal
          const totalResources = Object.values(player.resources).reduce((sum, count) => sum + count, 0)
          if (totalResources > 0) {
            targets.push(player)
          }
        }
      }
    })
    
    return targets
  }

  const validTargets = getValidTargets()

  const handleSelectVictim = () => {
    if (!selectedVictim) return
    
    onSelectVictim({
      type: 'stealResource' as const,
      playerId: localPlayerId,
      data: {
        targetPlayerId: selectedVictim,
        hexPosition: robberHexId
      }
    })
    
    setSelectedVictim(null)
    onClose()
  }

  const handleSkip = () => {
    onSelectVictim({
      type: 'stealResource' as const,
      playerId: localPlayerId,
      data: {
        targetPlayerId: undefined, // No victim selected
        hexPosition: robberHexId
      }
    })
    
    onClose()
  }

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={ds(
        componentStyles.glassCard,
        'sm:max-w-md backdrop-blur-md text-white border-white/30'
      )}>
        <DialogHeader className="text-center">
          <DialogTitle className={ds(designSystem.text.heading, 'text-xl flex items-center gap-2 justify-center')}>
            <Sword className="w-5 h-5 text-red-400" />
            Choose Robbery Target
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {validTargets.length === 0 ? (
            <div className={ds(
              designSystem.glass.secondary,
              'p-4 rounded-lg text-center'
            )}>
              <div className={ds(designSystem.text.body, 'mb-2')}>
                No players to steal from
              </div>
              <div className={ds(designSystem.text.muted, 'text-sm')}>
                No opponents have buildings adjacent to the robber or resources to steal
              </div>
            </div>
          ) : (
            <>
              <div className={ds(designSystem.text.body, 'text-sm text-center')}>
                Select a player to steal a random resource from:
              </div>
              
              <div className="space-y-2">
                {validTargets.map(target => {
                  const totalResources = Object.values(target.resources).reduce((sum, count) => sum + count, 0)
                  const isSelected = selectedVictim === target.id
                  
                  return (
                    <button
                      key={target.id}
                      onClick={() => setSelectedVictim(target.id)}
                      className={ds(
                        designSystem.glass.secondary,
                        'w-full p-3 rounded-lg border border-white/20',
                        'hover:bg-white/10 transition-all duration-200',
                        'flex items-center justify-between',
                        isSelected && 'bg-blue-500/20 border-blue-400/40'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full bg-${target.color}-500`} />
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          <span className={ds(designSystem.text.body, 'font-medium')}>
                            {target.name}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-white/80 border-white/30">
                          {totalResources} cards
                        </Badge>
                        {isSelected && (
                          <ArrowRight className="w-4 h-4 text-blue-400" />
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          )}
          
          <div className="flex gap-3 pt-2">
            {validTargets.length > 0 && (
              <Button
                onClick={handleSelectVictim}
                disabled={!selectedVictim}
                className={ds(
                  componentStyles.buttonPrimary,
                  'flex-1 bg-red-500/20 border-red-400/30 hover:bg-red-500/30',
                  !selectedVictim && 'opacity-50 cursor-not-allowed'
                )}
              >
                Steal Resource
              </Button>
            )}
            
            <Button
              onClick={handleSkip}
              variant="outline"
              className={ds(
                componentStyles.buttonSecondary,
                validTargets.length === 0 ? 'flex-1' : ''
              )}
            >
              {validTargets.length === 0 ? 'Continue' : 'Skip'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}