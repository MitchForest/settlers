# Catan AI Phase 2: Heuristic Evaluation Function

## Overview
The heuristic evaluation function is the AI's ability to judge how favorable a game position is. It takes a GameState and returns a numerical score from the AI player's perspective. Higher scores indicate better positions.

## Core Principles

1. **Victory Points are Ultimate**: Everything else is just a means to get VPs
2. **Production is Power**: Resources enable all actions
3. **Timing Matters**: Early production > late production
4. **Scarcity Creates Value**: Control of rare resources is powerful
5. **Position Beats Resources**: Good board position outlasts resource stockpiles

## Heuristic Function Structure

```typescript
interface HeuristicEvaluator {
  evaluate(state: GameState, playerId: string): number;
  
  // Sub-evaluators for different aspects
  evaluateVictoryProgress(state: GameState, player: PlayerState): number;
  evaluateProduction(state: GameState, player: PlayerState): number;
  evaluateResources(state: GameState, player: PlayerState): number;
  evaluateBoardPosition(state: GameState, player: PlayerState): number;
  evaluateOpponentThreats(state: GameState, playerId: string): number;
}
```

## 1. Victory Progress Evaluation (Weight: 1000x)

### 1.1 Direct Victory Points
```typescript
function evaluateVictoryProgress(state: GameState, player: PlayerState): number {
  let score = 0;
  
  // Current VPs (most important)
  score += player.totalVictoryPoints * 1000;
  
  // Distance to victory (bonus for being close)
  const vpNeeded = 10 - player.totalVictoryPoints;
  if (vpNeeded <= 2) {
    score += (3 - vpNeeded) * 200; // Big bonus for being 1-2 VPs away
  }
  
  // Victory potential
  const potential = calculateVictoryPotential(state, player);
  score += potential * 50;
  
  return score;
}

function calculateVictoryPotential(state: GameState, player: PlayerState): number {
  let potential = 0;
  
  // Can build settlements? (each worth 1 VP)
  const buildableSettlements = countBuildableSettlements(state, player);
  potential += Math.min(buildableSettlements, 3) * 0.8; // Diminishing returns
  
  // Can upgrade to cities? (each worth 1 additional VP)
  const upgradableCities = player.settlements.length;
  potential += upgradableCities * 0.9; // High probability if resources available
  
  // Longest road potential
  if (!player.hasLongestRoad) {
    const roadDiff = player.longestRoadLength - getLongestOpponentRoad(state, player.id);
    if (roadDiff >= -2) {
      potential += (2 - Math.abs(roadDiff)) * 0.4; // Closer = more likely
    }
  }
  
  // Largest army potential
  if (!player.hasLargestArmy) {
    const armyDiff = player.armySize - getLargestOpponentArmy(state, player.id);
    if (armyDiff >= -2) {
      potential += (2 - Math.abs(armyDiff)) * 0.4;
    }
  }
  
  // Development cards in hand (might be VPs)
  potential += player.developmentCards.unplayed.length * 0.15; // ~15% chance each
  
  return potential;
}
```

## 2. Production Evaluation (Weight: 100x)

