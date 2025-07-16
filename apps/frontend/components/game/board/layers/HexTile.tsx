import React, { useState, useEffect } from 'react'
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

// Get terrain color (fallback)
function getTerrainColor(terrain: string, resources: ResourceTheme[]): string {
  const resource = resources.find((r: ResourceTheme) => r.id === terrain)
  if (resource?.color) return resource.color
  
  // Universal fallback colors for universal terrain types
  const fallbackColors: Record<string, string> = {
    'terrain-1': '#2D5016', // Most plentiful terrain - dark green
    'terrain-2': '#7CB342', // Second most plentiful - light green  
    'terrain-3': '#FFC107', // Third most plentiful - yellow
    'terrain-4': '#D84315', // Fourth most plentiful - red/orange
    'terrain-5': '#6A1B9A', // Least plentiful - purple
    'terrain-6': '#F4E4BC'  // Non-producing terrain - tan/sand
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
  assetResolver,
  isHovered = false,
  isSelected = false,
  isEmpty = false,
  disableTransitions = false
}) => {
  const [resolvedAsset, setResolvedAsset] = useState<string | null>(null)
  
  // Handle empty/null terrain
  const isEmptyTile = terrain === null || terrain === undefined || isEmpty
  const resource = terrain && theme?.resources.find(r => r.id === terrain)
  const hexPath = getHexPath(0, 0, HEX_RADIUS) // Centered at origin

  const fallbackColor = terrain ? getTerrainColor(terrain, theme?.resources || []) : '#F4E4BC' // Sand color for unassigned
  const probabilityDots = numberToken ? getProbabilityDots(numberToken) : 0
  
  const useGeometricFallbacks = !theme || !assetResolver

  // Calculate scale transform for hover/selected states
  const getScaleTransform = () => {
    if (isSelected) return 'scale(1.08)'
    if (isHovered && !isEmptyTile) return 'scale(1.04)'
    return 'scale(1)'
  }

  // Resolve asset on mount/terrain change (only when theme and asset resolver exist)
  useEffect(() => {
    const resolveAsset = async () => {
      if (useGeometricFallbacks || !resource || typeof resource === 'string' || !resource.hexAsset || !assetResolver) {
        setResolvedAsset(null)
        return
      }
      
      const resolved = await assetResolver(resource.hexAsset)
      
      if (resolved) {
        setResolvedAsset(resolved)
      } else {
        console.warn(`Failed to resolve asset for terrain ${terrain}: ${resource.hexAsset}`)
        setResolvedAsset(null)
      }
    }
    
    resolveAsset()
  }, [terrain, theme, assetResolver, resource, useGeometricFallbacks])

  const getOpacity = () => {
    if (isEmptyTile) return 0.3
    if (isSelected) return 1
    if (isHovered) return 0.9
    return 0.8
  }

  const getFillColor = () => {
    // Use resolved asset if available, otherwise fallback color
    if (resolvedAsset) {
      return 'url(#hexPattern)'
    }
    return fallbackColor
  }

  return (
    <g transform={`translate(${position.x}, ${position.y})`}>
      {/* Define pattern for this hex if we have an asset */}
      {resolvedAsset && (
        <defs>
          <pattern
            id="hexPattern"
            x="0" y="0" width="100%" height="100%"
            patternUnits="objectBoundingBox"
            viewBox="0 0 100 100"
            preserveAspectRatio="xMidYMid slice"
          >
            <image
              href={resolvedAsset}
              x="0" y="0" width="100" height="100"
              preserveAspectRatio="xMidYMid slice"
              onError={() => {
                console.warn(`Image failed to load: ${resolvedAsset}`)
                setResolvedAsset(null)
              }}
            />
          </pattern>
        </defs>
      )}

      {/* Main hex shape */}
      <g
        className={!disableTransitions ? "transition-all duration-200 ease-in-out" : ""}
        style={{
          transform: getScaleTransform(),
          transformOrigin: 'center'
        }}
      >
        {/* Hex background */}
        <path
          d={hexPath}
          fill={getFillColor()}
          stroke={isSelected ? "#FFD700" : isHovered && !isEmptyTile ? "#FFFFFF" : "#333333"}
          strokeWidth={isSelected ? 3 : isHovered && !isEmptyTile ? 2 : 1}
          opacity={getOpacity()}
          className={!disableTransitions ? "transition-all duration-200" : ""}
        />

        {/* Inner shadow/highlight for depth */}
        {!isEmptyTile && (
          <path
            d={hexPath}
            fill="none"
            stroke="rgba(255, 255, 255, 0.3)"
            strokeWidth="1"
            opacity={0.6}
            style={{
              transform: 'translate(-1px, -1px)'
            }}
          />
        )}

        {/* Number token */}
        {numberToken && !isEmptyTile && (
          <g className="number-token">
            {/* Token background circle */}
            <circle
              r="18"
              fill="#F5E6D3"
              stroke="#8B4513"
              strokeWidth="2"
              opacity="0.95"
            />
            
            {/* Number text */}
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="14"
              fontWeight="bold"
              fill={[6, 8].includes(numberToken) ? "#DC2626" : "#1F2937"}
            >
              {numberToken}
            </text>
            
            {/* Probability dots */}
            {probabilityDots > 0 && (
              <g transform="translate(0, 12)">
                {Array.from({ length: probabilityDots }).map((_, i) => (
                  <circle
                    key={i}
                    cx={(i - (probabilityDots - 1) / 2) * 3}
                    cy="0"
                    r="1.5"
                    fill={[6, 8].includes(numberToken) ? "#DC2626" : "#1F2937"}
                  />
                ))}
              </g>
            )}
          </g>
        )}

        {/* Empty tile indicator */}
        {isEmptyTile && (
          <g opacity="0.4">
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="12"
              fill="#6B7280"
              className="select-none"
            >
              Empty
            </text>
          </g>
        )}

        {/* Hover overlay */}
        {isHovered && !isEmptyTile && (
          <path
            d={hexPath}
            fill="rgba(255, 255, 255, 0.1)"
            className="pointer-events-none"
          />
        )}

        {/* Selection overlay */}
        {isSelected && (
          <path
            d={hexPath}
            fill="rgba(255, 215, 0, 0.2)"
            className="pointer-events-none"
          />
        )}
      </g>
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