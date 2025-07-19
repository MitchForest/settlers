# Catan AI Phase 4: MCTS Implementation for Bun/Hono/WebSocket Architecture

## Overview
This document provides a complete MCTS (Monte Carlo Tree Search) implementation specifically designed for a Catan AI running in a Bun/Hono/WebSocket environment. The implementation leverages Bun Workers for performance and integrates seamlessly with the game state (Phase 1) and heuristic evaluation (Phase 2).

## Architecture Overview

```
┌─────────────────┐     WebSocket      ┌──────────────────┐
│   Next.js App   │◄──────────────────►│   Hono Server    │
└─────────────────┘                     └──────────────────┘
                                                │
                                                │ Game State
                                                ▼
                                        ┌──────────────────┐
                                        │   Game Engine    │
                                        └──────────────────┘
                                                │
                                                │ AI Turn
                                                ▼
                                        ┌──────────────────┐
                                        │   Bun Worker     │
                                        │   (MCTS AI)      │
                                        └──────────────────┘
```

## 1. MCTS Core Components

### 1.1 Node Structure
```typescript
interface MCTSNode {
  // State representation
  state: GameState;
  move: Move | null; // Move that led to this state
  
  // Tree structure
  parent: MCTSNode | null;
  children: Map<string, MCTSNode>; // Keyed by move hash
  untriedMoves: Move[]; // Moves not yet explored
  
  // Statistics
  visits: number;
  wins: number; // From AI perspective
  draws: number;
  
  // Optimizations
  isTerminal: boolean;
  isFullyExpanded: boolean;
  
  // Virtual wins for move ordering (from Phase 2 research)
  virtualWins: number;
  virtualVisits: number;
}

class MCTSNode {
  constructor(
    state: GameState,
    move: Move | null = null,
    parent: MCTSNode | null = null
  ) {
    this.state = state;
    this.move = move;
    this.parent = parent;
    this.children = new Map();
    this.visits = 0;
    this.wins = 0;
    this.draws = 0;
    
    // Initialize virtual wins based on move type
    this.virtualWins = this.getVirtualWins(move);
    this.virtualVisits = this.virtualWins;
    
    // Get all legal moves for expansion
    this.untriedMoves = this.getLegalMoves(state);
    this.isFullyExpanded = this.untriedMoves.length === 0;
    this.isTerminal = this.checkTerminal(state);
  }
  
  private getVirtualWins(move: Move | null): number {
    if (!move) return 0;
    
    // Based on Phase 2 research findings
    switch (move.type) {
      case 'buildSettlement': return 20;
      case 'buildCity': return 10;
      case 'buyDevelopmentCard': return 5;
      case 'buildRoad': return 2;
      default: return 0;
    }
  }
  
  getUCTValue(explorationConstant: number = 1.41): number {
    if (this.visits === 0) return Infinity;
    
    const totalVisits = this.visits + this.virtualVisits;
    const totalWins = this.wins + this.virtualWins;
    
    const exploitation = totalWins / totalVisits;
    const exploration = explorationConstant * 
      Math.sqrt(Math.log(this.parent!.visits) / totalVisits);
    
    return exploitation + exploration;
  }
}
```

### 1.2 MCTS Configuration
```typescript
interface MCTSConfig {
  // Core parameters
  iterations: number;
  explorationConstant: number;
  maxSimulationDepth: number;
  timeLimit: number; // milliseconds
  
  // Catan-specific
  useHeuristicEvaluation: boolean;
  useMoveOrdering: boolean;
  useEarlyTermination: boolean;
  
  // Performance
  useTranspositionTable: boolean;
  maxTreeSize: number;
}

const DIFFICULTY_CONFIGS: Record<'easy' | 'medium' | 'hard', MCTSConfig> = {
  easy: {
    iterations: 100,
    explorationConstant: 1.41,
    maxSimulationDepth: 20,
    timeLimit: 1000,
    useHeuristicEvaluation: false,
    useMoveOrdering: false,
    useEarlyTermination: true,
    useTranspositionTable: false,
    maxTreeSize: 10000
  },
  medium: {
    iterations: 1000,
    explorationConstant: 1.41,
    maxSimulationDepth: 40,
    timeLimit: 3000,
    useHeuristicEvaluation: true,
    useMoveOrdering: true,
    useEarlyTermination: true,
    useTranspositionTable: true,
    maxTreeSize: 50000
  },
  hard: {
    iterations: 5000,
    explorationConstant: 1.2, // Less exploration, more exploitation
    maxSimulationDepth: 60,
    timeLimit: 5000,
    useHeuristicEvaluation: true,
    useMoveOrdering: true,
    useEarlyTermination: false,
    useTranspositionTable: true,
    maxTreeSize: 100000
  }
};
```

