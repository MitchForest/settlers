'use client'

import { useRouter } from 'next/navigation'

export default function DemoHome() {
  const router = useRouter()

  const handleCreateGame = () => {
    router.push('/demo/lobby')
  }

  return (
    <div className="min-h-screen bg-slate-900 relative overflow-hidden">
      {/* Honeycomb Background - Inline */}
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}
      />
      
      {/* Header */}
      <header className="relative z-10 flex justify-between items-center p-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-white">Builders</h1>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-green-500/20 border border-green-400/30 rounded-full">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-sm text-green-300">Demo Mode</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 border border-white/30 rounded-md text-white hover:bg-white/10 transition-colors"
          >
            ← Back to App
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
        <div className="max-w-2xl mx-auto space-y-8">
          {/* Hero Section */}
          <div className="space-y-4">
            <h2 className="text-4xl sm:text-6xl font-bold text-white tracking-tight">
              Master the Art of
              <span className="block text-blue-400">Strategic Trade</span>
            </h2>
            <p className="text-lg text-gray-300 max-w-xl mx-auto">
              Build settlements, trade resources, and outmaneuver your opponents in this 
              modern take on the classic strategy game.
            </p>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 max-w-md mx-auto">
              <p className="text-blue-300 text-sm">
                🎮 This is a demo showcasing the game interface. No backend required!
              </p>
            </div>
          </div>

          {/* System Status Mock */}
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 max-w-md mx-auto">
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span className="text-green-300 text-sm">Demo System Ready</span>
            </div>
          </div>

          {/* Game Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg mx-auto">
            <button
              onClick={handleCreateGame}
              className="h-16 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex flex-col items-center justify-center gap-1"
            >
              <span className="text-lg">🎯</span>
              <span>Create Game</span>
            </button>
            
            <button
              disabled
              className="h-16 px-6 bg-gray-600/50 text-gray-400 rounded-lg flex flex-col items-center justify-center gap-1 opacity-50 cursor-not-allowed"
            >
              <span className="text-lg">🤝</span>
              <span>Join Game</span>
            </button>
            
            <button
              disabled
              className="h-16 px-6 bg-gray-600/50 text-gray-400 rounded-lg flex flex-col items-center justify-center gap-1 opacity-50 cursor-not-allowed"
            >
              <span className="text-lg">👁️</span>
              <span>Observe Game</span>
            </button>
          </div>

          {/* Guest Notice Mock */}
          <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-4 max-w-md mx-auto">
            <p className="text-cyan-300 text-sm">
              💡 You're in demo mode. Experience the full game interface without any setup!
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}