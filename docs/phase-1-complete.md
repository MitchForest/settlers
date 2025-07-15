# Phase 1: Core Game Loop & Premium UI Implementation

## Overview

Phase 1 focuses on building a complete, playable Settlers/Catan-style game with a beautiful, modern UI that is completely theme-agnostic. This phase establishes the core game mechanics, state management, and visual components that can be easily themed later.

**Key Principles:**
- 🎮 **Complete Game Loop**: Full turn-based gameplay with all core mechanics
- 🎨 **Premium UI/UX**: Glass morphism, smooth animations, 60fps performance
- 🔌 **Theme Agnostic**: Generic terms and extensible architecture
- 🏗️ **Solid Foundation**: TypeScript, proper state management, real-time sync
- ⚡ **Performance First**: CSS transforms, GPU acceleration, minimal runtime overhead
- 🎯 **Zero Technical Debt**: Clean architecture, no shortcuts, production-ready code
- 🔥 **React Flow + Hex Grid**: Hybrid architecture for premium interactions

## Current Status

### ✅ Completed
- Turborepo monorepo setup with Bun
- Next.js 15 + React 19 frontend with TypeScript
- Bun + Hono backend infrastructure
- PostgreSQL with Drizzle ORM
- Basic theme system with Tailwind CSS 4
- shadcn/ui components integrated
- WebSocket dependencies installed
- Development environment configured
- **Core game types and interfaces** ✅
- **Game constants (costs, rules, layouts)** ✅
- **Board generator with hex placement** ✅
- **State validator for all game actions** ✅
- **Action processor with event sourcing** ✅
- **Game flow manager (create, join, process)** ✅
- **Database schema (games, players, events, trades)** ✅
- **WebSocket server with Bun native implementation** ✅
- **HTTP API routes for game management** ✅
- **Error boundary component for frontend** ✅
- **Core package builds and tests passing** ✅

### 🚧 To Build (Critical Path)
- Fix backend health check stack overflow issue
- **React Flow + react-hexgrid hybrid board implementation**
- Frontend game board with layered architecture
- Player UI components (dashboard, resources, actions)
- Dice roll animation system
- Trading interface with drag-and-drop
- Building placement UI with React Flow nodes
- Development card UI with 3D animations
- Victory detection and celebration
- Real-time state synchronization
- Beautiful animations and transitions
- Sound design system
- Mobile-first responsive design
- Tutorial/onboarding flow
- Game persistence & recovery

### ⚠️ Known Issues
- Backend health check endpoint has stack overflow (postgres client singleton needed)
- WebSocket upgrade handler needs testing
- Game state synchronization not yet connected to frontend
- Port 4000 conflict when restarting backend

## Architecture Overview

### Hybrid Board Architecture (React Flow + react-hexgrid)

```
┌─────────────────────────────────────────────────────────┐
│                    Game Board Layers                     │
├─────────────────────────────────────────────────────────┤
│  Layer 3: Interactions (Robber, Highlights, Tooltips)   │
├─────────────────────────────────────────────────────────┤
│  Layer 2: React Flow (Roads, Settlements, Cities)       │
├─────────────────────────────────────────────────────────┤
│  Layer 1: react-hexgrid (Terrain, Resources, Numbers)   │
└─────────────────────────────────────────────────────────┘
```

### System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                    │
├─────────────────────────────────────────────────────────┤
│  Game Board │ Player UI │ Trading │ Actions │ Victory   │
├─────────────────────────────────────────────────────────┤
│         Zustand Store │ WebSocket Client                 │
└─────────────────────────────────────────────────────────┘
                            │
                            │ WebSocket
                            │
┌─────────────────────────────────────────────────────────┐
│                    Backend (Hono)                        │
├─────────────────────────────────────────────────────────┤
│    Game Engine │ State Validator │ Event System         │
├─────────────────────────────────────────────────────────┤
│              PostgreSQL (Game State)                     │
└─────────────────────────────────────────────────────────┘
```

## Week 1: Foundation & Board Architecture (Days 1-5)

### Day 1: Fix Critical Issues & Project Setup

#### 1. Backend Health Check Fix
```typescript
// apps/backend/src/db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/settlers'

// Singleton pattern to prevent stack overflow
let client: postgres.Sql | null = null

export function getClient() {
  if (!client) {
    client = postgres(connectionString, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10
    })
  }
  return client
}