## 2. MCTS Algorithm Implementation

### 2.1 Main MCTS Class
```typescript
class CatanMCTS {
  private config: MCTSConfig;
  private aiPlayerId: string;
  private moveGenerator: LegalMoveGenerator;
  private stateTransition: StateTransition;
  private evaluator: HeuristicEvaluator;
  private transpositionTable: Map<string, MCTSNode>;
  
  constructor(
    config: MCTSConfig,
    aiPlayerId: string,
    moveGenerator: LegalMoveGenerator,
    stateTransition: StateTransition,
    evaluator: HeuristicEvaluator
  ) {
    this.config = config;
    this.aiPlayerId = aiPlayerId;
    this.moveGenerator = moveGenerator;
    this.stateTransition = stateTransition;
    this.evaluator = evaluator;
    this.transpositionTable = new Map();
  }
  
  findBestMove(rootState: GameState): Move {
    const startTime = Date.now();
    const root = new MCTSNode(rootState);
    
    let iterations = 0;
    while (
      iterations < this.config.iterations &&
      Date.now() - startTime < this.config.timeLimit
    ) {
      // 1. Selection
      const leaf = this.select(root);
      
      // 2. Expansion
      const child = this.expand(leaf);
      
      // 3. Simulation
      const result = this.simulate(child);
      
      // 4. Backpropagation
      this.backpropagate(child, result);
      
      iterations++;
      
      // Memory management
      if (iterations % 100 === 0) {
        this.pruneTree(root);
      }
    }
    
    // Select best move based on visit count (not win rate)
    return this.selectFinalMove(root);
  }
}
```

### 2.2 Selection Phase
```typescript
private select(node: MCTSNode): MCTSNode {
  while (!node.isTerminal && node.isFullyExpanded) {
    node = this.selectBestChild(node);
  }
  return node;
}

private selectBestChild(node: MCTSNode): MCTSNode {
  let bestChild: MCTSNode | null = null;
  let bestValue = -Infinity;
  
  for (const child of node.children.values()) {
    const uctValue = child.getUCTValue(this.config.explorationConstant);
    
    // Add small random noise to break ties
    const value = uctValue + Math.random() * 0.0001;
    
    if (value > bestValue) {
      bestValue = value;
      bestChild = child;
    }
  }
  
  return bestChild!;
}
```

### 2.3 Expansion Phase
```typescript
private expand(node: MCTSNode): MCTSNode {
  if (node.isTerminal) return node;
  
  // Order moves if configured
  if (this.config.useMoveOrdering && node.untriedMoves.length > 1) {
    this.orderMoves(node);
  }
  
  // Select move to try
  const move = node.untriedMoves.pop()!;
  
  // Apply move to create new state
  const newState = this.stateTransition.applyMove(node.state, move);
  
  // Check transposition table
  if (this.config.useTranspositionTable) {
    const stateKey = this.hashState(newState);
    if (this.transpositionTable.has(stateKey)) {
      const existingNode = this.transpositionTable.get(stateKey)!;
      node.children.set(this.hashMove(move), existingNode);
      return existingNode;
    }
  }
  
  // Create new child
  const child = new MCTSNode(newState, move, node);
  node.children.set(this.hashMove(move), child);
  
  if (node.untriedMoves.length === 0) {
    node.isFullyExpanded = true;
  }
  
  return child;
}

private orderMoves(node: MCTSNode): void {
  // Sort moves by expected value (worst first, since we pop from end)
  node.untriedMoves.sort((a, b) => {
    const scoreA = this.estimateMoveValue(node.state, a);
    const scoreB = this.estimateMoveValue(node.state, b);
    return scoreA - scoreB; // Lower scores first
  });
}

private estimateMoveValue(state: GameState, move: Move): number {
  // Quick heuristic without full state evaluation
  switch (move.type) {
    case 'buildCity': return 1000;
    case 'buildSettlement': return 900;
    case 'buyDevelopmentCard': return 300;
    case 'buildRoad': {
      // Only valuable if it leads somewhere
      const hasNearbyBuildableSpot = this.checkNearbyBuildableSpot(state, move);
      return hasNearbyBuildableSpot ? 200 : 10;
    }
    case 'playKnight': {
      // Valuable if robber is blocking us
      const robberBlockingUs = this.isRobberBlockingUs(state);
      return robberBlockingUs ? 400 : 100;
    }
    default: return 50;
  }
}
```

