'use client'

import { defineHex, hexToPoint } from 'honeycomb-grid'
import { Board, TerrainType } from '@settlers/core'
import { cn } from '@/lib/utils'
import { useGameStore } from '@/stores/gameStore'
import { useMemo, useState, useEffect } from 'react'
import { useGameTheme } from '@/components/theme-provider'

interface HexGridLayerProps {
  board: Board
}

// Define our hex class for rendering
const GameHex = defineHex({ 
  dimensions: 45,
  origin: { x: 0, y: 0 }
})

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

// Generate hexagon path for SVG
function generateHexPath(centerX: number, centerY: number, size: number): string {
  const points: [number, number][] = []
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2 // Start from top
    const x = centerX + size * Math.cos(angle)
    const y = centerY + size * Math.sin(angle)
    points.push([x, y])
  }
  
  return `M ${points[0][0]} ${points[0][1]} ` + 
         points.slice(1).map(p => `L ${p[0]} ${p[1]}`).join(' ') + 
         ' Z'
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
  
  // Calculate board layout using Honeycomb
  const hexLayout = useMemo(() => {
    const hexes = Array.from(board.hexes.values())
    if (hexes.length === 0) return { hexes: [], viewBox: '0 0 100 100' }
    
    // Create Honeycomb hexes with positions
    const honeycombHexes = hexes.map(hex => {
      const honeycombHex = new GameHex(hex.position)
      const point = hexToPoint(honeycombHex)
      return {
        ...hex,
        x: point.x,
        y: point.y
      }
    })
    
    // Calculate viewBox bounds
    const xs = honeycombHexes.map(h => h.x)
    const ys = honeycombHexes.map(h => h.y)
    const minX = Math.min(...xs) - 60
    const maxX = Math.max(...xs) + 60
    const minY = Math.min(...ys) - 60
    const maxY = Math.max(...ys) + 60
    const width = maxX - minX
    const height = maxY - minY
    
    return {
      hexes: honeycombHexes,
      viewBox: `${minX} ${minY} ${width} ${height}`
    }
  }, [board])
  
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
    <svg 
      viewBox={hexLayout.viewBox}
      className="w-full h-full"
      style={{ maxWidth: '100%', maxHeight: '100%' }}
    >
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
      
      {/* Sort hexes so hovered/selected renders last (on top) */}
      {hexLayout.hexes
        .sort((a, b) => {
          const aIsActive = hoveredHex === a.id || selectedHex === a.id
          const bIsActive = hoveredHex === b.id || selectedHex === b.id
          if (aIsActive && !bIsActive) return 1
          if (!aIsActive && bIsActive) return -1
          return 0
        })
        .map((hex) => {
          const isHovered = hoveredHex === hex.id
          const isSelected = selectedHex === hex.id
          const isProducing = productionAnimation?.has(hex.id)
          const terrainConfig = TERRAIN_CONFIG[hex.terrain]
          
          // Get the computed color from the state
          const fillColor = terrainColors[hex.terrain] || '#000000'
          const hexPath = generateHexPath(hex.x, hex.y, 45)
          
          return (
            <g key={hex.id} className="hex-group">
              {/* Hex base with CSS hover effects */}
              <path
                d={hexPath}
                fill={fillColor}
                stroke={isSelected ? "white" : isHovered ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.2)"}
                strokeWidth={isSelected ? 3 : isHovered ? 2 : 1}
                filter={isSelected || isHovered ? "url(#hex-glow)" : "url(#hex-shadow)"}
                className={cn(
                  "transition-all duration-200 cursor-pointer",
                  "hover:brightness-110",
                  isSelected && "drop-shadow-lg",
                  isHovered && "scale-105",
                  isProducing && "animate-pulse"
                )}
                style={{ 
                  transformOrigin: `${hex.x}px ${hex.y}px`,
                  transform: isHovered ? 'scale(1.05)' : 'scale(1)'
                }}
                onMouseEnter={() => handleHexHover(hex.id)}
                onMouseLeave={() => handleHexHover(null)}
                onClick={() => handleHexClick(hex.id)}
              />
              
              {/* Glass morphism overlay */}
              <path
                d={hexPath}
                fill="url(#hex-gradient)"
                className="pointer-events-none"
              />
              
              {/* Terrain icon */}
              <text
                x={hex.x}
                y={hex.y - 12}
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
                  <circle
                    cx={hex.x}
                    cy={hex.y}
                    r={14}
                    fill="white"
                    stroke="#333"
                    strokeWidth={1.5}
                    filter="url(#hex-shadow)"
                    className="animate-in zoom-in duration-200"
                  />
                  <text
                    x={hex.x}
                    y={hex.y + 1}
                    textAnchor="middle"
                    className={cn(
                      "select-none font-bold text-sm fill-gray-800",
                      (hex.numberToken === 6 || hex.numberToken === 8) && "fill-red-600"
                    )}
                  >
                    {hex.numberToken}
                  </text>
                  {/* Probability dots */}
                  <text
                    x={hex.x}
                    y={hex.y + 16}
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
                <g className="pointer-events-none animate-pulse">
                  <circle
                    cx={hex.x}
                    cy={hex.y}
                    r={18}
                    fill="black"
                    opacity={0.8}
                    filter="url(#hex-shadow)"
                  />
                  <text
                    x={hex.x}
                    y={hex.y + 2}
                    textAnchor="middle"
                    fontSize="20"
                    className="fill-white"
                  >
                    🦹
                  </text>
                </g>
              )}
            </g>
          )
        })}
      </svg>
  )
} 