export const db = drizzle(getClient(), { schema })
export const { games, players, gameEvents, trades, users, sessions } = schema
export type Database = typeof db
```

#### 2. Install Dependencies
```bash
cd apps/frontend
bun add reactflow react-hexgrid zustand immer
bun add -D @types/react-hexgrid
```

#### 3. Create Game Route Structure
```
apps/frontend/
├── app/
│   ├── game/
│   │   ├── [gameId]/
│   │   │   ├── page.tsx
│   │   │   ├── loading.tsx
│   │   │   └── error.tsx
│   │   └── layout.tsx
│   └── lobby/
│       ├── page.tsx
│       └── create/
│           └── page.tsx
```

### Day 2-3: Hybrid Board Implementation

#### Master GameBoard Component
See detailed implementation in appendix.

#### HexGrid Layer
See detailed implementation in appendix.

#### React Flow Connection Layer
See detailed implementation in appendix.

### Day 4-5: State Management & WebSocket

#### Zustand Store Implementation
```typescript
// apps/frontend/stores/gameStore.ts
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { subscribeWithSelector } from 'zustand/middleware'
import { GameState, GameAction, PlayerId, Player } from '@settlers/core'
import type { ReactFlowInstance } from 'reactflow'

interface GameStore {
  // Core State
  gameState: GameState | null
  localPlayerId: PlayerId | null
  
  // React Flow State
  flowInstance: ReactFlowInstance | null
  setFlowInstance: (instance: ReactFlowInstance) => void
  
  // WebSocket
  ws: WebSocket | null
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error'
  
  // UI State
  placementMode: 'none' | 'settlement' | 'city' | 'road'
  hoveredHex: string | null
  selectedVertex: string | null
  selectedEdge: string | null
  validPlacements: {
    settlements: Set<string>
    roads: Set<string>
    cities: Set<string>
  }
  
  // Actions
  connect: (gameId: string, playerId: string) => Promise<void>
  disconnect: () => void
  sendAction: (action: GameAction) => void
  setPlacementMode: (mode: PlacementMode) => void
  updateGameState: (state: GameState) => void
  
  // Computed
  currentPlayer: () => Player | null
  isMyTurn: () => boolean
  myPlayer: () => Player | null
}

export const useGameStore = create<GameStore>()(
  subscribeWithSelector(
    immer((set, get) => ({
      // Initial state
      gameState: null,
      localPlayerId: null,
      flowInstance: null,
      ws: null,
      connectionStatus: 'disconnected',
      placementMode: 'none',
      hoveredHex: null,
      selectedVertex: null,
      selectedEdge: null,
      validPlacements: {
        settlements: new Set(),
        roads: new Set(),
        cities: new Set()
      },
      
      // Actions
      setFlowInstance: (instance) => set({ flowInstance: instance }),
      
      connect: async (gameId, playerId) => {
        const ws = new WebSocket(`ws://localhost:4000/ws?gameId=${gameId}&playerId=${playerId}`)
        
        ws.onopen = () => {
          set({ connectionStatus: 'connected', ws })
        }
        
        ws.onmessage = (event) => {
          const data = JSON.parse(event.data)
          if (data.type === 'gameState') {
            get().updateGameState(data.state)
          }
        }
        
        ws.onerror = () => {
          set({ connectionStatus: 'error' })
        }
        
        ws.onclose = () => {
          set({ connectionStatus: 'disconnected', ws: null })
        }
        
        set({ ws, connectionStatus: 'connecting', localPlayerId: playerId })
      },
      
      disconnect: () => {
        const ws = get().ws
        if (ws) {
          ws.close()
          set({ ws: null, connectionStatus: 'disconnected' })
        }
      },
      
      sendAction: (action) => {
        const ws = get().ws
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'action', action }))
        }
      },
      
      setPlacementMode: (mode) => set({ placementMode: mode }),
      
      updateGameState: (state) => {
        set({ gameState: state })
        // Update valid placements based on new state
        // This would call validation functions from core
      },
      
      // Computed
      currentPlayer: () => {
        const state = get().gameState
        if (!state) return null
        return state.players.get(state.playerOrder[state.currentPlayerIndex]) || null
      },
      
      isMyTurn: () => {
        const state = get().gameState
        const localId = get().localPlayerId
        if (!state || !localId) return false
        return state.playerOrder[state.currentPlayerIndex] === localId
      },
      
      myPlayer: () => {
        const state = get().gameState
        const localId = get().localPlayerId
        if (!state || !localId) return null
        return state.players.get(localId) || null
      }
    }))
  )
)
```

## Week 2: Core Game UI (Days 6-10)

### Day 6-7: Player Dashboard

#### PlayerDashboard Component
```typescript
// apps/frontend/components/game/PlayerDashboard.tsx
import { motion } from 'framer-motion'
import { useGameStore } from '@/stores/gameStore'
import { ResourceDisplay } from './ResourceDisplay'
import { DevelopmentCards } from './DevelopmentCards'
import { BuildingCosts } from './BuildingCosts'
import { ActionButtons } from './ActionButtons'
import { cn } from '@/lib/utils'

