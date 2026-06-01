'use client'

import { useParams, useRouter } from 'next/navigation'
import { useGame } from '@/hooks/useGame'
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Card, PlayerState, HandState, RoomState, ActionType,
  PlayerStatus, Street
} from '@/engine/types'

// ─── Card Component ──────────────────────────────────────────
function PlayingCard({ card, size = 'md', animate = false }: {
  card: Card | null
  size?: 'sm' | 'md' | 'lg'
  animate?: boolean
}) {
  const sizeMap = {
    sm: 'w-8 h-12 text-xs',
    md: 'w-11 h-16 text-sm',
    lg: 'w-14 h-20 text-base',
  }
  const suitSymbol: Record<string, string> = {
    spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣'
  }
  const isRed = card?.suit === 'hearts' || card?.suit === 'diamonds'

  if (!card) {
    return (
      <div className={`playing-card card-back ${sizeMap[size]} ${animate ? 'card-deal' : ''} 
        flex items-center justify-center rounded-md`} />
    )
  }

  return (
    <div className={`playing-card ${sizeMap[size]} ${animate ? 'card-deal' : ''}
      ${isRed ? 'card-red' : 'card-black'} 
      flex flex-col items-center justify-between p-1 rounded-md`}>
      <span className="leading-none font-bold">{card.rank}</span>
      <span className="text-lg leading-none">{suitSymbol[card.suit]}</span>
      <span className="leading-none font-bold rotate-180">{card.rank}</span>
    </div>
  )
}

// ─── Seat positions for oval table ──────────────────────────
// 9 positions arranged around an ellipse
// Positions are % values: [left%, top%]
const SEAT_POSITIONS: Record<number, [number, number]> = {
  0: [50,  92],   // bottom center
  1: [18,  78],   // bottom left
  2: [4,   48],   // left
  3: [12,  18],   // top left
  4: [38,  4],    // top center-left
  5: [62,  4],    // top center-right
  6: [88,  18],   // top right
  7: [96,  48],   // right
  8: [82,  78],   // bottom right
}

