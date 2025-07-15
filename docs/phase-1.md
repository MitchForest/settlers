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

## Animation & Performance Strategy

### CSS Transforms for Core Animations
**Rationale**: Maximum performance with GPU acceleration, no library overhead

#### Dice System (Pure CSS 3D)
```css
.dice {
  transform-style: preserve-3d;
  transform: rotateX(45deg) rotateY(45deg);
  transition: transform 1s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  will-change: transform;
}

@keyframes diceRoll {
  0% { transform: rotateX(0) rotateY(0); }
  100% { transform: rotateX(var(--final-x)) rotateY(var(--final-y)); }
}
```

#### Card System (CSS 3D Transforms)
```css
.card {
  transform-style: preserve-3d;
  transition: transform 0.6s cubic-bezier(0.4, 0.0, 0.2, 1);
}

.card.flipped {
  transform: rotateY(180deg);
}
```

### React Flow for Graph-Based Interactions
**Use Cases**: 
- Road connections between vertices
- Settlement/City placement on vertices
- Longest road calculation and visualization
- Port connections to settlements

### Framer Motion for Complex Gestures
**Use Cases**: 
- Robber drag gesture
- Trade card drag and drop
- Victory celebration sequences 

## Critical Implementation Path

### Immediate Fix: Backend Health Check (Day 0)

The postgres client is creating a stack overflow due to circular dependencies. Fix:

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

// Export tables for easier access
export const { games, players, gameEvents, trades, users, sessions } = schema

export type Database = typeof db
```

### Week 1: Foundation & Board Architecture (Days 1-5)

#### Day 1: Project Structure & React Flow Setup

1. **Install React Flow and dependencies**:
```bash
cd apps/frontend
bun add reactflow react-hexgrid
bun add -D @types/react-hexgrid
```

2. **Create game route structure**:
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

3. **Setup Zustand store with TypeScript**:
```typescript
// apps/frontend/stores/gameStore.ts
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { GameState, GameAction, PlayerId } from '@settlers/core'
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
  
  // Computed
  currentPlayer: () => Player | null
  isMyTurn: () => boolean
}

export const useGameStore = create<GameStore>()(
  immer((set, get) => ({
    // Implementation...
  }))
)
```

#### Day 2-3: Hybrid Board Implementation

1. **Master GameBoard Component**:
```typescript
// apps/frontend/components/game/board/GameBoard.tsx
'use client'

import { ReactFlowProvider } from 'reactflow'
import { HexGridLayer } from './layers/HexGridLayer'
import { ConnectionLayer } from './layers/ConnectionLayer'
import { InteractionLayer } from './layers/InteractionLayer'
import { useGameStore } from '@/stores/gameStore'
import { cn } from '@/lib/utils'

export function GameBoard() {
  const gameState = useGameStore(state => state.gameState)
  const placementMode = useGameStore(state => state.placementMode)
  
  if (!gameState) return null
  
  return (
    <div className={cn(
      "relative w-full h-full bg-gradient-to-br from-blue-950/20 to-emerald-950/20",
      "rounded-xl overflow-hidden",
      "border border-white/10"
    )}>
      {/* Base Layer: Hex Grid for terrain */}
      <div className="absolute inset-0 z-0">
        <HexGridLayer board={gameState.board} />
      </div>
      
      {/* Connection Layer: React Flow for roads and buildings */}
      <div className={cn(
        "absolute inset-0 z-10",
        placementMode === 'none' && "pointer-events-none"
      )}>
        <ReactFlowProvider>
          <ConnectionLayer gameState={gameState} />
        </ReactFlowProvider>
      </div>
      
      {/* Interaction Layer: Overlays, tooltips, highlights */}
      <div className="absolute inset-0 z-20 pointer-events-none">
        <InteractionLayer gameState={gameState} />
      </div>
      
      {/* Mini-map overlay */}
      <div className="absolute bottom-4 right-4 z-30">
        <MiniMap />
      </div>
    </div>
  )
}

