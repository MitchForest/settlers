import React from 'react'
import { defineHex, Orientation } from 'honeycomb-grid'
import { HexTileProps, ResourceTheme } from '@/lib/theme-types'
import { HEX_RADIUS } from '@/lib/board-utils'

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

export function HexTile({
  terrain,
  numberToken,
  position,
  theme,
  isHovered = false,
  isSelected = false,
  isEmpty = false,
  disableTransitions: _disableTransitions = false,
  onHexHover,
  onHexClick,
  hexId
}: HexTileProps) {
  // Use theme resources or fallback to empty array
  const resources = theme?.resources || []
  const terrainColor = terrain ? getTerrainColor(terrain, resources) : '#F4E4BC'
  const terrainTexture = terrain ? getTerrainTexture(terrain, resources) : null
  const hexPath = getHexPath(HEX_RADIUS)
  
  // Generate unique pattern ID for this hex
  const patternId = terrainTexture ? `texture-${terrain}-${Math.random().toString(36).substr(2, 9)}` : null
  
  // All hexes are hoverable now (including sea) for consistent interaction
  const showHoverEffect = isHovered

  return (
    <g 
      transform={`translate(${position.x}, ${position.y})`}
      className="cursor-pointer"
      data-hex-id={hexId}
      onMouseEnter={() => onHexHover?.(hexId || null)}
      onMouseLeave={() => onHexHover?.(null)}
      onClick={() => onHexClick?.(hexId || null)}
      style={{ 
        pointerEvents: 'all',
      }}
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

      {/* Selection indicator */}
      {isSelected && (
        <path
          d={hexPath}
          fill="none"
          stroke="rgba(37, 99, 235, 0.7)"
          strokeWidth="2"
          className="pointer-events-none"
        />
      )}
      
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
            fontSize="12"
            fontWeight="bold"
            fill={theme?.ui?.numberTokenText || '#000000'}
          >
            {numberToken}
          </text>
          
          {/* Probability dots */}
          {Array.from({ length: getProbabilityDots(numberToken) }, (_, i) => (
            <circle
              key={i}
              cx={-8 + (i * 4)}
              cy="12"
              r="1.5"
              fill={theme?.ui?.numberTokenText || '#000000'}
            />
          ))}
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