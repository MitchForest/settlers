// Theme loader system - loads JSON themes and applies CSS custom properties

import { GameTheme, PartialGameTheme } from './theme-types'

export class ThemeLoader {
  private static instance: ThemeLoader
  private currentTheme: GameTheme | null = null
  private themeCache = new Map<string, GameTheme>()

  static getInstance(): ThemeLoader {
    if (!ThemeLoader.instance) {
      ThemeLoader.instance = new ThemeLoader()
    }
    return ThemeLoader.instance
  }

  /**
   * Load a theme by ID from the themes directory
   */
  async loadTheme(themeId: string = 'default'): Promise<GameTheme> {
    // Check cache first
    if (this.themeCache.has(themeId)) {
      const theme = this.themeCache.get(themeId)!
      this.currentTheme = theme
      this.applyCSSProperties(theme)
      return theme
    }

    try {
      // Load theme JSON
      const response = await fetch(`/themes/${themeId}.json`)
      if (!response.ok) {
        throw new Error(`Failed to load theme: ${themeId}`)
      }
      
      const themeData: PartialGameTheme = await response.json()
      
      // Merge with default theme if needed
      const theme = await this.mergeWithDefault(themeData)
      
      // Cache the theme
      this.themeCache.set(themeId, theme)
      
      // Apply CSS properties
      this.applyCSSProperties(theme)
      
      this.currentTheme = theme
      return theme
    } catch (error) {
      console.warn(`Failed to load theme ${themeId}, falling back to default:`, error)
      
      // Fallback to default if not already trying default
      if (themeId !== 'default') {
        return this.loadTheme('default')
      }
      
      // If default also fails, create minimal theme
      return this.createFallbackTheme()
    }
  }

  /**
   * Get the currently loaded theme
   */
  getCurrentTheme(): GameTheme | null {
    return this.currentTheme
  }

  /**
   * Apply theme colors to CSS custom properties
   */
  private applyCSSProperties(theme: GameTheme): void {
    const root = document.documentElement
    const colors = theme.ui.colors

    // Apply all theme colors as CSS custom properties
    Object.entries(colors).forEach(([key, value]) => {
      const cssVar = `--color-${key.replace(/_/g, '-')}`
      root.style.setProperty(cssVar, value)
    })

    // Apply terrain colors specifically
    theme.terrain.forEach((terrain) => {
      const terrainKey = terrain.base
      const cssVar = `--color-${terrainKey}`
      root.style.setProperty(cssVar, terrain.color)
    })

    // Apply fonts
    root.style.setProperty('--font-heading', theme.ui.fonts.heading)
    root.style.setProperty('--font-body', theme.ui.fonts.body)
    root.style.setProperty('--font-mono', theme.ui.fonts.mono)
  }

  /**
   * Merge partial theme with default theme
   */
  private async mergeWithDefault(partialTheme: PartialGameTheme): Promise<GameTheme> {
    // If this is already the default theme, just validate and return
    if (partialTheme.meta.id === 'default') {
      return this.validateTheme(partialTheme as GameTheme)
    }

    // Load default theme for merging
    const defaultTheme = await this.loadDefaultTheme()
    
    // Deep merge the themes
    const mergedTheme: GameTheme = {
      meta: partialTheme.meta,
      resources: partialTheme.resources || defaultTheme.resources,
      structures: partialTheme.structures || defaultTheme.structures,
      terrain: partialTheme.terrain || defaultTheme.terrain,
      cards: partialTheme.cards || defaultTheme.cards,
      ui: {
        colors: { ...defaultTheme.ui.colors, ...partialTheme.ui?.colors },
        fonts: { ...defaultTheme.ui.fonts, ...partialTheme.ui?.fonts },
        styles: { ...defaultTheme.ui.styles, ...partialTheme.ui?.styles }
      },
      text: { 
        ...defaultTheme.text, 
        ...partialTheme.text,
        turn_actions: { ...defaultTheme.text.turn_actions, ...partialTheme.text?.turn_actions },
        phases: { ...defaultTheme.text.phases, ...partialTheme.text?.phases },
        messages: { ...defaultTheme.text.messages, ...partialTheme.text?.messages }
      },
      assets: { ...defaultTheme.assets, ...partialTheme.assets }
    }

    return this.validateTheme(mergedTheme)
  }

