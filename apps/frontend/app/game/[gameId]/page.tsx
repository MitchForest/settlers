'use client'

import { GameBoard } from '@/components/game/board/GameBoard'
import { useState } from 'react'
import { Board, TerrainType } from '@settlers/core'
import { Button } from '@/components/ui/button'

// Test game pieces to demonstrate the system
const TEST_PIECES = [
  { type: 'settlement' as const, playerId: 'red', position: { x: 100, y: 100 } },
  { type: 'city' as const, playerId: 'blue', position: { x: 150, y: 120 } },
  { type: 'road' as const, playerId: 'red', position: { x: 125, y: 110 }, rotation: 45 },
  { type: 'road' as const, playerId: 'green', position: { x: 175, y: 90 }, rotation: 90 },
]

// Simple board generation functions for testing
function generateEmptyBoard(): Board {
  const hexes = []
  
  // Generate 19 hex positions without terrain or numbers
  // Center hex
  hexes.push({ 
    id: '0,0,0',
    position: { q: 0, r: 0, s: 0 },
    terrain: null as any, // Truly empty - no terrain assigned yet
    numberToken: null,
    hasBlocker: false
  })
  
  // Inner ring (6 hexes)
  const innerPositions = [
    { q: 1, r: -1, s: 0 }, { q: 1, r: 0, s: -1 }, { q: 0, r: 1, s: -1 },
    { q: -1, r: 1, s: 0 }, { q: -1, r: 0, s: 1 }, { q: 0, r: -1, s: 1 }
  ]
  innerPositions.forEach(pos => {
    hexes.push({
      id: `${pos.q},${pos.r},${pos.s}`,
      position: pos,
      terrain: null as any, // Truly empty - no terrain assigned yet
      numberToken: null,
      hasBlocker: false
    })
  })
  
  // Outer ring (12 hexes)
  const outerPositions = [
    { q: 2, r: -2, s: 0 }, { q: 2, r: -1, s: -1 }, { q: 2, r: 0, s: -2 },
    { q: 1, r: 1, s: -2 }, { q: 0, r: 2, s: -2 }, { q: -1, r: 2, s: -1 },
    { q: -2, r: 2, s: 0 }, { q: -2, r: 1, s: 1 }, { q: -2, r: 0, s: 2 },
    { q: -1, r: -1, s: 2 }, { q: 0, r: -2, s: 2 }, { q: 1, r: -2, s: 1 }
  ]
  outerPositions.forEach(pos => {
    hexes.push({
      id: `${pos.q},${pos.r},${pos.s}`,
      position: pos,
      terrain: null as any, // Truly empty - no terrain assigned yet
      numberToken: null,
      hasBlocker: false
    })
  })

  return {
    id: 'test-board',
    baseGrid: { hexes: [], ports: [] },
    terrainAssignment: {},
    numberAssignment: {},
    hexes,
    ports: [],
    vertices: new Map(),
    edges: new Map(),
    blockerPosition: { q: 0, r: 0, s: 0 }
  }
}

function addTerrainsToBoard(board: Board): Board {
  const terrainTypes: TerrainType[] = [
    'tile-type-1', 'tile-type-1', 'tile-type-1', 'tile-type-1', // 4 of type 1
    'tile-type-2', 'tile-type-2', 'tile-type-2', 'tile-type-2', // 4 of type 2  
    'tile-type-3', 'tile-type-3', 'tile-type-3', 'tile-type-3', // 4 of type 3
    'tile-type-4', 'tile-type-4', 'tile-type-4',                // 3 of type 4
    'tile-type-5', 'tile-type-5', 'tile-type-5',                // 3 of type 5
    'tile-type-6'                                               // 1 non-producing
  ]
  
  // Shuffle terrains
  const shuffled = [...terrainTypes].sort(() => Math.random() - 0.5)
  
  const newHexes = board.hexes.map((hex, index) => ({
    ...hex,
    terrain: shuffled[index] || ('tile-type-6' as TerrainType),
    hasBlocker: shuffled[index] === 'tile-type-6'
  }))

  return { ...board, hexes: newHexes }
}

function addNumbersToBoard(board: Board): Board {
  const numbers = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12]
  const shuffled = [...numbers].sort(() => Math.random() - 0.5)
  
  let numberIndex = 0
  const newHexes = board.hexes.map(hex => ({
    ...hex,
    numberToken: (hex.terrain === 'tile-type-6' || hex.terrain === 'desert') ? null : shuffled[numberIndex++] || null
  }))

  return { ...board, hexes: newHexes }
}

