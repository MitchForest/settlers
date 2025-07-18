'use client'

import React, { useState, useMemo } from 'react'
import { GameState, Player, GameAction, Trade, ResourceCards } from '@settlers/core'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ds, componentStyles, designSystem } from '@/lib/design-system'


interface TradingInterfaceProps {
  gameState: GameState
  localPlayer: Player
  isMyTurn: boolean
  onAction: (action: GameAction) => void
}

// Resource emojis mapping
const RESOURCE_EMOJIS = {
  wood: '🌲',
  brick: '🧱', 
  ore: '🪨',
  wheat: '🌾',
  sheep: '🐑'
} as const

const RESOURCE_NAMES = {
  wood: 'Wood',
  brick: 'Brick',
  ore: 'Ore', 
  wheat: 'Wheat',
  sheep: 'Sheep'
} as const

type ResourceType = keyof typeof RESOURCE_EMOJIS

export default function TradingInterface({ gameState, localPlayer, isMyTurn, onAction }: TradingInterfaceProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<string>('bank')
  
  // Bank trading state
  const [bankOffering, setBankOffering] = useState<Partial<ResourceCards>>({})
  const [bankRequesting, setBankRequesting] = useState<Partial<ResourceCards>>({})
  
  // Port trading state
  const [portOffering, setPortOffering] = useState<Partial<ResourceCards>>({})
  const [portRequesting, setPortRequesting] = useState<Partial<ResourceCards>>({})
  const [selectedPortType, setSelectedPortType] = useState<'generic' | ResourceType>('generic')
  
  // Player trading state
  const [playerOffering, setPlayerOffering] = useState<Partial<ResourceCards>>({})
  const [playerRequesting, setPlayerRequesting] = useState<Partial<ResourceCards>>({})
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null)
  const [isOpenOffer, setIsOpenOffer] = useState(false)
  const [expirationMinutes, setExpirationMinutes] = useState(5)

  // Available ports for the player
  const availablePorts = useMemo(() => {
    const ports: Array<{ type: 'generic' | ResourceType, ratio: number, name: string }> = [
      { type: 'generic' as const, ratio: 3, name: 'Generic Port (3:1)' }
    ]
    
    // Check each port on the board for access
    gameState.board.ports.forEach(port => {
      // Check if player has any settlements/cities adjacent to this port
      const hasAccess = Array.from(gameState.board.vertices.values()).some(vertex => {
        if (!vertex.building || vertex.building.owner !== localPlayer.id) {
          return false
        }
        
        // Check if vertex is connected to this port
        // For simplicity, we'll check if any of the vertex's hexes match the port's position
        return vertex.position.hexes.some(vertexHex => 
          port.position.hexes.some(portHex => 
            vertexHex.q === portHex.q && vertexHex.r === portHex.r && vertexHex.s === portHex.s
          )
        )
      })
      
      if (hasAccess) {
        if (port.type === 'generic') {
          // Replace the default generic port with the player's accessible one
          const existingGeneric = ports.findIndex(p => p.type === 'generic')
          if (existingGeneric >= 0) {
            ports[existingGeneric] = { type: 'generic' as const, ratio: port.ratio, name: `Generic Port (${port.ratio}:1)` }
          }
        } else {
          ports.push({ 
            type: port.type as ResourceType, 
            ratio: port.ratio, 
            name: `${port.type.charAt(0).toUpperCase() + port.type.slice(1)} Port (${port.ratio}:1)` 
          })
        }
      }
    })
    
    return ports
  }, [gameState, localPlayer])

  // Helper functions
  const getTotalResources = (resources: Partial<ResourceCards>) => {
    return Object.values(resources).reduce((sum, count) => sum + (count || 0), 0)
  }

  const canAfford = (resources: Partial<ResourceCards>) => {
    return Object.entries(resources).every(([resource, count]) => 
      localPlayer.resources[resource as keyof ResourceCards] >= (count || 0)
    )
  }

  const resetBankTrade = () => {
    setBankOffering({})
    setBankRequesting({})
  }

  const resetPortTrade = () => {
    setPortOffering({})
    setPortRequesting({})
  }

  const resetPlayerTrade = () => {
    setPlayerOffering({})
    setPlayerRequesting({})
    setSelectedTarget(null)
  }

  // Resource counter component
  const ResourceCounter = ({ 
    resource, 
    value, 
    onChange, 
    max, 
    min = 0 
  }: { 
    resource: ResourceType
    value: number
    onChange: (value: number) => void
    max: number
    min?: number
  }) => (
    <div className={ds(
      designSystem.glass.secondary,
      'flex items-center justify-between p-3 border-white/20 rounded-lg',
      'hover:bg-white/10 transition-all duration-200'
    )}>
      <div className="flex items-center gap-3">
        <span className="text-lg">{RESOURCE_EMOJIS[resource]}</span>
        <span className={ds(designSystem.text.body, 'text-sm font-medium')}>
          {RESOURCE_NAMES[resource]}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className={ds(
            'h-8 w-8 p-0',
            componentStyles.buttonSecondary,
            'hover:scale-110 transition-all duration-200'
          )}
        >
          -
        </Button>
        <span className={ds(designSystem.text.body, 'w-8 text-center font-medium')}>
          {value}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
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

  // Bank trading tab
  const BankTradingTab = () => {
    const offeringTotal = getTotalResources(bankOffering)
    const requestingTotal = getTotalResources(bankRequesting)
    const isValid = offeringTotal === 4 && requestingTotal === 1 && canAfford(bankOffering)

    const handleBankTrade = () => {
      if (!isValid) return
      
      onAction({
        type: 'bankTrade',
        playerId: localPlayer.id,
        data: {
          offering: bankOffering,
          requesting: bankRequesting
        }
      })
      resetBankTrade()
      setIsOpen(false)
    }

    return (
      <div className="space-y-4">
        <div className={ds(designSystem.text.muted, 'text-sm')}>
          Bank trades allow you to exchange 4 resources of any type for 1 resource of your choice.
        </div>
        
        <div className="space-y-3">
          <h4 className={ds(designSystem.text.heading, 'font-medium')}>
            Offering (4 resources required)
          </h4>
          {(Object.keys(RESOURCE_EMOJIS) as ResourceType[]).map(resource => (
            <ResourceCounter
              key={resource}
              resource={resource}
              value={bankOffering[resource] || 0}
              onChange={(value) => setBankOffering(prev => ({ ...prev, [resource]: value }))}
              max={localPlayer.resources[resource]}
            />
          ))}
          <div className={ds(designSystem.text.muted, 'text-sm')}>
            Total offering: {offeringTotal}/4
          </div>
        </div>

        <Separator className="bg-white/20" />

        <div className="space-y-3">
          <h4 className={ds(designSystem.text.heading, 'font-medium')}>
            Requesting (1 resource)
          </h4>
          {(Object.keys(RESOURCE_EMOJIS) as ResourceType[]).map(resource => (
            <ResourceCounter
              key={resource}
              resource={resource}
              value={bankRequesting[resource] || 0}
              onChange={(value) => setBankRequesting(prev => ({ ...prev, [resource]: value }))}
              max={1}
            />
          ))}
          <div className={ds(designSystem.text.muted, 'text-sm')}>
            Total requesting: {requestingTotal}/1
          </div>
        </div>

        <div className="flex gap-3">
          <Button 
            onClick={handleBankTrade}
            disabled={!isValid || !isMyTurn}
            className={ds(
              componentStyles.buttonPrimary,
              'flex-1 bg-green-500/20 border-green-400/30 hover:bg-green-500/30',
              'hover:scale-[1.02] transition-all duration-200',
              (!isValid || !isMyTurn) && 'opacity-60 cursor-not-allowed'
            )}
          >
            Execute Bank Trade
          </Button>
          <Button 
            variant="outline" 
            onClick={resetBankTrade}
            className={ds(
              componentStyles.buttonSecondary,
              'hover:scale-105 transition-all duration-200'
            )}
          >
            Reset
          </Button>
        </div>
      </div>
    )
  }

  // Port trading tab
  const PortTradingTab = () => {
    const selectedPort = availablePorts.find(p => p.type === selectedPortType)
    const ratio = selectedPort?.ratio || 3
    const offeringTotal = getTotalResources(portOffering)
    const requestingTotal = getTotalResources(portRequesting)
    
    let isValid = offeringTotal === ratio && requestingTotal === 1 && canAfford(portOffering)
    
    // For specific ports, validate resource type
    if (selectedPortType !== 'generic') {
      const offeredTypes = Object.keys(portOffering).filter(key => (portOffering as Record<string, number>)[key] > 0)
      isValid = isValid && offeredTypes.length === 1 && offeredTypes[0] === selectedPortType
    }

    const handlePortTrade = () => {
      if (!isValid) return
      
      onAction({
        type: 'portTrade',
        playerId: localPlayer.id,
        data: {
          offering: portOffering,
          requesting: portRequesting,
          portType: selectedPortType,
          ratio
        }
      })
      resetPortTrade()
      setIsOpen(false)
    }

    return (
      <div className="space-y-4">
        <div className="space-y-3">
          <h4 className="font-medium">Select Port</h4>
          <div className="grid gap-2">
            {availablePorts.map(port => (
              <Button
                key={port.type}
                variant={selectedPortType === port.type ? "default" : "outline"}
                onClick={() => setSelectedPortType(port.type)}
                className="justify-start"
              >
                {port.name}
              </Button>
            ))}
          </div>
        </div>

        <Separator />
        
        <div className="space-y-3">
          <h4 className="font-medium">Offering ({ratio} resources required)</h4>
          {selectedPortType === 'generic' ? (
            (Object.keys(RESOURCE_EMOJIS) as ResourceType[]).map(resource => (
              <ResourceCounter
                key={resource}
                resource={resource}
                value={portOffering[resource] || 0}
                onChange={(value) => setPortOffering(prev => ({ ...prev, [resource]: value }))}
                max={localPlayer.resources[resource]}
              />
            ))
          ) : (
            <ResourceCounter
              resource={selectedPortType}
              value={portOffering[selectedPortType] || 0}
              onChange={(value) => setPortOffering({ [selectedPortType]: value })}
              max={localPlayer.resources[selectedPortType]}
            />
          )}
          <div className="text-sm text-muted-foreground">
            Total offering: {offeringTotal}/{ratio}
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <h4 className="font-medium">Requesting (1 resource)</h4>
          {(Object.keys(RESOURCE_EMOJIS) as ResourceType[]).map(resource => (
            <ResourceCounter
              key={resource}
              resource={resource}
              value={portRequesting[resource] || 0}
              onChange={(value) => setPortRequesting(prev => ({ ...prev, [resource]: value }))}
              max={1}
            />
          ))}
          <div className="text-sm text-muted-foreground">
            Total requesting: {requestingTotal}/1
          </div>
        </div>

        <div className="flex gap-3">
          <Button 
            onClick={handlePortTrade}
            disabled={!isValid || !isMyTurn}
            className={ds(
              componentStyles.buttonPrimary,
              'flex-1 bg-blue-500/20 border-blue-400/30 hover:bg-blue-500/30',
              'hover:scale-[1.02] transition-all duration-200',
              (!isValid || !isMyTurn) && 'opacity-60 cursor-not-allowed'
            )}
          >
            Execute Port Trade
          </Button>
          <Button 
            variant="outline" 
            onClick={resetPortTrade}
            className={ds(
              componentStyles.buttonSecondary,
              'hover:scale-105 transition-all duration-200'
            )}
          >
            Reset
          </Button>
        </div>
      </div>
    )
  }

  // Player trading tab
  const PlayerTradingTab = () => {
    const offeringTotal = getTotalResources(playerOffering)
    const requestingTotal = getTotalResources(playerRequesting)
    const isValid = offeringTotal > 0 && requestingTotal > 0 && canAfford(playerOffering)
    
    const otherPlayers = Array.from(gameState.players.values()).filter(p => p.id !== localPlayer.id)

    const handleCreateTrade = () => {
      if (!isValid) return
      
      onAction({
        type: 'createTradeOffer',
        playerId: localPlayer.id,
        data: {
          offering: playerOffering,
          requesting: playerRequesting,
          target: selectedTarget,
          isOpenOffer,
          expirationMinutes
        }
      })
      resetPlayerTrade()
      setIsOpen(false)
    }

    return (
      <div className="space-y-4">
        <div className="space-y-3">
          <h4 className="font-medium">Trade Type</h4>
          <div className="flex gap-2">
            <Button
              variant={isOpenOffer ? "default" : "outline"}
              onClick={() => {
                setIsOpenOffer(true)
                setSelectedTarget(null)
              }}
              size="sm"
            >
              Open Offer
            </Button>
            <Button
              variant={!isOpenOffer ? "default" : "outline"}
              onClick={() => setIsOpenOffer(false)}
              size="sm"
            >
              Direct Trade
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            {isOpenOffer 
              ? "Any player can accept this trade offer"
              : "Send trade offer to a specific player"
            }
          </div>
        </div>

        {!isOpenOffer && (
          <div className="space-y-3">
            <h4 className="font-medium">Target Player</h4>
            <div className="grid gap-2">
              {otherPlayers.map(player => (
                <Button
                  key={player.id}
                  variant={selectedTarget === player.id ? "default" : "outline"}
                  onClick={() => setSelectedTarget(player.id)}
                  className="justify-start"
                >
                  <div className={`w-3 h-3 rounded-full mr-2 player-${player.color}`} />
                  {player.name}
                </Button>
              ))}
            </div>
          </div>
        )}

        <Separator />
        
        <div className="space-y-3">
          <h4 className="font-medium">Offering</h4>
          {(Object.keys(RESOURCE_EMOJIS) as ResourceType[]).map(resource => (
            <ResourceCounter
              key={resource}
              resource={resource}
              value={playerOffering[resource] || 0}
              onChange={(value) => setPlayerOffering(prev => ({ ...prev, [resource]: value }))}
              max={localPlayer.resources[resource]}
            />
          ))}
          <div className="text-sm text-muted-foreground">
            Total offering: {offeringTotal}
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <h4 className="font-medium">Requesting</h4>
          {(Object.keys(RESOURCE_EMOJIS) as ResourceType[]).map(resource => (
            <ResourceCounter
              key={resource}
              resource={resource}
              value={playerRequesting[resource] || 0}
              onChange={(value) => setPlayerRequesting(prev => ({ ...prev, [resource]: value }))}
              max={20} // Reasonable max
            />
          ))}
          <div className="text-sm text-muted-foreground">
            Total requesting: {requestingTotal}
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="font-medium">Expiration Timer (minutes)</h4>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpirationMinutes(Math.max(1, expirationMinutes - 1))}
            >
              -
            </Button>
            <span className="w-12 text-center">{expirationMinutes}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpirationMinutes(Math.min(30, expirationMinutes + 1))}
            >
              +
            </Button>
            <span className="text-sm text-muted-foreground">minutes</span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={handleCreateTrade}
            disabled={!isValid || !isMyTurn || (!isOpenOffer && !selectedTarget)}
            className="flex-1"
          >
            Create Trade Offer
          </Button>
          <Button variant="outline" onClick={resetPlayerTrade}>
            Reset
          </Button>
        </div>
      </div>
    )
  }

  // Active trades display
  const ActiveTradesTab = () => {
    const myTrades = gameState.activeTrades.filter(trade => trade.initiator === localPlayer.id)
    const offersForMe = gameState.activeTrades.filter(trade => 
      trade.target === localPlayer.id || (trade.isOpenOffer && trade.initiator !== localPlayer.id)
    )

    const handleAcceptTrade = (tradeId: string) => {
      onAction({
        type: 'acceptTrade',
        playerId: localPlayer.id,
        data: { tradeId }
      })
    }

    const handleRejectTrade = (tradeId: string) => {
      onAction({
        type: 'rejectTrade',
        playerId: localPlayer.id,
        data: { tradeId }
      })
    }

    const handleCancelTrade = (tradeId: string) => {
      onAction({
        type: 'cancelTrade',
        playerId: localPlayer.id,
        data: { tradeId }
      })
    }

    const TradeCard = ({ trade, showAcceptReject }: { trade: Trade, showAcceptReject: boolean }) => {
      const initiator = gameState.players.get(trade.initiator)
      
      return (
        <Card className="p-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {initiator && (
                  <>
                    <div className={`w-3 h-3 rounded-full player-${initiator.color}`} />
                    <span className="font-medium">{initiator.name}</span>
                  </>
                )}
                {trade.isOpenOffer && (
                  <Badge variant="secondary">Open Offer</Badge>
                )}
              </div>
              <Badge variant="outline">{trade.status}</Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h5 className="text-sm font-medium mb-1">Offering:</h5>
                <div className="space-y-1">
                  {Object.entries(trade.offering).map(([resource, count]) => 
                    count && count > 0 ? (
                      <div key={resource} className="flex items-center gap-1 text-sm">
                        <span>{RESOURCE_EMOJIS[resource as ResourceType]}</span>
                        <span>{count}</span>
                      </div>
                    ) : null
                  )}
                </div>
              </div>
              
              <div>
                <h5 className="text-sm font-medium mb-1">Requesting:</h5>
                <div className="space-y-1">
                  {Object.entries(trade.requesting).map(([resource, count]) => 
                    count && count > 0 ? (
                      <div key={resource} className="flex items-center gap-1 text-sm">
                        <span>{RESOURCE_EMOJIS[resource as ResourceType]}</span>
                        <span>{count}</span>
                      </div>
                    ) : null
                  )}
                </div>
              </div>
            </div>

            {trade.expiresAt && (
              <div className="text-xs text-muted-foreground">
                Expires: {new Date(trade.expiresAt).toLocaleTimeString()}
              </div>
            )}
            
            <div className="flex gap-2">
              {showAcceptReject ? (
                <>
                  <Button
                    size="sm"
                    onClick={() => handleAcceptTrade(trade.id)}
                    disabled={!isMyTurn}
                    className="flex-1"
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRejectTrade(trade.id)}
                    disabled={!isMyTurn}
                  >
                    Reject
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCancelTrade(trade.id)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </Card>
      )
    }

    return (
      <div className="space-y-4">
        <div className="space-y-3">
          <h4 className="font-medium">My Active Trades</h4>
          {myTrades.length === 0 ? (
            <div className="text-sm text-muted-foreground">No active trades</div>
          ) : (
            <div className="space-y-2">
              {myTrades.map(trade => (
                <TradeCard key={trade.id} trade={trade} showAcceptReject={false} />
              ))}
            </div>
          )}
        </div>

        <Separator />

        <div className="space-y-3">
          <h4 className="font-medium">Trade Offers for Me</h4>
          {offersForMe.length === 0 ? (
            <div className="text-sm text-muted-foreground">No trade offers</div>
          ) : (
            <div className="space-y-2">
              {offersForMe.map(trade => (
                <TradeCard key={trade.id} trade={trade} showAcceptReject={true} />
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          className={ds(
            componentStyles.buttonSecondary,
            'w-full hover:scale-[1.02] transition-all duration-200'
          )}
        >
          🤝 Trading
        </Button>
      </DialogTrigger>
      <DialogContent className={ds(
        componentStyles.glassCard,
        'max-w-2xl max-h-[80vh] overflow-y-auto border-white/30'
      )}>
        <DialogHeader>
          <DialogTitle className={ds(designSystem.text.heading, 'text-xl')}>
            Trading Center
          </DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className={ds(
            designSystem.glass.secondary,
            'grid w-full grid-cols-4 border-white/20'
          )}>
            <TabsTrigger 
              value="bank"
              className={ds(
                'data-[state=active]:bg-white/20 data-[state=active]:text-white',
                'hover:bg-white/10 transition-all duration-200'
              )}
            >
              Bank
            </TabsTrigger>
            <TabsTrigger 
              value="port"
              className={ds(
                'data-[state=active]:bg-white/20 data-[state=active]:text-white',
                'hover:bg-white/10 transition-all duration-200'
              )}
            >
              Ports
            </TabsTrigger>
            <TabsTrigger 
              value="player"
              className={ds(
                'data-[state=active]:bg-white/20 data-[state=active]:text-white',
                'hover:bg-white/10 transition-all duration-200'
              )}
            >
              Players
            </TabsTrigger>
            <TabsTrigger 
              value="active"
              className={ds(
                'data-[state=active]:bg-white/20 data-[state=active]:text-white',
                'hover:bg-white/10 transition-all duration-200'
              )}
            >
              Active 
              {gameState.activeTrades.length > 0 && (
                <Badge 
                  variant="secondary" 
                  className={ds(
                    'ml-1 bg-blue-500/20 border-blue-400/30 text-blue-300',
                    'hover:bg-blue-500/30 transition-colors duration-200'
                  )}
                >
                  {gameState.activeTrades.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="bank" className="mt-4">
            <BankTradingTab />
          </TabsContent>
          
          <TabsContent value="port" className="mt-4">
            <PortTradingTab />
          </TabsContent>
          
          <TabsContent value="player" className="mt-4">
            <PlayerTradingTab />
          </TabsContent>
          
          <TabsContent value="active" className="mt-4">
            <ActiveTradesTab />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
} 