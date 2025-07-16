'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DevelopmentCard, DevelopmentCardType } from '@settlers/core'
import { cn } from '@/lib/utils'

interface DevelopmentCardsProps {
  cards: DevelopmentCard[]
  currentTurn: number
  onPlayCard: (cardId: string) => void
  onBuyCard: () => void
  canBuyCard: boolean
}

export function DevelopmentCards({ 
  cards, 
  currentTurn, 
  onPlayCard, 
  onBuyCard, 
  canBuyCard 
}: DevelopmentCardsProps) {
  const playableCards = cards.filter(card => 
    !card.playedTurn && 
    card.purchasedTurn < currentTurn &&
    card.type !== 'victory' // Victory cards are passive
  )

  const victoryCards = cards.filter(card => card.type === 'victory')

  return (
    <Card className="p-4 bg-white/10 backdrop-blur-sm border-white/20">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Development Cards</h3>
          <Button
            onClick={onBuyCard}
            disabled={!canBuyCard}
            size="sm"
            variant={canBuyCard ? "default" : "outline"}
          >
            Buy Card
          </Button>
        </div>

        {/* Card Summary */}
        <div className="grid grid-cols-2 gap-2 text-sm text-white/80">
          <div>Total Cards: {cards.length}</div>
          <div>Playable: {playableCards.length}</div>
          {victoryCards.length > 0 && (
            <div className="col-span-2 text-yellow-300">
              Victory Points: +{victoryCards.length}
            </div>
          )}
        </div>

        {/* Playable Cards */}
        {playableCards.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-white mb-2">Ready to Play</h4>
            <div className="space-y-2">
              {playableCards.map(card => (
                <DevCard
                  key={card.id}
                  card={card}
                  onPlay={() => onPlayCard(card.id)}
                  canPlay={true}
                />
              ))}
            </div>
          </div>
        )}

        {/* Recently Purchased Cards */}
        {cards.some(card => card.purchasedTurn === currentTurn) && (
          <div>
            <h4 className="text-sm font-medium text-white mb-2">This Turn</h4>
            <div className="space-y-2">
              {cards
                .filter(card => card.purchasedTurn === currentTurn)
                .map(card => (
                  <DevCard
                    key={card.id}
                    card={card}
                    onPlay={() => {}}
                    canPlay={false}
                    disabled={true}
                  />
                ))}
            </div>
          </div>
        )}

        {/* All Cards Count */}
        <div className="text-xs text-white/60">
          <div>Cards by type:</div>
          {getCardCounts(cards).map(({ type, count }) => (
            <div key={type} className="flex justify-between">
              <span>{getCardDisplayName(type)}:</span>
              <span>{count}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

interface DevCardProps {
  card: DevelopmentCard
  onPlay: () => void
  canPlay: boolean
  disabled?: boolean
}

function DevCard({ card, onPlay, canPlay, disabled = false }: DevCardProps) {
  return (
    <div className={cn(
      "p-3 rounded-lg border",
      "bg-white/5 border-white/20",
      disabled && "opacity-50"
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="text-2xl">{getCardEmoji(card.type)}</div>
          <div>
            <div className="text-sm font-medium text-white">
              {getCardDisplayName(card.type)}
            </div>
            <div className="text-xs text-white/60">
              {getCardDescription(card.type)}
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {card.type === 'victory' && (
            <Badge className="bg-yellow-600/80 text-white">+1 VP</Badge>
          )}
          {canPlay && !disabled && (
            <Button
              onClick={onPlay}
              size="sm"
              variant="outline"
              className="text-white border-white/30 hover:bg-white/10"
            >
              Play
            </Button>
          )}
          {disabled && (
            <Badge variant="outline" className="text-white/50 border-white/20">
              This Turn
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}

function getCardEmoji(type: DevelopmentCardType): string {
  const emojis = {
    knight: '⚔️',
    victory: '🏆',
    roadBuilding: '🛤️',
    yearOfPlenty: '🌾',
    monopoly: '💰'
  }
  return emojis[type] || '❓'
}

function getCardDisplayName(type: DevelopmentCardType): string {
  const names = {
    knight: 'Knight',
    victory: 'Victory Point',
    roadBuilding: 'Road Building',
    yearOfPlenty: 'Year of Plenty',
    monopoly: 'Monopoly'
  }
  return names[type] || type
}

function getCardDescription(type: DevelopmentCardType): string {
  const descriptions = {
    knight: 'Move robber and steal resource',
    victory: 'Adds 1 victory point',
    roadBuilding: 'Build 2 roads for free',
    yearOfPlenty: 'Take 2 resources from bank',
    monopoly: 'Take all cards of one type'
  }
  return descriptions[type] || ''
}

function getCardCounts(cards: DevelopmentCard[]): Array<{ type: DevelopmentCardType, count: number }> {
  const counts: Record<DevelopmentCardType, number> = {
    knight: 0,
    victory: 0,
    roadBuilding: 0,
    yearOfPlenty: 0,
    monopoly: 0
  }
  
  cards.forEach(card => {
    counts[card.type]++
  })
  
  return Object.entries(counts).map(([type, count]) => ({ 
    type: type as DevelopmentCardType, 
    count 
  })).filter(({ count }) => count > 0)
} 