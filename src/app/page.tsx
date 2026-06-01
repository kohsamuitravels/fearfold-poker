'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()
  const [tab, setTab] = useState<'create' | 'join'>('create')
  const [nickname, setNickname] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = () => {
    if (!nickname.trim()) return setError('Enter your nickname')
    setError('')
    // Store nickname in sessionStorage and route to room creation
    sessionStorage.setItem('fearfold_nickname', nickname.trim())
    router.push(`/create-room`)
  }

  const handleJoin = () => {
    if (!nickname.trim()) return setError('Enter your nickname')
    if (!roomCode.trim()) return setError('Enter a room code')
    setError('')
    sessionStorage.setItem('fearfold_nickname', nickname.trim())
    router.push(`/room/${roomCode.toUpperCase().trim()}/lobby`)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background felt texture */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-950 via-green-950/20 to-gray-950" />
      <div className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)`,
          backgroundSize: '20px 20px',
        }}
      />

      {/* Logo */}
      <div className="relative z-10 text-center mb-10 animate-slide-up">
        <div className="flex items-center justify-center gap-3 mb-2">
          <span className="text-5xl">🃏</span>
          <h1 className="text-4xl md:text-5xl font-bold text-gold"
            style={{ fontFamily: 'Playfair Display, serif' }}>
            FearFold
          </h1>
        </div>
        <p className="text-gray-400 text-sm tracking-widest uppercase">
          Private poker for friends
        </p>
      </div>

      {/* Card */}
      <div className="relative z-10 w-full max-w-sm mx-4 animate-slide-up"
        style={{ animationDelay: '0.1s', opacity: 0 }}>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl">
          {/* Tabs */}
          <div className="flex rounded-xl bg-gray-950 p-1 mb-6">
            {(['create', 'join'] as const).map(t => (
              <button key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                  tab === t
                    ? 'bg-green-800 text-green-100'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {t === 'create' ? '🎲 Create Room' : '🔗 Join Room'}
              </button>
            ))}
          </div>

          {/* Nickname */}
          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">
              Your Name
            </label>
            <input
              type="text"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              placeholder="e.g. Eitan, Ben, Tal..."
              maxLength={20}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-green-700 transition-colors"
              onKeyDown={e => e.key === 'Enter' && (tab === 'create' ? handleCreate() : handleJoin())}
            />
          </div>

          {tab === 'join' && (
            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">
                Room Code
              </label>
              <input
                type="text"
                value={roomCode}
                onChange={e => setRoomCode(e.target.value.toUpperCase())}
                placeholder="e.g. WOLF42"
                maxLength={6}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-600 font-mono tracking-widest text-center uppercase focus:outline-none focus:border-green-700"
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
              />
            </div>
          )}

          {error && (
            <p className="text-red-400 text-sm mb-4 text-center">{error}</p>
          )}

          <button
            onClick={tab === 'create' ? handleCreate : handleJoin}
            disabled={loading}
            className="w-full bg-green-800 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all duration-150 active:scale-95"
          >
            {loading ? 'Loading...' : tab === 'create' ? 'Continue →' : 'Join Game'}
          </button>
        </div>

        <p className="text-center text-gray-600 text-xs mt-4">
          Private game · No account needed
        </p>
      </div>
    </div>
  )
}
