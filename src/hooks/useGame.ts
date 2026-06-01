'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSocket } from './useSocket'
import { RoomState, PlayerActionRequest, HandState } from '@/engine/types'

export function useGame(roomCode: string) {
  const { socket, isConnected } = useSocket()
  const [room, setRoom] = useState<RoomState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastCompletedHand, setLastCompletedHand] = useState<HandState | null>(null)
  const [settlement, setSettlement] = useState<any>(null)

  // Player identity
  const playerId = typeof window !== 'undefined' ? sessionStorage.getItem('fearfold_playerId') ?? '' : ''
  const nickname = typeof window !== 'undefined' ? sessionStorage.getItem('fearfold_nickname') ?? '' : ''

  // ─── Join Room ──────────────────────────────────────────
  useEffect(() => {
    if (!socket || !isConnected) return

    const existingPlayerId = sessionStorage.getItem('fearfold_playerId')

    socket.emit('room:join', {
      roomCode,
      nickname,
      playerId: existingPlayerId ?? undefined,
    }, (res: any) => {
      setLoading(false)
      if (!res.success) {
        setError(res.error)
        return
      }
      sessionStorage.setItem('fearfold_playerId', res.playerId)
      sessionStorage.setItem('fearfold_roomId', res.roomId)
      setRoom(res.room)
    })
  }, [socket, isConnected, roomCode])

  // ─── Room Updates ───────────────────────────────────────
  useEffect(() => {
    if (!socket) return

    const onRoomUpdate = ({ room }: { room: RoomState }) => setRoom(room)
    const onHandComplete = ({ hand }: { hand: HandState }) => setLastCompletedHand(hand)
    const onNightEnded = (data: any) => setSettlement(data)

    socket.on('room:update', onRoomUpdate)
    socket.on('game:handComplete', onHandComplete)
    socket.on('game:started', onRoomUpdate)
    socket.on('game:nightEnded', onNightEnded)

    return () => {
      socket.off('room:update', onRoomUpdate)
      socket.off('game:handComplete', onHandComplete)
      socket.off('game:started', onRoomUpdate)
      socket.off('game:nightEnded', onNightEnded)
    }
  }, [socket])

  // ─── Actions ─────────────────────────────────────────────

  const takeSeat = useCallback((seatNumber: number) => {
    socket?.emit('room:takeSeat', { seatNumber })
  }, [socket])

  const buyChips = useCallback((amount: number) => {
    socket?.emit('room:buyChips', { amount })
  }, [socket])

  const startGame = useCallback(() => {
    socket?.emit('game:start', {}, (res: any) => {
      if (!res?.success) setError(res?.error)
    })
  }, [socket])

  const sendAction = useCallback((
    actionType: PlayerActionRequest['actionType'],
    amount?: number
  ) => {
    if (!room?.currentHand) return
    socket?.emit('game:action', {
      playerId,
      handId: room.currentHand.handId,
      actionType,
      amount,
    }, (res: any) => {
      if (!res?.success) setError(res?.error)
    })
  }, [socket, room, playerId])

  const startChap = useCallback(() => {
    socket?.emit('game:chap', {})
  }, [socket])

  const approveRebuy = useCallback((targetPlayerId: string, amount: number) => {
    socket?.emit('game:approveRebuy', { targetPlayerId, amount })
  }, [socket])

  const endNight = useCallback(() => {
    socket?.emit('admin:endNight', {}, (res: any) => {
      if (res?.success) setSettlement(res)
    })
  }, [socket])

  const pauseGame = useCallback(() => socket?.emit('admin:pause'), [socket])
  const resumeGame = useCallback(() => socket?.emit('admin:resume'), [socket])
  const kickPlayer = useCallback((targetPlayerId: string) =>
    socket?.emit('admin:kick', { targetPlayerId }), [socket])
  const adjustChips = useCallback((targetPlayerId: string, newAmount: number) =>
    socket?.emit('admin:adjustChips', { targetPlayerId, newAmount }), [socket])

  const me = room?.players.find(p => p.playerId === playerId)
  const myHandState = room?.currentHand?.players.find(p => p.playerId === playerId)
  const isMyTurn = room?.currentHand?.currentPlayerSeat === myHandState?.seatNumber
  const isHost = me?.isHost ?? false

  return {
    room,
    me,
    myHandState,
    isMyTurn,
    isHost,
    playerId,
    loading,
    error,
    isConnected,
    lastCompletedHand,
    settlement,

    // Actions
    takeSeat,
    buyChips,
    startGame,
    sendAction,
    startChap,
    approveRebuy,
    endNight,
    pauseGame,
    resumeGame,
    kickPlayer,
    adjustChips,
  }
}
