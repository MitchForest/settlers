'use client'

import { useState, useCallback } from 'react'

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
  reset: () => void
  getViewBoxString: () => string
}

interface UseZoomPanOptions {
  initialViewBox?: ViewBoxState
  minZoom?: number
  maxZoom?: number
  zoomStep?: number
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
  zoomStep = 0.2
}: UseZoomPanOptions = {}): ZoomPanControls {
  
  const [viewBox, setViewBox] = useState<ViewBoxState>(initialViewBox)
  const [zoom, setZoomLevel] = useState(1.0)
  
  // Calculate zoom bounds
  const canZoomIn = zoom < maxZoom
  const canZoomOut = zoom > minZoom

  const setZoom = useCallback((newZoom: number) => {
    const clampedZoom = Math.min(Math.max(newZoom, minZoom), maxZoom)
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

  const pan = useCallback((deltaX: number, deltaY: number) => {
    setViewBox(prev => {
      // Calculate the center of the initial view box
      const centerX = initialViewBox.x + initialViewBox.width / 2
      const centerY = initialViewBox.y + initialViewBox.height / 2
      
      // Calculate 25% of the initial view box dimensions as max offset
      const maxOffsetX = initialViewBox.width * 0.25
      const maxOffsetY = initialViewBox.height * 0.25
      
      // Calculate new position
      const newX = prev.x + deltaX
      const newY = prev.y + deltaY
      
      // Calculate the center of the new view box
      const newCenterX = newX + prev.width / 2
      const newCenterY = newY + prev.height / 2
      
      // Calculate offset from original center
      const offsetX = newCenterX - centerX
      const offsetY = newCenterY - centerY
      
      // Clamp the offset to within 25% of the original view box size
      const clampedOffsetX = Math.min(Math.max(offsetX, -maxOffsetX), maxOffsetX)
      const clampedOffsetY = Math.min(Math.max(offsetY, -maxOffsetY), maxOffsetY)
      
      // Calculate the constrained position
      const constrainedX = centerX + clampedOffsetX - prev.width / 2
      const constrainedY = centerY + clampedOffsetY - prev.height / 2
      
      return {
        ...prev,
        x: constrainedX,
        y: constrainedY
      }
    })
  }, [initialViewBox])

  const reset = useCallback(() => {
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
    reset,
    getViewBoxString
  }
} 