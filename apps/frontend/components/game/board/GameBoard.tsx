'use client'

import { ReactFlowProvider } from 'reactflow'
import { HexGridLayer } from './layers/HexGridLayer'
import { ConnectionLayer } from './layers/ConnectionLayer'
import { InteractionLayer } from './layers/InteractionLayer'
import { useGameStore } from '@/stores/gameStore'
import { cn } from '@/lib/utils'

export function GameBoard() {
  const gameState = useGameStore(state => state.gameState)
  const placementMode = useGameStore(state => state.placementMode)
  
  if (!gameState) return null
  
      return (
      <div className={cn(
        "fixed inset-0 w-screen h-screen",
        "overflow-hidden"
      )}
      style={{
        background: `linear-gradient(135deg, var(--color-game-bg-primary), var(--color-game-bg-secondary), var(--color-game-bg-accent))`
      }}>
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,var(--color-game-bg-primary)_0%,transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,var(--color-game-bg-accent)_0%,transparent_50%)]" />
        </div>
      
      {/* Base Layer: Hex Grid for terrain */}
      <div className="absolute inset-0 z-10">
        <HexGridLayer board={gameState.board} />
      </div>
      
      {/* Connection Layer: React Flow for roads and buildings */}
      {placementMode !== 'none' && (
        <div className="absolute inset-0 z-20">
          <ReactFlowProvider>
            <ConnectionLayer gameState={gameState} />
          </ReactFlowProvider>
        </div>
      )}
      
      {/* Interaction Layer: Overlays, tooltips, highlights */}
      <div className="absolute inset-0 z-30 pointer-events-none">
        <InteractionLayer gameState={gameState} />
      </div>
      
      {/* Mini-map overlay */}
      <div className="absolute bottom-4 right-4 z-40">
        {/* TODO: Add MiniMap component */}
      </div>
    </div>
  )
} 