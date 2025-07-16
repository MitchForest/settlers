'use client'

import { useState, useEffect, useRef, useCallback, RefObject } from 'react'

interface PanZoomState {
  x: number      // Pan X offset in pixels
  y: number      // Pan Y offset in pixels  
  scale: number  // Zoom scale (1.0 = 100%)
}

interface PanZoomControls {
  transform: string          // CSS transform string
  isDragging: boolean       // Current drag state
  reset: () => void         // Reset to center
  zoomIn: () => void        // Zoom in by step
  zoomOut: () => void       // Zoom out by step
  canZoomIn: boolean        // Can zoom in more
  canZoomOut: boolean       // Can zoom out more
}

interface UseSimplePanZoomOptions {
  minScale?: number    // Default: 0.5
  maxScale?: number    // Default: 2.0
  zoomStep?: number    // Default: 0.2
}

export function useSimplePanZoom(
  containerRef: RefObject<HTMLElement | null>,
  options: UseSimplePanZoomOptions = {}
): PanZoomControls {
  const {
    minScale = 0.5,
    maxScale = 2.0,
    zoomStep = 0.1  // Reduced from 0.2 to 0.1 for smoother button controls
  } = options

  // Simple state - just x, y, scale
  const [state, setState] = useState<PanZoomState>({ x: 0, y: 0, scale: 1 })
  const [isDragging, setIsDragging] = useState(false)
  
  // Refs for tracking drag state
  const dragStart = useRef<{ x: number; y: number } | null>(null)
  const lastPan = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  // Calculate zoom bounds
  const canZoomIn = state.scale < maxScale
  const canZoomOut = state.scale > minScale

  // Mouse event handlers
  const handleMouseDown = useCallback((e: MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    dragStart.current = { x: e.clientX, y: e.clientY }
    lastPan.current = { x: state.x, y: state.y }
  }, [state.x, state.y])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !dragStart.current) return

    // Calculate delta from drag start
    const deltaX = e.clientX - dragStart.current.x
    const deltaY = e.clientY - dragStart.current.y

    // Update position directly - no throttling for immediate response
    setState(prev => ({
      ...prev,
      x: lastPan.current.x + deltaX,
      y: lastPan.current.y + deltaY
    }))
  }, [isDragging])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    dragStart.current = null
  }, [])

  // Wheel zoom handler with much better sensitivity
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    
    const container = containerRef.current
    if (!container) return

    // Get mouse position relative to container
    const rect = container.getBoundingClientRect()
    const mouseX = e.clientX - rect.left - rect.width / 2
    const mouseY = e.clientY - rect.top - rect.height / 2

    // Much more sensitive zoom calculation
    // Use deltaY directly but scale it down significantly
    const sensitivity = 0.01 // Good middle ground - 10x more sensitive than before
    const zoomFactor = 1 + (e.deltaY * -sensitivity) // Invert deltaY, small increments
    const newScale = Math.max(minScale, Math.min(maxScale, state.scale * zoomFactor))
    
    if (Math.abs(newScale - state.scale) < 0.001) return // Ignore tiny changes

    // Calculate zoom factor for positioning
    const scaleFactor = newScale / state.scale

    // Zoom toward mouse cursor
    setState(prev => ({
      x: prev.x - mouseX * (scaleFactor - 1),
      y: prev.y - mouseY * (scaleFactor - 1),
      scale: newScale
    }))
  }, [state.scale, minScale, maxScale, containerRef])

  // Touch event handlers for mobile
  const lastTouchDistance = useRef<number | null>(null)
  const lastTouchCenter = useRef<{ x: number; y: number } | null>(null)

  const getTouchDistance = (touches: TouchList) => {
    if (touches.length < 2) return null
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  const getTouchCenter = (touches: TouchList) => {
    if (touches.length === 1) {
      return { x: touches[0].clientX, y: touches[0].clientY }
    } else if (touches.length === 2) {
      return {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2
      }
    }
    return null
  }

  const handleTouchStart = useCallback((e: TouchEvent) => {
    e.preventDefault()
    
    if (e.touches.length === 1) {
      // Single touch - start pan
      setIsDragging(true)
      const touch = e.touches[0]
      dragStart.current = { x: touch.clientX, y: touch.clientY }
      lastPan.current = { x: state.x, y: state.y }
    } else if (e.touches.length === 2) {
      // Two touches - start pinch zoom
      setIsDragging(false)
      lastTouchDistance.current = getTouchDistance(e.touches)
      lastTouchCenter.current = getTouchCenter(e.touches)
    }
  }, [state.x, state.y])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    e.preventDefault()

    if (e.touches.length === 1 && isDragging && dragStart.current) {
      // Single touch pan
      const touch = e.touches[0]
      const deltaX = touch.clientX - dragStart.current.x
      const deltaY = touch.clientY - dragStart.current.y

      setState(prev => ({
        ...prev,
        x: lastPan.current.x + deltaX,
        y: lastPan.current.y + deltaY
      }))
    } else if (e.touches.length === 2 && lastTouchDistance.current && lastTouchCenter.current) {
      // Pinch zoom
      const newDistance = getTouchDistance(e.touches)
      const newCenter = getTouchCenter(e.touches)
      
      if (newDistance && newCenter) {
        // Calculate scale change
        const scaleChange = newDistance / lastTouchDistance.current
        const newScale = Math.max(minScale, Math.min(maxScale, state.scale * scaleChange))
        
        // Calculate center offset for zoom
        const container = containerRef.current
        if (container) {
          const rect = container.getBoundingClientRect()
          const centerX = newCenter.x - rect.left - rect.width / 2
          const centerY = newCenter.y - rect.top - rect.height / 2
          
          setState(prev => ({
            x: prev.x - centerX * (newScale / prev.scale - 1),
            y: prev.y - centerY * (newScale / prev.scale - 1),
            scale: newScale
          }))
        }

        lastTouchDistance.current = newDistance
        lastTouchCenter.current = newCenter
      }
    }
  }, [isDragging, state.scale, minScale, maxScale, containerRef])

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false)
    dragStart.current = null
    lastTouchDistance.current = null
    lastTouchCenter.current = null
  }, [])

  // Set up event listeners
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Add event listeners directly to avoid React synthetic event issues
    container.addEventListener('mousedown', handleMouseDown, { passive: false })
    container.addEventListener('wheel', handleWheel, { passive: false })
    container.addEventListener('touchstart', handleTouchStart, { passive: false })
    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    container.addEventListener('touchend', handleTouchEnd, { passive: false })

    // Global listeners for mouse events (to handle dragging outside container)
    document.addEventListener('mousemove', handleMouseMove, { passive: false })
    document.addEventListener('mouseup', handleMouseUp, { passive: false })

    return () => {
      // Cleanup
      container.removeEventListener('mousedown', handleMouseDown)
      container.removeEventListener('wheel', handleWheel)
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
      
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseDown, handleMouseMove, handleMouseUp, handleWheel, handleTouchStart, handleTouchMove, handleTouchEnd, containerRef])

  // Control functions
  const reset = useCallback(() => {
    setState({ x: 0, y: 0, scale: 1 })
  }, [])

  const zoomIn = useCallback(() => {
    if (canZoomIn) {
      setState(prev => ({ ...prev, scale: Math.min(maxScale, prev.scale + zoomStep) }))
    }
  }, [canZoomIn, maxScale, zoomStep])

  const zoomOut = useCallback(() => {
    if (canZoomOut) {
      setState(prev => ({ ...prev, scale: Math.max(minScale, prev.scale - zoomStep) }))
    }
  }, [canZoomOut, minScale, zoomStep])

  // Generate CSS transform string
  const transform = `translate(${state.x}px, ${state.y}px) scale(${state.scale})`

  return {
    transform,
    isDragging,
    reset,
    zoomIn,
    zoomOut,
    canZoomIn,
    canZoomOut
  }
} 