### 2.1 Production Power Calculation
```typescript
function evaluateProduction(state: GameState, player: PlayerState): number {
  let score = 0;
  
  // Probability values for each dice roll
  const DICE_PROBABILITY = {
    2: 1/36, 3: 2/36, 4: 3/36, 5: 4/36, 6: 5/36,
    7: 6/36, // Robber
    8: 5/36, 9: 4/36, 10: 3/36, 11: 2/36, 12: 1/36
  };
  
  // Calculate expected resources per turn
  const production = calculateResourceProduction(state, player);
  
  // Base production score
  score += production.total * 100;
  
  // Resource diversity bonus (having access to all resources)
  const diversityScore = calculateDiversityScore(production.byResource);
  score += diversityScore * 50;
  
  // Scarcity value bonus
  const scarcityBonus = calculateScarcityBonus(state, production.byResource);
  score += scarcityBonus * 30;
  
  // Port access bonus
  const portBonus = calculatePortBonus(state, player, production.byResource);
  score += portBonus * 20;
  
  return score;
}

function calculateResourceProduction(state: GameState, player: PlayerState): ProductionInfo {
  const production: Record<Resource, number> = {
    wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0
  };
  
  // Check each settlement
  for (const nodeId of player.settlements) {
    const node = state.board.nodes[nodeId];
    for (const hexId of node.adjacentHexes) {
      const hex = state.board.hexes[hexId];
      if (hex.resource !== 'desert' && !hex.hasRobber && hex.numberToken !== 7) {
        const probability = DICE_PROBABILITY[hex.numberToken] || 0;
        production[hex.resource] += probability;
      }
    }
  }
  
  // Check each city (double production)
  for (const nodeId of player.cities) {
    const node = state.board.nodes[nodeId];
    for (const hexId of node.adjacentHexes) {
      const hex = state.board.hexes[hexId];
      if (hex.resource !== 'desert' && !hex.hasRobber && hex.numberToken !== 7) {
        const probability = DICE_PROBABILITY[hex.numberToken] || 0;
        production[hex.resource] += probability; // Additional production
      }
    }
  }
  
  const total = Object.values(production).reduce((sum, val) => sum + val, 0);
  return { total, byResource: production };
}

function calculateDiversityScore(production: Record<Resource, number>): number {
  // Reward having access to all resources
  const resourcesProduced = Object.values(production).filter(p => p > 0).length;
  
  // Bonus for each resource type produced
  let score = resourcesProduced * 10;
  
  // Extra bonus for complete diversity
  if (resourcesProduced === 5) {
    score += 20;
  }
  
  // Penalty for missing critical resources
  if (production.wheat === 0 || production.ore === 0) {
    score -= 15; // Can't build cities without these
  }
  if (production.wood === 0 || production.brick === 0) {
    score -= 10; // Can't build roads/settlements without these
  }
  
  return score;
}
```

### 2.2 Scarcity Analysis
```typescript
function calculateScarcityBonus(state: GameState, myProduction: Record<Resource, number>): number {
  // Calculate total board production for each resource
  const boardProduction: Record<Resource, number> = {
    wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0
  };
  
  for (const hex of state.board.hexes) {
    if (hex.resource !== 'desert' && hex.numberToken !== 7) {
      const probability = DICE_PROBABILITY[hex.numberToken] || 0;
      boardProduction[hex.resource] += probability;
    }
  }
  
  // Calculate scarcity bonus
  let bonus = 0;
  for (const resource of ['wood', 'brick', 'sheep', 'wheat', 'ore'] as Resource[]) {
    const totalProduction = boardProduction[resource];
    const myShare = myProduction[resource] / (totalProduction || 1);
    
    // Bonus for controlling scarce resources
    const scarcityFactor = 1 / (totalProduction + 0.1); // Avoid division by zero
    bonus += myShare * scarcityFactor * 100;
  }
  
  return bonus;
}
```

## 3. Current Resources Evaluation (Weight: 10x)

```typescript
function evaluateResources(state: GameState, player: PlayerState): number {
  let score = 0;
  const resources = player.resources;
  const totalCards = Object.values(resources).reduce((sum, count) => sum + count, 0);
  
  // Base value of resources
  score += totalCards * 10;
  
  // Building potential bonus
  if (canBuildCity(resources)) score += 30;
  if (canBuildSettlement(resources) && canBuildRoad(resources)) score += 25;
  if (canBuyDevelopmentCard(resources)) score += 15;
  
  // Flexibility bonus (having diverse resources)
  const resourceTypes = Object.values(resources).filter(count => count > 0).length;
  score += resourceTypes * 5;
  
  // Penalty for too many cards (robber risk)
  if (totalCards > 7) {
    score -= (totalCards - 7) * 5; // Increasing penalty
  }
  
  // Penalty for resource imbalance
  const maxResource = Math.max(...Object.values(resources));
  if (maxResource > totalCards * 0.5) {
    score -= (maxResource - totalCards * 0.5) * 3; // Too many of one type
  }
  
  return score;
}

// Helper functions
function canBuildCity(resources: Record<Resource, number>): boolean {
  return resources.ore >= 3 && resources.wheat >= 2;
}

function canBuildSettlement(resources: Record<Resource, number>): boolean {
  return resources.wood >= 1 && resources.brick >= 1 && 
         resources.sheep >= 1 && resources.wheat >= 1;
}
```

