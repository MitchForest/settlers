# Comprehensive Game Design Document - Catan Clone

## 1. Game Overview

### Core Concept
- **Players**: 3-4 players
- **Objective**: First player to reach 10 Victory Points wins
- **Type**: Resource management and trading board game
- **Turn-based**: Players take turns in clockwise order

## 2. Game Components/Entities

### Board Components
1. **Terrain Hexes** (19 total):
   - 4 Forest hexes (produce Lumber)
   - 4 Pasture hexes (produce Wool)
   - 4 Fields hexes (produce Grain)
   - 3 Hills hexes (produce Brick)
   - 3 Mountains hexes (produce Ore)
   - 1 Desert hex (produces nothing)

2. **Frame Pieces** (6 pieces):
   - Form the border of the game board
   - Numbered 1-1, 2-2, etc. for assembly

3. **Number Tokens** (18 total):
   - One each: 2, 12
   - Two each: 3, 4, 5, 6, 8, 9, 10, 11
   - No 7 token (7 triggers robber movement)
   - Red numbers (6 and 8) are most frequently rolled

4. **Harbor Pieces** (9 total):
   - 4 Generic harbors (3:1 trade ratio)
   - 5 Special harbors (2:1 for specific resource):
     - 1 Brick harbor
     - 1 Grain harbor
     - 1 Lumber harbor
     - 1 Ore harbor
     - 1 Wool harbor

### Player Components (per player)
- **5 Settlements** (worth 1 VP each)
- **4 Cities** (worth 2 VP each)
- **15 Roads**
- **1 Building Costs Card** (reference)

### Cards
1. **Resource Cards** (95 total):
   - 19 Brick
   - 19 Grain
   - 19 Lumber
   - 19 Ore
   - 19 Wool

2. **Development Cards** (25 total):
   - 14 Knight cards
   - 6 Progress cards:
     - 2 Road Building
     - 2 Year of Plenty
     - 2 Monopoly
   - 5 Victory Point cards

3. **Special Cards** (2 total):
   - Longest Road (2 VP) - Requires 5+ continuous road segments
   - Largest Army (2 VP) - Requires 3+ played Knight cards

### Other Components
- **2 Dice** (standard six-sided)
- **1 Robber** piece

## 3. Board Setup

### Variable Setup Process
1. Assemble frame pieces by matching numbers
2. Shuffle terrain hexes face-down
3. Place terrain hexes randomly face-up in frame
4. Place number tokens alphabetically (A-R) starting from a corner, spiraling inward
5. Skip desert hex when placing number tokens
6. Place harbor pieces randomly around frame edges
7. Place robber on desert hex

### Fixed Beginner Setup
- Use predetermined layout as shown in game rules
- Specific arrangement of terrain and number tokens
- Fixed harbor positions

## 4. Game Setup Phase

### Player Setup (Two Rounds)
**Round 1** (Clockwise from starting player):
1. Each player places 1 settlement on an unoccupied intersection
2. Each player places 1 road adjacent to their settlement
3. Distance Rule applies (no settlements on adjacent intersections)

**Round 2** (Counter-clockwise from last player):
1. Each player places second settlement and adjacent road
2. Each player collects starting resources:
   - 1 resource card for each hex adjacent to second settlement

### Starting Player Determination
- All players roll dice
- Highest roll becomes starting player
- Starting player begins game after setup phase

## 5. Turn Structure

Each turn consists of three phases in order:

### Phase 1: Resource Production (Mandatory)
1. Roll both dice
2. Sum determines which hexes produce
3. All players with settlements/cities adjacent to producing hexes collect resources:
   - Settlement: 1 resource card per hex
   - City: 2 resource cards per hex
4. **Special Case - Rolling 7**:
   - No resources produced
   - All players with >7 cards discard half (round down)
   - Rolling player moves robber and steals 1 card

### Phase 2: Trading (Optional)
**Domestic Trade**:
- Active player may trade with other players
- Other players cannot trade with each other
- No restrictions on trade ratios
- Cannot give away cards for free
- Cannot trade identical resources

**Maritime Trade**:
- 4:1 - Trade 4 identical resources for 1 of choice (always available)
- 3:1 - At generic harbor (requires settlement/city)
- 2:1 - At special harbor for specific resource type only

