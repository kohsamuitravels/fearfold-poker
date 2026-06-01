// ============================================================
// FearFold Poker — Room Manager
// Manages all active rooms in server memory.
// Rooms are persisted to DB but live game state is in-memory.
// ============================================================

import { v4 as uuidv4 } from 'uuid'
import { RoomState, HandState, GameVariant } from '../engine/types'

const rooms = new Map<string, RoomState>()

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export function createRoom(options: {
  roomId: string
  hostPlayerId: string
  hostNickname: string
  config: RoomState['config']
}): RoomState {
  const room: RoomState = {
    roomId: options.roomId,
    config: options.config,
    players: [{
      playerId: options.hostPlayerId,
      nickname: options.hostNickname,
      seatNumber: null,
      chipStack: 0,
      totalBought: 0,
      isHost: true,
      isConnected: true,
    }],
    status: 'LOBBY',
    currentHand: null,
    handNumber: 0,
    dealerSeat: null,
    eventLog: [],
  }
  rooms.set(options.roomId, room)
  return room
}

export function getRoom(roomId: string): RoomState | undefined {
  return rooms.get(roomId)
}

export function getRoomByCode(code: string): RoomState | undefined {
  for (const room of rooms.values()) {
    // Code is stored in roomId mapping — we match it via a lookup
    // In production, this would query DB
  }
  return undefined
}

export function setRoom(roomId: string, room: RoomState): void {
  rooms.set(roomId, room)
}

export function updateRoom(roomId: string, updater: (room: RoomState) => RoomState): RoomState | null {
  const room = rooms.get(roomId)
  if (!room) return null
  const updated = updater(room)
  rooms.set(roomId, updated)
  return updated
}

export function addPlayerToRoom(
  roomId: string,
  playerId: string,
  nickname: string
): { room: RoomState; error?: string } {
  const room = rooms.get(roomId)
  if (!room) return { room: null as any, error: 'Room not found' }
  if (room.status !== 'LOBBY') return { room, error: 'Game already started' }
  if (room.players.length >= room.config.maxPlayers) {
    return { room, error: 'Room is full' }
  }
  if (room.players.find(p => p.playerId === playerId)) {
    // Already in room — reconnect
    const updated: RoomState = {
      ...room,
      players: room.players.map(p =>
        p.playerId === playerId ? { ...p, isConnected: true } : p
      ),
    }
    rooms.set(roomId, updated)
    return { room: updated }
  }

  const updated: RoomState = {
    ...room,
    players: [
      ...room.players,
      {
        playerId,
        nickname,
        seatNumber: null,
        chipStack: 0,
        totalBought: 0,
        isHost: false,
        isConnected: true,
      }
    ],
  }
  rooms.set(roomId, updated)
  return { room: updated }
}

export function takeSeat(
  roomId: string,
  playerId: string,
  seatNumber: number
): { room: RoomState; error?: string } {
  const room = rooms.get(roomId)
  if (!room) return { room: null as any, error: 'Room not found' }
  if (seatNumber < 0 || seatNumber >= room.config.maxPlayers) {
    return { room, error: 'Invalid seat' }
  }
  if (room.players.find(p => p.seatNumber === seatNumber)) {
    return { room, error: 'Seat taken' }
  }

  const updated: RoomState = {
    ...room,
    players: room.players.map(p =>
      p.playerId === playerId ? { ...p, seatNumber } : p
    ),
  }
  rooms.set(roomId, updated)
  return { room: updated }
}

export function buyChips(
  roomId: string,
  playerId: string,
  amount: number
): { room: RoomState; error?: string } {
  const room = rooms.get(roomId)
  if (!room) return { room: null as any, error: 'Room not found' }

  const updated: RoomState = {
    ...room,
    players: room.players.map(p =>
      p.playerId === playerId
        ? { ...p, chipStack: p.chipStack + amount, totalBought: p.totalBought + amount }
        : p
    ),
  }
  rooms.set(roomId, updated)
  return { room: updated }
}

export function addEventLog(
  roomId: string,
  message: string,
  emoji?: string
): void {
  const room = rooms.get(roomId)
  if (!room) return
  const updated: RoomState = {
    ...room,
    eventLog: [
      ...room.eventLog.slice(-49),  // Keep last 50 events
      { message, timestamp: Date.now(), emoji }
    ],
  }
  rooms.set(roomId, updated)
}

export function setPlayerConnected(
  roomId: string,
  playerId: string,
  connected: boolean
): void {
  const room = rooms.get(roomId)
  if (!room) return
  const updated: RoomState = {
    ...room,
    players: room.players.map(p =>
      p.playerId === playerId ? { ...p, isConnected: connected } : p
    ),
  }
  rooms.set(roomId, updated)
}

export function getAllRooms(): RoomState[] {
  return Array.from(rooms.values())
}