### 2.4 Simulation Phase
```typescript
private simulate(node: MCTSNode): SimulationResult {
  if (node.isTerminal) {
    return this.evaluateTerminalState(node.state);
  }
  
  // For hard AI, use heuristic evaluation instead of random rollout
  if (this.config.useHeuristicEvaluation && node.visits > 5) {
    return this.heuristicSimulation(node);
  }
  
  // Standard random rollout
  return this.randomRollout(node);
}

private randomRollout(node: MCTSNode): SimulationResult {
  let currentState = this.deepClone(node.state);
  let depth = 0;
  
  while (depth < this.config.maxSimulationDepth) {
    // Check for game end
    if (this.isGameOver(currentState)) {
      return this.evaluateTerminalState(currentState);
    }
    
    // Get legal moves
    const moves = this.moveGenerator.getLegalMoves(currentState);
    if (moves.length === 0) {
      // Pass turn if no moves
      currentState = this.passTurn(currentState);
      depth++;
      continue;
    }
    
    // Select random move (with slight bias for good moves)
    const move = this.selectSimulationMove(currentState, moves);
    currentState = this.stateTransition.applyMove(currentState, move);
    
    depth++;
    
    // Early termination if someone is close to winning
    if (this.config.useEarlyTermination) {
      const leader = this.getLeader(currentState);
      if (leader && leader.totalVictoryPoints >= 8) {
        // Estimate winner
        return this.estimateWinner(currentState);
      }
    }
  }
  
  // Depth limit reached - use heuristic
  return this.evaluatePosition(currentState);
}

private selectSimulationMove(state: GameState, moves: Move[]): Move {
  // For easy AI: pure random
  if (!this.config.useMoveOrdering) {
    return moves[Math.floor(Math.random() * moves.length)];
  }
  
  // For medium/hard: weighted random
  const weights = moves.map(move => {
    const value = this.estimateMoveValue(state, move);
    return Math.exp(value / 100); // Softmax-like
  });
  
  return this.weightedRandomSelect(moves, weights);
}

private heuristicSimulation(node: MCTSNode): SimulationResult {
  // Use heuristic to evaluate position without rollout
  const scores = new Map<string, number>();
  
  for (const player of node.state.players) {
    const score = this.evaluator.evaluate(node.state, player.id);
    scores.set(player.id, score);
  }
  
  // Convert to win probability
  const aiScore = scores.get(this.aiPlayerId)!;
  const maxOpponentScore = Math.max(
    ...Array.from(scores.entries())
      .filter(([id]) => id !== this.aiPlayerId)
      .map(([_, score]) => score)
  );
  
  // Sigmoid to convert score difference to win probability
  const scoreDiff = aiScore - maxOpponentScore;
  const winProbability = 1 / (1 + Math.exp(-scoreDiff / 1000));
  
  return {
    winner: winProbability > 0.8 ? this.aiPlayerId : null,
    isDraw: false,
    aiScore: winProbability
  };
}
```

