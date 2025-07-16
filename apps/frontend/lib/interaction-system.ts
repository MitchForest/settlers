'use client'

import { useCallback, useRef, useState, useEffect } from 'react'
import { useGameStore } from '@/stores/gameStore'

// Unified interaction modes
type InteractionMode = 'idle' | 'panning' | 'hex_selecting' | 'piece_placing'

// Unified interaction state
interface InteractionState {
  // Core interaction mode
  mode: InteractionMode
  
  // Pan/zoom state
  panStart: { x: number; y: number } | null
  panCurrent: { x: number; y: number } | null
  
  // Hex interaction state (unified with store)
  hoveredHexId: string | null
  selectedHexId: string | null
  
  // Touch/gesture state
  touchStart: { distance: number; center: { x: number; y: number } } | null
}

// Zoom/pan controls interface
export interface ViewBoxControls {
  viewBox: { x: number; y: number; width: number; height: number }
  zoom: number
  pan: (deltaX: number, deltaY: number) => void
  setZoom: (zoom: number) => void
  reset: () => void
  getViewBoxString: () => string
}

// Unified interaction system options
interface InteractionSystemOptions {
  viewBoxControls: ViewBoxControls
  containerRef: React.RefObject<HTMLDivElement | null>
  onHexHover?: (hexId: string | null) => void
  onHexSelect?: (hexId: string | null) => void
  panThreshold?: number
  zoomSensitivity?: number
}

/**
 * Unified Interaction System
 * 
 * This is the SINGLE source of truth for all board interactions:
 * - Hex hover/selection (synced with game store)
 * - Pan/zoom viewport controls
 * - Touch/gesture support
 * - Mode-aware interaction handling
 */
