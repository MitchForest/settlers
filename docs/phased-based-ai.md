# Phase-Based AI Strategy Framework

## Overview

This document outlines our approach to building a robust, maintainable AI system for Settlers of Catan that adapts its strategy based on game progression phases. The focus is on creating a **solid foundation** that can grow and evolve over time, rather than implementing every possible strategy upfront.

## Core Philosophy: 80/20 Approach

- **80%**: Build extensible framework with simple, effective strategies
- **20%**: Leave room for advanced features like MCTS, opponent modeling, complex negotiations
- **Foundation First**: Establish clean architecture before adding complexity
- **Incremental Growth**: Add strategies over time without breaking existing system

## Game Phase Definition

### Primary Phases
| Phase | VP Range | Primary Goal | Strategy Focus |
|-------|----------|--------------|----------------|
| **SETUP1** | - | Initial placement | High numbers + scarcity |
| **SETUP2** | - | Second placement | Diversity OR ports OR blocking |
| **TO3** | 0-2 VP | Race to 3 points | Settlement expansion |
| **TO5** | 3-4 VP | Establish position | Cities vs settlements (resource-based) |
| **TO-3** | 7+ VP | Endgame prep | Multiple strategy options |
| **TO-2** | 8+ VP | Victory approach | Adaptive execution |
| **TO-1** | 9+ VP | Secure victory | Last-point optimization |

### Phase Detection Logic
```typescript
function detectPhase(gameState: GameState, playerId: PlayerId): string {
  const vp = gameState.players.get(playerId)!.score.total
  
  if (gameState.phase.startsWith('setup')) return gameState.phase
  if (vp < 3) return 'TO3'
  if (vp < 5) return 'TO5'
  if (vp >= 7) return 'TO-3'
  if (vp >= 8) return 'TO-2' 
  if (vp >= 9) return 'TO-1'
  
  return 'TO5' // default mid-game
}
```

## Strategy Framework Architecture

### Core Interfaces
```typescript
interface StrategyOption {
  id: string
  name: string
  description: string
  viabilityCheck(gameState: GameState, playerId: PlayerId): number // 0-100
  weight: number  // base priority multiplier
}

interface PhaseStrategy {
  phase: string
  primaryStrategies: StrategyOption[]
  secondaryStrategies: StrategyOption[]
  selectStrategy(gameState: GameState, playerId: PlayerId): {
    primary: StrategyOption
    secondary?: StrategyOption
  }
}
```

### Strategy Selection Algorithm
1. **Calculate viability** for each strategy option (0-100 score)
2. **Apply weight multiplier** (viability × weight = final score)
3. **Select highest scoring** as primary strategy
4. **Select secondary** if primary viability drops below threshold (e.g., 60)
5. **Switch strategies** when viability changes significantly

## Initial Strategy Pool

### SETUP Phase Strategies
| Strategy | Focus | Viability Factors |
|----------|-------|-------------------|
| **HighNumberStrategy** | 6/8 placement | Number token availability, scarcity |
| **ScarcityStrategy** | Rare resources | Resource distribution analysis |
| **PortStrategy** | 2:1 ports | Port availability + resource synergy |
| **BlockingStrategy** | Deny opponents | Opponent threat assessment |

### Mid-Game Strategies  
| Strategy | Focus | Viability Factors |
|----------|-------|-------------------|
| **ExpansionStrategy** | New settlements | Available spots, resource needs |
| **UpgradeStrategy** | Cities | Ore/wheat availability, production multiplier |
| **DiversityStrategy** | Resource balance | Current resource gaps |

### Endgame Strategies
| Strategy | Focus | Viability Factors |
|----------|-------|-------------------|
| **VictoryRushStrategy** | Direct VP path | Resources vs. VP needed |
| **LargestArmyStrategy** | Development cards | Knights played, opponent threats |
| **SecureWinStrategy** | Defensive play | Lead protection, opponent proximity |

## Phase-Specific Implementation

### SETUP1: Foundation Building
**Primary Goal**: Maximize long-term production potential

**Strategy Pool**:
- **Primary**: HighNumberStrategy (6/8 focus)
- **Secondary**: ScarcityStrategy (if no 6/8 available)

**Key Decisions**:
- Prioritize 6/8 intersections with 2+ resources
- Consider scarcity bonus for rare resources (ore, wheat)
- Evaluate future expansion potential

