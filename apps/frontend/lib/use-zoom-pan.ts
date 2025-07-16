'use client'

import { useState, useCallback, useRef } from 'react'

export interface ViewBoxState {
  x: number      // Left edge
  y: number      // Top edge  
  width: number  // Visible width
  height: number // Visible height
}

export interface ZoomPanControls {
  viewBox: ViewBoxState
  zoom: number
  canZoomIn: boolean
  canZoomOut: boolean
  setZoom: (zoom: number) => void
  zoomIn: () => void
  zoomOut: () => void
  pan: (deltaX: number, deltaY: number) => void
  panTo: (x: number, y: number) => void
  reset: () => void
  getViewBoxString: () => string
}

// Alias for compatibility with new interaction system
export type ViewBoxControls = ZoomPanControls

interface UseZoomPanOptions {
  initialViewBox?: ViewBoxState
  minZoom?: number
  maxZoom?: number
  zoomStep?: number
  panBounds?: {
    minX: number
    maxX: number
    minY: number
    maxY: number
  }
}

const DEFAULT_VIEW_BOX: ViewBoxState = {
  x: -200,
  y: -200, 
  width: 400,
  height: 400
}

export function useZoomPan({
  initialViewBox = DEFAULT_VIEW_BOX,
  minZoom = 0.5,
  maxZoom = 3.0,
  zoomStep = 0.2,
  panBounds
}: UseZoomPanOptions = {}): ZoomPanControls {
  
  const [viewBox, setViewBox] = useState<ViewBoxState>(initialViewBox)
  const [zoom, setZoomLevel] = useState(1.0)
  const animationFrameRef = useRef<number | null>(null)
  
  // Calculate zoom bounds
  const canZoomIn = zoom < maxZoom
  const canZoomOut = zoom > minZoom

  const setZoom = useCallback((newZoom: number) => {
    const clampedZoom = Math.max(minZoom, Math.min(maxZoom, newZoom))
    setZoomLevel(clampedZoom)
    
    // Update viewBox based on zoom level
    // Zoom affects the visible area size, centered on current view
    const baseWidth = initialViewBox.width
    const baseHeight = initialViewBox.height
    const newWidth = baseWidth / clampedZoom
    const newHeight = baseHeight / clampedZoom
    
    setViewBox(prev => ({
      x: prev.x + (prev.width - newWidth) / 2,
      y: prev.y + (prev.height - newHeight) / 2,
      width: newWidth,
      height: newHeight
    }))
  }, [minZoom, maxZoom, initialViewBox])

  const zoomIn = useCallback(() => {
    if (canZoomIn) {
      setZoom(zoom + zoomStep)
    }
  }, [zoom, zoomStep, canZoomIn, setZoom])

  const zoomOut = useCallback(() => {
    if (canZoomOut) {
      setZoom(zoom - zoomStep)
    }
  }, [zoom, zoomStep, canZoomOut, setZoom])

  // Smooth, incremental panning with constraints
  const pan = useCallback((deltaX: number, deltaY: number) => {
    // Cancel any pending animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    // Use requestAnimationFrame for smooth updates
    animationFrameRef.current = requestAnimationFrame(() => {
      setViewBox(prev => {
        let newX = prev.x + deltaX
        let newY = prev.y + deltaY
        
        // Apply pan bounds if specified
        if (panBounds) {
          newX = Math.max(panBounds.minX, Math.min(panBounds.maxX - prev.width, newX))
          newY = Math.max(panBounds.minY, Math.min(panBounds.maxY - prev.height, newY))
        }
        
        return {
          ...prev,
          x: newX,
          y: newY
        }
      })
    })
  }, [panBounds])

  // Direct pan to specific coordinates
  const panTo = useCallback((x: number, y: number) => {
    // Cancel any pending animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      setViewBox(prev => {
        let newX = x - prev.width / 2
        let newY = y - prev.height / 2
        
        // Apply pan bounds if specified
        if (panBounds) {
          newX = Math.max(panBounds.minX, Math.min(panBounds.maxX - prev.width, newX))
          newY = Math.max(panBounds.minY, Math.min(panBounds.maxY - prev.height, newY))
        }
        
        return {
          ...prev,
          x: newX,
          y: newY
        }
      })
    })
  }, [panBounds])

  const reset = useCallback(() => {
    // Cancel any pending animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    setViewBox(initialViewBox)
    setZoomLevel(1.0)
  }, [initialViewBox])

  const getViewBoxString = useCallback(() => {
    return `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`
  }, [viewBox])

  return {
    viewBox,
    zoom,
    canZoomIn,
    canZoomOut,
    setZoom,
    zoomIn,
    zoomOut,
    pan,
    panTo,
    reset,
    getViewBoxString
  }
} 