export function useInteractionSystem({
  viewBoxControls,
  containerRef,
  onHexHover,
  onHexSelect,
  panThreshold = 5,
  zoomSensitivity = 0.001
}: InteractionSystemOptions) {
  
  // Get game state and store updaters
  const gameState = useGameStore(state => state.gameState)
  const placementMode = useGameStore(state => state.placementMode)
  const updateHoveredHex = useGameStore(state => state.setHoveredHex)
  const updateSelectedHex = useGameStore(state => state.setSelectedHex)
  
  // Local interaction state (separate from game state)
  const [state, setState] = useState<InteractionState>({
    mode: 'idle',
    panStart: null,
    panCurrent: null,
    hoveredHexId: null,
    selectedHexId: null,
    touchStart: null
  })
  
  // Animation frame management
  const frameRef = useRef<number | null>(null)
  
  // Utility: Calculate distance between points
  const getDistance = useCallback((p1: { x: number; y: number }, p2: { x: number; y: number }) => {
    const dx = p1.x - p2.x
    const dy = p1.y - p2.y
    return Math.sqrt(dx * dx + dy * dy)
  }, [])
  
  // Utility: Cancel pending animation frame
  const cancelFrame = useCallback(() => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
  }, [])
  
  // === HEX INTERACTION HANDLERS ===
  
  const handleHexHover = useCallback((hexId: string | null) => {
    // Update both local state and game store
    setState(prev => ({ ...prev, hoveredHexId: hexId }))
    updateHoveredHex(hexId)
    onHexHover?.(hexId)
  }, [updateHoveredHex, onHexHover])
  
  const handleHexSelect = useCallback((hexId: string | null) => {
    // Only allow selection in appropriate modes
    if (state.mode === 'panning') return
    
    // Update both local state and game store
    setState(prev => ({ ...prev, selectedHexId: hexId }))
    updateSelectedHex(hexId)
    onHexSelect?.(hexId)
  }, [state.mode, updateSelectedHex, onHexSelect])
  
  // === VIEWPORT INTERACTION HANDLERS ===
  
  const handleWheel = useCallback((event: WheelEvent) => {
    event.preventDefault()
    const zoomDelta = -event.deltaY * zoomSensitivity
    const newZoom = viewBoxControls.zoom + zoomDelta
    viewBoxControls.setZoom(newZoom)
  }, [viewBoxControls, zoomSensitivity])
  
  const handleMouseDown = useCallback((event: MouseEvent) => {
    if (event.button !== 0) return // Only left mouse button
    
    const startPos = { x: event.clientX, y: event.clientY }
    setState(prev => ({
      ...prev,
      mode: 'idle', // Will transition to panning if moved
      panStart: startPos,
      panCurrent: startPos
    }))
  }, [])
  
  const handleMouseMove = useCallback((event: MouseEvent) => {
    const currentPos = { x: event.clientX, y: event.clientY }
    
    setState(prev => ({ ...prev, panCurrent: currentPos }))
    
    if (state.mode === 'panning' && state.panStart) {
      // Smooth panning with animation frame
      cancelFrame()
      frameRef.current = requestAnimationFrame(() => {
        const deltaX = currentPos.x - state.panStart!.x
        const deltaY = currentPos.y - state.panStart!.y
        
        // Convert to viewBox coordinates
        const rect = containerRef.current?.getBoundingClientRect()
        if (rect) {
          const scaleX = viewBoxControls.viewBox.width / rect.width
          const scaleY = viewBoxControls.viewBox.height / rect.height
          const viewBoxDeltaX = -deltaX * scaleX
          const viewBoxDeltaY = -deltaY * scaleY
          
          viewBoxControls.pan(viewBoxDeltaX, viewBoxDeltaY)
          
          // Update pan start for incremental movement
          setState(prev => ({ ...prev, panStart: currentPos }))
        }
      })
    } else if (state.mode === 'idle' && state.panStart) {
      // Check if we should transition to panning
      const distance = getDistance(currentPos, state.panStart)
      if (distance > panThreshold) {
        setState(prev => ({ ...prev, mode: 'panning' }))
      }
    }
  }, [state, viewBoxControls, containerRef, panThreshold, getDistance, cancelFrame])
  
  const handleMouseUp = useCallback(() => {
    cancelFrame()
    setState(prev => ({
      ...prev,
      mode: 'idle',
      panStart: null,
      panCurrent: null
    }))
  }, [cancelFrame])
  
  // === TOUCH/GESTURE HANDLERS ===
  
  const handleTouchStart = useCallback((event: TouchEvent) => {
    if (event.touches.length === 2) {
      // Two-finger pinch/zoom
      const touch1 = event.touches[0]
      const touch2 = event.touches[1]
      const distance = getDistance(
        { x: touch1.clientX, y: touch1.clientY },
        { x: touch2.clientX, y: touch2.clientY }
      )
      const center = {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2
      }
      
      setState(prev => ({
        ...prev,
        touchStart: { distance, center }
      }))
    } else if (event.touches.length === 1) {
      // Single finger - treat like mouse
      const touch = event.touches[0]
      handleMouseDown({ button: 0, clientX: touch.clientX, clientY: touch.clientY } as MouseEvent)
    }
  }, [getDistance, handleMouseDown])
  
  const handleTouchMove = useCallback((event: TouchEvent) => {
    if (event.touches.length === 2 && state.touchStart) {
      // Pinch zoom
      const touch1 = event.touches[0]
      const touch2 = event.touches[1]
      const distance = getDistance(
        { x: touch1.clientX, y: touch1.clientY },
        { x: touch2.clientX, y: touch2.clientY }
      )
      
      const zoomDelta = (distance - state.touchStart.distance) * 0.01
      const newZoom = viewBoxControls.zoom + zoomDelta
      viewBoxControls.setZoom(newZoom)
      
      setState(prev => ({
        ...prev,
        touchStart: prev.touchStart ? { ...prev.touchStart, distance } : null
      }))
    } else if (event.touches.length === 1) {
      // Single finger - treat like mouse
      const touch = event.touches[0]
      handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY } as MouseEvent)
    }
  }, [state.touchStart, getDistance, viewBoxControls, handleMouseMove])
  
  const handleTouchEnd = useCallback(() => {
    setState(prev => ({ ...prev, touchStart: null }))
    handleMouseUp()
  }, [handleMouseUp])
  
  // === EVENT LISTENER SETUP ===
  
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    
    // Container-specific events
    container.addEventListener('wheel', handleWheel, { passive: false })
    container.addEventListener('mousedown', handleMouseDown)
    container.addEventListener('touchstart', handleTouchStart)
    
    // Global events (prevents sticky interactions)
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('touchmove', handleTouchMove)
    document.addEventListener('touchend', handleTouchEnd)
    
    return () => {
      // Cleanup
      container.removeEventListener('wheel', handleWheel)
      container.removeEventListener('mousedown', handleMouseDown)
      container.removeEventListener('touchstart', handleTouchStart)
      
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
      
      cancelFrame()
    }
  }, [
    handleWheel, handleMouseDown, handleMouseMove, handleMouseUp,
    handleTouchStart, handleTouchMove, handleTouchEnd, cancelFrame
  ])
  
  // === DERIVED STATE ===
  
  const isPanning = state.mode === 'panning'
  const isPlacing = placementMode !== 'none'
  
  // Get current hover/selection from game store (single source of truth)
  const storeHoveredHex = useGameStore(state => state.hoveredHex)
  const storeSelectedHex = useGameStore(state => state.selectedHex)
  
  return {
    // Container ref for event attachment
    containerRef,
    
    // Interaction state
    isPanning,
    isPlacing,
    hoveredHexId: storeHoveredHex,
    selectedHexId: storeSelectedHex,
    
    // Hex interaction handlers (for direct HexTile usage)
    onHexHover: handleHexHover,
    onHexSelect: handleHexSelect,
    
    // Utility methods
    reset: () => {
      setState({
        mode: 'idle',
        panStart: null,
        panCurrent: null,
        hoveredHexId: null,
        selectedHexId: null,
        touchStart: null
      })
      viewBoxControls.reset()
    }
  }
} 