// Theme system types for decoupled themeable Catan

export interface ThemeMeta {
  id: string
  name: string
  description: string
  version: string
  author?: string
  useCustomIcons?: boolean
}

export interface ResourceTheme {
  id: string
  name: string
  color: string
  icon: string
  // Asset paths (resolved by loader)
  hexAsset?: string       // Path to hex tile asset (PNG, SVG, etc.)
  iconAsset?: string      // Path to resource icon asset
}

export interface PlayerColor {
  id: string
  name: string
  primary: string
  secondary: string
  accent: string
}

export interface StructureTheme {
  settlement: {
    name: string
    plural: string
    description: string
    icon: string
    color: string
    asset?: string // Path to settlement asset for each player color
  }
  city: {
    name: string
    plural: string
    description: string
    icon: string
    color: string
    asset?: string // Path to city asset for each player color
  }
  road: {
    name: string
    plural: string
    description: string
    width?: number
    style?: string
    asset?: string // Path to road asset for each player color
  }
}

export interface DevelopmentCardTheme {
  name: string
  description: string
  action?: string
  icon: string
  color?: string
  iconAsset?: string
  artAsset?: string
}

export interface UIColors {
  primary: string
  secondary: string
  accent: string
  background: string
  surface: string
  text: string
}

export interface GameTheme {
  meta: ThemeMeta
  resources: ResourceTheme[]
  structures: StructureTheme
  players: {
    colors: PlayerColor[]
  }
  developmentCards: Record<string, DevelopmentCardTheme>
  ui: {
    colors: UIColors
  }
  _assetBasePath?: string
} 

// Asset resolution function type
export type AssetResolver = (assetPath: string, fallbackPath?: string) => Promise<string | null>

// Utility types for component props
export interface HexTileProps {
  terrain: string
  numberToken: number | null
  position: { x: number, y: number }
  theme: GameTheme | null
  assetResolver: AssetResolver | null
  isHovered?: boolean
  isSelected?: boolean
  isEmpty?: boolean
}

export interface GamePieceProps {
  type: 'settlement' | 'city' | 'road'
  playerId: string
  position: { x: number, y: number }
  theme: GameTheme | null
  assetResolver: AssetResolver | null
  rotation?: number // For roads
} 