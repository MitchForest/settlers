'use client'

import { useGameStore } from '@/stores/gameStore'
import { useTurnStore } from '@/stores/turnStore'
import { GameAction } from '@settlers/game-engine'
import { Button } from '@/components/ui/button'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog'
import { TurnTimer } from './TurnTimer'
import { RobberVictimDialog } from './RobberVictimDialog'
import { DiscardCardsDialog } from './DiscardCardsDialog'
import { 
  KnightCardDialog, 
  YearOfPlentyDialog, 
  MonopolyDialog, 
  RoadBuildingDialog 
} from './DevelopmentCardDialogs'
import { ds, componentStyles, designSystem } from '@/lib/design-system'

import { InfoIcon, Clock, Users, Activity } from 'lucide-react'
import { useState } from 'react'

interface GameInterfaceProps {
  onGameAction?: (action: GameAction) => void
  isConnected?: boolean
  gameId?: string
  onOpenDialog?: {
    robberVictim?: (hexId: string) => void
    discardCards?: (playerId: string, requiredDiscards: number) => void
    developmentCard?: (cardType: 'knight' | 'yearOfPlenty' | 'monopoly' | 'roadBuilding') => void
  }
}

// Dialog state types
interface DialogState {
  robberVictim: { isOpen: boolean; hexId: string | null }
  discardCards: { isOpen: boolean; playerId: string | null; requiredDiscards: number }
  knight: boolean
  yearOfPlenty: boolean
  monopoly: boolean
  roadBuilding: boolean
}

