# Iterative AI Development Framework for Settlers of Catan

## Overview

This document outlines our systematic approach to developing AI strategies for Settlers of Catan, prioritizing **baseline establishment** and **incremental improvement** over complex initial implementations. Our goal is to create a modular, testable system that allows for systematic strategy development and performance measurement.

## Core Philosophy: Baseline-First Iterative Development

- **Start Simple**: Establish baseline performance with crude but functional strategies
- **Measure Everything**: Track performance metrics across large sample sizes (100+ games)
- **Iterate Systematically**: Make one change at a time, measure impact, document results
- **Modular Design**: Enable easy strategy addition/modification without system rewrites
- **User-Friendly**: Design for community contribution and experimentation

## Commercial Vision: AI-Assisted Catan for Strategy Development

This AI system has potential commercial applications:

- **Hybrid Play Mode**: Humans can join games with bots, taking control when desired or letting AI play
- **Strategy Testing Platform**: Players can experiment with different bot strategies to improve their own gameplay
- **Statistical Analysis Hub**: Full bot-vs-bot games with detailed analytics for strategy nerds
- **Learning Platform**: Watch AI strategies unfold to understand optimal play patterns
- **Community Strategies**: Users can create, share, and test custom AI strategies

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

## Development Goals & Timeline

### GOAL #1: Baseline Establishment (CRITICAL) ⭐
**Objective**: Create functional bots with decent setups that can finish games within 150 turns

**Target Metrics**:
- Average game length: <150 turns
- Game completion rate: >95% (no infinite loops or stalls)
- Baseline win rate: Competitive against random play

**Simple Strategy Algorithm**:
Focus on crude but effective "next 1-2 VP" decision making:
1. **Settlement Building**: Can I build a settlement for 1 VP?
2. **City Upgrades**: Can I upgrade to a city for 1 VP + production boost?
3. **Longest Road**: Am I close to longest road (2 VP)?
4. **Largest Army**: Am I close to largest army (2 VP)?
5. **Development Cards**: Buy dev cards for potential VP cards

**Deliverables**:
- [ ] Crude next-VP strategy algorithm
- [ ] Game completion within turn limits
- [ ] Basic performance measurement system
- [ ] Integration with existing setup strategies
- [ ] 100-game baseline test results
- [ ] Game engine stress testing and bug reporting
- [ ] Full rule compliance validation
- [ ] Authentic multiplayer simulation environment

**Success Criteria**: Bots consistently finish games and provide measurable baseline

### GOAL #2: Phase-Based Strategy Implementation
**Objective**: Add basic phase awareness and measure improvement over baseline

**Key Improvements**:
- **TO3 Strategy**: Prioritize settlement expansion for 3rd victory point
- **Resource Balancing**: Simple resource management for building costs
- **Turn Efficiency**: Reduce average turns to victory
- **Basic Blocking**: Prevent opponents from obvious good moves

**Target Metrics**:
- Improved average game length vs. baseline
- Better resource utilization efficiency
- Measurable win rate improvement in head-to-head tests

**Deliverables**:
- [ ] Simple phase detection (VP-based)
- [ ] TO3-focused expansion strategy
- [ ] Comparative analysis vs. baseline (100+ games)
- [ ] Performance improvement documentation

**Success Criteria**: Measurable improvement over baseline performance

### GOAL #3: Iterative Enhancement & Testing
**Objective**: Systematic improvement through measured iterations

**Enhancement Areas** (one at a time):
- **Player Count Optimization**: Different strategies for 3 vs 4 players
- **MCTS Integration**: For complex decisions (pathfinding, unclear choices)
- **Port Awareness**: 2:1 port utilization in strategy decisions
- **Trading Capability**: Bank/port trade optimization
- **Multiple Endgame Strategies**: Diversify victory path approaches
- **Weight Tuning**: Optimize strategy parameters based on results

