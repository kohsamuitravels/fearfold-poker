'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSocket } from '@/hooks/useSocket'

export default function CreateRoomPage() {
  const router = useRouter()
  const { socket } = useSocket()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [config, setConfig] = useState({
    smallBlind: 1,
    bigBlind: 2,
    startingStack: 50,
    maxPlayers: 6,
    gameVariant: 'TEXAS_HOLDEM' as const,
    houseRulesEnabled: false,
  })

  const update = (key: string, value: any) =>
    setConfig(c => ({ ...c, [key]: value }))

  const handleCreate = () => {
    const nickname = sessionStorage.getItem('fearfold_nickname')
    if (!nickname) return router.push('/')

    setLoading(true)
    setError('')

    socket?.emit('room:create', { nickname, config }, (res: any) => {
      setLoading(false)
      if (!res.success) return setError(res.error)
      // Store player info
      sessionStorage.setItem('fearfold_playerId', res.playerId)
      sessionStorage.setItem('fearfold_roomId', res.roomId)
      router.push(`/room/${res.roomCode}/lobby`)
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gold mb-1" style={{ fontFamily: 'Playfair Display, serif' }}>
            Table Setup
          </h2>
          <p className="text-gray-500 text-sm">Configure your home game</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
          {/* Blind structure */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">Small Blind</label>
              <input type="number" min={1} value={config.smallBlind}
                onChange={e => update('smallBlind', parseInt(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">Big Blind</label>
              <input type="number" min={2} value={config.bigBlind}
                onChange={e => update('bigBlind', parseInt(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono"
              />
            </div>
          </div>

          {/* Buy-in & Players */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">Starting Chips</label>
              <input type="number" min={10} value={config.startingStack}
                onChange={e => update('startingStack', parseInt(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">Max Players</label>
              <select value={config.maxPlayers}
                onChange={e => update('maxPlayers', parseInt(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
              >
                {[2,3,4,5,6,7,8,9].map(n => <option key={n} value={n}>{n} players</option>)}
              </select>
            </div>
          </div>

          {/* House rules */}
          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg bg-gray-800/50 hover:bg-gray-800">
            <input type="checkbox"
              checked={config.houseRulesEnabled}
              onChange={e => update('houseRulesEnabled', e.target.checked)}
              className="w-4 h-4 accent-green-600"
            />
            <div>
              <div className="text-sm font-medium text-gray-200">Enable House Rules</div>
              <div className="text-xs text-gray-500">Enables Chap and custom game modes</div>
            </div>
          </label>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button onClick={handleCreate} disabled={loading || !socket}
            className="w-full bg-green-800 hover:bg-green-700 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-all active:scale-95"
          >
            {loading ? 'Creating...' : 'Create Table 🎲'}
          </button>

          <button onClick={() => router.push('/')}
            className="w-full text-gray-500 hover:text-gray-300 text-sm py-2 transition-colors"
          >
            ← Back
          </button>
        </div>
      </div>
    </div>
  )
}