## 4. Board Position Evaluation (Weight: 50x)

```typescript
function evaluateBoardPosition(state: GameState, player: PlayerState): number {
  let score = 0;
  
  // Expansion potential
  const expansionScore = evaluateExpansionPotential(state, player);
  score += expansionScore * 30;
  
  // Road network quality
  const roadScore = evaluateRoadNetwork(state, player);
  score += roadScore * 20;
  
  // Port access
  const portScore = evaluatePortAccess(state, player);
  score += portScore * 15;
  
  // Board control (blocking opponents)
  const controlScore = evaluateBoardControl(state, player);
  score += controlScore * 10;
  
  return score;
}

function evaluateExpansionPotential(state: GameState, player: PlayerState): number {
  let score = 0;
  
  // Find reachable empty nodes for settlements
  const reachableNodes = findReachableNodes(state, player);
  const buildableNodes = reachableNodes.filter(nodeId => 
    isValidSettlementLocation(state, nodeId)
  );
  
  // Score each potential settlement location
  for (const nodeId of buildableNodes) {
    const nodeValue = evaluateNodeValue(state, nodeId);
    const distance = getDistanceToNode(state, player, nodeId);
    
    // Closer nodes are more valuable
    score += nodeValue / (distance + 1);
  }
  
  return Math.min(score, 100); // Cap to prevent overvaluation
}

function evaluateNodeValue(state: GameState, nodeId: number): number {
  const node = state.board.nodes[nodeId];
  let value = 0;
  
  for (const hexId of node.adjacentHexes) {
    const hex = state.board.hexes[hexId];
    if (hex.resource !== 'desert' && hex.numberToken !== 7) {
      const probability = DICE_PROBABILITY[hex.numberToken] || 0;
      
      // Base value from probability
      value += probability * 100;
      
      // Bonus for high-probability numbers
      if (hex.numberToken === 6 || hex.numberToken === 8) {
        value += 20;
      }
    }
  }
  
  // Port bonus
  if (node.port) {
    value += node.port.ratio === 2 ? 30 : 20;
  }
  
  return value;
}
```

## 5. Opponent Threat Evaluation (Weight: -30x)

```typescript
function evaluateOpponentThreats(state: GameState, playerId: string): number {
  let threatScore = 0;
  const player = state.players.find(p => p.id === playerId)!;
  
  for (const opponent of state.players.filter(p => p.id !== playerId)) {
    // Victory point threat
    const vpThreat = (opponent.publicVictoryPoints / 10) ** 2 * 100;
    threatScore += vpThreat;
    
    // Production dominance threat
    const oppProduction = calculateResourceProduction(state, opponent);
    if (oppProduction.total > calculateResourceProduction(state, player).total * 1.5) {
      threatScore += 30;
    }
    
    // Special victory threats
    if (opponent.longestRoadLength >= player.longestRoadLength - 1 && !player.hasLongestRoad) {
      threatScore += 20;
    }
    if (opponent.armySize >= player.armySize - 1 && !player.hasLargestArmy) {
      threatScore += 20;
    }
  }
  
  return -threatScore; // Negative because threats are bad
}
```

## 6. Game Phase Adjustments

