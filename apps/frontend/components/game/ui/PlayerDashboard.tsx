'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useGameTheme } from '@/components/theme-provider'
import { GameTheme } from '@/lib/theme-types'
import { Player, ResourceCards, GamePhase, BUILDING_COSTS } from '@settlers/game-engine'
import { hasResources } from '@settlers/game-engine'

interface PlayerDashboardProps {
  player: Player
  gamePhase: GamePhase
  isCurrentPlayer: boolean
  canRoll?: boolean
  onAction: (action: string, data?: unknown) => void
}

export function PlayerDashboard({ 
  player, 
  gamePhase, 
  isCurrentPlayer, 
  canRoll = false,
  onAction 
}: PlayerDashboardProps) {
  const { theme } = useGameTheme()
  
  const canBuildSettlement = hasResources(player.resources, BUILDING_COSTS.settlement) && player.buildings.settlements > 0
  const canBuildCity = hasResources(player.resources, BUILDING_COSTS.city) && player.buildings.cities > 0
  const canBuildRoad = hasResources(player.resources, BUILDING_COSTS.road) && player.buildings.roads > 0
  const canBuyCard = hasResources(player.resources, BUILDING_COSTS.developmentCard)

  return (
    <Card className="p-4 bg-white/10 backdrop-blur-sm border-white/20 min-w-[300px]">
      <div className="space-y-4">
        {/* Player Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">{player.name}</h3>
            <div className="text-sm text-white/70">
              Score: {player.score.total} | Turn: {isCurrentPlayer ? 'Your Turn' : 'Waiting'}
            </div>
          </div>
          <div className={`w-6 h-6 rounded-full border-2 border-white player-color-${player.color}`} 
               style={{ backgroundColor: `var(--color-player-${player.color})` }} />
        </div>

        <Separator className="bg-white/20" />

        {/* Resources */}
        <div>
          <h4 className="text-sm font-medium text-white mb-2">Resources</h4>
          <div className="grid grid-cols-5 gap-2">
            <ResourceCard type="wood" count={player.resources.wood} theme={theme} />
            <ResourceCard type="brick" count={player.resources.brick} theme={theme} />
            <ResourceCard type="ore" count={player.resources.ore} theme={theme} />
            <ResourceCard type="wheat" count={player.resources.wheat} theme={theme} />
            <ResourceCard type="sheep" count={player.resources.sheep} theme={theme} />
          </div>
        </div>

        {/* Buildings */}
        <div>
          <h4 className="text-sm font-medium text-white mb-2">Buildings</h4>
          <div className="flex space-x-4 text-sm text-white/80">
            <span>Settlements: {player.buildings.settlements}</span>
            <span>Cities: {player.buildings.cities}</span>
            <span>Roads: {player.buildings.roads}</span>
          </div>
        </div>

        {/* Development Cards */}
        <div>
          <h4 className="text-sm font-medium text-white mb-2">Development Cards</h4>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="text-white border-white/30">
              {player.developmentCards.length} cards
            </Badge>
            {player.knightsPlayed > 0 && (
              <Badge variant="outline" className="text-yellow-300 border-yellow-300/50">
                Knights: {player.knightsPlayed}
              </Badge>
            )}
          </div>
        </div>

        {/* Special Achievements */}
        {(player.hasLongestRoad || player.hasLargestArmy) && (
          <div>
            <h4 className="text-sm font-medium text-white mb-2">Achievements</h4>
            <div className="flex space-x-2">
              {player.hasLongestRoad && (
                <Badge className="bg-green-600/80">Longest Road (+2)</Badge>
              )}
              {player.hasLargestArmy && (
                <Badge className="bg-red-600/80">Largest Army (+2)</Badge>
              )}
            </div>
          </div>
        )}

        <Separator className="bg-white/20" />

        {/* Actions */}
        {isCurrentPlayer && (
          <div>
            <h4 className="text-sm font-medium text-white mb-2">Actions</h4>
            <div className="space-y-2">
              {/* Phase-specific actions */}
              {gamePhase === 'roll' && canRoll && (
                <Button 
                  onClick={() => onAction('roll')}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  Roll Dice
                </Button>
              )}
              
              {gamePhase === 'actions' && (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    disabled={!canBuildSettlement}
                    onClick={() => onAction('buildSettlement')}
                    size="sm"
                    variant={canBuildSettlement ? "default" : "outline"}
                  >
                    Settlement
                  </Button>
                  <Button
                    disabled={!canBuildCity}
                    onClick={() => onAction('buildCity')}
                    size="sm"
                    variant={canBuildCity ? "default" : "outline"}
                  >
                    City
                  </Button>
                  <Button
                    disabled={!canBuildRoad}
                    onClick={() => onAction('buildRoad')}
                    size="sm"
                    variant={canBuildRoad ? "default" : "outline"}
                  >
                    Road
                  </Button>
                  <Button
                    disabled={!canBuyCard}
                    onClick={() => onAction('buyCard')}
                    size="sm"
                    variant={canBuyCard ? "default" : "outline"}
                  >
                    Buy Card
                  </Button>
                </div>
              )}
              
              {gamePhase === 'actions' && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <Button
                    onClick={() => onAction('trade')}
                    size="sm"
                    variant="outline"
                  >
                    Trade
                  </Button>
                  <Button
                    onClick={() => onAction('endTurn')}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    End Turn
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Game Phase Indicator */}
        <div className="text-xs text-white/60 text-center">
          Phase: {gamePhase.charAt(0).toUpperCase() + gamePhase.slice(1)}
        </div>
      </div>
    </Card>
  )
}

interface ResourceCardProps {
  type: keyof ResourceCards
  count: number
  theme: GameTheme | null
}

function ResourceCard({ type, count, theme }: ResourceCardProps) {
  const displayName = theme?.resourceMapping?.[type]?.displayName || type
  const emoji = getResourceEmoji(type)
  
  return (
    <div className="bg-white/20 rounded p-2 text-center">
      <div className="text-lg mb-1">{emoji}</div>
      <div className="text-sm font-medium text-white">{count}</div>
      <div className="text-xs text-white/70 capitalize">{displayName}</div>
    </div>
  )
}

function getResourceEmoji(type: keyof ResourceCards): string {
  const emojis = {
    wood: '🌲',
    brick: '🧱',
    ore: '🪨',
    wheat: '🌾',
    sheep: '🐑'
  }
  return emojis[type] || '❓'
} 