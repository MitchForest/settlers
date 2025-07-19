'use client'

import { useRouter } from 'next/navigation'
import { useState, useRef } from 'react'

export default function DemoGamePage() {
  const router = useRouter()
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setTransform(prev => ({
      ...prev,
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    }))
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setTransform(prev => ({
      ...prev,
      scale: Math.max(0.5, Math.min(3, prev.scale * delta))
    }))
  }

  const handleLeaveGame = () => {
    router.push('/demo')
  }

  const handleDiceRoll = () => {
    const die1 = Math.floor(Math.random() * 6) + 1
    const die2 = Math.floor(Math.random() * 6) + 1
    alert(`Rolled ${die1} + ${die2} = ${die1 + die2}! (Demo mode)`)
  }

  // Honeycomb background
  const honeycombBg = `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`

  return (
    <div className="h-screen bg-slate-900 relative overflow-hidden">
      {/* Background */}
      <div 
        className="absolute inset-0 opacity-30"
        style={{ backgroundImage: honeycombBg }}
      />
      
      {/* Main game display */}
      <div className="relative w-full h-full">
        {/* Game Board Container */}
        <div 
          ref={containerRef}
          className={`relative w-full h-full bg-gradient-to-br from-blue-400 to-blue-600 overflow-hidden ${
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          {/* Pannable/Zoomable Game Board */}
          <div 
            className="absolute inset-0 transition-transform"
            style={{
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`
            }}
          >
            {/* Mock Hex Grid */}
            <div className="w-full h-full flex items-center justify-center">
              <div className="grid grid-cols-5 gap-2">
                {Array.from({ length: 19 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-20 h-20 rounded-lg flex items-center justify-center text-white font-bold text-lg cursor-pointer hover:scale-110 transition-transform"
                    style={{
                      backgroundColor: [
                        '#2d5016', // forest
                        '#8fbc8f', // pasture  
                        '#daa520', // wheat
                        '#cd853f', // hills
                        '#696969', // mountains
                        '#f4a460'  // desert
                      ][i % 6]
                    }}
                    onClick={() => alert(`Clicked hex ${i + 1}! (Demo mode)`)}
                  >
                    {i === 9 ? '🏠' : i === 5 ? '🏛️' : i === 12 ? '🛤️' : Math.floor(Math.random() * 11) + 2}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        {/* Players Panel - Top */}
        <div className="absolute top-4 left-4 right-4 z-20">
          <div className="flex items-center justify-between w-full gap-2">
            {['Demo Player', 'CleverBuilder247', 'StrategicBot891'].map((name, i) => (
              <div
                key={name}
                className={`flex items-center space-x-3 p-3 rounded-lg bg-white/10 border backdrop-blur-sm ${
                  i === 0 ? 'border-yellow-400/60 bg-yellow-400/5' : 'border-white/20'
                }`}
              >
                <div 
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold border-2 ${
                    i === 0 ? 'border-yellow-400 bg-yellow-400/20' : 'border-white/30 bg-white/10'
                  }`}
                  style={{ backgroundColor: ['#E8E9EA', '#EA4335', '#4285F4'][i] + '40' }}
                >
                  {i === 0 ? '👤' : '🤖'}
                </div>
                <span className="font-medium text-white text-sm">{name}</span>
                <div className="flex items-center space-x-1">
                  <span className="text-yellow-400">👑</span>
                  <span className="text-white font-bold text-lg">{[3, 2, 4][i]}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Player Sidebar - Left */}
        <div className="fixed left-4 w-80 top-20 bottom-20 z-40">
          <div className="bg-white/10 border border-white/20 rounded-lg backdrop-blur-sm p-4 space-y-4 h-full overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Demo Player</h3>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-green-300 text-sm">Your Turn</span>
              </div>
            </div>

            {/* Victory Points */}
            <div className="p-3 bg-yellow-400/5 border border-yellow-400/30 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-yellow-300 font-medium">Victory Points</span>
                <span className="text-yellow-300 text-xl font-bold">3</span>
              </div>
            </div>

            {/* Resources */}
            <div className="space-y-2">
              <h4 className="font-medium text-white">Resources (9)</h4>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { emoji: '🌲', name: 'Wood', count: 2 },
                  { emoji: '🧱', name: 'Brick', count: 1 },
                  { emoji: '🌾', name: 'Wheat', count: 3 },
                  { emoji: '🐑', name: 'Sheep', count: 2 },
                  { emoji: '🪨', name: 'Ore', count: 1 }
                ].map(resource => (
                  <div
                    key={resource.name}
                    className="p-2 bg-white/5 border border-white/20 rounded text-center"
                  >
                    <div className="text-lg">{resource.emoji}</div>
                    <div className="text-sm text-white/80">{resource.name}</div>
                    <div className="text-lg font-bold text-white">{resource.count}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <h4 className="font-medium text-white">Actions</h4>
              
              {[
                { icon: '🏠', name: 'Settlement', cost: '🌲🧱🌾🐑' },
                { icon: '🏛️', name: 'City', cost: '🌾🌾🪨🪨🪨' },
                { icon: '🛤️', name: 'Road', cost: '🌲🧱' },
                { icon: '📜', name: 'Dev Card', cost: '🌾🐑🪨' }
              ].map(action => (
                <button
                  key={action.name}
                  onClick={() => alert(`${action.name} clicked! (Demo mode)`)}
                  className="w-full flex justify-between items-center p-2 bg-white/5 border border-white/20 rounded hover:bg-white/10 transition-colors text-white"
                >
                  <span>{action.icon} {action.name}</span>
                  <span className="text-xs">{action.cost}</span>
                </button>
              ))}
              
              <button
                onClick={() => alert('End turn clicked! (Demo mode)')}
                className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
              >
                End Turn
              </button>
            </div>
          </div>
        </div>

        {/* Floating Action Buttons - Bottom Left */}
        <div className="fixed left-4 w-80 bottom-4 z-40">
          <div className="flex justify-between">
            {[
              { icon: '🔄', title: 'Restart Demo' },
              { icon: '🎨', title: 'Change Theme' },
              { icon: '🚪', title: 'Leave Demo', onClick: handleLeaveGame },
              { icon: 'ℹ️', title: 'Demo Info' }
            ].map((button, i) => (
              <button
                key={i}
                onClick={button.onClick || (() => alert(`${button.title} (Demo mode)`))}
                className="h-12 w-12 bg-black/30 backdrop-blur-sm border border-white/20 text-white hover:bg-black/40 hover:scale-105 transition-all duration-200 rounded-lg"
                title={button.title}
              >
                {button.icon}
              </button>
            ))}
          </div>
        </div>

        {/* Dice Roller - Bottom Center */}
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-40">
          <button
            onClick={handleDiceRoll}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-lg transition-all hover:scale-105"
          >
            🎲 Roll Dice
          </button>
        </div>

        {/* Demo Mode Indicator */}
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-blue-500/20 border border-blue-400/30 rounded-full px-4 py-2 backdrop-blur-sm">
            <span className="text-blue-300 text-sm font-medium">🎮 Demo Mode - Pan & Zoom to Explore</span>
          </div>
        </div>
      </div>
    </div>
  )
}