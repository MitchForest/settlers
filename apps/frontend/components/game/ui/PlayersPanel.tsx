'use client'

import { Player, GameState } from '@settlers/core'
import { PlayerAvatar } from './AvatarPicker'

import { Badge } from '@/components/ui/badge'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Crown, Shield, Sword } from 'lucide-react'

interface PlayersPanelProps {
  gameState: GameState
  playerAvatars: Record<string, { avatar: string; name: string }>
}

export function PlayersPanel({ 
  gameState, 
  playerAvatars
}: PlayersPanelProps) {

  const sortedPlayers = Array.from(gameState.players.entries())
    .sort(([, a], [, b]) => b.score.total - a.score.total)

  return (
    <div className="absolute top-4 left-4 right-4 z-20 pointer-events-auto">
      <div className="flex items-center justify-between px-2">
        {/* Players List - Evenly spaced with balanced edge spacing */}
        <div className="flex items-center justify-evenly w-full px-4">
          {sortedPlayers.map(([playerId, player]) => {
            const isCurrentTurn = gameState.currentPlayer === playerId
            const playerInfo = playerAvatars[playerId] || { 
              avatar: '👤', 
              name: player.name 
            }
            
            return (
              <PlayerCard
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
    </div>
  )
}

interface PlayerCardProps {
  player: Player
  avatar: string
  displayName: string
  isCurrentTurn: boolean
}

function PlayerCard({ player, avatar, displayName, isCurrentTurn }: PlayerCardProps) {
  const totalResources = Object.values(player.resources).reduce((sum, count) => sum + count, 0)
  const unplayedDevCards = player.developmentCards.filter(card => !card.playedTurn).length
  
  // Calculate longest road length (simplified - would need actual calculation)
  const longestRoadLength = player.hasLongestRoad ? 5 : Math.min(15 - player.buildings.roads, 4)

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <div className={`
          flex items-center space-x-3 p-2 rounded-lg transition-all duration-200 cursor-pointer
          bg-black/30 backdrop-blur-sm hover:bg-black/40
          ${isCurrentTurn 
            ? 'border border-yellow-400/50 shadow-lg' 
            : 'border border-white/20'
          }
        `}>
          {/* Avatar & Name */}
          <PlayerAvatar
            avatar={avatar}
            name={displayName}
            playerColor={player.color}
            isCurrentTurn={isCurrentTurn}
          />

          {/* Victory Points - Bigger */}
          <div className="flex items-center space-x-1">
            <Crown className="w-5 h-5 text-yellow-400" />
            <span className="text-white font-bold text-lg">{player.score.public}</span>
            {player.score.hidden > 0 && (
              <span className="text-yellow-400 text-lg">+{player.score.hidden}</span>
            )}
          </div>

          {/* Desktop: Show all stats */}
          <div className="hidden lg:flex items-center space-x-4 text-sm">
            {/* Cards - Stacked */}
            <div className="flex flex-col space-y-1">
              <Badge variant="outline" className="bg-white/10 border-white/20 text-blue-300">
                🃏 {totalResources}
              </Badge>
              <Badge variant="outline" className="bg-white/10 border-white/20 text-purple-300">
                📜 {unplayedDevCards}
              </Badge>
            </div>

            {/* Knights & Roads - Stacked */}
            <div className="flex flex-col space-y-1">
              <Badge variant="outline" className="bg-white/10 border-white/20 text-red-300">
                <Sword className="w-3 h-3" />
                {player.knightsPlayed}
              </Badge>
              <Badge variant="outline" className="bg-white/10 border-white/20 text-orange-300">
                🛤️ {15 - player.buildings.roads}
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
      <HoverCardContent className="lg:hidden bg-black/90 backdrop-blur-sm border border-white/20 text-white">
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
              <span>{longestRoadLength} road length</span>
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