export function GameInterface({ onGameAction, isConnected = true, gameId, onOpenDialog }: GameInterfaceProps) {
  const gameState = useGameStore(state => state.gameState)
  const localPlayerId = useGameStore(state => state.localPlayerId)
  const { currentTurn, aiTurn, notifications } = useTurnStore()
  const isMyTurn = currentTurn.isMyTurn
  const timeRemaining = currentTurn.timing?.remainingMs || 0
  const [showInfoDialog, setShowInfoDialog] = useState(false)
  
  // Dialog state management
  const [dialogs, setDialogs] = useState<DialogState>({
    robberVictim: { isOpen: false, hexId: null },
    discardCards: { isOpen: false, playerId: null, requiredDiscards: 0 },
    knight: false,
    yearOfPlenty: false,
    monopoly: false,
    roadBuilding: false
  })

  // Dialog helper functions
  const openRobberVictimDialog = (hexId: string) => {
    setDialogs(prev => ({
      ...prev,
      robberVictim: { isOpen: true, hexId }
    }))
  }

  const openDiscardCardsDialog = (playerId: string, requiredDiscards: number) => {
    setDialogs(prev => ({
      ...prev,
      discardCards: { isOpen: true, playerId, requiredDiscards }
    }))
  }

  const openDevelopmentCardDialog = (cardType: 'knight' | 'yearOfPlenty' | 'monopoly' | 'roadBuilding') => {
    setDialogs(prev => ({
      ...prev,
      [cardType]: true
    }))
  }

  // Expose dialog functions to parent components via callback
  if (onOpenDialog) {
    onOpenDialog.robberVictim = openRobberVictimDialog
    onOpenDialog.discardCards = openDiscardCardsDialog
    onOpenDialog.developmentCard = openDevelopmentCardDialog
  }

  const closeDialog = (dialogType: keyof DialogState) => {
    setDialogs(prev => ({
      ...prev,
      [dialogType]: dialogType === 'robberVictim' 
        ? { isOpen: false, hexId: null }
        : dialogType === 'discardCards'
        ? { isOpen: false, playerId: null, requiredDiscards: 0 }
        : false
    }))
  }

  // Enhanced game action handler
  const handleGameAction = (action: GameAction) => {
    if (onGameAction) {
      onGameAction(action)
    }

    // Handle action side effects for UI
    if (action.type === 'moveRobber' && action.data?.hexPosition) {
      // Open robber victim selection after robber is moved
      const hexId = `${action.data.hexPosition.q},${action.data.hexPosition.r},${action.data.hexPosition.s}`
      openRobberVictimDialog(hexId)
    } else if (action.type === 'roll' && action.data?.dice?.sum === 7) {
      // Check if players need to discard due to robber
      if (gameState) {
        gameState.players.forEach((player, playerId) => {
          const totalResources = Object.values(player.resources).reduce((sum, count) => sum + count, 0)
          if (totalResources > 7) {
            const requiredDiscards = Math.floor(totalResources / 2)
            if (playerId === localPlayerId) {
              openDiscardCardsDialog(playerId, requiredDiscards)
            }
          }
        })
      }
    }
  }

  if (!gameState || !localPlayerId) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50">
        <div className="text-lg text-white">Loading game...</div>
      </div>
    )
  }

  const myPlayer = gameState.players.get(localPlayerId)
  const currentPlayer = gameState.players.get(gameState.currentPlayer)

  if (!myPlayer) {
    console.error('GameInterface: Player not found in game', {
      localPlayerId,
      gameStatePlayerIds: Array.from(gameState.players.keys()),
      gameStatePlayers: Array.from(gameState.players.values()).map((p: unknown) => {
        const player = p as { id: string; name: string }
        return { id: player.id, name: player.name }
      }),
      playerExistsInGame: gameState.players.has(localPlayerId)
    })
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50">
        <div className="text-lg text-red-500">Player not found in game</div>
      </div>
    )
  }

  return (
    <div className="game-interface">
      {/* Top Status Bar */}
      <div className="fixed top-4 left-4 right-4 z-50 flex items-center justify-between">
        {/* Left: Turn Status */}
        <div className={ds(designSystem.glass.primary, 'px-4 py-2 rounded-lg flex items-center gap-3')}>
          {/* Connection Status */}
          <div className="flex items-center gap-2">
            <div 
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-400' : 'bg-red-400'
              } animate-pulse`} 
            />
            <span className={designSystem.text.muted}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          {/* Turn Info */}
          <div className="h-4 w-px bg-white/20" />
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-white/60" />
            <span className={designSystem.text.body}>
              {isMyTurn ? 'Your turn' : `${currentPlayer?.name || 'Unknown'}'s turn`}
            </span>
          </div>

          {/* Phase Info */}
          <div className="h-4 w-px bg-white/20" />
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-white/60" />
            <span className={designSystem.text.body}>
              {gameState.phase}
            </span>
          </div>
        </div>

        {/* Center: Turn Timer */}
                 <div className={ds(designSystem.glass.primary, 'px-4 py-2 rounded-lg')}>
           <TurnTimer 
             size="sm" 
             showPhase={false} 
             showPlayerName={false}
           />
         </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowInfoDialog(true)}
            className={ds(
              designSystem.glass.primary,
              designSystem.interactive.primary.hover,
              'border-white/20 text-white'
            )}
          >
            <InfoIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Turn Notifications */}
      {notifications.length > 0 && (
        <div className="fixed top-20 right-4 z-40 space-y-2 max-w-sm">
          {notifications.slice(0, 3).map((notification) => (
            <div
              key={notification.id}
                             className={ds(
                 designSystem.glass.primary,
                 'px-4 py-3 rounded-lg border-l-4',
                 notification.type === 'actionCompleted' && 'border-l-green-400',
                 notification.type === 'turnTimeout' && 'border-l-orange-400',
                 notification.type === 'error' && 'border-l-red-400',
                 (notification.type === 'turnStarted' || notification.type === 'turnEnded' || notification.type === 'phaseChanged') && 'border-l-blue-400',
                 designSystem.animation.normal
               )}
            >
              <div className={designSystem.text.body}>
                {notification.message}
              </div>
              {notification.timestamp && (
                <div className={ds(designSystem.text.muted, 'text-xs mt-1')}>
                  {new Date(notification.timestamp).toLocaleTimeString()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Game Info Dialog */}
      <Dialog open={showInfoDialog} onOpenChange={setShowInfoDialog}>
        <DialogContent className={ds(
          designSystem.glass.primary,
          'sm:max-w-md backdrop-blur-md text-white'
        )}>
          <DialogHeader>
            <DialogTitle className="text-white">Game Information</DialogTitle>
            <DialogDescription className="text-white/80">
              Current game state and victory conditions
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2 text-white">Current Game State</h4>
              <div className="grid grid-cols-2 gap-4 text-sm text-white/80">
                <div>Turn: {gameState.turn}</div>
                <div>Phase: {gameState.phase}</div>
                <div>Players: {gameState.players.size}</div>
                <div>Current Player: {currentPlayer?.name || 'Unknown'}</div>
              </div>
            </div>

            {/* Turn Information */}
            <div>
              <h4 className="font-semibold mb-2 text-white">Turn Status</h4>
              <div className="text-sm text-white/80 space-y-1">
                <div>Time Remaining: {Math.ceil(timeRemaining / 1000)}s</div>
                <div>My Turn: {isMyTurn ? 'Yes' : 'No'}</div>
                <div>Available Actions: {currentTurn.availableActions.length}</div>
              </div>
            </div>
            
            {gameState.dice && (
              <div>
                <h4 className="font-semibold mb-2 text-white">Last Roll</h4>
                <div className="text-sm text-white/80">
                  {gameState.dice.die1} + {gameState.dice.die2} = {gameState.dice.sum}
                </div>
              </div>
            )}
            
            <div>
              <h4 className="font-semibold mb-2 text-white">Victory Conditions</h4>
              <div className="text-sm text-white/60">
                First player to reach 10 victory points wins!
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button 
              onClick={() => setShowInfoDialog(false)}
              className={ds(
                designSystem.interactive.primary.base,
                designSystem.interactive.primary.hover,
                'px-4 py-2 rounded-md'
              )}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Game Action Dialogs */}
      {gameState && (
        <>
          {/* Robber Victim Selection Dialog */}
          <RobberVictimDialog
            isOpen={dialogs.robberVictim.isOpen}
            onClose={() => closeDialog('robberVictim')}
            gameState={gameState}
            robberHexId={dialogs.robberVictim.hexId || ''}
            onSelectVictim={handleGameAction}
            localPlayerId={localPlayerId}
          />

          {/* Discard Cards Dialog */}
          {dialogs.discardCards.playerId && (
            <DiscardCardsDialog
              isOpen={dialogs.discardCards.isOpen}
              onClose={() => closeDialog('discardCards')}
              player={gameState.players.get(dialogs.discardCards.playerId)!}
              requiredDiscards={dialogs.discardCards.requiredDiscards}
              onDiscard={handleGameAction}
              localPlayerId={localPlayerId}
            />
          )}

          {/* Development Card Dialogs */}
          <KnightCardDialog
            isOpen={dialogs.knight}
            onClose={() => closeDialog('knight')}
            gameState={gameState}
            localPlayerId={localPlayerId}
            onAction={handleGameAction}
          />

          <YearOfPlentyDialog
            isOpen={dialogs.yearOfPlenty}
            onClose={() => closeDialog('yearOfPlenty')}
            gameState={gameState}
            localPlayerId={localPlayerId}
            onAction={handleGameAction}
          />

          <MonopolyDialog
            isOpen={dialogs.monopoly}
            onClose={() => closeDialog('monopoly')}
            gameState={gameState}
            localPlayerId={localPlayerId}
            onAction={handleGameAction}
          />

          <RoadBuildingDialog
            isOpen={dialogs.roadBuilding}
            onClose={() => closeDialog('roadBuilding')}
            gameState={gameState}
            localPlayerId={localPlayerId}
            onAction={handleGameAction}
          />
        </>
      )}
    </div>
  )
}

 