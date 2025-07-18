import React from 'react'
import { cn } from '@/lib/utils'

interface ConnectionStatusProps {
  status: 'connecting' | 'connected' | 'disconnected' | 'error'
  className?: string
}

export function ConnectionStatus({ status, className }: ConnectionStatusProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-500'
      case 'connecting': return 'bg-yellow-500'
      case 'error': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected': return 'Connected'
      case 'connecting': return 'Connecting'
      case 'error': return 'Error'
      default: return 'Disconnected'
    }
  }

  return (
    <div className={cn(
      "fixed bottom-4 right-4 flex items-center gap-2 px-3 py-2 rounded-full bg-black/20 backdrop-blur-sm border border-white/10 text-white text-sm z-50",
      className
    )}>
      <div className={cn("w-2 h-2 rounded-full", getStatusColor(status))} />
      <span>{getStatusText(status)}</span>
    </div>
  )
} 