'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PanZoomControls } from '@/lib/use-simple-pan-zoom'
import { Plus, Minus, RotateCcw } from 'lucide-react'

interface ZoomPanControlsUIProps {
  controls: PanZoomControls
  className?: string
}

export function ZoomPanControlsUI({ controls, className = '' }: ZoomPanControlsUIProps) {
  const { canZoomIn, canZoomOut, zoomIn, zoomOut, reset } = controls
  
  return (
    <Card className={`p-2 space-y-2 bg-background/90 backdrop-blur-sm ${className}`}>
      {/* Zoom In */}
      <Button
        size="sm"
        variant="outline"
        onClick={zoomIn}
        disabled={!canZoomIn}
        className="w-full"
        title="Zoom In"
      >
        <Plus className="h-4 w-4" />
      </Button>
      
      {/* Zoom Level Display */}
      <div className="text-center text-xs font-medium py-1 px-2 bg-muted rounded">
        Zoom
      </div>
      
      {/* Zoom Out */}
      <Button
        size="sm"
        variant="outline"
        onClick={zoomOut}
        disabled={!canZoomOut}
        className="w-full"
        title="Zoom Out"
      >
        <Minus className="h-4 w-4" />
      </Button>
      
      {/* Reset View */}
      <Button
        size="sm"
        variant="outline"
        onClick={reset}
        className="w-full"
        title="Reset View"
      >
        <RotateCcw className="h-4 w-4" />
      </Button>
    </Card>
  )
} 