**Methodology**:
1. Implement single improvement
2. Run 100+ game test suite
3. Compare against previous version
4. Document results and learnings
5. Keep or revert based on data
6. Repeat with next improvement

**Success Criteria**: Continuous measurable improvement through systematic iteration

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

## Performance Tracking & Documentation

### Results Documentation Structure
We will maintain detailed records of our iterative improvements:

```
docs/ai-development/
├── baseline-results.md              # Initial performance metrics
├── iteration-log.md                 # Change log with results
├── strategy-comparison.md           # Head-to-head strategy analysis
├── performance-metrics.md           # Standardized measurement definitions
└── commercial-insights.md           # Findings relevant to product development
```

### Key Metrics to Track
- **Game Completion**: Turn count, completion rate, timeout frequency
- **Victory Distribution**: Settlement/city/army/road/dev card victory types
- **Resource Efficiency**: Resource waste, conversion rates, building ratios
- **Strategy Effectiveness**: Win rates by strategy type, phase performance
- **Scalability**: Performance differences in 3 vs 4 player games

### Testing Protocol
1. **Sample Size**: Minimum 100 games per test (statistical significance)
2. **Control Variables**: Same board configurations, player counts, randomization seeds
3. **A/B Testing**: New strategy vs. previous best performer
4. **Multiple Runs**: 3 independent test runs to validate consistency
5. **Documentation**: Record all parameters, results, and insights
6. **Real Game Engine**: All tests use full game-engine with complete rule validation
7. **No Cheating**: Bots have same information access as human players
8. **Live Simulation**: Real-time game state updates, proper turn sequences, authentic gameplay

## Modular Architecture for Community Development

### Simplified File Structure
```
packages/ai-iterative/
├── src/
│   ├── core/
│   │   ├── game-analyzer.ts         # Game state analysis utilities
│   │   ├── performance-tracker.ts   # Metrics collection and reporting
│   │   └── interfaces.ts            # Core type definitions
│   ├── strategies/
│   │   ├── baseline-strategy.ts     # Goal #1: Simple next-VP algorithm
│   │   ├── phase-aware-strategy.ts  # Goal #2: Basic phase detection
│   │   └── custom/                  # Community-contributed strategies
│   │       ├── aggressive-expansion.ts
│   │       ├── port-focused.ts
│   │       └── defensive-play.ts
│   ├── evaluators/
│   │   ├── next-vp-evaluator.ts     # Simple VP-gaining move evaluation
│   │   ├── resource-evaluator.ts    # Resource efficiency analysis
│   │   └── position-evaluator.ts    # Board position strength
│   ├── testing/
│   │   ├── test-runner.ts           # Automated game simulation
│   │   ├── metrics-calculator.ts    # Performance analysis
│   │   └── comparison-engine.ts     # Strategy A vs B testing
│   └── ai-coordinator.ts            # Main entry point
```

### User-Friendly Strategy Development
```typescript
// Example: Easy strategy creation for community contributors
interface SimpleStrategy {
  name: string
  description: string
  
  // Simple decision functions
  shouldBuildSettlement(gameState: GameState, playerId: PlayerId): boolean
  shouldBuildCity(gameState: GameState, playerId: PlayerId): boolean
  shouldBuyDevCard(gameState: GameState, playerId: PlayerId): boolean
  
  // Optional advanced functions
  evaluateTradeOffer?(offer: TradeOffer): number
  selectBestBuildingSpot?(options: BuildingSpot[]): BuildingSpot
}
```

## Success Metrics & Milestones

### Goal #1 Success (Baseline Establishment)
- [ ] **Game Completion**: 95%+ of games finish within 150 turns
- [ ] **Performance Measurement**: Automated testing system operational
- [ ] **Baseline Documentation**: 100-game performance profile established
- [ ] **Competitive Play**: Outperforms random decision making consistently
- [ ] **Engine Validation**: Proves game engine stability under AI load
- [ ] **Rule Compliance**: All AI actions validated through game engine rule system
- [ ] **Bug Discovery**: Testing reveals and helps fix game engine edge cases
- [ ] **Authentic Gameplay**: Bots play exactly like human players would (no cheating)