### 2.5 Backpropagation Phase
```typescript
private backpropagate(node: MCTSNode, result: SimulationResult): void {
  let current: MCTSNode | null = node;
  
  while (current !== null) {
    current.visits++;
    
    if (result.isDraw) {
      current.draws++;
    } else if (result.winner === this.aiPlayerId) {
      current.wins++;
    } else if (result.aiScore !== undefined) {
      // Partial credit based on heuristic score
      current.wins += result.aiScore;
    }
    
    current = current.parent;
  }
}
```

### 2.6 Final Move Selection
```typescript
private selectFinalMove(root: MCTSNode): Move {
  let bestMove: Move | null = null;
  let bestValue = -Infinity;
  
  console.log("MCTS Results:");
  
  for (const child of root.children.values()) {
    // Use visit count as primary criterion (more robust than win rate)
    const value = child.visits;
    
    // Debug output
    const winRate = child.visits > 0 ? child.wins / child.visits : 0;
    console.log(`Move: ${this.moveToString(child.move)}, ` +
                `Visits: ${child.visits}, ` +
                `Win Rate: ${(winRate * 100).toFixed(1)}%`);
    
    if (value > bestValue) {
      bestValue = value;
      bestMove = child.move;
    }
  }
  
  return bestMove!;
}
```

## 3. Bun Worker Implementation

### 3.1 Worker Script (ai-worker.ts)
```typescript
// ai-worker.ts
import { CatanMCTS } from './mcts';
import { LegalMoveGenerator } from '../game/legal-moves';
import { StateTransition } from '../game/state-transition';
import { HeuristicEvaluator } from './heuristic';

interface WorkerMessage {
  type: 'calculateMove';
  gameState: GameState;
  aiPlayerId: string;
  difficulty: 'easy' | 'medium' | 'hard';
  timeLimit?: number;
}

interface WorkerResponse {
  type: 'moveCalculated';
  move: Move;
  stats: {
    iterations: number;
    timeElapsed: number;
    nodesEvaluated: number;
  };
}

// Initialize components
const moveGenerator = new LegalMoveGenerator();
const stateTransition = new StateTransition();
const evaluator = new HeuristicEvaluator();

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, gameState, aiPlayerId, difficulty, timeLimit } = event.data;
  
  if (type === 'calculateMove') {
    const startTime = Date.now();
    
    // Get config for difficulty
    const config = { 
      ...DIFFICULTY_CONFIGS[difficulty],
      timeLimit: timeLimit || DIFFICULTY_CONFIGS[difficulty].timeLimit
    };
    
    // Create MCTS instance
    const mcts = new CatanMCTS(
      config,
      aiPlayerId,
      moveGenerator,
      stateTransition,
      evaluator
    );
    
    // Find best move
    const move = mcts.findBestMove(gameState);
    
    // Send response
    const response: WorkerResponse = {
      type: 'moveCalculated',
      move,
      stats: {
        iterations: mcts.getIterationCount(),
        timeElapsed: Date.now() - startTime,
        nodesEvaluated: mcts.getNodeCount()
      }
    };
    
    self.postMessage(response);
  }
};
```

### 3.2 Server Integration (Hono)
```typescript
// server/ai-manager.ts
import { Worker } from 'bun';

export class AIManager {
  private workers: Map<string, Worker> = new Map();
  
  async calculateAIMove(
    gameId: string,
    gameState: GameState,
    aiPlayerId: string,
    difficulty: 'easy' | 'medium' | 'hard'
  ): Promise<Move> {
    // Create worker for this calculation
    const worker = new Worker(
      new URL('../ai/ai-worker.ts', import.meta.url).href
    );
    
    this.workers.set(gameId, worker);
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        worker.terminate();
        this.workers.delete(gameId);
        reject(new Error('AI calculation timeout'));
      }, 10000); // 10 second hard timeout
      
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        clearTimeout(timeout);
        worker.terminate();
        this.workers.delete(gameId);
        
        console.log(`AI move calculated in ${event.data.stats.timeElapsed}ms`);
        resolve(event.data.move);
      };
      
      worker.onerror = (error) => {
        clearTimeout(timeout);
        worker.terminate();
        this.workers.delete(gameId);
        reject(error);
      };
      
      // Send game state to worker
      worker.postMessage({
        type: 'calculateMove',
        gameState,
        aiPlayerId,
        difficulty
      });
    });
  }
  
  // Clean up any running workers
  terminateAll(): void {
    for (const [gameId, worker] of this.workers) {
      worker.terminate();
    }
    this.workers.clear();
  }
}
```

