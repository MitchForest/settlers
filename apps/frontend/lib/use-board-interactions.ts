'use client'

import { useCallback, useRef } from 'react'
import { ZoomPanControls } from './use-zoom-pan'

interface UseBoardInteractionsOptions {
  controls: ZoomPanControls
  zoomSensitivity?: number
  panSensitivity?: number
  shouldAllowPan?: (event: React.MouseEvent) => boolean
}

export function useBoardInteractions({
  controls,
  zoomSensitivity = 0.001,
  panSensitivity = 1.0,
  shouldAllowPan
}: UseBoardInteractionsOptions) {
  
  const isDragging = useRef(false)
  const lastMousePos = useRef({ x: 0, y: 0 })
  
  // Handle wheel zoom
  const handleWheel = useCallback((event: React.WheelEvent) => {
    event.preventDefault()
    
    const delta = -event.deltaY * zoomSensitivity
    const newZoom = controls.zoom + delta
    controls.setZoom(newZoom)
  }, [controls, zoomSensitivity])
  
  // Handle mouse down for drag start
  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    // Only start drag on left mouse button
    if (event.button === 0) {
      // Check if panning should be allowed for this target
      if (shouldAllowPan && !shouldAllowPan(event)) {
        return
      }
      
      isDragging.current = true
      lastMousePos.current = { x: event.clientX, y: event.clientY }
      event.preventDefault()
    }
  }, [shouldAllowPan])
  
  // Handle mouse move for dragging
  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (!isDragging.current) return
    
    const deltaX = (event.clientX - lastMousePos.current.x) * panSensitivity
    const deltaY = (event.clientY - lastMousePos.current.y) * panSensitivity
    
    // Convert screen delta to viewBox delta (invert because moving mouse right should pan left)
    const viewBoxDeltaX = -deltaX * (controls.viewBox.width / 800) // Assume ~800px width
    const viewBoxDeltaY = -deltaY * (controls.viewBox.height / 800)
    
    controls.pan(viewBoxDeltaX, viewBoxDeltaY)
    
    lastMousePos.current = { x: event.clientX, y: event.clientY }
  }, [controls, panSensitivity])
  
  // Handle mouse up for drag end
  const handleMouseUp = useCallback(() => {
    isDragging.current = false
  }, [])
  
  // Handle mouse leave for drag end
  const handleMouseLeave = useCallback(() => {
    isDragging.current = false
  }, [])
  
  return {
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    isDragging: isDragging.current
  }
} 