export function PlayerDashboard() {
  const myPlayer = useGameStore(state => state.myPlayer())
  const isMyTurn = useGameStore(state => state.isMyTurn())
  const phase = useGameStore(state => state.gameState?.phase)
  
  if (!myPlayer) return null
  
  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={cn(
        "fixed bottom-0 left-0 right-0",
        "bg-gradient-to-t from-background/95 to-background/80",
        "backdrop-blur-xl border-t border-white/10",
        "p-6 shadow-2xl"
      )}
    >
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-12 gap-6">
          {/* Resources Section */}
          <div className="col-span-5">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Resources</h3>
            <ResourceDisplay resources={myPlayer.resources} />
          </div>
          
          {/* Development Cards */}
          <div className="col-span-3">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Development Cards</h3>
            <DevelopmentCards cards={myPlayer.developmentCards} />
          </div>
          
          {/* Actions */}
          <div className="col-span-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Actions</h3>
            <ActionButtons 
              isMyTurn={isMyTurn}
              phase={phase}
              resources={myPlayer.resources}
            />
          </div>
        </div>
        
        {/* Building Costs Reference */}
        <BuildingCosts className="mt-4" />
      </div>
    </motion.div>
  )
}
```

### Day 8: Dice System

#### DiceRoll Component
```typescript
// apps/frontend/components/game/DiceRoll.tsx
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface DiceRollProps {
  value: [number, number] | null
  isRolling: boolean
  onRollComplete?: () => void
}

