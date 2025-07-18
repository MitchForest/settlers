import React, { useState, useEffect } from 'react'

// Terrain assets for honeycomb background
const TERRAIN_ASSETS = [
  { name: 'forest', image: '/themes/settlers/assets/terrains/forest.png' },
  { name: 'pasture', image: '/themes/settlers/assets/terrains/pasture.png' },
  { name: 'wheat', image: '/themes/settlers/assets/terrains/wheat.png' },
  { name: 'brick', image: '/themes/settlers/assets/terrains/brick.png' },
  { name: 'ore', image: '/themes/settlers/assets/terrains/ore.png' },
  { name: 'desert', image: '/themes/settlers/assets/terrains/desert.png' },
  { name: 'sea', image: '/themes/settlers/assets/terrains/sea.png' },
]

interface HoneycombBackgroundProps {
  className?: string
  children?: React.ReactNode
}

export function HoneycombBackground({ className = '', children }: HoneycombBackgroundProps) {
  // Track if component has mounted to avoid hydration issues
  const [isMounted, setIsMounted] = useState(false)
  const [honeycombBackground, setHoneycombBackground] = useState<{
    id: string;
    x: number;
    y: number;
    terrain: typeof TERRAIN_ASSETS[0];
    animationDelay: number;
    animationDuration: number;
  }[]>([])

  useEffect(() => {
    // Generate honeycomb background after component mounts
    const hexes = []
    const hexRadius = 80
    const rows = 12
    const cols = 20
    
    // Simple seeded pseudo-random function for deterministic results
    const seededRandom = (seed: number) => {
      const x = Math.sin(seed) * 10000
      return x - Math.floor(x)
    }
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = col * (hexRadius * 1.5) - hexRadius
        const y = row * (hexRadius * Math.sqrt(3)) + (col % 2) * (hexRadius * Math.sqrt(3) / 2) - hexRadius
        
        const seed = row * cols + col
        const terrainIndex = Math.floor(seededRandom(seed) * TERRAIN_ASSETS.length)
        const terrain = TERRAIN_ASSETS[terrainIndex]
        
        const animationDelay = seededRandom(seed + 1000) * 5
        const animationDuration = 3 + seededRandom(seed + 2000) * 4
        
        hexes.push({
          id: `hex-${row}-${col}`,
          x,
          y,
          terrain,
          animationDelay,
          animationDuration,
        })
      }
    }
    
    setHoneycombBackground(hexes)
    setIsMounted(true)
  }, [])

  return (
    <div className={`min-h-screen relative overflow-hidden bg-gradient-to-br from-[#1a4b3a] via-[#2d5a47] to-[#1a4b3a] ${className}`}>
      {/* Client-side Honeycomb Background */}
      {isMounted && (
        <div className="absolute inset-0 overflow-hidden opacity-30">
          <svg className="w-full h-full" viewBox="0 0 1800 1200" preserveAspectRatio="xMidYMid slice">
            <defs>
              {TERRAIN_ASSETS.map(terrain => (
                <pattern key={terrain.name} id={`pattern-${terrain.name}`} patternUnits="objectBoundingBox" width="1" height="1">
                  <image href={terrain.image} x="0" y="0" width="160" height="160" preserveAspectRatio="xMidYMid slice"/>
                </pattern>
              ))}
            </defs>
            {honeycombBackground.map(hex => (
              <polygon
                key={hex.id}
                points="40,0 120,0 160,69 120,138 40,138 0,69"
                transform={`translate(${hex.x}, ${hex.y})`}
                fill={`url(#pattern-${hex.terrain.name})`}
                className="opacity-40 animate-pulse"
                style={{
                  animationDelay: `${hex.animationDelay}s`,
                  animationDuration: `${hex.animationDuration}s`
                }}
              />
            ))}
          </svg>
        </div>
      )}

      {/* Overlay gradient for better text contrast */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/40" />

      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
} 