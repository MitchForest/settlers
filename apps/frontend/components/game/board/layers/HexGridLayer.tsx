'use client'

import { HexGrid, Layout, Hexagon, Text } from 'react-hexgrid'
import { motion } from 'framer-motion'
import { Board, TerrainType } from '@settlers/core'
import { cn } from '@/lib/utils'
import { useGameStore } from '@/stores/gameStore'
import { useMemo, useState, useEffect } from 'react'
import { useGameTheme } from '@/components/theme-provider'

interface HexGridLayerProps {
  board: Board
}

// Theme-agnostic terrain configuration - uses CSS custom properties
const TERRAIN_CONFIG: Record<TerrainType, {
  cssVar: string
  icon: string
}> = {
  terrain1: { cssVar: 'var(--color-terrain1)', icon: '🌲' },
  terrain2: { cssVar: 'var(--color-terrain2)', icon: '🐑' },
  terrain3: { cssVar: 'var(--color-terrain3)', icon: '🌾' },
  terrain4: { cssVar: 'var(--color-terrain4)', icon: '🧱' },
  terrain5: { cssVar: 'var(--color-terrain5)', icon: '⛰️' },
  desert: { cssVar: 'var(--color-desert)', icon: '🏜️' }
}

export function HexGridLayer({ board }: HexGridLayerProps) {
  const hoveredHex = useGameStore(state => state.hoveredHex)
  const selectedHex = useGameStore(state => state.selectedHex)
  const productionAnimation = useGameStore(state => state.productionAnimation)
  const { theme, loading } = useGameTheme()

  // Initialize state as an empty object for cleaner loading logic
  const [terrainColors, setTerrainColors] = useState<Record<TerrainType, string>>({} as Record<TerrainType, string>)

  // Use useEffect to compute styles after the theme loads
  useEffect(() => {
    // Only run this logic when loading is finished and we have a theme
    if (!loading && theme) {
      const computedColors = {} as Record<TerrainType, string>
      for (const key in TERRAIN_CONFIG) {
        const terrain = key as TerrainType
        const config = TERRAIN_CONFIG[terrain]
        const cssVarName = config.cssVar.replace('var(', '').replace(')', '')
        const color = getComputedStyle(document.documentElement).getPropertyValue(cssVarName).trim()
        // Fallback to black if a variable is missing for some reason
        computedColors[terrain] = color || '#000000'
      }
      setTerrainColors(computedColors)
      console.log('Computed terrain colors:', computedColors)
    }
  }, [loading, theme]) // This effect re-runs when loading or theme changes
  
  // Calculate proper board bounds for centering
  const boardBounds = useMemo(() => {
    const hexes = Array.from(board.hexes.values())
    if (hexes.length === 0) return { minQ: 0, maxQ: 0, minR: 0, maxR: 0, centerQ: 0, centerR: 0 }
    
    const qs = hexes.map(h => h.position.q)
    const rs = hexes.map(h => h.position.r)
    
    const minQ = Math.min(...qs)
    const maxQ = Math.max(...qs)
    const minR = Math.min(...rs)
    const maxR = Math.max(...rs)
    const centerQ = (minQ + maxQ) / 2
    const centerR = (minR + maxR) / 2
    
    return { minQ, maxQ, minR, maxR, centerQ, centerR }
  }, [board])
  
  // Responsive hex size and viewport
  const hexSize = 45
  const boardWidth = (boardBounds.maxQ - boardBounds.minQ + 3) * hexSize * 1.5
  const boardHeight = (boardBounds.maxR - boardBounds.minR + 3) * hexSize * Math.sqrt(3)
  const viewBox = `${-boardWidth/2} ${-boardHeight/2} ${boardWidth} ${boardHeight}`
  
  const handleHexClick = (hexId: string) => {
    // Toggle selection - click same hex to deselect
    useGameStore.setState({ 
      selectedHex: selectedHex === hexId ? null : hexId 
    })
  }
  
  const handleHexHover = (hexId: string | null) => {
    useGameStore.setState({ hoveredHex: hexId })
  }
  
  // Don't render until colors are computed. This now works correctly.
  if (loading || Object.keys(terrainColors).length === 0) {
    return <div>Loading board...</div>
  }

  return (
    <div className="hex-board">
      <HexGrid width="100vw" height="100vh" viewBox={viewBox}>
        <defs>
          {/* Glass morphism gradient overlay */}
          <radialGradient id="hex-gradient">
            <stop offset="0%" stopColor="white" stopOpacity="0.15" />
            <stop offset="100%" stopColor="black" stopOpacity="0.05" />
          </radialGradient>
          
          {/* Glow effect for hover and selection */}
          <filter id="hex-glow">
            <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          
          {/* Shadow for depth */}
          <filter id="hex-shadow">
            <feDropShadow dx="1" dy="2" stdDeviation="2" floodOpacity="0.2"/>
          </filter>
        </defs>
        
        <Layout 
          size={{ x: hexSize, y: hexSize }} 
          flat={true} 
          spacing={1.05} 
          origin={{ x: 0, y: 0 }}
        >
          {Array.from(board.hexes.values()).map((hex) => {
            const isHovered = hoveredHex === hex.id
            const isSelected = selectedHex === hex.id
            const isProducing = productionAnimation?.has(hex.id)
            const terrainConfig = TERRAIN_CONFIG[hex.terrain]
            
            // Get the computed color from the state
            const fillColor = terrainColors[hex.terrain] || '#000000'
            
            return (
              <g key={hex.id} className="hex-group">
                {/* Hex base with proper animations */}
                <motion.g
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ 
                    scale: isProducing ? [1, 1.1, 1] : (isHovered ? 1.08 : 1),
                    opacity: 1,
                    fill: fillColor 
                  }}
                  transition={{ 
                    scale: {
                      duration: isProducing ? 1.5 : 0.2,
                      repeat: isProducing ? Infinity : 0,
                      ease: "easeInOut"
                    },
                    opacity: { duration: 0.3 },
                    fill: { duration: 0.2 } // Optionally add a transition for color changes
                  }}
                  style={{ transformOrigin: "center" }}
                >
                  <Hexagon
                    q={hex.position.q}
                    r={hex.position.r}
                    s={hex.position.s}
                    stroke={isSelected ? "white" : isHovered ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.2)"}
                    strokeWidth={isSelected ? 3 : isHovered ? 2 : 1}
                    filter={isSelected || isHovered ? "url(#hex-glow)" : "url(#hex-shadow)"}
                    className={cn(
                      "transition-all duration-200 cursor-pointer",
                      "hover:brightness-110",
                      isSelected && "drop-shadow-lg",
                      isHovered && "drop-shadow-md"
                    )}
                    onMouseEnter={() => handleHexHover(hex.id)}
                    onMouseLeave={() => handleHexHover(null)}
                    onClick={() => handleHexClick(hex.id)}
                  />
                  
                  {/* Glass morphism overlay */}
                  <Hexagon
                    q={hex.position.q}
                    r={hex.position.r}
                    s={hex.position.s}
                    fill="url(#hex-gradient)"
                    className="pointer-events-none"
                  />
                </motion.g>
                
                {/* Terrain icon */}
                <text
                  x={0}
                  y={-12}
                  textAnchor="middle"
                  fontSize="18"
                  className="pointer-events-none select-none"
                  opacity={0.9}
                >
                  {terrainConfig.icon}
                </text>
                
                {/* Number token */}
                {hex.numberToken && (
                  <g className="number-token pointer-events-none">
                    <motion.circle
                      r={14}
                      fill="white"
                      stroke="#333"
                      strokeWidth={1.5}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                      filter="url(#hex-shadow)"
                    />
                    <Text
                      y={1}
                      className={cn(
                        "select-none font-bold text-sm fill-gray-800",
                        (hex.numberToken === 6 || hex.numberToken === 8) && "fill-red-600"
                      )}
                    >
                      {hex.numberToken}
                    </Text>
                    {/* Probability dots */}
                    <text
                      y={16}
                      textAnchor="middle"
                      fontSize="7"
                      fill="#666"
                      className="select-none"
                    >
                      {'•'.repeat(hex.numberToken === 6 || hex.numberToken === 8 ? 5 : 
                                  hex.numberToken === 5 || hex.numberToken === 9 ? 4 :
                                  hex.numberToken === 4 || hex.numberToken === 10 ? 3 :
                                  hex.numberToken === 3 || hex.numberToken === 11 ? 2 : 1)}
                    </text>
                  </g>
                )}
                
                {/* Robber */}
                {hex.hasBlocker && (
                  <motion.g 
                    className="pointer-events-none"
                    initial={{ scale: 0, rotate: 0 }}
                    animate={{ scale: 1, rotate: [0, 5, -5, 0] }}
                    transition={{ 
                      scale: { type: "spring", stiffness: 200 },
                      rotate: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                    }}
                  >
                    <circle
                      r={18}
                      fill="black"
                      opacity={0.8}
                      filter="url(#hex-shadow)"
                    />
                    <text
                      textAnchor="middle"
                      y={2}
                      fontSize="20"
                      className="fill-white"
                    >
                      🦹
                    </text>
                  </motion.g>
                )}
              </g>
            )
          })}
        </Layout>
      </HexGrid>
    </div>
  )
} 