// ─── Player Seat Component ────────────────────────────────────
function PlayerSeat({
  seatNumber,
  player,
  handPlayer,
  isMyTurn,
  isMe,
  dealerSeat,
  sbSeat,
  bbSeat,
  currentBet,
}: {
  seatNumber: number
  player?: RoomState['players'][0]
  handPlayer?: PlayerState
  isMyTurn: boolean
  isMe: boolean
  dealerSeat: number | null
  sbSeat: number
  bbSeat: number
  currentBet: number
}) {
  const pos = SEAT_POSITIONS[seatNumber]
  const occupied = !!player
  const isDealer = dealerSeat === seatNumber
  const isSB = sbSeat === seatNumber
  const isBB = bbSeat === seatNumber
  const status = handPlayer?.status
  const isActive = isMyTurn && status === 'ACTIVE'
  const isFolded = status === 'FOLDED'
  const isAllIn = status === 'ALL_IN'

  if (!occupied) {
    return (
      <div
        className="absolute transform -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${pos[0]}%`, top: `${pos[1]}%` }}
      >
        <div className="w-16 h-16 rounded-full border-2 border-dashed border-white/15 
          flex items-center justify-center text-white/20 text-xs">
          {seatNumber + 1}
        </div>
      </div>
    )
  }

  const chipStack = player.chipStack

  return (
    <div
      className="absolute transform -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${pos[0]}%`, top: `${pos[1]}%` }}
    >
      <div className={`relative flex flex-col items-center gap-1 
        ${isFolded ? 'opacity-40' : ''}`}>
        
        {/* Dealer / blind badges */}
        <div className="flex gap-1 h-4">
          {isDealer && (
            <div className="dealer-btn text-[9px]">D</div>
          )}
          {isSB && <div className="blind-badge sb-badge">SB</div>}
          {isBB && <div className="blind-badge bb-badge">BB</div>}
        </div>

        {/* Video circle / avatar */}
        <div className={`video-ring w-16 h-16 bg-slate-800 flex items-center justify-center
          relative
          ${isActive ? 'is-active' : ''}
          ${isFolded ? 'is-folded' : ''}
          ${isAllIn ? 'is-allin' : ''}
          ${isMe ? 'ring-2 ring-offset-1 ring-offset-transparent ring-amber-400/50' : ''}
        `}>
          {/* Avatar initial */}
          <span className="text-xl select-none">
            {player.nickname.charAt(0).toUpperCase()}
          </span>

          {/* Active pulse overlay */}
          {isActive && (
            <div className="absolute inset-0 rounded-full animate-ping 
              bg-amber-400/20 pointer-events-none" />
          )}

          {/* Status overlay */}
          {isFolded && (
            <div className="absolute inset-0 rounded-full bg-black/60 
              flex items-center justify-center">
              <span className="text-red-400 text-xs font-bold">😱</span>
            </div>
          )}
          {isAllIn && (
            <div className="absolute inset-0 rounded-full bg-red-900/50 
              flex items-center justify-center">
              <span className="text-xs font-bold text-red-300">ALL IN</span>
            </div>
          )}
        </div>

        {/* Name + stack */}
        <div className={`text-center rounded px-2 py-0.5
          ${isMe ? 'bg-amber-900/60 border border-amber-600/30' : 'bg-black/60'}`}>
          <div className="text-xs font-semibold text-white/90 max-w-[80px] truncate leading-tight">
            {player.nickname}
          </div>
          <div className="chip-counter text-amber-300 text-xs leading-tight">
            {chipStack.toLocaleString()}
          </div>
        </div>

        {/* Current street bet */}
        {handPlayer && handPlayer.currentBet > 0 && (
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 
            bg-amber-900/80 border border-amber-600/50 rounded px-2 py-0.5
            text-amber-200 text-xs font-mono whitespace-nowrap">
            {handPlayer.currentBet}
          </div>
        )}

        {/* Hole cards — only shown if we have them (own cards or showdown) */}
        {handPlayer && handPlayer.holeCards.length > 0 && (
          <div className="absolute -top-14 left-1/2 -translate-x-1/2 flex gap-0.5">
            {handPlayer.holeCards.map((c, i) => (
              <PlayingCard key={i} card={c} size="sm" animate />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Community Cards ─────────────────────────────────────────
function CommunityCards({ cards, street }: { cards: Card[], street: Street }) {
  const revealed = cards.length
  return (
    <div className="flex items-center gap-2">
      {[0,1,2,3,4].map(i => (
        <PlayingCard
          key={i}
          card={i < revealed ? cards[i] : null}
          size="lg"
          animate={i < revealed}
        />
      ))}
    </div>
  )
}

// ─── Action Panel ─────────────────────────────────────────────
function ActionPanel({
  hand,
  myHandPlayer,
  isMyTurn,
  bigBlind,
  onAction,
}: {
  bigBlind: number
  hand: HandState
  myHandPlayer: PlayerState
  isMyTurn: boolean
  onAction: (type: ActionType, amount?: number) => void
}) {
  const [raiseAmount, setRaiseAmount] = useState(hand.currentBet * 2 || hand.minRaise || 0)

  const toCall = Math.max(0, hand.currentBet - myHandPlayer.currentBet)
  const canCheck = toCall === 0
  const canCall  = toCall > 0 && toCall < myHandPlayer.chipStack + myHandPlayer.currentBet
  const canRaise = myHandPlayer.chipStack > toCall
  const minRaise = hand.currentBet + (hand.minRaise || hand.currentBet)

  useEffect(() => {
    setRaiseAmount(Math.max(minRaise, hand.currentBet + (hand.minRaise || bigBlind)))
  }, [hand.currentBet, hand.minRaise, bigBlind])

  if (!isMyTurn) {
    return (
      <div className="text-center text-white/30 text-sm py-4">
        Waiting for others…
      </div>
    )
  }

  return (
    <div className="animate-slide-up">
      {/* Raise slider row */}
      {canRaise && (
        <div className="flex items-center gap-3 mb-3">
          <span className="text-amber-300 text-xs font-mono w-16 text-right">
            {raiseAmount}
          </span>
          <input
            type="range"
            min={minRaise}
            max={myHandPlayer.chipStack + myHandPlayer.currentBet}
            step={bigBlind}
            value={raiseAmount}
            onChange={e => setRaiseAmount(Number(e.target.value))}
            className="flex-1 h-1.5 appearance-none bg-amber-900/50 rounded-full
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-4
              [&::-webkit-slider-thumb]:h-4
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-amber-400
              [&::-webkit-slider-thumb]:cursor-pointer"
          />
          <button
            onClick={() => setRaiseAmount(myHandPlayer.chipStack + myHandPlayer.currentBet)}
            className="text-xs text-red-400 hover:text-red-300 font-bold px-2"
          >
            MAX
          </button>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 justify-center flex-wrap">
        {/* Fold */}
        <button
          onClick={() => onAction('FOLD')}
          className="btn-fold min-w-[90px]"
        >
          <div className="text-base leading-tight">פיחדתי 😱</div>
          <div className="text-[10px] opacity-60">Fold</div>
        </button>

        {/* Check or Call */}
        {canCheck ? (
          <button
            onClick={() => onAction('CHECK')}
            className="btn-check min-w-[90px]"
          >
            <div>Check ✓</div>
          </button>
        ) : (
          <button
            onClick={() => onAction('CALL')}
            className="btn-call min-w-[90px]"
          >
            <div>Call</div>
            <div className="text-[11px] opacity-80 font-mono">{toCall}</div>
          </button>
        )}

        {/* Raise / Bet */}
        {canRaise && (
          <button
            onClick={() => onAction(hand.currentBet > 0 ? 'RAISE' : 'BET', raiseAmount)}
            className="btn-raise min-w-[90px]"
          >
            <div>{hand.currentBet > 0 ? 'Raise' : 'Bet'}</div>
            <div className="text-[11px] opacity-80 font-mono">{raiseAmount}</div>
          </button>
        )}

        {/* All In */}
        <button
          onClick={() => onAction('ALL_IN')}
          className="btn-allin min-w-[90px]"
        >
          <div>🔥 All In</div>
          <div className="text-[11px] opacity-80 font-mono">
            {myHandPlayer.chipStack + myHandPlayer.currentBet}
          </div>
        </button>
      </div>
    </div>
  )
}

// ─── Event Log ────────────────────────────────────────────────
function EventLog({ events }: { events: RoomState['eventLog'] }) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [events])

  return (
    <div
      ref={scrollRef}
      className="event-log h-full overflow-y-auto space-y-1 pr-1"
    >
      {events.slice(-30).map((e, i) => (
        <div key={i} className="text-xs text-white/50 leading-snug">
          <span className="mr-1">{e.emoji}</span>
          {e.message}
        </div>
      ))}
    </div>
  )
}

// ─── Hand Result Overlay ─────────────────────────────────────
function HandResultOverlay({ hand, onDismiss }: {
  hand: HandState
  onDismiss: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000)
    return () => clearTimeout(t)
  }, [onDismiss])

  if (!hand.winners?.length) return null

  return (
    <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
      <div className="bg-black/80 border border-amber-500/40 rounded-2xl px-8 py-6 
        text-center animate-slide-up backdrop-blur-sm">
        {hand.winners.map((w, i) => {
          const player = hand.players.find(p => p.playerId === w.playerId)
          return (
            <div key={i} className="mb-2">
              <div className="text-amber-300 text-2xl font-bold">{player?.nickname}</div>
              <div className="text-white/70 text-sm">wins <span className="text-amber-200 font-mono">{w.amount}</span> chips</div>
              {w.hand && (
                <div className="text-green-400 text-sm mt-1">{w.hand.name}</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Settlement Screen ────────────────────────────────────────
function SettlementScreen({ settlement, onClose }: { settlement: any, onClose: () => void }) {
  const sorted = [...(settlement.players ?? [])].sort(
    (a: any, b: any) => b.netResult - a.netResult
  )

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-amber-600/40 rounded-2xl max-w-md w-full p-6">
        <h2 className="text-amber-300 text-2xl font-bold text-center mb-1">
          🌙 Night Settled
        </h2>
        <p className="text-white/40 text-xs text-center mb-6">
          {new Date().toLocaleDateString('he-IL')}
        </p>

        <div className="space-y-3">
          {sorted.map((p: any, i: number) => (
            <div key={p.playerId}
              className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3">
              <div className="text-2xl w-8 text-center">
                {i === 0 ? '🏆' : i === sorted.length - 1 ? '😢' : '•'}
              </div>
              <div className="flex-1">
                <div className="text-white font-semibold">{p.nickname}</div>
                <div className="text-white/40 text-xs">
                  Bought: {p.totalBought} → Final: {p.finalStack}
                </div>
              </div>
              <div className={`font-mono font-bold text-lg 
                ${p.netResult > 0 ? 'text-green-400' : p.netResult < 0 ? 'text-red-400' : 'text-white/40'}`}>
                {p.netResult > 0 ? '+' : ''}{p.netResult}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full py-3 bg-amber-700 hover:bg-amber-600 
            text-white font-bold rounded-xl transition-colors">
          Close
        </button>
      </div>
    </div>
  )
}

// ─── Admin Panel ───────────────────────────────────────────────
function AdminPanel({
  room,
  isHost,
  playerId,
  onPause,
  onResume,
  onEndNight,
  onStartChap,
  onApproveRebuy,
  onKick,
  onAdjustChips,
}: {
  room: RoomState
  isHost: boolean
  playerId: string
  onPause: () => void
  onResume: () => void
  onEndNight: () => void
  onStartChap: () => void
  onApproveRebuy: (pid: string, amount: number) => void
  onKick: (pid: string) => void
  onAdjustChips: (pid: string, amount: number) => void
}) {
  const [open, setOpen] = useState(false)
  if (!isHost) return null

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="text-xs px-3 py-1.5 bg-white/10 hover:bg-white/20 
          rounded-lg text-white/60 hover:text-white transition-colors"
      >
        ⚙️ Host
      </button>

      {open && (
        <div className="absolute bottom-8 right-0 w-56 bg-slate-900 border border-white/10 
          rounded-xl p-3 shadow-2xl z-20 space-y-2">
          <p className="text-white/30 text-xs uppercase tracking-widest px-1 mb-2">
            Host Controls
          </p>

          {room.status === 'ACTIVE' && (
            <button onClick={() => { onPause(); setOpen(false) }}
              className="w-full text-left text-sm px-3 py-2 rounded-lg 
                bg-yellow-900/40 hover:bg-yellow-800/60 text-yellow-200">
              ⏸ Pause Game
            </button>
          )}
          {room.status === 'PAUSED' && (
            <button onClick={() => { onResume(); setOpen(false) }}
              className="w-full text-left text-sm px-3 py-2 rounded-lg 
                bg-green-900/40 hover:bg-green-800/60 text-green-200">
              ▶️ Resume Game
            </button>
          )}

          {room.config.houseRulesEnabled && (
            <button onClick={() => { onStartChap(); setOpen(false) }}
              className="w-full text-left text-sm px-3 py-2 rounded-lg 
                bg-purple-900/40 hover:bg-purple-800/60 text-purple-200">
              🎭 Start Chap Hand
            </button>
          )}

          <div className="border-t border-white/10 my-2" />

          {room.players.filter(p => p.playerId !== playerId).map(p => (
            <div key={p.playerId} className="text-xs text-white/50 px-1">
              <div className="font-semibold text-white/70 mb-1">{p.nickname}</div>
              <div className="flex gap-1">
                <button
                  onClick={() => { onApproveRebuy(p.playerId, 50); setOpen(false) }}
                  className="px-2 py-1 bg-blue-900/50 hover:bg-blue-800/60 
                    rounded text-blue-300 text-[10px]">
                  Rebuy +50
                </button>
                <button
                  onClick={() => { onKick(p.playerId); setOpen(false) }}
                  className="px-2 py-1 bg-red-900/50 hover:bg-red-800/60 
                    rounded text-red-300 text-[10px]">
                  Kick
                </button>
              </div>
            </div>
          ))}

          <div className="border-t border-white/10 my-2" />

          <button onClick={() => { onEndNight(); setOpen(false) }}
            className="w-full text-left text-sm px-3 py-2 rounded-lg 
              bg-red-900/40 hover:bg-red-800/60 text-red-300">
            🌙 End Night
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Street Indicator ─────────────────────────────────────────
function StreetBadge({ street }: { street: Street }) {
  const labels: Record<Street, string> = {
    PREFLOP: 'Pre-Flop',
    FLOP: 'Flop',
    TURN: 'Turn',
    RIVER: 'River',
    SHOWDOWN: 'Showdown',
  }
  const colors: Record<Street, string> = {
    PREFLOP: 'bg-slate-700/80 text-slate-300',
    FLOP: 'bg-blue-900/80 text-blue-300',
    TURN: 'bg-violet-900/80 text-violet-300',
    RIVER: 'bg-rose-900/80 text-rose-300',
    SHOWDOWN: 'bg-amber-900/80 text-amber-300',
  }
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors[street]}`}>
      {labels[street]}
    </span>
  )
}

// ─── Main Table Page ──────────────────────────────────────────
export default function TablePage() {
  const params = useParams()
  const router = useRouter()
  const code = params?.code as string

  const {
    room, me, myHandState, isMyTurn, isHost, playerId,
    loading, error, isConnected,
    sendAction, startChap, approveRebuy, endNight,
    pauseGame, resumeGame, kickPlayer, adjustChips,
    settlement, lastCompletedHand,
  } = useGame(code)

  const [showResult, setShowResult] = useState(false)
  const [resultHand, setResultHand] = useState<HandState | null>(null)

  // Show result overlay when hand completes
  useEffect(() => {
    if (lastCompletedHand) {
      setResultHand(lastCompletedHand)
      setShowResult(true)
    }
  }, [lastCompletedHand])

  // Redirect to lobby if not yet at table
  useEffect(() => {
    if (!loading && room && room.status === 'LOBBY') {
      router.push(`/room/${code}/lobby`)
    }
  }, [room, loading, code])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-pulse">🃏</div>
          <p className="text-white/40">Joining table…</p>
        </div>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white/50">
        Room not found. <button onClick={() => router.push('/')} className="ml-2 underline">Go home</button>
      </div>
    )
  }

  const hand = room.currentHand
  const totalSeats = room.config.maxPlayers

  // Resolve player states
  const roomPlayers = room.players
  const getHandPlayer = (playerId: string) =>
    hand?.players.find(p => p.playerId === playerId)

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden select-none"
      style={{ background: 'radial-gradient(ellipse at center, #0a1a14 0%, #050d09 100%)' }}>

      {/* ── Top bar ── */}
      <header className="flex items-center justify-between px-4 py-2 z-10 
        border-b border-white/5 bg-black/30 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-amber-400 font-bold text-sm tracking-wider">
            🃏 FearFold
          </span>
          <span className="text-white/20 text-xs">#{code}</span>
          {hand && <StreetBadge street={hand.street} />}
          {hand && (
            <span className="text-white/30 text-xs">Hand #{hand.handNumber}</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Connection indicator */}
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />

          {/* My stack */}
          {me && (
            <div className="text-amber-300 text-sm font-mono">
              {me.chipStack.toLocaleString()} 🪙
            </div>
          )}

          {/* Admin panel */}
          {isHost && (
            <AdminPanel
              room={room}
              isHost={isHost}
              playerId={playerId}
              onPause={pauseGame}
              onResume={resumeGame}
              onEndNight={endNight}
              onStartChap={startChap}
              onApproveRebuy={approveRebuy}
              onKick={kickPlayer}
              onAdjustChips={adjustChips}
            />
          )}
        </div>
      </header>

      {/* ── Main layout: table + sidebar ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Poker Table area ── */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 relative">

          {/* Oval felt table */}
          <div className="felt-table rounded-[50%] relative"
            style={{
              width: 'min(70vw, 680px)',
              height: 'min(42vw, 400px)',
            }}>

            {/* Pot display */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              {hand && (
                <>
                  <div className="text-white/30 text-xs uppercase tracking-widest">Pot</div>
                  <div className="chip-counter text-amber-300 text-2xl font-bold">
                    {hand.pot.toLocaleString()}
                  </div>
                  {/* Side pots */}
                  {hand.sidePots.length > 0 && (
                    <div className="flex gap-2">
                      {hand.sidePots.map((sp, i) => (
                        <div key={i}
                          className="text-xs text-white/40 bg-white/5 rounded px-2 py-0.5">
                          Side: {sp.amount}
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Community cards */}
                  <div className="mt-3">
                    <CommunityCards cards={hand.communityCards} street={hand.street} />
                  </div>
                </>
              )}

              {!hand && room.status === 'ACTIVE' && (
                <div className="text-white/20 text-sm">Waiting for next hand…</div>
              )}
              {!hand && room.status === 'PAUSED' && (
                <div className="text-yellow-400/60 text-sm">⏸ Game paused</div>
              )}
            </div>

            {/* Hand result overlay */}
            {showResult && resultHand && (
              <HandResultOverlay
                hand={resultHand}
                onDismiss={() => setShowResult(false)}
              />
            )}
          </div>

          {/* ── Player seats positioned around the table ── */}
          <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
            <div className="relative w-full h-full">
              {Array.from({ length: totalSeats }).map((_, seatIdx) => {
                const seatPlayer = roomPlayers.find(p => p.seatNumber === seatIdx)
                const hp = seatPlayer ? getHandPlayer(seatPlayer.playerId) : undefined
                const isMeTurn = isMyTurn && seatPlayer?.playerId === playerId

                return (
                  <PlayerSeat
                    key={seatIdx}
                    seatNumber={seatIdx}
                    player={seatPlayer}
                    handPlayer={hp}
                    isMyTurn={isMeTurn}
                    isMe={seatPlayer?.playerId === playerId}
                    dealerSeat={hand?.dealerSeat ?? room.dealerSeat}
                    sbSeat={hand?.smallBlindSeat ?? -1}
                    bbSeat={hand?.bigBlindSeat ?? -1}
                    currentBet={hand?.currentBet ?? 0}
                  />
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Right sidebar: event log ── */}
        <aside className="w-56 flex-shrink-0 flex flex-col border-l border-white/5 
          bg-black/20 backdrop-blur-sm">
          <div className="p-3 border-b border-white/5">
            <h3 className="text-white/30 text-xs uppercase tracking-widest">Table Chat</h3>
          </div>
          <div className="flex-1 p-3 overflow-hidden">
            <EventLog events={room.eventLog} />
          </div>

          {/* Current turn reminder in sidebar */}
          {hand && (
            <div className="p-3 border-t border-white/5">
              {isMyTurn && myHandState ? (
                <div className="text-amber-300 text-xs text-center font-semibold animate-pulse">
                  Your turn!
                </div>
              ) : (
                (() => {
                  const actingPlayer = hand.players.find(
                    p => p.seatNumber === hand.currentPlayerSeat
                  )
                  const roomP = actingPlayer
                    ? roomPlayers.find(rp => rp.playerId === actingPlayer.playerId)
                    : null
                  return roomP ? (
                    <div className="text-white/30 text-xs text-center">
                      {roomP.nickname}'s turn
                    </div>
                  ) : null
                })()
              )}
            </div>
          )}
        </aside>
      </div>

      {/* ── Bottom action panel ── */}
      <footer className="flex-shrink-0 border-t border-white/5 bg-black/40 backdrop-blur-sm px-4 py-3">
        {hand && myHandState && myHandState.status === 'ACTIVE' ? (
          <ActionPanel
            hand={hand}
            myHandPlayer={myHandState}
            isMyTurn={isMyTurn}
            bigBlind={room.config.bigBlind}
            onAction={sendAction}
          />
        ) : (
          <div className="flex items-center justify-between text-white/25 text-xs">
            <span>
              {myHandState?.status === 'FOLDED'
                ? '😱 פיחדתי — folded this hand'
                : myHandState?.status === 'ALL_IN'
                ? '🔥 All-in — waiting for showdown'
                : 'Waiting for your turn…'}
            </span>
            <span className="font-mono">
              {me?.chipStack.toLocaleString()} chips
            </span>
          </div>
        )}
      </footer>

      {/* ── Settlement modal ── */}
      {settlement && (
        <SettlementScreen
          settlement={settlement}
          onClose={() => router.push(`/room/${code}/lobby`)}
        />
      )}
    </div>
  )
}
