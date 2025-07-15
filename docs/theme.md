# Themeability Implementation & Cap Table Theme Specification

## 1. Themeability Architecture Overview

### MVP Phase (Visual & Naming Only)
The initial implementation focuses on making all game text, imagery, and theming configurable without touching core mechanics.

### Future Phase (Full Mechanics)
Later iterations will allow complete customization of game rules, victory conditions, and mechanics.

## 2. Theme Configuration Structure

### Base Theme Interface
```typescript
interface GameTheme {
  meta: ThemeMeta;
  resources: ResourceTheme[];
  structures: StructureTheme;
  terrain: TerrainTheme[];
  cards: CardTheme;
  ui: UITheme;
  text: TextOverrides;
  assets: AssetPaths;
}
```

### Configuration File Structure
```
/themes
  /captable
    theme.json         # Main theme configuration
    /assets
      /icons          # Resource, structure icons
      /tiles          # Hex tile graphics
      /cards          # Card artwork
      /ui             # UI elements, backgrounds
    locale.json       # Text strings and descriptions
  /base             # Default Catan theme for reference
```

## 3. MVP Themeability Implementation

### 3.1 Resource Theming
```json
{
  "resources": [
    {
      "id": "resource_1",
      "name": "Code",
      "color": "#00D4FF",
      "icon": "code-icon.svg"
    },
    {
      "id": "resource_2", 
      "name": "Hardware",
      "color": "#FF6B6B",
      "icon": "hardware-icon.svg"
    },
    {
      "id": "resource_3",
      "name": "Talent",
      "color": "#4ECDC4",
      "icon": "talent-icon.svg"
    },
    {
      "id": "resource_4",
      "name": "Marketing",
      "color": "#FFE66D",
      "icon": "marketing-icon.svg"
    },
    {
      "id": "resource_5",
      "name": "Capital",
      "color": "#95E1D3",
      "icon": "capital-icon.svg"
    }
  ]
}
```

### 3.2 Structure Theming
```json
{
  "structures": {
    "settlement": {
      "name": "Seed PortCo",
      "plural": "Seed PortCos",
      "description": "Early-stage portfolio company",
      "icon": "seed-company.svg",
      "color": "#primary"
    },
    "city": {
      "name": "Unicorn",
      "plural": "Unicorns",
      "description": "Billion-dollar portfolio company",
      "icon": "unicorn.svg",
      "color": "#gold"
    },
    "road": {
      "name": "Expansion Route",
      "plural": "Expansion Routes",
      "description": "Strategic market expansion path",
      "icon": "expansion-route.svg"
    }
  }
}
```

### 3.3 Development Card Theming
```json
{
  "cards": {
    "knight": {
      "name": "Replace Board Member",
      "description": "Exercise your board influence to redirect regulatory attention",
      "action": "Move the SEC to a new location and steal resources",
      "icon": "board-member.svg"
    },
    "monopoly": {
      "name": "Market Correction",
      "description": "Consolidate the market by acquiring all of one resource type",
      "action": "Take all {resource} from other players",
      "icon": "market-correction.svg"
    },
    "year_of_plenty": {
      "name": "Grant Round",
      "description": "Secure government grants for your portfolio",
      "action": "Take any 2 resources from the bank",
      "icon": "grant-round.svg"
    },
    "road_building": {
      "name": "Expansion Strategy",
      "description": "Execute rapid market expansion",
      "action": "Place 2 free Expansion Routes",
      "icon": "expansion-strategy.svg"
    },
    "victory_point": {
      "name": "Industry Award",
      "description": "Recognition for innovation leadership",
      "value_text": "1 Exit Value",
      "icon": "industry-award.svg"
    }
  }
}
```

### 3.4 Special Mechanics Theming
```json
{
  "mechanics": {
    "robber": {
      "name": "SEC",
      "description": "Securities and Exchange Commission oversight",
      "action_text": "Regulatory scrutiny blocks resource production"
    },
    "longest_road": {
      "name": "Market Leader",
      "description": "Largest expansion network"
    },
    "largest_army": {
      "name": "Most Influential",
      "description": "Most board seats controlled"
    },
    "seven_rolled": {
      "event_name": "Regulatory Event",
      "description": "SEC investigation triggered"
    }
  }
}
```

### 3.5 UI Theme Configuration
```json
{
  "ui": {
    "colors": {
      "primary": "#1E3A8A",
      "secondary": "#3B82F6", 
      "accent": "#10B981",
      "background": "#0F172A",
      "surface": "#1E293B",
      "text": "#F8FAFC"
    },
    "fonts": {
      "heading": "Inter",
      "body": "Inter",
      "mono": "Fira Code"
    },
    "styles": {
      "theme": "modern-corporate",
      "animations": true,
      "particles": true
    }
  }
}
```

