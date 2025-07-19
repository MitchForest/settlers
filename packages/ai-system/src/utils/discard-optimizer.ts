import { ResourceCards } from '@settlers/game-engine'
import { ResourceAnalyzer } from './resource-analyzer'

export class DiscardOptimizer {
  optimize(resources: ResourceCards, discardCount: number): ResourceCards {
    const discardResources: ResourceCards = { wood: 0, brick: 0, ore: 0, wheat: 0, sheep: 0 }
    const resourceTypes = ['wood', 'brick', 'ore', 'wheat', 'sheep'] as const
    
    // Calculate building needs and strategic priorities
    const buildingNeeds = ResourceAnalyzer.calculateBuildingNeeds(resources)
    const strategicValue = ResourceAnalyzer.calculateStrategicValue()
    
    // Create priority-based discard order
    const discardPriority = resourceTypes
      .map(type => ({
        type,
        count: resources[type] || 0,
        need: buildingNeeds[type] || 0,
        strategicValue: strategicValue[type] || 1,
        surplus: Math.max(0, (resources[type] || 0) - (buildingNeeds[type] || 0))
      }))
      .filter(item => item.count > 0)
      .sort((a, b) => {
        if (a.surplus !== b.surplus) return b.surplus - a.surplus
        if (a.strategicValue !== b.strategicValue) return a.strategicValue - b.strategicValue
        if (a.need !== b.need) return a.need - b.need
        return b.count - a.count
      })
    
    // Execute discard strategy
    let remaining = discardCount
    for (const item of discardPriority) {
      if (remaining <= 0) break
      
      const maxDiscard = Math.min(remaining, item.count)
      const keepForBuilding = Math.min(item.count, item.need)
      const optimalDiscard = Math.min(maxDiscard, Math.max(0, item.count - keepForBuilding))
      
      if (optimalDiscard > 0) {
        discardResources[item.type] = optimalDiscard
        remaining -= optimalDiscard
      }
    }
    
    // Fallback: discard from most abundant
    if (remaining > 0) {
      for (const item of discardPriority) {
        if (remaining <= 0) break
        
        const currentDiscard = discardResources[item.type]
        const availableToDiscard = item.count - currentDiscard
        const additionalDiscard = Math.min(remaining, availableToDiscard)
        
        if (additionalDiscard > 0) {
          discardResources[item.type] += additionalDiscard
          remaining -= additionalDiscard
        }
      }
    }
    
    return discardResources
  }
} 