export function DiceRoll({ value, isRolling, onRollComplete }: DiceRollProps) {
  const [displayValues, setDisplayValues] = useState<[number, number]>([1, 1])
  
  useEffect(() => {
    if (isRolling) {
      // Simulate dice rolling
      const interval = setInterval(() => {
        setDisplayValues([
          Math.floor(Math.random() * 6) + 1,
          Math.floor(Math.random() * 6) + 1
        ])
      }, 100)
      
      // Stop rolling after animation
      setTimeout(() => {
        clearInterval(interval)
        if (value) {
          setDisplayValues(value)
          onRollComplete?.()
        }
      }, 1500)
      
      return () => clearInterval(interval)
    }
  }, [isRolling, value, onRollComplete])
  
  return (
    <AnimatePresence>
      {(isRolling || value) && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50"
        >
          <div className="flex gap-4">
            {displayValues.map((die, index) => (
              <motion.div
                key={index}
                animate={{
                  rotateX: isRolling ? [0, 360] : 0,
                  rotateY: isRolling ? [0, 360] : 0,
                }}
                transition={{
                  duration: 1.5,
                  repeat: isRolling ? Infinity : 0,
                  ease: "linear"
                }}
                className={cn(
                  "w-20 h-20 bg-white rounded-lg shadow-2xl",
                  "flex items-center justify-center",
                  "text-3xl font-bold",
                  "transform-gpu preserve-3d"
                )}
                style={{
                  transformStyle: "preserve-3d",
                }}
              >
                {die}
              </motion.div>
            ))}
          </div>
          
          {/* Sum display */}
          {!isRolling && value && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-center mt-4 text-2xl font-bold"
            >
              Total: {value[0] + value[1]}
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

### Day 9-10: Trading Interface

#### TradePanel Component
```typescript
// apps/frontend/components/game/trading/TradePanel.tsx
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '@/stores/gameStore'
import { ResourceCards } from '@settlers/core'
import { cn } from '@/lib/utils'

export function TradePanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [offering, setOffering] = useState<ResourceCards>(createEmptyResources())
  const [requesting, setRequesting] = useState<ResourceCards>(createEmptyResources())
  const myResources = useGameStore(state => state.myPlayer()?.resources)
  
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 20 }}
            className={cn(
              "fixed right-0 top-0 bottom-0 w-96",
              "bg-background/95 backdrop-blur-xl",
              "border-l border-white/10",
              "shadow-2xl z-50 p-6"
            )}
          >
            <h2 className="text-2xl font-bold mb-6">Trade</h2>
            
            {/* Trade interface implementation */}
            {/* ... */}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
```

## Week 3: Game Mechanics & Polish (Days 11-15)

### Day 11-12: Building Placement & Development Cards
- Building placement with React Flow integration
- Development card purchase and play animations
- Special card effects (Knight, Road Building, etc.)

### Day 13: Special Mechanics
- Robber movement with Framer Motion drag
- Port trading interface
- Longest road calculation and visualization

### Day 14-15: Victory & Polish
- Victory detection and celebration sequence
- Sound system implementation
- Performance optimization

## Week 4: Integration & Quality (Days 16-20)

### Day 16-17: Full Integration Testing
- End-to-end game flow
- Multiplayer synchronization
- Cross-browser testing

### Day 18-19: Polish & Optimization
- Loading states
- Error recovery
- Tutorial system

### Day 20: Performance & Deployment
- Bundle optimization
- Lighthouse audit
- Production deployment

## Technical Standards

### Code Quality
- TypeScript strict mode
- No any types
- Component size < 200 lines
- 100% type coverage

### Performance Targets
- 60fps animations
- < 100ms interactions
- < 200KB initial JS
- Lighthouse score > 90

### Architecture Principles
1. **No Technical Debt**: Clean as we code
2. **Component Isolation**: Self-contained components
3. **State Immutability**: Immer for all mutations
4. **Error Recovery**: Every action has error handling
5. **Performance First**: Profile before optimizing

## Appendix: Detailed Implementations

### HexGrid Layer Implementation

```typescript
// apps/frontend/components/game/board/layers/HexGridLayer.tsx
import { HexGrid, Layout, Hexagon, Text, Pattern } from 'react-hexgrid'
import { motion, AnimatePresence } from 'framer-motion'
import { Board, Hex } from '@settlers/core'
import { cn } from '@/lib/utils'
import { useGameStore } from '@/stores/gameStore'

interface HexGridLayerProps {
  board: Board
}

// Terrain colors matching the theme-agnostic approach
const TERRAIN_COLORS = {
  terrain1: '#2d5016', // Forest
  terrain2: '#8fbc8f', // Pasture  
  terrain3: '#daa520', // Fields
  terrain4: '#cd853f', // Hills
  terrain5: '#696969', // Mountains
  desert: '#f4a460'    // Desert
}

export function HexGridLayer({ board }: HexGridLayerProps) {
  const hoveredHex = useGameStore(state => state.hoveredHex)
  const productionAnimation = useGameStore(state => state.productionAnimation)
  
  // Convert board coordinates to pixel positions
  const hexToPixel = (q: number, r: number, size: number = 60) => {
    const x = size * (3/2 * q)
    const y = size * (Math.sqrt(3)/2 * q + Math.sqrt(3) * r)
    return { x, y }
  }
  
  return (
    <HexGrid width="100%" height="100%" viewBox="-300 -300 600 600">
      <defs>
        {/* Glass morphism filter */}
        <filter id="glass">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" />
          <feColorMatrix
            type="matrix"
            values="1 0 0 0 0
                    0 1 0 0 0
                    0 0 1 0 0
                    0 0 0 0.3 0"
          />
        </filter>
        
        {/* Glow effect for hover */}
        <filter id="glow">
          <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        
        {/* Terrain patterns */}
        {Object.entries(TERRAIN_COLORS).map(([terrain, color]) => (
          <Pattern key={terrain} id={terrain} size={{ x: 10, y: 10 }}>
            <rect width="10" height="10" fill={color} opacity="0.8" />
            <circle cx="5" cy="5" r="2" fill={color} opacity="0.4" />
          </Pattern>
        ))}
      </defs>
      
      <Layout size={{ x: 60, y: 60 }} flat={true} spacing={1.05}>
        <AnimatePresence>
          {Array.from(board.hexes.values()).map((hex) => {
            const isHovered = hoveredHex === hex.id
            const isProducing = productionAnimation?.has(hex.id)
            
            return (
              <motion.g
                key={hex.id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ 
                  scale: isHovered ? 1.05 : 1,
                  opacity: 1 
                }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ 
                  duration: 0.3,
                  type: "spring",
                  stiffness: 260,
                  damping: 20
                }}
              >
                <Hexagon
                  q={hex.position.q}
                  r={hex.position.r}
                  s={hex.position.s}
                  fill={`url(#${hex.terrain})`}
                  stroke={isHovered ? "#fff" : "#00000030"}
                  strokeWidth={isHovered ? 2 : 1}
                  filter={isHovered ? "url(#glow)" : "url(#glass)"}
                  className={cn(
                    "cursor-pointer transition-all duration-200",
                    isProducing && "animate-pulse"
                  )}
                  onMouseEnter={() => useGameStore.setState({ hoveredHex: hex.id })}
                  onMouseLeave={() => useGameStore.setState({ hoveredHex: null })}
                />
                
                {/* Resource icon */}
                <image
                  href={`/assets/resources/${hex.terrain}.svg`}
                  x={-20}
                  y={-20}
                  width={40}
                  height={40}
                  opacity={0.9}
                  pointerEvents="none"
                />
                
                {/* Number token */}
                {hex.number && (
                  <g className="number-token">
                    <circle
                      r={18}
                      fill="white"
                      stroke="#000"
                      strokeWidth={2}
                      filter="url(#glass)"
                    />
                    <Text
                      className={cn(
                        "text-lg font-bold select-none",
                        (hex.number === 6 || hex.number === 8) && "fill-red-600"
                      )}
                    >
                      {hex.number}
                    </Text>
                  </g>
                )}
                
                {/* Robber overlay */}
                {hex.hasBlocker && (
                  <g className="robber-overlay">
                    <circle
                      r={25}
                      fill="black"
                      opacity={0.7}
                      className="animate-pulse"
                    />
                    <image
                      href="/assets/icons/robber.svg"
                      x={-15}
                      y={-15}
                      width={30}
                      height={30}
                    />
                  </g>
                )}
                
                {/* Production animation particles */}
                {isProducing && (
                  <ProductionParticles hexId={hex.id} resource={hex.terrain} />
                )}
              </motion.g>
            )
          })}
        </AnimatePresence>
      </Layout>
    </HexGrid>
  )
}
```

### Custom React Flow Node Components

```typescript
// apps/frontend/components/game/board/nodes/BuildingNode.tsx
import { Handle, Position, NodeProps } from 'reactflow'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { PLAYER_COLORS } from '@/lib/board-utils'

