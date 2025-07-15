// Theme system types based on theme.md specification

export interface ThemeMeta {
  id: string
  name: string
  description: string
  version: string
  author?: string
}

export interface ResourceTheme {
  id: string
  name: string
  color: string
  icon: string
}

export interface StructureTheme {
  settlement: {
    name: string
    plural: string
    description: string
    icon: string
    color: string
  }
  city: {
    name: string
    plural: string
    description: string
    icon: string
    color: string
  }
  road: {
    name: string
    plural: string
    description: string
    icon: string
  }
}

export interface TerrainTheme {
  base: string
  produces: string
  color: string
}

export interface UITheme {
  colors: {
    primary: string
    secondary: string
    accent: string
    background: string
    surface: string
    text: string
    // Game-specific background colors
    game_bg_primary: string
    game_bg_secondary: string
    game_bg_accent: string
    // Terrain colors
    terrain_1: string
    terrain_2: string
    terrain_3: string
    terrain_4: string
    terrain_5: string
    terrain_desert: string
  }
  fonts: {
    heading: string
    body: string
    mono: string
  }
  styles: {
    theme: string
    animations: boolean
    particles: boolean
  }
}

export interface CardTheme {
  knight: {
    name: string
    description: string
    action: string
    icon: string
  }
  monopoly: {
    name: string
    description: string
    action: string
    icon: string
  }
  year_of_plenty: {
    name: string
    description: string
    action: string
    icon: string
  }
  road_building: {
    name: string
    description: string
    action: string
    icon: string
  }
  victory_point: {
    name: string
    description: string
    value_text: string
    icon: string
  }
}

export interface TextOverrides {
  game_name: string
  currency: string
  turn_actions: {
    roll: string
    build: string
    trade: string
  }
  phases: {
    setup: string
    main: string
    end: string
  }
  messages: {
    seven_rolled: string
    resource_stolen: string
    trade_offer: string
    building_placed: string
    victory: string
  }
}

export interface AssetPaths {
  icons: Record<string, string>
  tiles: Record<string, string>
  cards: Record<string, string>
  ui: Record<string, string>
}

export interface GameTheme {
  meta: ThemeMeta
  resources: ResourceTheme[]
  structures: StructureTheme
  terrain: TerrainTheme[]
  cards: CardTheme
  ui: UITheme
  text: TextOverrides
  assets: AssetPaths
}

// Partial theme for loading/merging
export type PartialGameTheme = Partial<GameTheme> & {
  meta: ThemeMeta
} 