## 4. Cap Table Theme - Complete Specification

### 4.1 Theme Narrative
Players are venture capitalists competing to build the most valuable portfolio. They establish portfolio companies (Seed PortCos and Unicorns) and expansion routes. Resources represent: Code, Hardware, Talent, Marketing, and Capital.

### 4.2 Victory Conditions (Themed)
- **Victory Points**: Standard scoring system
- **10 Points**: Win condition
- **Seed PortCo**: 1 point
- **Unicorn**: 2 points
- **Market Leader**: 2 points (Longest Road equivalent)
- **Most Influential**: 2 points (Largest Army equivalent)
- **Industry Awards**: 1 point each (Victory Point cards)

### 4.3 Terrain to Resource Mapping
```json
{
  "terrain": [
    {
      "base": "forest",
      "produces": "Code",
      "color": "#00D4FF"
    },
    {
      "base": "mountains", 
      "produces": "Hardware",
      "color": "#FF6B6B"
    },
    {
      "base": "fields",
      "produces": "Talent",
      "color": "#4ECDC4"
    },
    {
      "base": "hills",
      "produces": "Marketing",
      "color": "#FFE66D"
    },
    {
      "base": "pasture",
      "produces": "Capital",
      "color": "#95E1D3"
    },
    {
      "base": "desert",
      "produces": "Nothing",
      "color": "#292524"
    }
  ]
}
```

### 4.4 Port Mapping
```json
{
  "ports": {
    "3:1": {
      "name": "General Port",
      "description": "3:1 trade ratio for any resource"
    },
    "2:1_code": {
      "name": "Code Port",
      "description": "2:1 trade ratio for Code"
    },
    "2:1_hardware": {
      "name": "Hardware Port",
      "description": "2:1 trade ratio for Hardware"
    },
    "2:1_talent": {
      "name": "Talent Port",
      "description": "2:1 trade ratio for Talent"
    },
    "2:1_marketing": {
      "name": "Marketing Port",
      "description": "2:1 trade ratio for Marketing"
    },
    "2:1_capital": {
      "name": "Capital Port",
      "description": "2:1 trade ratio for Capital"
    }
  }
}
```

### 4.5 Game Text Overrides
```json
{
  "text": {
    "game_name": "Cap Table",
    "currency": "resources",
    "turn_actions": {
      "roll": "Roll Dice",
      "build": "Build",
      "trade": "Trade"
    },
    "phases": {
      "setup": "Setup Phase",
      "main": "Main Game",
      "end": "Game End"
    },
    "messages": {
      "seven_rolled": "{player} triggered a regulatory event!",
      "resource_stolen": "{player} stole {resource}",
      "trade_offer": "{player} offers a trade",
      "building_placed": "{player} built a {structure}",
      "victory": "{player} wins with {points} points!"
    }
  }
}
```

### 4.6 Sound Theme
```json
{
  "sounds": {
    "dice_roll": "dice.mp3",
    "build_settlement": "build.mp3",
    "build_city": "upgrade.mp3", 
    "trade_complete": "trade.mp3",
    "seven_rolled": "alert.mp3",
    "victory": "victory.mp3"
  }
}
```

## 5. Implementation Plan

### Phase 1: MVP Theming (Visual Only)
1. Create theme loader that reads JSON configs
2. Build theme context provider for React
3. Replace all hardcoded strings with theme references
4. Create asset loading system for icons/graphics
5. Implement theme switcher in settings

### Phase 2: Extended Theming
1. Add custom victory conditions
2. Allow modified building costs
3. Support custom development cards
4. Enable altered resource production ratios

### Phase 3: Full Mechanical Customization  
1. Pluggable rule modules
2. Custom turn phases
3. New building types
4. Alternative victory paths
5. Modified dice mechanics

## 6. Theme Validation

### Required Theme Elements
```typescript
interface ThemeValidator {
  validateResources(): boolean;    // Exactly 5 resources
  validateStructures(): boolean;   // All structure types defined
  validateCards(): boolean;        // All card types present
  validateAssets(): boolean;       // All required assets exist
  validateColors(): boolean;       // Sufficient contrast
  validateText(): boolean;         // No missing translations
}
```

### Balance Checks (Future)
- Resource distribution ratios
- Trade ratio fairness
- Victory point balance
- Development card distribution

## 7. Example Usage

```typescript
// Load theme
const theme = await loadTheme('captable');

// Access themed content
const resourceName = theme.resources[0].name; // "Code"
const buildingAction = theme.text.turn_actions.build; // "Invest"

// Apply to UI
<ResourceCard 
  icon={theme.getAsset('resources.code.icon')}
  color={theme.resources[0].color}
  name={theme.resources[0].name}
/>
```

This architecture ensures clean separation between game mechanics and presentation, allowing for rich theming while maintaining game balance and extensibility.