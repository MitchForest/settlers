'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { GameState, GameAction, ResourceCards } from '@settlers/game-engine'
import { ds, componentStyles, designSystem } from '@/lib/design-system'
import { Sword, Route, Gift, DollarSign, ArrowRight } from 'lucide-react'

interface DevelopmentCardDialogsProps {
  gameState: GameState
  localPlayerId: string
  onAction: (action: GameAction) => void
}

// Resource configuration
const RESOURCE_CONFIG = {
  wood: { emoji: '🌲', name: 'Wood' },
  brick: { emoji: '🧱', name: 'Brick' },
  ore: { emoji: '🪨', name: 'Ore' },
  wheat: { emoji: '🌾', name: 'Wheat' },
  sheep: { emoji: '🐑', name: 'Sheep' }
} as const

type ResourceType = keyof typeof RESOURCE_CONFIG

// Knight Card Dialog
export function KnightCardDialog({
  isOpen,
  onClose,
  gameState,
  localPlayerId,
  onAction
}: {
  isOpen: boolean
  onClose: () => void
  gameState: GameState
  localPlayerId: string
  onAction: (action: GameAction) => void
}) {
  const [selectedHex, setSelectedHex] = useState<string | null>(null)

  const getMovableHexes = () => {
    const movableHexes: Array<{ id: string, name: string, terrain: string | null }> = []
    
    gameState.board.hexes.forEach((hex, hexId) => {
      if (hex.terrain !== 'sea' && hex.terrain !== 'desert') {
        // Check if different from current robber position
        const currentRobber = gameState.board.robberPosition
        if (!currentRobber || 
            currentRobber.q !== hex.position.q || 
            currentRobber.r !== hex.position.r || 
            currentRobber.s !== hex.position.s) {
          movableHexes.push({
            id: hexId,
            name: `${hex.terrain || 'Unknown'} (${hex.numberToken ? hex.numberToken.toString() : 'No number'})`,
            terrain: hex.terrain
          })
        }
      }
    })
    
    return movableHexes
  }

  const handlePlayKnight = () => {
    if (!selectedHex) return
    
    const coords = selectedHex.split(',').map(Number)
    if (coords.length >= 3) {
      const [q, r, s] = coords
      
      onAction({
        type: 'playCard',
        playerId: localPlayerId,
        data: {
          cardType: 'knight',
          cardData: {
            robberPosition: { q, r, s }
          }
        }
      })
    }
    
    setSelectedHex(null)
    onClose()
  }

  const movableHexes = getMovableHexes()

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={ds(componentStyles.glassCard, 'sm:max-w-md text-white')}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sword className="w-5 h-5 text-red-400" />
            Play Knight Card
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className={ds(designSystem.text.body, 'text-sm')}>
            Move the robber to a new hex and steal a resource from an adjacent player.
          </div>
          
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {movableHexes.map(hex => (
              <button
                key={hex.id}
                onClick={() => setSelectedHex(hex.id)}
                className={ds(
                  designSystem.glass.secondary,
                  'w-full p-3 rounded-lg border border-white/20',
                  'hover:bg-white/10 transition-all duration-200',
                  'text-left',
                  selectedHex === hex.id && 'bg-red-500/20 border-red-400/40'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className={designSystem.text.body}>{hex.name}</span>
                  {selectedHex === hex.id && (
                    <ArrowRight className="w-4 h-4 text-red-400" />
                  )}
                </div>
              </button>
            ))}
          </div>
          
          <div className="flex gap-3">
            <Button
              onClick={handlePlayKnight}
              disabled={!selectedHex}
              className={ds(
                componentStyles.buttonPrimary,
                'flex-1 bg-red-500/20 border-red-400/30 hover:bg-red-500/30'
              )}
            >
              Play Knight
            </Button>
            <Button
              onClick={onClose}
              variant="outline"
              className={componentStyles.buttonSecondary}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Year of Plenty Dialog
export function YearOfPlentyDialog({
  isOpen,
  onClose,
  gameState: _gameState,
  localPlayerId,
  onAction
}: {
  isOpen: boolean
  onClose: () => void
  gameState: GameState
  localPlayerId: string
  onAction: (action: GameAction) => void
}) {
  const [selectedResources, setSelectedResources] = useState<ResourceCards>({
    wood: 0,
    brick: 0,
    ore: 0,
    wheat: 0,
    sheep: 0
  })

  const totalSelected = Object.values(selectedResources).reduce((sum, count) => sum + count, 0)
  const canPlay = totalSelected === 2

  const handleResourceChange = (resource: ResourceType, delta: number) => {
    const newCount = Math.max(0, selectedResources[resource] + delta)
    const newTotal = totalSelected - selectedResources[resource] + newCount
    
    if (newTotal <= 2) {
      setSelectedResources(prev => ({
        ...prev,
        [resource]: newCount
      }))
    }
  }

  const handlePlay = () => {
    if (!canPlay) return
    
    onAction({
      type: 'playCard',
      playerId: localPlayerId,
      data: {
        cardType: 'yearOfPlenty',
        cardData: {
          resources: selectedResources
        }
      }
    })
    
    setSelectedResources({ wood: 0, brick: 0, ore: 0, wheat: 0, sheep: 0 })
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={ds(componentStyles.glassCard, 'sm:max-w-md text-white')}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-green-400" />
            Year of Plenty
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className={ds(designSystem.text.body, 'text-sm')}>
            Choose 2 resources to take from the bank.
          </div>
          
          <div className="text-center">
            <Badge variant="outline" className="text-white/80">
              {totalSelected} / 2 selected
            </Badge>
          </div>
          
          <div className="space-y-2">
            {(Object.keys(RESOURCE_CONFIG) as ResourceType[]).map(resource => {
              const config = RESOURCE_CONFIG[resource]
              const count = selectedResources[resource]
              
              return (
                <div
                  key={resource}
                  className={ds(
                    designSystem.glass.secondary,
                    'p-3 rounded-lg flex items-center justify-between'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{config.emoji}</span>
                    <span className={designSystem.text.body}>{config.name}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResourceChange(resource, -1)}
                      disabled={count <= 0}
                      className="h-8 w-8 p-0"
                    >
                      -
                    </Button>
                    <span className="w-8 text-center">{count}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResourceChange(resource, 1)}
                      disabled={totalSelected >= 2}
                      className="h-8 w-8 p-0"
                    >
                      +
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
          
          <div className="flex gap-3">
            <Button
              onClick={handlePlay}
              disabled={!canPlay}
              className={ds(
                componentStyles.buttonPrimary,
                'flex-1 bg-green-500/20 border-green-400/30 hover:bg-green-500/30'
              )}
            >
              Take Resources
            </Button>
            <Button
              onClick={onClose}
              variant="outline"
              className={componentStyles.buttonSecondary}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Monopoly Dialog
export function MonopolyDialog({
  isOpen,
  onClose,
  gameState: _gameState,
  localPlayerId,
  onAction
}: {
  isOpen: boolean
  onClose: () => void
  gameState: GameState
  localPlayerId: string
  onAction: (action: GameAction) => void
}) {
  const [selectedResource, setSelectedResource] = useState<ResourceType | null>(null)

  const handlePlay = () => {
    if (!selectedResource) return
    
    onAction({
      type: 'playCard',
      playerId: localPlayerId,
      data: {
        cardType: 'monopoly',
        cardData: {
          resourceType: selectedResource
        }
      }
    })
    
    setSelectedResource(null)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={ds(componentStyles.glassCard, 'sm:max-w-md text-white')}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-yellow-400" />
            Monopoly
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className={ds(designSystem.text.body, 'text-sm')}>
            Choose a resource type. All other players must give you all their cards of that type.
          </div>
          
          <div className="space-y-2">
            {(Object.keys(RESOURCE_CONFIG) as ResourceType[]).map(resource => {
              const config = RESOURCE_CONFIG[resource]
              const isSelected = selectedResource === resource
              
              return (
                <button
                  key={resource}
                  onClick={() => setSelectedResource(resource)}
                  className={ds(
                    designSystem.glass.secondary,
                    'w-full p-3 rounded-lg border border-white/20',
                    'hover:bg-white/10 transition-all duration-200',
                    'flex items-center justify-between',
                    isSelected && 'bg-yellow-500/20 border-yellow-400/40'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{config.emoji}</span>
                    <span className={designSystem.text.body}>{config.name}</span>
                  </div>
                  {isSelected && (
                    <ArrowRight className="w-4 h-4 text-yellow-400" />
                  )}
                </button>
              )
            })}
          </div>
          
          <div className="flex gap-3">
            <Button
              onClick={handlePlay}
              disabled={!selectedResource}
              className={ds(
                componentStyles.buttonPrimary,
                'flex-1 bg-yellow-500/20 border-yellow-400/30 hover:bg-yellow-500/30'
              )}
            >
              Monopolize
            </Button>
            <Button
              onClick={onClose}
              variant="outline"
              className={componentStyles.buttonSecondary}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Road Building Dialog
export function RoadBuildingDialog({
  isOpen,
  onClose,
  gameState,
  localPlayerId,
  onAction
}: {
  isOpen: boolean
  onClose: () => void
  gameState: GameState
  localPlayerId: string
  onAction: (action: GameAction) => void
}) {
  const [selectedRoads, setSelectedRoads] = useState<string[]>([])

  // Get available road positions
  const getAvailableRoads = () => {
    const availableRoads: Array<{ id: string, name: string }> = []
    
    gameState.board.edges.forEach((edge, edgeId) => {
      if (!edge.connection) {
        // Check if connected to player's network (simplified)
        availableRoads.push({
          id: edgeId,
          name: `Road ${edgeId.substring(0, 8)}...`
        })
      }
    })
    
    return availableRoads.slice(0, 20) // Limit for UI performance
  }

  const handleRoadSelect = (roadId: string) => {
    if (selectedRoads.includes(roadId)) {
      setSelectedRoads(prev => prev.filter(id => id !== roadId))
    } else if (selectedRoads.length < 2) {
      setSelectedRoads(prev => [...prev, roadId])
    }
  }

  const handlePlay = () => {
    onAction({
      type: 'playCard',
      playerId: localPlayerId,
      data: {
        cardType: 'roadBuilding',
        cardData: {
          roadPositions: selectedRoads
        }
      }
    })
    
    setSelectedRoads([])
    onClose()
  }

  const availableRoads = getAvailableRoads()

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={ds(componentStyles.glassCard, 'sm:max-w-md text-white')}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Route className="w-5 h-5 text-orange-400" />
            Road Building
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className={ds(designSystem.text.body, 'text-sm')}>
            Choose up to 2 positions to build roads for free.
          </div>
          
          <div className="text-center">
            <Badge variant="outline" className="text-white/80">
              {selectedRoads.length} / 2 selected
            </Badge>
          </div>
          
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {availableRoads.map(road => {
              const isSelected = selectedRoads.includes(road.id)
              
              return (
                <button
                  key={road.id}
                  onClick={() => handleRoadSelect(road.id)}
                  className={ds(
                    designSystem.glass.secondary,
                    'w-full p-3 rounded-lg border border-white/20',
                    'hover:bg-white/10 transition-all duration-200',
                    'flex items-center justify-between',
                    isSelected && 'bg-orange-500/20 border-orange-400/40'
                  )}
                >
                  <span className={designSystem.text.body}>{road.name}</span>
                  {isSelected && (
                    <ArrowRight className="w-4 h-4 text-orange-400" />
                  )}
                </button>
              )
            })}
          </div>
          
          <div className="flex gap-3">
            <Button
              onClick={handlePlay}
              disabled={selectedRoads.length === 0}
              className={ds(
                componentStyles.buttonPrimary,
                'flex-1 bg-orange-500/20 border-orange-400/30 hover:bg-orange-500/30'
              )}
            >
              Build Roads
            </Button>
            <Button
              onClick={onClose}
              variant="outline"
              className={componentStyles.buttonSecondary}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Main component export
export function DevelopmentCardDialogs(_props: DevelopmentCardDialogsProps) {
  return (
    <>
      {/* Individual dialogs would be rendered when needed */}
    </>
  )
}