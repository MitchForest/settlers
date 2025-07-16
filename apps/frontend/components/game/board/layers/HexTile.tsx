import React, { useState } from 'react'
import { defineHex, Orientation } from 'honeycomb-grid'
import { HexTileProps, ResourceTheme } from '@/lib/theme-types'

const HEX_RADIUS = 32

// Generate hexagon path points for SVG using honeycomb-grid
function getHexPath(radius: number): string {
  // Let honeycomb-grid calculate the correct corners based on orientation
  const CustomHex = defineHex({ dimensions: radius, orientation: Orientation.FLAT })
  const hex = new CustomHex({ q: 0, r: 0 }) // Create hex at origin
  const corners = hex.corners // Library calculates all the math! (corners is a getter)
  const points = corners.map((corner: any) => [corner.x, corner.y])
  return `M ${points.map((p: any) => p.join(',')).join(' L ')} Z`
}

// Get terrain color using Settlers terminology
function getTerrainColor(terrain: string, resources: ResourceTheme[]): string {
  const resource = resources.find((r: ResourceTheme) => r.id === terrain)
  if (resource?.color) return resource.color
  
  // Settlers terrain fallback colors
  const fallbackColors: Record<string, string> = {
    'forest': '#2D5016',    // Dark green for wood
    'pasture': '#7CB342',   // Light green for sheep
    'fields': '#FFC107',    // Yellow for wheat
    'hills': '#D84315',     // Orange/red for brick
    'mountains': '#6A1B9A', // Purple for ore
    'desert': '#F4E4BC',    // Tan/sand for desert
    'sea': '#1E40AF'        // Blue for ocean
  }
  return fallbackColors[terrain] || '#F4E4BC'
}

// Get probability dots for number token
function getProbabilityDots(num: number): number {
  const probabilities: Record<number, number> = {
    2: 1, 12: 1,
    3: 2, 11: 2,
    4: 3, 10: 3,
    5: 4, 9: 4,
    6: 5, 8: 5
  }
  return probabilities[num] || 0
}

export function HexTile({
  terrain,
  numberToken,
  position,
  theme,
  isHovered = false,
  isSelected = false,
  isEmpty = false,
  disableTransitions = false
}: HexTileProps) {
  const [localHovered, setLocalHovered] = useState(false)
  
  // Use theme resources or fallback to empty array
  const resources = theme?.resources || []
  const terrainColor = terrain ? getTerrainColor(terrain, resources) : '#F4E4BC'
  const hexPath = getHexPath(HEX_RADIUS)
  
  // Only apply hover effects to playable terrain (not sea or desert)
  const isPlayableTerrain = terrain && terrain !== 'sea' && terrain !== 'desert'
  const showHoverEffect = (isHovered || localHovered) && isPlayableTerrain
  
  const handleMouseEnter = () => {
    if (isPlayableTerrain) {
      setLocalHovered(true)
    }
  }
  
  const handleMouseLeave = () => {
    if (isPlayableTerrain) {
      setLocalHovered(false)
    }
  }

  return (
    <g 
      transform={`translate(${position.x}, ${position.y})`}
      className={isPlayableTerrain ? "cursor-pointer" : ""}
      data-hex-interactive={isPlayableTerrain ? "true" : undefined}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Hex base */}
      <path
        d={hexPath}
        fill={terrainColor}
        stroke={theme?.ui?.hexBorder || '#2D3748'}
        strokeWidth={theme?.ui?.hexBorderWidth || 1}
        opacity={isEmpty ? 0.3 : 1}
        className={`
          transition-all duration-200
          ${isSelected ? "filter-[url(#hexGlow)]" : ""}
          ${showHoverEffect ? "brightness-110 drop-shadow-md" : ""}
          ${!disableTransitions ? "transition-all duration-200" : ""}
        `}
        style={{
          filter: showHoverEffect ? 'brightness(1.15) drop-shadow(0 4px 8px rgba(0,0,0,0.2))' : 
                  isSelected ? 'brightness(1.2)' : 'none'
        }}
      />
      
      {/* Number Token */}
      {numberToken && !isEmpty && (
        <g>
          {/* Number token background */}
          <circle
            cx="0"
            cy="0"
            r="14"
            fill={theme?.ui?.numberTokenBackground || '#FFFFFF'}
            stroke={theme?.ui?.numberTokenBorder || '#000000'}
            strokeWidth="2"
          />
          
          {/* Number text */}
          <text
            x="0"
            y="-2"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="14"
            fontWeight="bold"
            fill={numberToken === 6 || numberToken === 8 ? '#DC2626' : '#000000'}
            className="pointer-events-none select-none"
          >
            {numberToken}
          </text>
          
          {/* Probability dots */}
          {getProbabilityDots(numberToken) > 0 && (
            <g>
              {Array.from({ length: getProbabilityDots(numberToken) }).map((_, i) => {
                const totalDots = getProbabilityDots(numberToken)
                const dotSpacing = 2.5
                const startX = -(totalDots - 1) * (dotSpacing / 2)
                return (
                  <circle
                    key={i}
                    cx={startX + i * dotSpacing}
                    cy="8"
                    r="1"
                    fill={numberToken === 6 || numberToken === 8 ? '#DC2626' : '#000000'}
                    className="pointer-events-none"
                  />
                )
              })}
            </g>
          )}
        </g>
      )}
      
      {/* Robber (if present) */}
      {/* Note: Robber rendering would go here when we implement it */}
    </g>
  )
}

// Shared filter definitions for hex tiles
export const HexTileFilters: React.FC = () => (
  <defs>
    {/* Drop shadow filter */}
    <filter id="hexShadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="2" dy="2" stdDeviation="3" floodOpacity="0.3" />
    </filter>
    
    {/* Glow filter for selections */}
    <filter id="hexGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
) 