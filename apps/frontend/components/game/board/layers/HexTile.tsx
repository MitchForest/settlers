import React from 'react'
import { defineHex, Orientation } from 'honeycomb-grid'
import { ResourceTheme } from '@/lib/theme-types'
import { HEX_RADIUS } from '@/lib/board-utils'
import { TOKEN_DESIGN, PROBABILITY_DOTS } from '@/lib/game-constants'
import { GameTheme } from '@/lib/theme-types'

// Generate hexagon path points for SVG using honeycomb-grid
function getHexPath(radius: number): string {
  // Let honeycomb-grid calculate the correct corners based on orientation
  const CustomHex = defineHex({ dimensions: radius, orientation: Orientation.FLAT })
  const hex = new CustomHex({ q: 0, r: 0 }) // Create hex at origin
  const corners = hex.corners // Library calculates all the math! (corners is a getter)
  const points = corners.map((corner: { x: number; y: number }) => [corner.x, corner.y])
  return `M ${points.map((p: number[]) => p.join(',')).join(' L ')} Z`
}

// Get terrain texture path from theme
function getTerrainTexture(terrain: string, resources: ResourceTheme[]): string | null {
  const resource = resources.find((r: ResourceTheme) => r.id === terrain)
  return resource?.texture || null
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

// Enhanced interface with robber support and click handlers
interface HexTileProps {
  terrain: string | null
  numberToken: number | null
  position: { x: number; y: number }
  theme: GameTheme | null
  assetResolver: unknown
  isHovered?: boolean
  isSelected?: boolean
  isEmpty?: boolean
  disableTransitions?: boolean
  hexId: string
  hasRobber?: boolean
  canMoveRobber?: boolean
  onHexHover?: (hexId: string | null) => void
  onHexClick?: (hexId: string | null) => void
}

export const HexTile: React.FC<HexTileProps> = ({
  terrain,
  numberToken,
  position,
  theme,
  isHovered = false,
  isSelected = false,
  isEmpty = false,
  hexId,
  hasRobber = false,
  canMoveRobber = false,
  onHexHover,
  onHexClick
}) => {
  const hexPath = getHexPath(HEX_RADIUS)
  const showHoverEffect = isHovered && !isEmpty
  
  // Asset resolution
  const resources = theme?.resources || []
  const terrainTexture = getTerrainTexture(terrain || '', resources)
  const terrainColor = getTerrainColor(terrain || '', resources)
  const patternId = terrainTexture ? `texture-${hexId}` : null
  
  const handleMouseEnter = () => {
    if (onHexHover) {
      onHexHover(hexId)
    }
  }
  
  const handleMouseLeave = () => {
    if (onHexHover) {
      onHexHover(null)
    }
  }
  
  const handleClick = () => {
    if (onHexClick && (canMoveRobber || !isEmpty)) {
      onHexClick(hexId)
    }
  }

  return (
    <g 
      className={`hex-tile ${canMoveRobber ? 'cursor-pointer' : ''}`}
      transform={`translate(${position.x}, ${position.y})`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {/* Texture pattern definition */}
      {terrainTexture && patternId && (
        <defs>
          <pattern 
            id={patternId}
            patternUnits="objectBoundingBox"
            patternContentUnits="objectBoundingBox"
            width="1"
            height="1"
          >
            <image
              href={terrainTexture}
              width="1.3"
              height="1.3"
              x="-0.15"
              y="-0.15"
              preserveAspectRatio="xMidYMid slice"
            />
          </pattern>
        </defs>
      )}

      {/* Hex base - use texture or fallback to color */}
      <path
        d={hexPath}
        fill={terrainTexture && patternId ? `url(#${patternId})` : terrainColor}
        stroke={theme?.ui?.hexBorder || '#2D3748'}
        strokeWidth={theme?.ui?.hexBorderWidth || 1}
        opacity={isEmpty ? 0.3 : 1}
        style={{
          filter: isSelected ? 'drop-shadow(0 3px 12px rgba(37, 99, 235, 0.25))' : 'none',
        }}
      />

      {/* Robber movement highlight */}
      {canMoveRobber && (
        <path
          d={hexPath}
          fill="rgba(220, 38, 38, 0.15)"
          stroke="rgba(220, 38, 38, 0.5)"
          strokeWidth={2}
          className="pointer-events-none animate-pulse"
          style={{
            transition: `opacity var(--interaction-timing) var(--interaction-easing)`,
          }}
        />
      )}

      {/* Subtle white hover overlay */}
      {showHoverEffect && (
        <path
          d={hexPath}
          fill="var(--hover-overlay)"
          className="pointer-events-none"
          style={{
            transition: `opacity var(--interaction-timing) var(--interaction-easing)`,
          }}
        />
      )}

      {/* Selection indicator - subtle overlay like hover but stronger */}
      {isSelected && (
        <path
          d={hexPath}
          fill="rgba(255, 255, 255, 0.12)"
          className="pointer-events-none"
          style={{
            transition: `opacity var(--interaction-timing) var(--interaction-easing)`,
          }}
        />
      )}
      
      {/* Number Token */}
      {numberToken && !isEmpty && !hasRobber && (
        <g>
          {/* Number token background - standardized design */}
          <circle
            cx="0"
            cy="0"
            r={TOKEN_DESIGN.radius}
            fill={TOKEN_DESIGN.backgroundColor}
            stroke={TOKEN_DESIGN.borderColor}
            strokeWidth={TOKEN_DESIGN.borderWidth}
          />
          
          {/* Number text */}
          <text
            x="0"
            y="-2"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={TOKEN_DESIGN.fontSize.number}
            fontWeight="bold"
            fill={numberToken === 6 || numberToken === 8 ? TOKEN_DESIGN.redTextColor : TOKEN_DESIGN.textColor}
          >
            {numberToken}
          </text>
          
          {/* Probability dots */}
          {Array.from({ length: getProbabilityDots(numberToken) }, (_, i) => (
            <circle
              key={i}
              cx={-((getProbabilityDots(numberToken) - 1) * PROBABILITY_DOTS.dotSpacing) / 2 + (i * PROBABILITY_DOTS.dotSpacing)}
              cy={PROBABILITY_DOTS.yOffset}
              r={PROBABILITY_DOTS.dotRadius}
              fill={numberToken === 6 || numberToken === 8 ? PROBABILITY_DOTS.redColor : PROBABILITY_DOTS.color}
            />
          ))}
        </g>
      )}

      {/* Robber piece */}
      {hasRobber && (
        <g className="robber-piece">
          {/* Robber shadow */}
          <circle
            cx="2"
            cy="2"
            r="18"
            fill="rgba(0, 0, 0, 0.3)"
            className="pointer-events-none"
          />
          
          {/* Robber body - dark figure */}
          <circle
            cx="0"
            cy="0"
            r="16"
            fill="#1a1a1a"
            stroke="#000"
            strokeWidth="2"
            className="pointer-events-none"
          />
          
          {/* Robber hood/head */}
          <circle
            cx="0"
            cy="-8"
            r="8"
            fill="#2a2a2a"
            stroke="#000"
            strokeWidth="1"
            className="pointer-events-none"
          />
          
          {/* Robber eyes */}
          <circle
            cx="-3"
            cy="-8"
            r="1.5"
            fill="#ff0000"
            className="pointer-events-none"
          />
          <circle
            cx="3"
            cy="-8"
            r="1.5"
            fill="#ff0000"
            className="pointer-events-none"
          />
          
          {/* Robber text label */}
          <text
            x="0"
            y="26"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="10"
            fontWeight="bold"
            fill="#ff0000"
            className="pointer-events-none"
          >
            ROBBER
          </text>
        </g>
      )}
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