3. **React Flow Connection Layer**:
```typescript
// apps/frontend/components/game/board/layers/ConnectionLayer.tsx
import ReactFlow, {
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  ConnectionMode,
  MarkerType,
  Position,
  Background,
  BackgroundVariant
} from 'reactflow'
import { GameState, Vertex, Edge as GameEdge } from '@settlers/core'
import { useGameStore } from '@/stores/gameStore'
import { BuildingNode, VertexNode } from '../nodes'
import { RoadEdge, PotentialRoadEdge } from '../edges'
import { vertexToPixel, PLAYER_COLORS } from '@/lib/board-utils'
import 'reactflow/dist/style.css'

interface ConnectionLayerProps {
  gameState: GameState
}

const nodeTypes = {
  building: BuildingNode,
  vertex: VertexNode,
}

const edgeTypes = {
  road: RoadEdge,
  potential: PotentialRoadEdge,
}

export function ConnectionLayer({ gameState }: ConnectionLayerProps) {
  const placementMode = useGameStore(state => state.placementMode)
  const validPlacements = useGameStore(state => state.validPlacements)
  const sendAction = useGameStore(state => state.sendAction)
  const setFlowInstance = useGameStore(state => state.setFlowInstance)
  
  // Convert game vertices to React Flow nodes
  const vertexNodes: Node[] = Array.from(gameState.board.vertices.entries()).map(([id, vertex]) => {
    const building = vertex.building
    const pixelPos = vertexToPixel(vertex.position)
    const isValid = validPlacements.settlements.has(id) || validPlacements.cities.has(id)
    
    return {
      id,
      type: building ? 'building' : 'vertex',
      position: pixelPos,
      data: {
        vertex,
        building,
        owner: building?.owner,
        isValid,
        canUpgrade: building?.type === 'settlement' && validPlacements.cities.has(id)
      },
      draggable: false,
      selectable: placementMode !== 'none' && isValid,
      style: {
        width: building?.type === 'city' ? 50 : 40,
        height: building?.type === 'city' ? 50 : 40,
      }
    }
  })
  
  // Convert game edges to React Flow edges
  const roadEdges: Edge[] = Array.from(gameState.board.edges.entries()).map(([id, edge]) => {
    const connection = edge.connection
    const isValid = validPlacements.roads.has(id)
    
    return {
      id,
      source: edge.vertices[0],
      target: edge.vertices[1],
      type: connection ? 'road' : 'potential',
      animated: isValid && placementMode === 'road',
      style: {
        stroke: connection ? PLAYER_COLORS[connection.owner] : 'transparent',
        strokeWidth: connection ? 8 : 4,
        opacity: connection ? 1 : (isValid ? 0.5 : 0),
      },
      data: {
        edge,
        connection,
        isValid,
        owner: connection?.owner
      },
      selectable: placementMode === 'road' && isValid,
      interactionWidth: 20,
    }
  })
  
  const [nodes, setNodes, onNodesChange] = useNodesState(vertexNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(roadEdges)
  
  // Handle node clicks (settlement/city placement)
  const handleNodeClick = (event: React.MouseEvent, node: Node) => {
    if (placementMode === 'settlement' && node.data.isValid) {
      sendAction({
        type: 'placeSettlement',
        playerId: useGameStore.getState().localPlayerId!,
        data: { vertexId: node.id }
      })
    } else if (placementMode === 'city' && node.data.canUpgrade) {
      sendAction({
        type: 'build',
        playerId: useGameStore.getState().localPlayerId!,
        data: { 
          buildingType: 'city',
          position: { type: 'vertex', id: node.id }
        }
      })
    }
  }
  
  // Handle edge clicks (road placement)
  const handleEdgeClick = (event: React.MouseEvent, edge: Edge) => {
    if (placementMode === 'road' && edge.data.isValid) {
      sendAction({
        type: 'placeConnection',
        playerId: useGameStore.getState().localPlayerId!,
        data: { edgeId: edge.id }
      })
    }
  }
  
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={handleNodeClick}
      onEdgeClick={handleEdgeClick}
      onInit={setFlowInstance}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      connectionMode={ConnectionMode.Loose}
      fitView
      fitViewOptions={{ padding: 0.1 }}
      proOptions={{ hideAttribution: true }}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={placementMode !== 'none'}
      panOnDrag={placementMode === 'none'}
      zoomOnScroll={true}
      minZoom={0.5}
      maxZoom={2}
    >
      <Background 
        variant={BackgroundVariant.Dots} 
        gap={30} 
        size={1} 
        color="#ffffff10"
      />
    </ReactFlow>
  )
}
```