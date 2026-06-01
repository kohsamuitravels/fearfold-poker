// ============================================================
// FearFold Poker — Game Controller
// Bridges WebSocket events to the pure poker engine.
// All game state mutations go through here.
// ============================================================

import {
  createNewHand,
  applyAction,
  buildPlayerStatesFromRoom,
} from '../engine/pokerEngine'
import { createChapHand } from '../engine/variants/chap'
import {
  getRoom,
  setRoom,
  updateRoom,
  addEventLog,
  buyChips as buyChipsInRoom,
} from './roomManager'
import { RoomState, PlayerActionRequest, HandState, GameVariant } from '../engine/types'

// ─── Start Game ───────────────────────────────────────────

export function startGame(roomId: string): { room: RoomState; error?: string } {
  const room = getRoom(roomId)
  if (!room) return { room: null as any, error: 'Room not found' }

  const seatedPlayers = room.players.filter(p => p.seatNumber !== null && p.chipStack > 0)
  if (seatedPlayers.length < 2) {
    return { room, error: 'Need at least 2 seated players with chips' }
  }

  const updated: RoomState = { ...room, status: 'ACTIVE' }
  setRoom(roomId, updated)
  addEventLog(roomId, '🃏 Game started!')

  return startNewHand(roomId)
}

// ─── New Hand ────────────────────────────────────────────

export function startNewHand(roomId: string): { room: RoomState; error?: string } {
  const room = getRoom(roomId)
  if (!room) return { room: null as any, error: 'Room not found' }

  const seatedPlayers = room.players
    .filter(p => p.seatNumber !== null && p.chipStack > 0)

  if (seatedPlayers.length < 2) {
    return { room, error: 'Not enough players with chips' }
  }

  const prevDealerSeat = room.dealerSeat
  const handNumber = room.handNumber + 1

  try {
    const hand = createNewHand(
      handNumber,
      seatedPlayers.map(p => ({
        playerId: p.playerId,
        nickname: p.nickname,
        seatNumber: p.seatNumber!,
        chipStack: p.chipStack,
      })),
      prevDealerSeat,
      room.config.smallBlind,
      room.config.bigBlind,
      room.config.gameVariant
    )

    const updated: RoomState = {
      ...room,
      currentHand: hand,
      handNumber,
      dealerSeat: hand.dealerSeat,
      // Update player chip stacks to reflect blinds posted
      players: room.players.map(p => {
        const enginePlayer = hand.players.find(ep => ep.playerId === p.playerId)
        if (!enginePlayer) return p
        return { ...p, chipStack: enginePlayer.chipStack }
      }),
    }

    setRoom(roomId, updated)
    addEventLog(roomId, `Hand #${handNumber} started`)

    return { room: updated }
  } catch (err: any) {
    return { room, error: err.message }
  }
}

// ─── Player Action ────────────────────────────────────────

export function handlePlayerAction(
  roomId: string,
  request: PlayerActionRequest
): { room: RoomState; error?: string } {
  const room = getRoom(roomId)
  if (!room) return { room: null as any, error: 'Room not found' }
  if (!room.currentHand) return { room, error: 'No active hand' }

  if (room.currentHand.handId !== request.handId) {
    return { room, error: 'Hand ID mismatch' }
  }

  const result = applyAction(
    room.currentHand,
    request,
    room.config.smallBlind,
    room.config.bigBlind
  )

  if (result.error) return { room, error: result.error }

  const newHand = result.state

  // Generate event log message
  const player = room.players.find(p => p.playerId === request.playerId)
  const nickname = player?.nickname ?? 'Unknown'
  const msg = buildActionMessage(nickname, request.actionType, request.amount)
  addEventLog(roomId, msg)

  // Sync chip stacks back to room state
  const updated: RoomState = {
    ...room,
    currentHand: newHand,
    players: room.players.map(p => {
      const enginePlayer = newHand.players.find(ep => ep.playerId === p.playerId)
      if (!enginePlayer) return p
      return { ...p, chipStack: enginePlayer.chipStack }
    }),
  }

  setRoom(roomId, updated)

  // If hand complete, schedule next hand after delay
  if (newHand.isComplete) {
    if (newHand.winners) {
      for (const winner of newHand.winners) {
        const wp = room.players.find(p => p.playerId === winner.playerId)
        if (wp) {
          addEventLog(roomId, `💰 ${wp.nickname} wins ${winner.amount} chips!`)
        }
      }
    }
  }

  return { room: updated }
}