### 3.3 WebSocket Integration
```typescript
// server/game-handler.ts
import { AIManager } from './ai-manager';

export class GameHandler {
  private aiManager = new AIManager();
  
  async handleGameAction(
    ws: WebSocket,
    gameId: string,
    action: GameAction
  ): Promise<void> {
    // Apply player action
    const newState = await this.applyAction(gameId, action);
    
    // Broadcast new state to all players
    await this.broadcastGameState(gameId, newState);
    
    // Check if it's AI's turn
    const currentPlayer = this.getCurrentPlayer(newState);
    if (currentPlayer.isAI) {
      // Show "AI thinking" to players
      await this.broadcastAIThinking(gameId, currentPlayer.id);
      
      try {
        // Calculate AI move
        const aiMove = await this.aiManager.calculateAIMove(
          gameId,
          newState,
          currentPlayer.id,
          currentPlayer.difficulty
        );
        
        // Apply AI move
        const stateAfterAI = await this.applyMove(gameId, aiMove);
        
        // Broadcast AI's move
        await this.broadcastAIMove(gameId, currentPlayer.id, aiMove);
        await this.broadcastGameState(gameId, stateAfterAI);
        
        // Check if game continues with AI
        await this.checkNextTurn(gameId, stateAfterAI);
        
      } catch (error) {
        console.error('AI error:', error);
        await this.broadcastAIError(gameId, currentPlayer.id);
      }
    }
  }
  
  private async broadcastAIThinking(gameId: string, aiId: string): Promise<void> {
    const message = {
      type: 'ai_thinking',
      gameId,
      playerId: aiId,
      timestamp: Date.now()
    };
    
    await this.broadcast(gameId, message);
  }
}
```

## 4. Performance Optimizations

### 4.1 State Hashing for Transpositions
```typescript
class StateHasher {
  // Fast hash for transposition detection
  hashState(state: GameState): string {
    // Include only relevant state for transpositions
    const relevantData = {
      board: this.hashBoard(state),
      players: this.hashPlayers(state),
      turn: state.turn,
      phase: state.phase
    };
    
    return this.fnv1aHash(JSON.stringify(relevantData));
  }
  
  private hashBoard(state: GameState): string {
    // Hash only occupied positions and robber
    const occupied = [];
    
    for (const node of state.board.nodes) {
      if (node.building.type) {
        occupied.push(`${node.id}:${node.building.type}:${node.building.playerId}`);
      }
    }
    
    for (const edge of state.board.edges) {
      if (edge.road.playerId) {
        occupied.push(`${edge.id}:road:${edge.road.playerId}`);
      }
    }
    
    occupied.push(`robber:${state.robberLocation}`);
    
    return occupied.sort().join(',');
  }
  
  private fnv1aHash(str: string): string {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash *= 16777619;
    }
    return hash.toString(36);
  }
}
```

### 4.2 Memory Management
```typescript
private pruneTree(root: MCTSNode): void {
  const nodeCount = this.countNodes(root);
  
  if (nodeCount > this.config.maxTreeSize) {
    // Remove least visited branches
    this.pruneLeastVisited(root, nodeCount - this.config.maxTreeSize * 0.8);
  }
  
  // Clear old transposition table entries
  if (this.transpositionTable.size > this.config.maxTreeSize / 2) {
    const entries = Array.from(this.transpositionTable.entries());
    entries.sort((a, b) => a[1].visits - b[1].visits);
    
    const toRemove = entries.slice(0, entries.length / 4);
    for (const [key, _] of toRemove) {
      this.transpositionTable.delete(key);
    }
  }
}
```