export function BuildingNode({ data, selected }: NodeProps) {
  const { building, owner } = data
  const playerColor = owner !== undefined ? PLAYER_COLORS[owner] : '#666'
  
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      className={cn(
        "building-node relative",
        "rounded-full",
        "border-2",
        "shadow-lg",
        "cursor-pointer",
        "backdrop-blur-sm",
        "bg-white/10",
        "flex items-center justify-center",
        selected && "ring-4 ring-white/50"
      )}
      style={{
        borderColor: playerColor,
        boxShadow: `0 0 20px ${playerColor}40, 0 4px 12px rgba(0,0,0,0.3)`,
        width: '100%',
        height: '100%',
      }}
    >
      {/* Glass morphism overlay */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/20 to-white/5" />
      
      {/* Building icon */}
      <div className="relative z-10">
        {building?.type === 'settlement' ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill={playerColor}>
            <path d="M12 3L2 12h3v8h14v-8h3L12 3z" />
          </svg>
        ) : (
          <svg width="28" height="28" viewBox="0 0 24 24" fill={playerColor}>
            <path d="M12 2L2 12h3v8h14v-8h3L12 2zM7 18v-5h2v5H7zm4 0v-5h2v5h-2zm4 0v-5h2v5h-2z" />
          </svg>
        )}
      </div>
      
      {/* Connection handles - invisible but functional */}
      <Handle type="source" position={Position.Top} className="opacity-0" />
      <Handle type="source" position={Position.Right} className="opacity-0" />
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
      <Handle type="source" position={Position.Left} className="opacity-0" />
    </motion.div>
  )
}

