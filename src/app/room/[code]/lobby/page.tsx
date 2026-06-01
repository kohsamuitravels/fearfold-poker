'use client'

import { useParams, useRouter } from 'next/navigation'
import { useGame } from '@/hooks/useGame'
import { useState } from 'react'

export default function LobbyPage() {
  const params = useParams()
  const router = useRouter()
  const code = params?.code as string
  const {
    room, me, isHost, loading, error, isConnected,
    takeSeat, buyChips, startGame,
  } = useGame(code)
  const [buyAmount, setBuyAmount] = useState(50)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-bounce">🃏</div>
          <p className="text-gray-400">Connecting to table...</p>
        </div>
      </div>
    )
  }

  if (error || !room) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error ?? 'Room not found'}</p>
          <button onClick={() => router.push('/')} className="text-gray-400 hover:text-white">← Home</button>
        </div>
      </div>
    )
  }

  const seatedCount = room.players.filter(p => p.seatNumber !== null).length

  // Navigate to table if game started
  if (room.status === 'ACTIVE') {
    router.push(`/room/${code}/table`)
    return null
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-start pt-8 p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-gold mb-1" style={{ fontFamily: 'Playfair Display, serif' }}>
            {room.config.gameVariant === 'TEXAS_HOLDEM' ? "Texas Hold'em" : room.config.gameVariant}
          </h2>
          <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
            <span>SB: {room.config.smallBlind} · BB: {room.config.bigBlind}</span>
            <span className="text-gray-700">|</span>
            <span>{seatedCount} seated</span>
          </div>
        </div>

        {/* Invite */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Room Code</div>
            <div className="font-mono text-2xl text-gold font-bold tracking-widest">{code}</div>
          </div>
          <button
            onClick={() => navigator.clipboard.writeText(`${window.location.origin}/room/${code}/lobby`)}
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm px-4 py-2 rounded-lg transition-colors"
          >
            Copy Invite Link
          </button>
        </div>

        {/* Connection status */}
        {!isConnected && (
          <div className="bg-yellow-900/30 border border-yellow-800 text-yellow-300 text-sm px-4 py-2 rounded-lg mb-4 text-center">
            ⚡ Reconnecting...
          </div>
        )}

        {/* Seat Grid */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {Array.from({ length: room.config.maxPlayers }).map((_, seatIdx) => {
            const seatPlayer = room.players.find(p => p.seatNumber === seatIdx)
            const isMe = seatPlayer?.playerId === me?.playerId
            const isEmpty = !seatPlayer
            const myCurrentSeat = me?.seatNumber

            return (
              <div key={seatIdx}
                onClick={() => isEmpty && myCurrentSeat === null && takeSeat(seatIdx)}
                className={`
                  relative border rounded-xl p-3 text-center cursor-pointer transition-all
                  ${isEmpty && myCurrentSeat === null
                    ? 'border-gray-700 hover:border-green-700 hover:bg-green-900/20 cursor-pointer'
                    : 'cursor-default'}
                  ${isMe ? 'border-gold bg-yellow-900/20' : 'border-gray-800 bg-gray-900/50'}
                  ${seatPlayer && !isMe ? 'border-gray-700' : ''}
                `}
              >
                <div className="text-xs text-gray-600 mb-1">Seat {seatIdx + 1}</div>
                {seatPlayer ? (
                  <>
                    <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center mx-auto mb-2 text-lg">
                      {seatPlayer.nickname[0].toUpperCase()}
                    </div>
                    <div className={`text-sm font-semibold ${isMe ? 'text-gold' : 'text-gray-200'}`}>
                      {seatPlayer.nickname} {isMe && '(you)'}
                    </div>
                    <div className="text-xs text-gray-500 font-mono">
                      {seatPlayer.chipStack > 0 ? `${seatPlayer.chipStack} chips` : 'No chips'}
                    </div>
                    {seatPlayer.isHost && (
                      <span className="text-xs text-amber-400">👑 Host</span>
                    )}
                  </>
                ) : (
                  <div className="text-gray-600 text-sm py-2">
                    {myCurrentSeat === null ? '+ Sit here' : 'Empty'}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Players without seats */}
        {room.players.filter(p => p.seatNumber === null).length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">Lobby (not seated)</div>
            <div className="flex flex-wrap gap-2">
              {room.players.filter(p => p.seatNumber === null).map(p => (
                <span key={p.playerId}
                  className="bg-gray-800 text-gray-300 px-3 py-1 rounded-full text-sm">
                  {p.nickname} {p.playerId === me?.playerId && '(you)'}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Buy chips */}
        {me?.seatNumber !== null && me?.seatNumber !== undefined && me.chipStack === 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
            <div className="text-sm text-gray-400 mb-3">Buy chips to play</div>
            <div className="flex gap-3">
              <div className="flex-1 flex gap-2">
                {[25, 50, 100].map(amt => (
                  <button key={amt}
                    onClick={() => setBuyAmount(amt)}
                    className={`flex-1 py-2 rounded-lg text-sm font-mono transition-colors ${
                      buyAmount === amt
                        ? 'bg-green-800 text-green-100'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {amt}
                  </button>
                ))}
              </div>
              <button
                onClick={() => buyChips(buyAmount)}
                className="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors"
              >
                Buy {buyAmount}
              </button>
            </div>
          </div>
        )}

        {/* Host controls */}
        {isHost && (
          <div className="space-y-3">
            <button
              onClick={startGame}
              disabled={seatedCount < 2}
              className="w-full bg-green-700 hover:bg-green-600 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl text-lg transition-all active:scale-95"
            >
              {seatedCount < 2 ? 'Waiting for players...' : '🃏 Start Game'}
            </button>

            {room.config.houseRulesEnabled && (
              <p className="text-center text-xs text-gray-600">
                House rules enabled — Chap available during game
              </p>
            )}
          </div>
        )}

        {!isHost && (
          <p className="text-center text-gray-500 text-sm">
            Waiting for host to start the game...
          </p>
        )}
      </div>
    </div>
  )
}