### SETUP2: Strategic Positioning  
**Primary Goal**: Complement first settlement OR capitalize on opportunities

**Strategy Pool**:
- **Primary**: DiversityStrategy (if first settlement specialized)
- **Secondary**: PortStrategy (if synergistic with first settlement)
- **Tertiary**: BlockingStrategy (prevent opponent advantages)

**Key Decisions**:
- Diversify resources if first settlement was specialized
- Target 2:1 ports if first settlement produces the port resource
- Block opponents from double-6/8 positions

### TO3: Expansion Race
**Primary Goal**: Reach 3 VP as quickly as possible

**Strategy Pool**:
- **Primary**: ExpansionStrategy (road + settlement)
- **Secondary**: UpgradeStrategy (if ore/wheat heavy)

**Key Decisions**:
- Build roads toward best available settlement spots
- Upgrade to city only if resources strongly favor it
- Consider 3-road chains to premium locations

### TO5: Position Establishment
**Primary Goal**: Build sustainable production base

**Strategy Pool**:
- **Primary**: Resource-dependent (cities if ore/wheat, settlements if wood/brick)
- **Secondary**: DiversityStrategy (fill resource gaps)

**Key Decisions**:
- Dynamic strategy selection based on resource production
- Balance between cities (efficiency) and settlements (expansion)
- Ensure 5 resource types for flexibility

### TO-3, TO-2, TO-1: Victory Execution
**Primary Goal**: Adapt to changing victory conditions

**Strategy Pool**:
- Multiple strategies evaluated each turn
- Dynamic switching based on opponent threats
- Resource security prioritization

## Implementation Phases

### Phase 1: Foundation (CRITICAL) ⭐
**Timeline**: Sprint 1-2

**Deliverables**:
- [ ] Core framework interfaces and classes
- [ ] Simple phase detection based on VP
- [ ] Basic strategy selection algorithm  
- [ ] 2-3 strategies per phase (minimal viable)
- [ ] Integration with existing ai-system

**Success Criteria**: AI can switch between strategies based on viability

### Phase 2: Enhanced Initial Placement
**Timeline**: Sprint 3-4

**Deliverables**:
- [ ] Port evaluation logic in setup strategies
- [ ] Basic blocking detection (prevent double-6/8)
- [ ] Resource synergy evaluation between settlements
- [ ] Improved scarcity calculation with opponent analysis

**Success Criteria**: AI makes noticeably better setup decisions

### Phase 3: Mid-Game Intelligence  
**Timeline**: Sprint 5-6

**Deliverables**:
- [ ] Resource-based strategy selection (TO5)
- [ ] Improved expansion pathfinding
- [ ] Basic trade evaluation for strategy execution
- [ ] City vs settlement decision optimization

**Success Criteria**: AI builds more efficiently in mid-game

### Phase 4: Endgame Adaptation
**Timeline**: Sprint 7-8

**Deliverables**:
- [ ] Victory path calculation and optimization
- [ ] Opponent threat assessment
- [ ] Adaptive strategy switching in endgame
- [ ] Resource security and denial tactics

**Success Criteria**: AI can reliably close out games when ahead

## Initial Assumptions & Limitations

To focus on the foundation, we'll start with these simplifying assumptions:

### Trading
- **No trade offers**: AI won't initiate player-to-player trades
- **Auto-decline trades**: Automatically decline all incoming trade offers
- **Bank/port trades only**: Focus on 4:1 and 2:1 trades only

### Social Features
- **No negotiations**: No complex interaction with other players
- **No psychological tactics**: Pure strategic decision making
- **No meta-gaming**: No learning from previous games

### Resource Management
- **Simple resource counting**: Basic resource availability checks
- **No probabilistic forecasting**: Decisions based on current state
- **No hoarding optimization**: Immediate resource usage focus

## Future Enhancement Ideas

### Advanced Strategy Features
- **MCTS Integration**: Monte Carlo Tree Search for complex decision trees
- **Opponent Modeling**: Predict opponent strategies and counter them
- **Multi-turn Planning**: Optimize sequences of actions across multiple turns
- **Dynamic Weights**: Adjust strategy weights based on game outcomes

### Trading & Negotiation
- **Trade Evaluation**: Calculate trade value and fairness
- **Negotiation Engine**: Multi-round trade negotiations
- **Trade Timing**: Optimal timing for trade offers
- **Resource Denial**: Strategic trading to deny opponents

