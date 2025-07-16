import React from 'react'
import { HexTileProps, ResourceTheme } from '@/lib/theme-types'

const HEX_RADIUS = 32

// Generate hexagon path points for SVG
function getHexPath(x: number, y: number, radius: number): string {
  // Use pre-calculated points for pointy-top hexagon (like Catan)
  // Starting from top point and going clockwise
  const points: [number, number][] = [
    [x, y - radius], // Top (270°)
    [x + radius * 0.866025403784, y - radius * 0.5], // Top-right (330°)
    [x + radius * 0.866025403784, y + radius * 0.5], // Bottom-right (30°)
    [x, y + radius], // Bottom (90°)
    [x - radius * 0.866025403784, y + radius * 0.5], // Bottom-left (150°)
    [x - radius * 0.866025403784, y - radius * 0.5], // Top-left (210°)
  ]
  return `M ${points.map(p => p.join(',')).join(' L ')} Z`
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
    'desert': '#F4E4BC'     // Tan/sand for desert
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

export const HexTile: React.FC<HexTileProps> = ({
  terrain,
  numberToken,
  position,
  theme,
  isHovered = false,
  isSelected = false,
  isEmpty = false,
  disableTransitions = false
}) => {
  // Use CSS colors only - no asset loading
  const terrainColor = terrain ? getTerrainColor(terrain, theme?.resources || []) : '#F4E4BC'
  
  return (
    <g transform={`translate(${position.x}, ${position.y})`}>
      {/* Hex Background */}
      <path
        d={getHexPath(0, 0, HEX_RADIUS)}
        fill={terrainColor}
        stroke={theme?.ui?.hexBorder || '#333333'}
        strokeWidth={theme?.ui?.hexBorderWidth || 2}
        opacity={isEmpty ? 0.3 : 1}
        className={`hex-tile ${isHovered ? 'hovered' : ''} ${isSelected ? 'selected' : ''} ${!disableTransitions ? 'transition-all duration-200' : ''}`}
        style={{
          filter: isHovered ? 'brightness(1.1)' : isSelected ? 'brightness(1.2)' : 'none'
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
            y="0"
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
                const startX = -(totalDots - 1) * 1.5
                return (
                  <circle
                    key={i}
                    cx={startX + i * 3}
                    cy="16"
                    r="1.5"
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