  /**
   * Load the default theme
   */
  private async loadDefaultTheme(): Promise<GameTheme> {
    // Fetch default theme from public directory
    const response = await fetch('/themes/default.json')
    if (!response.ok) {
      throw new Error('Failed to load default theme')
    }
    const themeData = await response.json()
    return themeData as GameTheme
  }

  /**
   * Validate theme structure
   */
  private validateTheme(theme: GameTheme): GameTheme {
    // Basic validation - ensure required fields exist
    if (!theme.meta || !theme.ui || !theme.resources) {
      throw new Error('Invalid theme structure')
    }

    // Ensure we have exactly 5 resources
    if (theme.resources.length !== 5) {
      console.warn('Theme should have exactly 5 resources')
    }

    return theme
  }

  /**
   * Create minimal fallback theme if all loading fails
   */
  private createFallbackTheme(): GameTheme {
    return {
      meta: {
        id: 'fallback',
        name: 'Fallback Theme',
        description: 'Emergency fallback theme',
        version: '1.0.0'
      },
      resources: [
        { id: 'resource1', name: 'Resource 1', color: '#8B5CF6', icon: '🟪' },
        { id: 'resource2', name: 'Resource 2', color: '#84CC16', icon: '🟢' },
        { id: 'resource3', name: 'Resource 3', color: '#16A34A', icon: '🟩' },
        { id: 'resource4', name: 'Resource 4', color: '#EAB308', icon: '🟨' },
        { id: 'resource5', name: 'Resource 5', color: '#DC2626', icon: '🟥' }
      ],
      structures: {
        settlement: { name: 'Settlement', plural: 'Settlements', description: '', icon: '', color: '#primary' },
        city: { name: 'City', plural: 'Cities', description: '', icon: '', color: '#gold' },
        road: { name: 'Road', plural: 'Roads', description: '', icon: '' }
      },
      terrain: [
        { base: 'terrain1', produces: 'Resource 1', color: '#8B5CF6' },
        { base: 'terrain2', produces: 'Resource 2', color: '#84CC16' },
        { base: 'terrain3', produces: 'Resource 3', color: '#16A34A' },
        { base: 'terrain4', produces: 'Resource 4', color: '#EAB308' },
        { base: 'terrain5', produces: 'Resource 5', color: '#DC2626' },
        { base: 'desert', produces: 'Nothing', color: '#D2B48C' }
      ],
      cards: {
        knight: { name: 'Knight', description: '', action: '', icon: '' },
        monopoly: { name: 'Monopoly', description: '', action: '', icon: '' },
        year_of_plenty: { name: 'Year of Plenty', description: '', action: '', icon: '' },
        road_building: { name: 'Road Building', description: '', action: '', icon: '' },
        victory_point: { name: 'Victory Point', description: '', value_text: '1 VP', icon: '' }
      },
      ui: {
        colors: {
          primary: '#2563EB',
          secondary: '#3B82F6',
          accent: '#10B981',
          background: '#F5F4ED',
          surface: '#FFFFFF',
          text: '#1A1A1A',
          game_bg_primary: '#1e3a8a',
          game_bg_secondary: '#3730a3',
          game_bg_accent: '#065f46',
          terrain_1: '#8B5CF6',
          terrain_2: '#84CC16',
          terrain_3: '#16A34A',
          terrain_4: '#EAB308',
          terrain_5: '#DC2626',
          terrain_desert: '#D2B48C'
        },
        fonts: { heading: 'Inter', body: 'Inter', mono: 'monospace' },
        styles: { theme: 'minimal', animations: false, particles: false }
      },
      text: {
        game_name: 'Game',
        currency: 'resources',
        turn_actions: { roll: 'Roll', build: 'Build', trade: 'Trade' },
        phases: { setup: 'Setup', main: 'Main', end: 'End' },
        messages: {
          seven_rolled: '{player} rolled a 7!',
          resource_stolen: '{player} stole {resource}',
          trade_offer: '{player} offers a trade',
          building_placed: '{player} built a {structure}',
          victory: '{player} wins!'
        }
      },
      assets: { icons: {}, tiles: {}, cards: {}, ui: {} }
    }
  }
} 