// apps/frontend/components/game/board/nodes/VertexNode.tsx
export function VertexNode({ data, selected }: NodeProps) {
  const { isValid } = data
  
  if (!isValid) return null
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ 
        opacity: 1,
        scale: [1, 1.2, 1]
      }}
      transition={{
        scale: {
          repeat: Infinity,
          duration: 2,
          ease: "easeInOut"
        }
      }}
      className={cn(
        "vertex-node",
        "rounded-full",
        "border-2 border-dashed",
        "border-green-500",
        "bg-green-500/20",
        "cursor-pointer",
        "hover:bg-green-500/30",
        "hover:border-solid",
        selected && "ring-4 ring-green-500/50"
      )}
      style={{
        width: '100%',
        height: '100%',
      }}
    >
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-2 h-2 bg-green-500 rounded-full" />
      </div>
      
      {/* Connection handles - invisible */}
      <Handle type="source" position={Position.Top} className="opacity-0" />
      <Handle type="source" position={Position.Right} className="opacity-0" />
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
      <Handle type="source" position={Position.Left} className="opacity-0" />
    </motion.div>
  )
}
```

### Custom React Flow Edge Components

```typescript
// apps/frontend/components/game/board/edges/RoadEdge.tsx
import { EdgeProps, getBezierPath } from 'reactflow'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export function RoadEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  selected
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  return (
    <g className="road-edge-group">
      {/* Shadow/glow layer */}
      <path
        style={{
          ...style,
          strokeWidth: 16,
          stroke: `${style.stroke}40`,
          filter: 'blur(8px)',
        }}
        className="react-flow__edge-path"
        d={edgePath}
      />
      
      {/* Main road */}
      <motion.path
        id={id}
        style={style}
        className={cn(
          "react-flow__edge-path",
          "cursor-pointer",
          "transition-all duration-200",
          selected && "animate-pulse"
        )}
        d={edgePath}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ 
          pathLength: { duration: 0.5, ease: "easeInOut" },
          opacity: { duration: 0.3 }
        }}
      />
      
      {/* Hover effect */}
      <path
        style={{
          ...style,
          strokeWidth: 20,
          stroke: 'transparent',
          fill: 'none',
        }}
        className="react-flow__edge-interaction"
        d={edgePath}
      />
    </g>
  )
}

// apps/frontend/components/game/board/edges/PotentialRoadEdge.tsx
export function PotentialRoadEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  if (!data.isValid) return null

  return (
    <g className="potential-road-group">
      <motion.path
        style={{
          strokeDasharray: 5,
          stroke: '#10b981',
          strokeWidth: 6,
          fill: 'none',
          opacity: 0.6
        }}
        className="react-flow__edge-path cursor-pointer hover:opacity-100"
        d={edgePath}
        animate={{
          strokeDashoffset: [0, -10],
        }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: "linear"
        }}
      />
      
      {/* Interaction area */}
      <path
        style={{
          strokeWidth: 20,
          stroke: 'transparent',
          fill: 'none',
        }}
        className="react-flow__edge-interaction"
        d={edgePath}
      />
    </g>
  )
}
```

### Coordinate System Utilities

```typescript
// apps/frontend/lib/board-utils.ts
import { VertexPosition, HexCoordinate } from '@settlers/core'

// Player colors for the game
export const PLAYER_COLORS = {
  0: '#FF453A', // Red
  1: '#32ADE6', // Blue
  2: '#30D158', // Green
  3: '#FFD60A', // Yellow
}

// Convert hex coordinates to pixel positions
export function hexToPixel(q: number, r: number, size: number = 60): { x: number, y: number } {
  const x = size * (3/2 * q)
  const y = size * (Math.sqrt(3)/2 * q + Math.sqrt(3) * r)
  return { x, y }
}

// Convert vertex positions to pixel coordinates
export function vertexToPixel(vertex: VertexPosition): { x: number, y: number } {
  // Vertex positions are defined by adjacent hexes
  const hexPositions = vertex.hexes.map(hex => hexToPixel(hex.q, hex.r))
  
  // Calculate centroid of adjacent hex centers
  const x = hexPositions.reduce((sum, pos) => sum + pos.x, 0) / hexPositions.length
  const y = hexPositions.reduce((sum, pos) => sum + pos.y, 0) / hexPositions.length
  
  return { x, y }
}

// Generate vertex ID from position
export function vertexId(vertex: VertexPosition): string {
  return vertex.hexes
    .map(h => `${h.q},${h.r}`)
    .sort()
    .join('|')
}

// Generate edge ID from vertices
export function edgeId(v1: string, v2: string): string {
  return [v1, v2].sort().join('-')
}
```

## Success Criteria

1. **Complete Game**: Fully playable from start to finish
2. **Multiplayer**: Real-time sync for 3-4 players
3. **Mobile Ready**: Touch-friendly and responsive
4. **Stable**: No game-breaking bugs
5. **Fast**: Smooth 60fps gameplay
6. **Beautiful**: Premium glass morphism UI

This document serves as the canonical reference for Phase 1 implementation.
