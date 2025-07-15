// Theme loader - loads game themes with assets
// Structure: themes/[themeId]/config.json + themes/[themeId]/assets/

import { GameTheme, ResourceTheme, StructureTheme, ThemeMeta, DevelopmentCardTheme } from './theme-types'

export class ThemeLoader {
  private static instance: ThemeLoader
  private themeCache = new Map<string, GameTheme>()
  private assetCache = new Map<string, string>()

  static getInstance(): ThemeLoader {
    if (!ThemeLoader.instance) {
      ThemeLoader.instance = new ThemeLoader()
    }
    return ThemeLoader.instance
  }

  async loadTheme(themeId: string): Promise<GameTheme> {
    if (this.themeCache.has(themeId)) {
      return this.themeCache.get(themeId)!
    }

    try {
      const configUrl = `/themes/${themeId}/config.json`
      const response = await fetch(configUrl)
      
      if (!response.ok) {
        throw new Error(`Failed to load theme '${themeId}': ${response.statusText}`)
      }

      const themeConfig = await response.json()
      const enhancedTheme = await this.enhanceThemeWithAssets(themeId, themeConfig)
      
      this.themeCache.set(themeId, enhancedTheme)
      return enhancedTheme
    } catch (error) {
      console.error(`Failed to load theme '${themeId}':`, error)
      throw error
    }
  }

  private async enhanceThemeWithAssets(themeId: string, config: Record<string, unknown>): Promise<GameTheme> {
    const basePath = `/themes/${themeId}/assets`
    
    // Enhance resources with asset paths
    const enhancedResources = (config.resources as ResourceTheme[]).map((resource: ResourceTheme) => ({
      ...resource,
      terrainAsset: `${basePath}/terrain/${resource.id}.png`,
      iconAsset: (config.meta as ThemeMeta)?.useCustomIcons ? `${basePath}/icons/${resource.id}.svg` : undefined
    }))

    // Enhance structures with asset paths
    const structures = config.structures as Record<string, { icon?: string; [key: string]: unknown }>
    const enhancedStructures = Object.entries(structures).reduce((acc, [key, structure]) => {
      acc[key] = {
        ...structure,
        iconAsset: structure.icon ? `${basePath}/pieces/${structure.icon}` : undefined
      }
      return acc
    }, {} as Record<string, unknown>)

    // Enhance development cards with asset paths
    const developmentCards = config.developmentCards as Record<string, DevelopmentCardTheme & { art?: string }>
    const enhancedDevelopmentCards = Object.entries(developmentCards).reduce((acc, [key, card]) => {
      acc[key] = {
        ...card,
        iconAsset: card.icon ? `${basePath}/development-cards/${card.icon}` : undefined,
        artAsset: card.art ? `${basePath}/development-cards/${card.art}` : undefined
      }
      return acc
    }, {} as Record<string, DevelopmentCardTheme>)

    return {
      meta: config.meta,
      resources: enhancedResources,
      structures: enhancedStructures as unknown as StructureTheme,
      developmentCards: enhancedDevelopmentCards,
      ui: config.ui,
      _assetBasePath: basePath
    } as GameTheme
  }

  async preloadAssets(themeId: string): Promise<void> {
    const theme = await this.loadTheme(themeId)
    const preloadPromises: Promise<void>[] = []

    // Preload terrain assets
    theme.resources.forEach(resource => {
      if (resource.terrainAsset) {
        preloadPromises.push(this.preloadImage(resource.terrainAsset))
      }
      if (resource.iconAsset) {
        preloadPromises.push(this.preloadImage(resource.iconAsset))
      }
    })

    // Preload structure assets
    Object.values(theme.structures).forEach(structure => {
      if (structure.iconAsset) {
        preloadPromises.push(this.preloadImage(structure.iconAsset))
      }
    })

    // Preload development card assets
    Object.values(theme.developmentCards).forEach(card => {
      if (card.iconAsset) {
        preloadPromises.push(this.preloadImage(card.iconAsset))
      }
      if (card.artAsset) {
        preloadPromises.push(this.preloadImage(card.artAsset))
      }
    })

    await Promise.allSettled(preloadPromises)
  }

  private async preloadImage(url: string): Promise<void> {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        this.assetCache.set(url, url)
        resolve()
      }
      img.onerror = () => {
        console.warn(`Failed to preload image: ${url}`)
        resolve()
      }
      img.src = url
    })
  }

  async getAssetUrl(themeId: string, assetPath: string): Promise<string> {
    const fullUrl = `/themes/${themeId}/assets/${assetPath}`
    
    try {
      const response = await fetch(fullUrl, { method: 'HEAD' })
      if (response.ok) {
        return fullUrl
      }
    } catch {
      console.warn(`Asset not found: ${fullUrl}`)
    }
    
    return ''
  }

  clearCache(): void {
    this.themeCache.clear()
    this.assetCache.clear()
  }

  async assetExists(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { method: 'HEAD' })
      return response.ok
    } catch {
      return false
    }
  }
} 