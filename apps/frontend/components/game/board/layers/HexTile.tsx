import React, { useState, useEffect } from 'react'
import { HexTileProps, ResourceTheme } from '@/lib/theme-types'
import { getAssetType } from '@/lib/theme-loader'

const HEX_RADIUS = 32
const HEX_SIZE = 64

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
  
  // Hardcoded fallback colors
  const fallbackColors: Record<string, string> = {
    'tile-type-1': '#2D5016', // Resource type 1 - dark green
    'tile-type-2': '#7CB342', // Resource type 2 - light green  
    'tile-type-3': '#FFC107', // Resource type 3 - yellow
    'tile-type-4': '#D84315', // Resource type 4 - red
    'tile-type-5': '#6A1B9A', // Resource type 5 - purple
    'tile-type-6': '#F4E4BC', // Non-producing tile - tan/sand
    // Legacy support for old names
    terrain1: '#2D5016',
    terrain2: '#7CB342', 
    terrain3: '#FFC107',
    terrain4: '#D84315',
    terrain5: '#6A1B9A',
    desert: '#F4E4BC'
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
  const [assetType, setAssetType] = useState<'png' | 'svg' | 'unknown'>('unknown')
  
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

  // Get glow color based on state
  const getGlowColor = () => {
    if (isEmptyTile && isHovered) return 'rgba(148, 163, 184, 0.6)' // Gray for empty hover
    if (isSelected) return '#10b981' // Emerald-500 for selected  
    if (isHovered) return 'var(--game-bg-secondary, #8b5cf6)' // Purple for hover
    return 'none'
  }

  // Get glow opacity
  const getGlowOpacity = () => {
    if (isEmptyTile && isHovered) return 0.4
    if (isSelected) return 0.8
    if (isHovered) return 0.6
    return 0
  }
  
  // Resolve asset on mount/terrain change (only when theme and asset resolver exist)
  useEffect(() => {
    const resolveAsset = async () => {
      if (useGeometricFallbacks || !resource || typeof resource === 'string' || !resource.hexAsset || !assetResolver) {
        setResolvedAsset(null)
        return
      }
      
      const resolved = await assetResolver(resource.hexAsset)
      setResolvedAsset(resolved)
      
      if (resolved) {
        const type = getAssetType(resource.hexAsset)
        setAssetType(type)
      }
    }
    
    resolveAsset()
  }, [terrain, useGeometricFallbacks, resource, assetResolver])
  
  const shouldUseAsset = resolvedAsset && !useGeometricFallbacks && resource && typeof resource !== 'string'
  const isImageAsset = assetType === 'png'
  
  return (
    <g 
      transform={`translate(${position.x}, ${position.y}) ${getScaleTransform()}`}
      className={`hex-tile ${isEmptyTile ? '' : 'cursor-pointer'} ${disableTransitions ? '' : 'transition-all duration-200 ease-out'}`}
      style={{ 
        filter: (isHovered || isSelected) && !isEmptyTile ? `drop-shadow(0 ${isSelected ? '6px 12px' : '4px 8px'} rgba(0,0,0,0.${isSelected ? '3' : '2'}))` : 'none'
      }}
    >
      {/* Asset Rendering (only for non-default themes) */}
      {shouldUseAsset ? (
        <>
          {/* Image Asset (PNG/JPG) */}
          {isImageAsset ? (
            <>
              <image
                href={resolvedAsset}
                x={-HEX_SIZE / 2}
                y={-HEX_SIZE / 2}
                width={HEX_SIZE}
                height={HEX_SIZE}
                preserveAspectRatio="xMidYMid meet"
                onError={() => {
                  // Fallback to color on image error
                  setResolvedAsset(null)
                }}
              />
              
              {/* Hex border for image */}
              <path
                d={hexPath}
                fill="none"
                stroke={isEmpty ? "#94a3b8" : "#374151"}
                strokeWidth={isEmpty ? 1 : 2}
                strokeDasharray="none"
              />
            </>
          ) : (
            /* SVG Asset */
            <g>
              {/* Background hex with fallback color */}
              <path
                d={hexPath}
                fill={fallbackColor}
                stroke={isEmpty ? "#94a3b8" : "#374151"}
                strokeWidth={isEmpty ? 1 : 2}
                strokeDasharray="none"
              />
              
              {/* SVG asset overlay */}
              <image
                href={resolvedAsset}
                x={-HEX_SIZE / 2}
                y={-HEX_SIZE / 2}
                width={HEX_SIZE}
                height={HEX_SIZE}
                preserveAspectRatio="xMidYMid meet"
                opacity={0.8}
                onError={() => {
                  setResolvedAsset(null)
                }}
              />
            </g>
          )}
        </>
      ) : (
        /* Default: Simple Colored Hex or Empty Board Slot */
        <path
          d={hexPath}
          fill={isEmptyTile ? (isHovered ? "rgba(148, 163, 184, 0.4)" : "rgba(255, 255, 255, 0.1)") : fallbackColor}
          stroke={isEmptyTile ? (isHovered ? "rgba(148, 163, 184, 0.8)" : "#94a3b8") : (isSelected ? "#10b981" : (isHovered ? "#8b5cf6" : "#374151"))}
          strokeWidth={isEmptyTile ? 1 : 2}
          strokeDasharray="none"
          opacity={1}
          style={{ pointerEvents: 'all' }}
        />
      )}
      
      {/* Resource Icon (only for geometric fallbacks or when no asset) */}
      {resource && typeof resource !== 'string' && resource.icon && (useGeometricFallbacks || !shouldUseAsset || isEmptyTile) && (
        <text
          x={0}
          y={5}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={16}
          style={{ pointerEvents: 'none' }}
        >
          {resource.icon}
        </text>
      )}
      

      
      {/* Number token - cohesive unit with proper colors */}
      {numberToken && !isEmptyTile && (
        <g className={`number-token ${disableTransitions ? '' : 'transition-all duration-200'}`}>
          {/* Token background - 5% off white */}
          <circle
            cx={0}
            cy={0}
            r={10}
            fill="rgba(255, 255, 255, 0.95)"
            stroke="rgba(0, 0, 0, 0.1)"
            strokeWidth={1}
          />
          
          {/* Number text - positioned in upper part of circle */}
          <text
            x={0}
            y={-1}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={8}
            fontWeight="bold"
            fill={numberToken === 6 || numberToken === 8 ? "#dc2626" : "rgba(0, 0, 0, 0.9)"}
          >
            {numberToken}
          </text>
          
          {/* Probability dots - inside circle at bottom */}
          {probabilityDots > 0 && (
            <g className="probability-dots">
              {Array.from({ length: probabilityDots }, (_, i) => {
                // Center the dots inside the circle bottom
                const dotSpacing = 1.8
                const totalWidth = (probabilityDots - 1) * dotSpacing
                const startX = -totalWidth / 2
                
                return (
                  <circle
                    key={i}
                    cx={startX + (i * dotSpacing)}
                    cy={6}
                    r={0.5}
                    fill={numberToken === 6 || numberToken === 8 ? "#dc2626" : "rgba(0, 0, 0, 0.9)"}
                  />
                )
              })}
            </g>
          )}
        </g>
      )}
      

    </g>
  )
}

// SVG filter definitions (should be defined once in parent SVG)
export const HexTileFilters: React.FC = () => (
  <defs>
    <filter id="hoverGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
      <feMerge> 
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    
    <filter id="selectedGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
      <feMerge> 
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
) 