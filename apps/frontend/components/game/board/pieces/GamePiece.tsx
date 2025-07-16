import React, { useState, useEffect } from 'react'
import { GamePieceProps } from '@/lib/theme-types'

// Hardcoded player colors for geometric fallbacks
function getHardcodedPlayerColor(playerId: string): string {
  const colors: Record<string, string> = {
    red: '#DC2626',
    blue: '#2563EB', 
    green: '#16A34A',
    yellow: '#EAB308',
    white: '#F3F4F6',
    orange: '#EA580C'
  }
  return colors[playerId] || '#666666'
}

interface RoadProps {
  color: string
  width: number
  length: number
  rotation: number
  asset?: string
  assetResolver: (path: string) => Promise<string | null>
  isDefault: boolean
}

interface SettlementProps {
  color: string
  level: 1 | 2  // 1 = settlement, 2 = city
  asset?: string
  assetResolver: (path: string) => Promise<string | null>
  isDefault: boolean
}

// Road component (rectangles for default, assets for custom themes)
const Road: React.FC<RoadProps> = ({ 
  color, 
  width, 
  length, 
  rotation, 
  asset, 
  assetResolver, 
  isDefault 
}) => {
  const [resolvedAsset, setResolvedAsset] = useState<string | null>(null)
  
  useEffect(() => {
    if (isDefault || !asset) {
      setResolvedAsset(null)
      return
    }
    
    const resolveAsset = async () => {
      const resolved = await assetResolver(asset)
      setResolvedAsset(resolved)
    }
    
    resolveAsset()
  }, [asset, assetResolver, isDefault])
  
  if (resolvedAsset && !isDefault) {
    // Use custom asset
    return (
      <g transform={`rotate(${rotation})`}>
        <image
          href={resolvedAsset}
          x={-length / 2}
          y={-width / 2}
          width={length}
          height={width}
          preserveAspectRatio="xMidYMid meet"
          onError={() => setResolvedAsset(null)}
        />
      </g>
    )
  }
  
  // Default geometric road
  return (
    <g transform={`rotate(${rotation})`}>
      <rect
        x={-length / 2}
        y={-width / 2}
        width={length}
        height={width}
        fill={color}
        stroke="#374151"
        strokeWidth={0.5}
        rx={1}
      />
    </g>
  )
}

// Settlement/City component (circles with text for default, assets for custom themes)
const Settlement: React.FC<SettlementProps> = ({ 
  color, 
  level, 
  asset, 
  assetResolver, 
  isDefault 
}) => {
  const [resolvedAsset, setResolvedAsset] = useState<string | null>(null)
  
  useEffect(() => {
    if (isDefault || !asset) {
      setResolvedAsset(null)
      return
    }
    
    const resolveAsset = async () => {
      const resolved = await assetResolver(asset)
      setResolvedAsset(resolved)
    }
    
    resolveAsset()
  }, [asset, assetResolver, isDefault])
  
  const size = level === 1 ? 12 : 16
  const labelText = level === 1 ? 'L1' : 'L2'
  
  if (resolvedAsset && !isDefault) {
    // Use custom asset
    return (
      <image
        href={resolvedAsset}
        x={-size}
        y={-size}
        width={size * 2}
        height={size * 2}
        preserveAspectRatio="xMidYMid meet"
        onError={() => setResolvedAsset(null)}
      />
    )
  }
  
  // Default geometric settlement/city
  return (
    <g>
      <circle
        cx={0}
        cy={0}
        r={size}
        fill={color}
        stroke="#374151"
        strokeWidth={1}
      />
      <text
        x={0}
        y={0}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={level === 1 ? 6 : 8}
        fontWeight="bold"
        fill="white"
        style={{ pointerEvents: 'none' }}
      >
        {labelText}
      </text>
    </g>
  )
}

export const GamePiece: React.FC<GamePieceProps> = ({
  type,
  playerId,
  position,
  theme,
  assetResolver,
  rotation = 0
}) => {
  const playerColor = theme?.players.colors.find(c => c.id === playerId)
  const color = playerColor?.primary || getHardcodedPlayerColor(playerId)
  const useGeometricFallbacks = !theme || !assetResolver
  
  return (
    <g transform={`translate(${position.x}, ${position.y})`}>
      {type === 'road' && (
        <Road
          color={color}
          width={theme?.structures.road.width || 4}
          length={24}
          rotation={rotation}
          asset={theme?.structures.road.asset}
          assetResolver={assetResolver || (async () => null)}
          isDefault={useGeometricFallbacks}
        />
      )}
      
      {type === 'settlement' && (
        <Settlement
          color={color}
          level={1}
          asset={theme?.structures.settlement.asset}
          assetResolver={assetResolver || (async () => null)}
          isDefault={useGeometricFallbacks}
        />
      )}
      
      {type === 'city' && (
        <Settlement
          color={color}
          level={2}
          asset={theme?.structures.city.asset}
          assetResolver={assetResolver || (async () => null)}
          isDefault={useGeometricFallbacks}
        />
      )}
    </g>
  )
} 