function fixNumbersAfterTerrainShuffle(board: Board): Board {
  // Find the hex with non-producing terrain (tile-type-6)
  const nonProducingHexIndex = board.hexes.findIndex(hex => hex.terrain === 'tile-type-6' || hex.terrain === 'desert')
  
  if (nonProducingHexIndex === -1) return board // No non-producing hex found
  
  // If the non-producing hex has a number, we need to move it
  const nonProducingHex = board.hexes[nonProducingHexIndex]
  
  if (nonProducingHex.numberToken !== null) {
    // Find a producing hex without a number to swap with
    const producingHexWithoutNumber = board.hexes.findIndex(hex => 
      hex.terrain !== 'tile-type-6' && 
      hex.terrain !== 'desert' && 
      hex.terrain !== null &&
      hex.numberToken === null
    )
    
    if (producingHexWithoutNumber !== -1) {
      // Swap: give the number to the producing hex, remove from non-producing
      const newHexes = [...board.hexes]
      newHexes[producingHexWithoutNumber] = {
        ...newHexes[producingHexWithoutNumber],
        numberToken: nonProducingHex.numberToken
      }
      newHexes[nonProducingHexIndex] = {
        ...newHexes[nonProducingHexIndex],
        numberToken: null
      }
      
      return { ...board, hexes: newHexes }
    }
  }
  
  // Ensure the non-producing hex has no number and has blocker
  const newHexes = board.hexes.map((hex, index) => 
    index === nonProducingHexIndex 
      ? { ...hex, numberToken: null, hasBlocker: true }
      : hex
  )
  
  return { ...board, hexes: newHexes }
}

export default function GamePage() {
  const [board, setBoard] = useState<Board>(generateEmptyBoard())
  const [step, setStep] = useState<'empty' | 'terrain' | 'numbers'>('empty')

  const handleGenerateEmpty = () => {
    setBoard(generateEmptyBoard())
    setStep('empty')
  }

  const handleAddTerrains = () => {
    setBoard(addTerrainsToBoard(board))
    setStep('terrain')
  }

  const handleAddNumbers = () => {
    setBoard(addNumbersToBoard(board))
    setStep('numbers')
  }

  const handleShuffleTerrains = () => {
    if (step !== 'empty') {
      // If we have numbers, we need to be careful about the non-producing tile
      const newBoard = addTerrainsToBoard(board)
      
      // If we have numbers, ensure no numbers land on non-producing tiles
      if (step === 'numbers') {
        const correctedBoard = fixNumbersAfterTerrainShuffle(newBoard)
        setBoard(correctedBoard)
      } else {
        setBoard(newBoard)
      }
    }
  }

  const handleShuffleNumbers = () => {
    if (step === 'numbers') {
      setBoard(addNumbersToBoard(board))
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Debug Controls */}
      <div className="absolute top-4 left-4 z-50 bg-white/90 backdrop-blur-sm rounded-lg p-4 shadow-lg">
        <h3 className="font-bold text-sm mb-3 text-gray-800">Board Generation</h3>
        <div className="flex flex-col gap-2">
          <div className="text-xs text-gray-600 mb-2">
            Step: <span className="font-mono">{step}</span> | Hexes: {board.hexes.length}
          </div>
          
          {/* Add/Shuffle Terrains Button */}
          {step === 'empty' ? (
            <Button 
              size="sm" 
              variant="default"
              onClick={handleAddTerrains}
              className="text-xs"
            >
              Add Terrains
            </Button>
          ) : (
            <Button 
              size="sm" 
              variant="outline"
              onClick={handleShuffleTerrains}
              className="text-xs"
            >
              Shuffle Terrains
            </Button>
          )}
          
          {/* Add/Shuffle Numbers Button - only show after terrains are added */}
          {step !== 'empty' && (
            step === 'terrain' ? (
              <Button 
                size="sm" 
                variant="default"
                onClick={handleAddNumbers}
                className="text-xs"
              >
                Add Numbers
              </Button>
            ) : (
              <Button 
                size="sm" 
                variant="outline"
                onClick={handleShuffleNumbers}
                className="text-xs"
              >
                Shuffle Numbers
              </Button>
            )
          )}
          
          {/* Clear Button */}
          <div className="border-t pt-2 mt-2">
            <Button 
              size="sm" 
              variant="destructive"
              onClick={handleGenerateEmpty}
              className="text-xs w-full"
            >
              Clear
            </Button>
          </div>
        </div>
      </div>

      {/* Game Board */}
      <GameBoard board={board} testPieces={TEST_PIECES} />
    </div>
  )
} 