// ─── Chap Hand ────────────────────────────────────────────

export function startChapHand(roomId: string): { room: RoomState; error?: string } {
  const room = getRoom(roomId)
  if (!room) return { room: null as any, error: 'Room not found' }
  if (!room.config.houseRulesEnabled) {
    return { room, error: 'House rules not enabled for this room' }
  }

  const seatedPlayers = room.players.filter(p => p.seatNumber !== null && p.chipStack >= 25)

  if (seatedPlayers.length < 2) {
    return { room, error: 'Not enough players with 25+ chips for Chap' }
  }

  try {
    const hand = createChapHand(
      room.handNumber + 1,
      seatedPlayers.map(p => ({
        playerId: p.playerId,
        nickname: p.nickname,
        seatNumber: p.seatNumber!,
        chipStack: p.chipStack,
      })),
      room.dealerSeat ?? seatedPlayers[0].seatNumber!
    )

    const updated: RoomState = {
      ...room,
      currentHand: hand,
      handNumber: room.handNumber + 1,
      players: room.players.map(p => {
        const ep = hand.players.find(hp => hp.playerId === p.playerId)
        if (!ep) return p
        return { ...p, chipStack: ep.chipStack }
      }),
    }

    setRoom(roomId, updated)
    addEventLog(roomId, '🃏 Chap time! Everyone pays the tax!')

    return { room: updated }
  } catch (err: any) {
    return { room, error: err.message }
  }
}

// ─── Rebuy ────────────────────────────────────────────────

export function approveRebuy(
  roomId: string,
  targetPlayerId: string,
  amount: number
): { room: RoomState; error?: string } {
  const room = getRoom(roomId)
  if (!room) return { room: null as any, error: 'Room not found' }

  const { room: updated, error } = buyChipsInRoom(roomId, targetPlayerId, amount)
  if (error) return { room, error }

  const player = updated.players.find(p => p.playerId === targetPlayerId)
  if (player) {
    addEventLog(roomId, `💵 ${player.nickname} rebuys ${amount} chips (total: ${player.totalBought})`)
  }
  return { room: updated }
}

// ─── Admin ────────────────────────────────────────────────

export function pauseGame(roomId: string): RoomState | null {
  return updateRoom(roomId, room => ({ ...room, status: 'PAUSED' }))
}

export function resumeGame(roomId: string): RoomState | null {
  return updateRoom(roomId, room => ({ ...room, status: 'ACTIVE' }))
}

export function kickPlayer(roomId: string, playerId: string): RoomState | null {
  return updateRoom(roomId, room => ({
    ...room,
    players: room.players.filter(p => p.playerId !== playerId),
  }))
}

export function adjustChips(
  roomId: string,
  playerId: string,
  newAmount: number
): RoomState | null {
  return updateRoom(roomId, room => ({
    ...room,
    players: room.players.map(p =>
      p.playerId === playerId ? { ...p, chipStack: newAmount } : p
    ),
  }))
}

export function endNight(roomId: string): { room: RoomState; settlement: Settlement[] } | null {
  const room = getRoom(roomId)
  if (!room) return null

  const settlement: Settlement[] = room.players
    .filter(p => p.seatNumber !== null)
    .map(p => ({
      playerId: p.playerId,
      nickname: p.nickname,
      totalBought: p.totalBought,
      finalStack: p.chipStack,
      netResult: p.chipStack - p.totalBought,
    }))
    .sort((a, b) => b.netResult - a.netResult)

  const updated = updateRoom(roomId, r => ({ ...r, status: 'ENDED' }))
  return { room: updated!, settlement }
}

// ─── Helpers ──────────────────────────────────────────────

function buildActionMessage(nickname: string, action: string, amount?: number): string {
  switch (action) {
    case 'FOLD':   return `😱 ${nickname} פיחדתי (folded)`
    case 'CHECK':  return `👋 ${nickname} checked`
    case 'CALL':   return `📞 ${nickname} called ${amount}`
    case 'BET':    return `💰 ${nickname} bet ${amount}`
    case 'RAISE':  return `⬆️ ${nickname} raised to ${amount}`
    case 'ALL_IN': return `🚀 ${nickname} went ALL IN!`
    default:       return `${nickname} acted`
  }
}

export interface Settlement {
  playerId: string
  nickname: string
  totalBought: number
  finalStack: number
  netResult: number
}