### Goal #2 Success (Phase-Based Improvement)
- [ ] **Turn Reduction**: 10-20% improvement in average game length
- [ ] **Strategy Differentiation**: Measurable differences between baseline and phase-aware AI
- [ ] **TO3 Optimization**: Faster path to 3rd victory point
- [ ] **Statistical Significance**: Results validated across 100+ game samples
- [ ] **Documentation**: Detailed comparison analysis completed

### Goal #3 Success (Iterative Enhancement)
- [ ] **Continuous Improvement**: Each iteration shows measurable gains
- [ ] **Community Readiness**: Simple interface for strategy contribution
- [ ] **Advanced Features**: MCTS, ports, trading successfully integrated
- [ ] **Commercial Viability**: AI quality suitable for customer-facing product
- [ ] **Learning Platform**: System generates insights for human strategy improvement

## Commercial Roadmap: "Catan Academy" - AI-Powered Strategy Platform

### Phase 1: Internal Development Tool
- Bot-vs-bot testing for our own strategy development
- Performance analytics and visualization
- Strategy comparison and iteration tracking

### Phase 2: Beta Testing Platform  
- Friends/community can test custom strategies
- Simple strategy creation interface
- Basic game statistics and analysis

### Phase 3: Commercial Product - "Catan for Stats Nerds"
**Target Market**: Competitive Catan players who want to improve through data

**Core Features**:
- **Hybrid Play**: Join games with bots, take control anytime
- **Strategy Sandbox**: Design and test custom bot strategies  
- **Performance Analytics**: Detailed statistics on play patterns
- **Learning Mode**: Watch optimal AI play with explanations
- **Community Hub**: Share strategies, compare results, tournaments

**Revenue Model**:
- Premium subscription for advanced analytics
- Strategy marketplace (user-created bots)
- Competitive tournaments with entry fees
- Educational content and coaching integration

### Phase 4: Advanced AI Platform
- Professional-grade AI opponents for training
- Integration with live tournament analysis
- Machine learning insights for meta-game evolution
- API for third-party tool integration

---

## Documentation Strategy

We will maintain comprehensive records throughout development:

### docs/ai-development/baseline-results.md
- Initial 100-game performance baseline
- Resource efficiency metrics
- Victory type distribution
- Turn count statistics
- Failure mode analysis

### docs/ai-development/iteration-log.md  
```markdown
## Iteration #1: Port Awareness Addition
**Date**: [Date]
**Change**: Added basic 2:1 port evaluation to setup strategies
**Hypothesis**: Better port utilization will improve resource efficiency
**Results**: 
- Average turns: 147 → 142 (3.4% improvement)
- Resource efficiency: +12% improvement
- Win rate vs baseline: 58% (statistically significant)
**Conclusion**: Keep change, port awareness valuable
**Next**: Test 3:1 port evaluation

## Iteration #2: MCTS for Complex Decisions
**Date**: [Date]  
**Change**: MCTS for settlement placement when >3 viable options
...
```

### docs/ai-development/strategy-comparison.md
- Head-to-head performance matrices
- Situational strategy effectiveness
- Player count impact analysis
- Meta-strategy emergence patterns

## Conclusion

This iterative, measurement-driven approach ensures we:

1. **Build a solid foundation** with measurable baseline performance
2. **Improve systematically** through data-driven iteration  
3. **Create commercial value** through AI-assisted strategy development
4. **Enable community contribution** with user-friendly interfaces
5. **Document our journey** for reproducibility and learning

The key insight is that **systematic improvement beats complex initial design**. By starting simple, measuring everything, and iterating based on data, we build both better AI and valuable commercial insights for the competitive Catan community. 