### 4.3 Parallel MCTS (Optional for Hard AI)
```typescript
class ParallelMCTS extends CatanMCTS {
  async findBestMoveParallel(
    rootState: GameState,
    parallelism: number = 4
  ): Promise<Move> {
    // Create root with virtual loss
    const root = new MCTSNode(rootState);
    
    // Run parallel workers
    const workers: Promise<void>[] = [];
    
    for (let i = 0; i < parallelism; i++) {
      workers.push(this.runWorkerIterations(root, this.config.iterations / parallelism));
    }
    
    await Promise.all(workers);
    
    return this.selectFinalMove(root);
  }
}
```

## 5. Testing & Benchmarking

### 5.1 Unit Tests
```typescript
describe('MCTS AI', () => {
  test('finds winning move in 1', async () => {
    const state = createTestState({
      aiVictoryPoints: 9,
      canBuildSettlement: true
    });
    
    const ai = createTestAI('hard');
    const move = await ai.findBestMove(state);
    
    expect(move.type).toBe('buildSettlement');
  });
  
  test('blocks opponent victory', async () => {
    const state = createTestState({
      opponentVictoryPoints: 9,
      canBlockWithRoad: true
    });
    
    const ai = createTestAI('medium');
    const move = await ai.findBestMove(state);
    
    expect(move.type).toBe('buildRoad');
  });
  
  test('respects time limit', async () => {
    const state = createComplexGameState();
    const ai = createTestAI('hard', { timeLimit: 100 });
    
    const start = Date.now();
    await ai.findBestMove(state);
    const elapsed = Date.now() - start;
    
    expect(elapsed).toBeLessThan(150);
  });
});
```

### 5.2 Performance Benchmarks
```typescript
interface PerformanceBenchmark {
  difficulty: 'easy' | 'medium' | 'hard';
  avgTimePerMove: number;
  avgIterations: number;
  avgNodesEvaluated: number;
  memoryUsage: number;
}

const EXPECTED_PERFORMANCE: Record<string, PerformanceBenchmark> = {
  easy: {
    difficulty: 'easy',
    avgTimePerMove: 100,  // ms
    avgIterations: 100,
    avgNodesEvaluated: 500,
    memoryUsage: 10  // MB
  },
  medium: {
    difficulty: 'medium',
    avgTimePerMove: 1000,
    avgIterations: 1000,
    avgNodesEvaluated: 5000,
    memoryUsage: 50
  },
  hard: {
    difficulty: 'hard',
    avgTimePerMove: 3000,
    avgIterations: 5000,
    avgNodesEvaluated: 25000,
    memoryUsage: 100
  }
};
```

## 6. Integration Checklist

- [ ] Implement MCTS core algorithm with UCT
- [ ] Add virtual wins for move ordering
- [ ] Create Bun worker script
- [ ] Integrate with Hono WebSocket server
- [ ] Add state hashing for transpositions
- [ ] Implement memory management
- [ ] Add difficulty configurations
- [ ] Create AI manager for worker lifecycle
- [ ] Add WebSocket messages for AI thinking
- [ ] Write comprehensive tests
- [ ] Benchmark performance
- [ ] Add telemetry/logging
- [ ] Handle edge cases (timeouts, errors)
- [ ] Optimize state cloning
- [ ] Document tuning parameters

## 7. Tuning Guide

### Key Parameters to Adjust:
1. **Exploration Constant**: Lower (1.0) for stronger play, higher (2.0) for more variety
2. **Virtual Wins**: Increase for more aggressive building strategies
3. **Simulation Depth**: Balance accuracy vs performance
4. **Time Limits**: Adjust based on user experience requirements
5. **Move Ordering Weights**: Tune based on game statistics

### Debugging Tools:
```typescript
interface MCTSDebugInfo {
  moveConsideration: Map<Move, {
    visits: number;
    winRate: number;
    uctValue: number;
  }>;
  treeDepth: number;
  branchingFactor: number;
  timeSpentByPhase: {
    selection: number;
    expansion: number;
    simulation: number;
    backpropagation: number;
  };
}
```