'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface DemoPlayer {
  id: string
  name: string
  avatarEmoji: string
  isAI: boolean
  aiDifficulty?: 'easy' | 'medium' | 'hard'
}

export default function DemoLobbyPage() {
  const router = useRouter()
  const [players, setPlayers] = useState<DemoPlayer[]>([
    {
      id: 'demo-player-1',
      name: 'Demo Player',
      avatarEmoji: '👤',
      isAI: false
    },
    {
      id: 'demo-ai-1',
      name: 'CleverBuilder247',
      avatarEmoji: '🤖',
      isAI: true,
      aiDifficulty: 'medium'
    },
    {
      id: 'demo-ai-2',  
      name: 'StrategicBot891',
      avatarEmoji: '🤖',
      isAI: true,
      aiDifficulty: 'hard'
    }
  ])

  const [showAddBotDialog, setShowAddBotDialog] = useState(false)

  const handleStartGame = () => {
    alert('Starting demo game...')
    setTimeout(() => {
      router.push('/demo/game')
    }, 1000)
  }

  const handleLeave = () => {
    router.push('/demo')
  }

  const handleAddBot = () => {
    if (players.length >= 4) {
      alert('Lobby is full')
      return
    }

    const newBot: DemoPlayer = {
      id: `demo-ai-${Date.now()}`,
      name: `DemoBot${players.length + 1}`,
      avatarEmoji: '🤖',
      isAI: true,
      aiDifficulty: 'medium'
    }

    setPlayers(prev => [...prev, newBot])
    alert('AI bot added!')
  }

  const handleRemoveBot = (botId: string) => {
    setPlayers(prev => prev.filter(p => p.id !== botId))
    alert('AI bot removed')
  }

  const canStart = players.length >= 3

  // Honeycomb background inline
  const honeycombBg = `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`

  return (
    <div className="min-h-screen bg-slate-900 relative overflow-hidden">
      {/* Background */}
      <div 
        className="absolute inset-0 opacity-30"
        style={{ backgroundImage: honeycombBg }}
      />
      
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-4xl">
          {/* Header */}
          <div className="text-center space-y-4 mb-8">
            <h1 className="text-4xl font-bold text-white">Game Lobby</h1>
            <div className="inline-flex items-center gap-3 rounded-lg px-6 py-3 bg-white/10 border border-white/30 backdrop-blur-sm">
              <span className="text-lg text-white">Game Code:</span>
              <code className="text-3xl font-mono font-bold text-yellow-400">DEMO</code>
              <button
                onClick={() => navigator.clipboard.writeText('DEMO')}
                className="p-2 rounded hover:bg-white/10 text-white"
              >
                📋
              </button>
            </div>
            <p className="text-lg text-gray-300">Share this code with friends to join the game</p>
          </div>

          {/* Main Content Grid */}
          <div className="grid lg:grid-cols-2 gap-8 items-start">
            {/* Left Column - Players */}
            <div className="bg-white/10 border border-white/20 rounded-lg backdrop-blur-sm">
              <div className="p-6">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  👥 Players ({players.length}/4)
                </h3>
                
                <div className="space-y-4">
                  {/* Player Slots - Always show 4 slots */}
                  {Array.from({ length: 4 }).map((_, slotIndex) => {
                    const player = players[slotIndex]
                    
                    if (player) {
                      // Occupied slot
                      const playerColors = ['bg-red-500', 'bg-green-500', 'bg-blue-500', 'bg-yellow-500']
                      return (
                        <div
                          key={`player-${player.id}-${slotIndex}`}
                          className="flex items-center gap-3 p-4 bg-white/5 border border-white/20 rounded-lg hover:bg-white/10 transition-colors"
                        >
                          <div 
                            className={`w-12 h-12 rounded-md ${playerColors[slotIndex]} flex items-center justify-center text-white font-bold text-lg`}
                          >
                            {player.avatarEmoji}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-white flex items-center gap-2">
                              {player.name}
                              {player.isAI && (
                                <span className="px-2 py-1 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded text-xs">
                                  🤖 {player.aiDifficulty} AI
                                </span>
                              )}
                              {slotIndex === 0 && (
                                <span className="px-2 py-1 bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 rounded text-xs">
                                  👑 Host
                                </span>
                              )}
                            </div>
                          </div>
                          {player.isAI && (
                            <button
                              onClick={() => handleRemoveBot(player.id)}
                              className="w-8 h-8 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors"
                            >
                              ❌
                            </button>
                          )}
                        </div>
                      )
                    } else {
                      // Empty slot
                      return (
                        <div
                          key={`empty-slot-${slotIndex}`}
                          onClick={handleAddBot}
                          className="flex items-center gap-3 p-4 border-2 border-dashed border-white/20 rounded-lg cursor-pointer hover:bg-white/5 hover:border-white/30 transition-colors"
                        >
                          <div className="w-12 h-12 rounded-md bg-white/5 flex items-center justify-center border border-white/10">
                            ➕
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-white/60">Add Player</div>
                            <div className="text-sm text-white/40">Click to add AI bot</div>
                          </div>
                        </div>
                      )
                    }
                  })}
                </div>
              </div>
            </div>

            {/* Right Column - Rules & Actions */}
            <div className="space-y-6">
              {/* Game Rules */}
              <div className="bg-white/10 border border-white/20 rounded-lg backdrop-blur-sm p-6">
                <h3 className="text-xl font-bold text-white mb-4">Game Rules & Resources</h3>
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Left - Core Rules */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-white mb-2">Core Rules</h4>
                    <ul className="space-y-2 text-sm text-white/80">
                      <li className="flex items-start gap-2">
                        <span className="text-yellow-400 mt-0.5">•</span>
                        <span>First to 10 victory points wins</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-yellow-400 mt-0.5">•</span>
                        <span>Build settlements, cities, and roads</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-yellow-400 mt-0.5">•</span>
                        <span>Trade resources with other players</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-yellow-400 mt-0.5">•</span>
                        <span>Use development cards strategically</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-yellow-400 mt-0.5">•</span>
                        <span>Watch out for the robber!</span>
                      </li>
                    </ul>
                  </div>
                  
                  {/* Right - Resources & Costs */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-white mb-2">Resources & Costs</h4>
                    <div className="space-y-3 text-sm">
                      <div>
                        <p className="text-white/80 mb-1">Resources:</p>
                        <div className="flex flex-wrap gap-2">
                          <span className="bg-green-500/20 px-2 py-1 rounded text-xs">🌲 Wood</span>
                          <span className="bg-red-500/20 px-2 py-1 rounded text-xs">🧱 Brick</span>
                          <span className="bg-yellow-500/20 px-2 py-1 rounded text-xs">🌾 Wheat</span>
                          <span className="bg-blue-500/20 px-2 py-1 rounded text-xs">🐑 Sheep</span>
                          <span className="bg-gray-500/20 px-2 py-1 rounded text-xs">🪨 Ore</span>
                        </div>
                      </div>
                      
                      <div>
                        <p className="text-white/80 mb-1">Building Costs:</p>
                        <div className="space-y-1 text-xs">
                          <div>🏠 Settlement: 🌲🧱🌾🐑</div>
                          <div>🏛️ City: 🌾🌾🪨🪨🪨</div>
                          <div>🛤️ Road: 🌲🧱</div>
                          <div>📜 Dev Card: 🌾🐑🪨</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-4">
                <button
                  onClick={handleStartGame}
                  disabled={!canStart}
                  className={`py-3 px-6 text-lg rounded-lg transition-all ${
                    canStart 
                      ? 'bg-green-600 hover:bg-green-700 text-white hover:scale-105' 
                      : 'bg-gray-600/50 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {canStart ? 'Start Game' : `Need ${3 - players.length} more players`}
                </button>
                
                <button
                  onClick={handleLeave}
                  className="py-3 px-6 text-lg bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-all hover:scale-105"
                >
                  Leave Lobby
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}