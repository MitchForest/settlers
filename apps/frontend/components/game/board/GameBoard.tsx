'use client'

import { HexGridLayer } from './layers/HexGridLayer'
import { ConnectionLayer } from './layers/ConnectionLayer'
import { InteractionLayer } from './layers/InteractionLayer'
import { GamePiece } from './pieces/GamePiece'
import { useGameStore } from '@/stores/gameStore'
import { useGameTheme } from '@/components/theme-provider'
import { getAssetResolver } from '@/lib/theme-loader'
import { cn } from '@/lib/utils'
import { Board } from '@settlers/core'
import { useState, useEffect } from 'react'
import { AssetResolver } from '@/lib/theme-types'

interface TestPiece {
  type: 'settlement' | 'city' | 'road'
  playerId: string
  position: { x: number, y: number }
  rotation?: number
}

interface GameBoardProps {
  board?: Board
  testPieces?: TestPiece[]
}

export function GameBoard({ board: propBoard, testPieces = [] }: GameBoardProps = {}) {
  const gameState = useGameStore(state => state.gameState)
  const placementMode = useGameStore(state => state.placementMode)
  const { theme, loading } = useGameTheme()
  const [assetResolver, setAssetResolver] = useState<AssetResolver | null>(null)
  const [selectedHexId, setSelectedHexId] = useState<string | undefined>(undefined)
  
  // Use prop board if provided, otherwise fall back to store
  const board = propBoard || gameState?.board
  
  // Initialize asset resolver only if theme exists (optional enhancement)
  useEffect(() => {
    if (!theme) {
      setAssetResolver(null) // No theme = use geometric fallbacks
      return
    }
    
    const initResolver = async () => {
      try {
        const resolver = await getAssetResolver(theme)
        setAssetResolver(() => resolver)
      } catch (error) {
        console.error('Theme asset loading failed, using fallbacks:', error)
        setAssetResolver(null) // Fall back to geometric shapes on error
      }
    }
    initResolver()
  }, [theme])
  
  console.log('GameBoard render:', { board: !!board, loading, theme: !!theme, assetResolver: !!assetResolver })
  
  // CRITICAL FIX: Only block if no board exists
  // Theme loading should NOT block board rendering - themes are optional enhancements
  if (!board) {
    return (
      <div className="fixed inset-0 w-screen h-screen flex items-center justify-center">
        <div className="text-lg text-gray-500">
          No board data available
        </div>
      </div>
    )
  }
  
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
    
    {/* Base Layer: Hex Grid for terrain - renders with or without theme */}
    <div className="absolute inset-0 z-10">
      <HexGridLayer 
        board={board} 
        theme={theme} // Can be null - component handles fallbacks
        selectedHexId={selectedHexId}
        onHexSelect={(hexId) => {
          console.log('Hex selected:', hexId)
          setSelectedHexId(hexId === selectedHexId ? undefined : hexId) // Toggle selection
        }}
      />
    </div>
    
    {/* Game Pieces Layer - renders with geometric fallbacks if no theme */}
    {testPieces.length > 0 && (
      <div className="absolute inset-0 z-15 pointer-events-none">
        <svg
          width="100%"
          height="100%"
          className="game-pieces-svg"
          style={{ background: 'transparent' }}
        >
          {testPieces.map((piece, index) => (
            <GamePiece
              key={index}
              type={piece.type}
              playerId={piece.playerId}
              position={piece.position}
              theme={theme} // Can be null - component handles fallbacks
              assetResolver={assetResolver} // Can be null - component handles fallbacks
              rotation={piece.rotation}
            />
          ))}
        </svg>
      </div>
    )}
    
    {/* Connection Layer: SVG for roads and buildings */}
    {placementMode !== 'none' && (
      <div className="absolute inset-0 z-20 pointer-events-none">
        <ConnectionLayer />
      </div>
    )}
    
    {/* Interaction Layer: Overlays, tooltips, highlights */}
    <div className="absolute inset-0 z-30 pointer-events-none">
      {gameState && <InteractionLayer gameState={gameState} />}
    </div>
    
    {/* Mini-map overlay */}
    <div className="absolute bottom-4 right-4 z-40">
      {/* TODO: Add MiniMap component */}
    </div>
    
    {/* Theme loading indicator (optional, non-blocking) */}
    {loading && (
      <div className="absolute top-4 left-4 z-50 bg-black/50 text-white px-3 py-1 rounded-md text-sm">
        Loading theme...
      </div>
    )}
  </div>
)
} 