'use client'

import { Badge } from '@/components/ui/badge'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Crown, Shield, Sword } from 'lucide-react'
import { ds, componentStyles, designSystem } from '@/lib/design-system'

interface DemoPlayer {
  id: string
  name: string
  color: string
  resources: Record<string, number>
  developmentCards: any[]
  victoryPoints: number
  settlements: any[]
  cities: any[]
  roads: any[]
  longestRoad: number
  hasLongestRoad: boolean
  hasLargestArmy: boolean
  knightsPlayed: number
}

interface DemoGameState {
  id: string
  phase: string
  currentPlayer: string
  players: Map<string, DemoPlayer>
}

interface DemoPlayersPanelProps {
  gameState: DemoGameState
  playerAvatars: Record<string, { avatar: string; name: string }>
}

export function DemoPlayersPanel({ 
  gameState, 
  playerAvatars
}: DemoPlayersPanelProps) {

  const sortedPlayers = Array.from(gameState.players.entries())
    .sort(([, a], [, b]) => b.victoryPoints - a.victoryPoints)

  return (
    <div className="absolute top-4 left-4 right-4 z-20 pointer-events-auto">
      {/* Players List - Edge to edge spacing */}
      <div className="flex items-center justify-between w-full gap-2">
          {sortedPlayers.map(([playerId, player]) => {
            const isCurrentTurn = gameState.currentPlayer === playerId
            const playerInfo = playerAvatars[playerId] || { 
              avatar: '👤', 
              name: player.name 
            }
            
            return (
              <DemoPlayerCard
                key={playerId}
                player={player}
                avatar={playerInfo.avatar}
                displayName={playerInfo.name}
                isCurrentTurn={isCurrentTurn}
              />
            )
          })}
      </div>
    </div>
  )
}

interface DemoPlayerCardProps {
  player: DemoPlayer
  avatar: string
  displayName: string
  isCurrentTurn: boolean
}

function DemoPlayerCard({ player, avatar, displayName, isCurrentTurn }: DemoPlayerCardProps) {
  const totalResources = Object.values(player.resources).reduce((sum, count) => sum + count, 0)
  const unplayedDevCards = player.developmentCards.length
  const roadsBuilt = player.roads.length
  
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <div className={ds(
          designSystem.glass.primary,
          'flex items-center space-x-3 p-3 rounded-lg cursor-pointer',
          designSystem.animation.normal,
          'hover:bg-white/10 hover:scale-[1.02] hover:shadow-lg',
          isCurrentTurn 
            ? 'border-yellow-400/60 shadow-lg shadow-yellow-400/20 bg-yellow-400/5' 
            : 'border-white/20 hover:border-white/30'
        )}>
          {/* Avatar & Name */}
          <div className="flex items-center space-x-2">
            <div className={ds(
              'w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold border-2',
              isCurrentTurn ? 'border-yellow-400 bg-yellow-400/20' : 'border-white/30 bg-white/10'
            )} style={{ backgroundColor: `${player.color}40` }}>
              {avatar}
            </div>
            <span className="font-medium text-white text-sm">{displayName}</span>
          </div>

          {/* Victory Points - Bigger */}
          <div className="flex items-center space-x-1">
            <Crown className="w-5 h-5 text-yellow-400" />
            <span className="text-white font-bold text-lg">{player.victoryPoints}</span>
          </div>

          {/* Desktop: Show all stats */}
          <div className="hidden lg:flex items-center space-x-4 text-sm">
            {/* Cards - Stacked */}
            <div className="flex flex-col space-y-1">
              <Badge variant="outline" className={ds(
                'bg-blue-500/10 border-blue-400/30 text-blue-300',
                'hover:bg-blue-500/20 transition-colors duration-200'
              )}>
                🃏 {totalResources}
              </Badge>
              <Badge variant="outline" className={ds(
                'bg-purple-500/10 border-purple-400/30 text-purple-300',
                'hover:bg-purple-500/20 transition-colors duration-200'
              )}>
                📜 {unplayedDevCards}
              </Badge>
            </div>

            {/* Knights & Roads - Stacked */}
            <div className="flex flex-col space-y-1">
              <Badge variant="outline" className={ds(
                'bg-red-500/10 border-red-400/30 text-red-300',
                'hover:bg-red-500/20 transition-colors duration-200'
              )}>
                <Sword className="w-3 h-3" />
                {player.knightsPlayed}
              </Badge>
              <Badge variant="outline" className={ds(
                'bg-orange-500/10 border-orange-400/30 text-orange-300',
                'hover:bg-orange-500/20 transition-colors duration-200'
              )}>
                🛤️ {roadsBuilt}
              </Badge>
            </div>

            {/* Achievements */}
            <div className="flex space-x-1">
              {player.hasLargestArmy && (
                <Badge variant="outline" className="border-red-400 text-red-300 px-1">
                  <Shield className="w-3 h-3" />
                </Badge>
              )}
              {player.hasLongestRoad && (
                <Badge variant="outline" className="border-orange-400 text-orange-300 px-1">
                  🛤️
                </Badge>
              )}
            </div>
          </div>
        </div>
      </HoverCardTrigger>
      
      {/* Mobile/Tablet: Show details on hover */}
      <HoverCardContent className={ds(
        'lg:hidden text-white',
        componentStyles.glassCard,
        'border-white/30 bg-black/80'
      )}>
        <div className="space-y-2">
          <h4 className="font-semibold">{displayName}</h4>
          
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center space-x-1">
              <span>🃏</span>
              <span>{totalResources} resources</span>
            </div>
            
            {unplayedDevCards > 0 && (
              <div className="flex items-center space-x-1">
                <span>📜</span>
                <span>{unplayedDevCards} dev cards</span>
              </div>
            )}
            
            {player.knightsPlayed > 0 && (
              <div className="flex items-center space-x-1">
                <Sword className="w-4 h-4 text-red-400" />
                <span>{player.knightsPlayed} knights</span>
              </div>
            )}
            
            <div className="flex items-center space-x-1">
              <span>🛤️</span>
              <span>{roadsBuilt} roads built</span>
            </div>
          </div>
          
          {(player.hasLargestArmy || player.hasLongestRoad) && (
            <div className="flex space-x-2 mt-2">
              {player.hasLargestArmy && (
                <Badge variant="outline" className="border-red-400 text-red-300">
                  <Shield className="w-3 h-3 mr-1" /> Largest Army
                </Badge>
              )}
              {player.hasLongestRoad && (
                <Badge variant="outline" className="border-orange-400 text-orange-300">
                  🛤️ Longest Road
                </Badge>
              )}
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}