```typescript
function adjustForGamePhase(baseScore: number, state: GameState): number {
  const gameProgress = estimateGameProgress(state);
  
  if (gameProgress < 0.3) {
    // Early game: Emphasize production and expansion
    return baseScore * 1.2;
  } else if (gameProgress < 0.7) {
    // Mid game: Balance everything
    return baseScore;
  } else {
    // Late game: Emphasize victory points and blocking
    return baseScore * 0.8; // Reduce long-term investment value
  }
}

function estimateGameProgress(state: GameState): number {
  // Estimate based on highest VP count and development
  const maxVP = Math.max(...state.players.map(p => p.publicVictoryPoints));
  const totalBuildings = state.players.reduce((sum, p) => 
    sum + p.settlements.length + p.cities.length, 0
  );
  
  const vpProgress = maxVP / 10;
  const buildingProgress = totalBuildings / 30; // Rough max buildings
  
  return Math.max(vpProgress, buildingProgress);
}
```

## 7. Complete Heuristic Function

```typescript
class HeuristicEvaluator {
  evaluate(state: GameState, playerId: string): number {
    const player = state.players.find(p => p.id === playerId);
    if (!player) return -Infinity;
    
    // Check for win/loss
    if (player.totalVictoryPoints >= 10) return Infinity;
    if (state.players.some(p => p.id !== playerId && p.totalVictoryPoints >= 10)) {
      return -Infinity;
    }
    
    // Component scores
    let score = 0;
    score += this.evaluateVictoryProgress(state, player);
    score += this.evaluateProduction(state, player);
    score += this.evaluateResources(state, player);
    score += this.evaluateBoardPosition(state, player);
    score += this.evaluateOpponentThreats(state, playerId);
    
    // Development cards bonus
    score += player.developmentCards.unplayed.length * 15;
    score += player.developmentCards.played.knights * 10;
    
    // Adjust for game phase
    score = this.adjustForGamePhase(score, state);
    
    // Add small random factor to break ties
    score += Math.random() * 0.1;
    
    return score;
  }
}
```

## 8. Tuning and Debugging

### 8.1 Weight Tuning Guidelines
```typescript
interface WeightConfig {
  victory: 1000;      // Don't change - VPs are the goal
  production: 100;    // High - enables everything
  resources: 10;      // Low - temporary value
  position: 50;       // Medium - long-term value
  threats: -30;       // Negative - reduce for opponent strength
}
```

### 8.2 Debug Utilities
```typescript
interface HeuristicDebugger {
  // Break down score by component
  explainScore(state: GameState, playerId: string): {
    total: number;
    components: {
      victory: number;
      production: number;
      resources: number;
      position: number;
      threats: number;
    };
    details: string[];
  };
  
  // Compare two states
  compareStates(state1: GameState, state2: GameState, playerId: string): {
    score1: number;
    score2: number;
    difference: number;
    explanation: string;
  };
}
```

## 9. Performance Considerations

### 9.1 Caching Strategy
```typescript
class CachedHeuristicEvaluator extends HeuristicEvaluator {
  private cache = new Map<string, number>();
  private productionCache = new Map<string, ProductionInfo>();
  
  evaluate(state: GameState, playerId: string): number {
    const cacheKey = this.generateCacheKey(state, playerId);
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }
    
    const score = super.evaluate(state, playerId);
    this.cache.set(cacheKey, score);
    
    // Limit cache size
    if (this.cache.size > 10000) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    return score;
  }
}
```

### 9.2 Optimization Tips
1. **Precompute static values**: Board topology, hex probabilities
2. **Incremental updates**: Update only affected components after moves
3. **Early termination**: Skip expensive calculations in won/lost positions
4. **Approximation**: Use simplified calculations in deep MCTS simulations

## Testing Checklist

- [ ] Verify victory point calculations are accurate
- [ ] Test production calculations against known board states
- [ ] Validate scarcity analysis with extreme boards
- [ ] Check expansion potential pathfinding
- [ ] Test opponent threat detection
- [ ] Benchmark performance (<1ms per evaluation)
- [ ] Verify scores increase with better positions
- [ ] Test edge cases (no valid moves, near-win states)