### Port & Trade Awareness
- **Port Strategy Optimization**: Advanced port utilization
- **Trade Route Planning**: Optimal resource conversion paths
- **Market Analysis**: Track resource scarcity and pricing
- **Monopoly Exploitation**: Leverage resource control

### Advanced Algorithms
- **Neural Networks**: Learn strategy weights from game data
- **Reinforcement Learning**: Self-improving through gameplay
- **Genetic Algorithms**: Evolve strategy parameters
- **Ensemble Methods**: Combine multiple AI approaches

### Opponent Intelligence
- **Strategy Recognition**: Identify opponent strategy patterns
- **Threat Assessment**: Predict opponent victory probability
- **Counter-strategies**: Develop specific anti-strategies
- **Coalition Building**: Multi-player alliance formation

## Testing Strategy

### Unit Testing
- Individual strategy viability functions
- Phase detection accuracy  
- Strategy selection logic
- Resource calculation methods

### Integration Testing
- Full game simulations with strategy switching
- Multi-player scenarios with different strategies
- Performance testing with complex game states
- Regression testing for strategy improvements

### Validation Metrics
- **Win Rate**: Against various opponents and difficulty levels
- **Strategy Switching**: Frequency and appropriateness of switches
- **Resource Efficiency**: Resource usage and waste minimization
- **Phase Optimization**: Time spent in each phase vs. optimal

## File Structure

```
packages/ai-strategy/
├── src/
│   ├── framework/
│   │   ├── phase-detector.ts         # VP-based phase detection
│   │   ├── strategy-selector.ts      # Primary/secondary selection
│   │   ├── viability-calculator.ts   # Strategy scoring
│   │   └── interfaces.ts             # Core type definitions
│   ├── phases/
│   │   ├── setup-phase.ts           # SETUP1 & SETUP2 strategies
│   │   ├── early-game-phase.ts      # TO3 strategies  
│   │   ├── mid-game-phase.ts        # TO5 strategies
│   │   └── endgame-phase.ts         # TO-3, TO-2, TO-1 strategies
│   ├── strategies/
│   │   ├── setup/
│   │   │   ├── high-number-strategy.ts
│   │   │   ├── scarcity-strategy.ts
│   │   │   ├── port-strategy.ts
│   │   │   └── blocking-strategy.ts
│   │   ├── midgame/
│   │   │   ├── expansion-strategy.ts
│   │   │   ├── upgrade-strategy.ts
│   │   │   └── diversity-strategy.ts
│   │   └── endgame/
│   │       ├── victory-rush-strategy.ts
│   │       ├── largest-army-strategy.ts
│   │       └── secure-win-strategy.ts
│   ├── evaluators/
│   │   ├── port-evaluator.ts        # 2:1 port value calculation
│   │   ├── blocking-evaluator.ts    # Opponent denial assessment
│   │   ├── resource-evaluator.ts    # Resource synergy analysis
│   │   └── position-evaluator.ts    # Board position strength
│   └── ai-coordinator.ts            # Main entry point
```

## Success Metrics

### Short-term (Foundation Complete)
- [ ] AI can detect and switch between game phases
- [ ] Strategy selection works with viability scoring  
- [ ] Basic strategies show measurable improvement over random play
- [ ] Framework is extensible and maintainable

### Medium-term (Enhanced Features)
- [ ] AI makes competitive setup decisions (ports, blocking)
- [ ] Mid-game strategy selection is resource-aware
- [ ] Endgame adaptability shows improved win rates
- [ ] System can accommodate new strategies easily

### Long-term (Advanced Features)
- [ ] AI competitive with experienced human players
- [ ] Complex features (MCTS, opponent modeling) integrated
- [ ] Trading and negotiation capabilities
- [ ] Self-improving through machine learning

---

## Conclusion

This phased approach prioritizes **building a robust foundation** that can evolve over time. By starting simple and focusing on extensibility, we ensure that future enhancements (MCTS, advanced trading, opponent modeling) can be added without redesigning the core system.

The key to success is implementing the **framework correctly** in Phase 1, as this will determine how easily we can add sophisticated strategies later. Once the foundation is solid, we can incrementally add intelligence and complexity while maintaining system stability and maintainability. 