### Phase 3: Building/Development (Optional)
Build any combination if resources available:
- **Road**: 1 Brick + 1 Lumber
- **Settlement**: 1 Brick + 1 Lumber + 1 Grain + 1 Wool
- **City**: 3 Ore + 2 Grain (upgrades existing settlement)
- **Development Card**: 1 Ore + 1 Wool + 1 Grain

## 6. Building Rules

### Roads
- Must connect to player's existing road, settlement, or city
- Only 1 road per path (edge between intersections)
- Can be built along coastline
- No victory points unless holding Longest Road

### Settlements
- Must be built on unoccupied intersection
- **Distance Rule**: No settlements on adjacent intersections
- Must connect to at least 1 of player's roads
- Worth 1 Victory Point
- Produces 1 resource per adjacent hex

### Cities
- Upgrades existing settlement (return settlement to supply)
- Worth 2 Victory Points
- Produces 2 resources per adjacent hex
- Limited to 4 per player

### Development Cards
- Draw from top of shuffled deck
- Keep hidden until played
- Can play 1 per turn (except Victory Point cards)
- Cannot play card bought same turn (except Victory Point cards)
- Never returned to deck after use

## 7. Development Card Types

### Knight Cards (14)
- Move robber to new hex
- Steal 1 resource from adjacent opponent
- Card stays face-up after playing
- 3+ knights = Largest Army (2 VP)

### Progress Cards (6)
**Road Building (2)**:
- Place 2 free roads immediately
- Follow normal road placement rules

**Year of Plenty (2)**:
- Take any 2 resource cards from bank
- Can use immediately

**Monopoly (2)**:
- Name 1 resource type
- All players give you all cards of that type

### Victory Point Cards (5)
- Keep hidden until winning
- Can play multiple on same turn
- Can play on turn purchased
- Worth 1 VP each

## 8. Special Mechanics

### The Robber
**Activation**:
- Rolling a 7
- Playing a Knight card

**Effects**:
- Blocks resource production on its hex
- Allows stealing 1 card from adjacent player
- Must be moved when activated
- Starts game on desert

### Resource Scarcity
- If bank cannot fulfill all production, no one gets that resource
- Exception: If only affects 1 player, they get remaining cards

### Breaking Roads
- Building settlement on opponent's road breaks continuity
- Can cause loss of Longest Road card

## 9. Victory Conditions

### Victory Points Sources
- Settlement: 1 VP each (max 5)
- City: 2 VP each (max 4)
- Longest Road card: 2 VP
- Largest Army card: 2 VP
- Victory Point development cards: 1 VP each

### Winning
- First to 10 VP on their turn wins
- Must be active player's turn to declare victory
- Can reveal hidden VP cards when winning

## 10. Important Rules Clarifications

### Distance Rule
- Settlements must be at least 2 intersections apart
- Applies to all players' settlements (including your own)
- Checked when building, not when upgrading to city

### Longest Road
- Minimum 5 continuous segments
- Only longest single branch counts
- Ties: Current holder keeps card
- Lost if road broken by opponent's settlement

### Largest Army
- Minimum 3 played Knight cards
- Immediate transfer when surpassed
- Knights stay visible after playing

### Trading Restrictions
- Only with active player
- No identical resource trades
- No free gifts
- Must involve active player in all trades

### Resource Production Roll Frequencies
- 2, 12: ~3% each (1 way to roll)
- 3, 11: ~6% each (2 ways to roll)
- 4, 10: ~8% each (3 ways to roll)
- 5, 9: ~11% each (4 ways to roll)
- 6, 8: ~14% each (5 ways to roll)
- 7: ~17% (6 ways to roll)

## 11. Game Flow Summary

1. **Setup Phase**: Place initial settlements and roads
2. **Main Game Loop**:
   - Roll dice for production
   - Execute robber if 7 rolled
   - Trade with players/bank
   - Build structures/buy cards
   - Play development card (optional, any time)
   - Check for victory
   - Pass dice clockwise
3. **End Game**: First to 10 VP wins

## 12. Edge Cases and Special Situations

- **Insufficient Resources**: If bank empty, production fails for all
- **Tied Longest Road**: Original holder keeps card
- **No Valid Robber Targets**: Still must move robber
- **Harbor Usage**: Can use on same turn as building
- **Development Card Limit**: Cannot buy if deck empty
- **Building Limit**: Cannot exceed piece limits (5 settlements, 4 cities, 15 roads)