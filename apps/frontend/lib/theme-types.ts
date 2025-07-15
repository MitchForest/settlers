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
  terrainAsset?: string // Path to terrain texture
  iconAsset?: string   // Path to custom icon SVG
}

export interface StructureTheme {
  settlement: {
    name: string
    plural: string
    description: string
    icon: string
    color: string
    iconAsset?: string
  }
  city: {
    name: string
    plural: string
    description: string
    icon: string
    color: string
    iconAsset?: string
  }
  road: {
    name: string
    plural: string
    description: string
    icon: string
    iconAsset?: string
  }
}

export interface DevelopmentCardTheme {
  name: string
  description: string
  action?: string
  value_text?: string
  icon: string
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
  developmentCards: Record<string, DevelopmentCardTheme>
  ui: {
    colors: UIColors
  }
  _assetBasePath?: string // Internal field added by theme loader
} 