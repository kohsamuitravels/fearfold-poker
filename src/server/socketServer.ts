// ============================================================
// FearFold Poker — Socket.IO Server
// All real-time game communication.
// ============================================================

import { Server as SocketIOServer, Socket } from 'socket.io'
import { Server as HttpServer } from 'http'
import {
  createRoom,
  getRoom,
  addPlayerToRoom,
  takeSeat,
  setPlayerConnected,
  generateRoomCode,
} from './roomManager'
import {
  startGame,
  startNewHand,
  handlePlayerAction,
  startChapHand,
  approveRebuy,
  pauseGame,
  resumeGame,
  kickPlayer,
  adjustChips,
  endNight,
} from './gameController'
import { RoomState, PlayerActionRequest } from '../engine/types'
import { v4 as uuidv4 } from 'uuid'

// Map socketId → {playerId, roomId}
const socketPlayers = new Map<string, { playerId: string; roomId: string; nickname: string }>()

// Map roomId → Set<socketId>
const roomSockets = new Map<string, Set<string>>()
// Map roomId → roomCode
const roomCodes = new Map<string, string>()
// Map roomCode → roomId  
const codeToRoom = new Map<string, string>()

export function createSocketServer(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    path: '/api/socket',
    transports: ['websocket', 'polling'],
  })

  io.on('connection', (socket: Socket) => {
    console.log(`[Socket] Connected: ${socket.id}`)

    // ─── Create Room ──────────────────────────────────────
    socket.on('room:create', (payload: {
      nickname: string
      config: RoomState['config']
    }, callback) => {
      try {
        const playerId = uuidv4()
        const roomId = uuidv4()
        const roomCode = generateRoomCode()

        const room = createRoom({
          roomId,
          hostPlayerId: playerId,
          hostNickname: payload.nickname,
          config: payload.config,
        })

        roomCodes.set(roomId, roomCode)
        codeToRoom.set(roomCode, roomId)

        socketPlayers.set(socket.id, { playerId, roomId, nickname: payload.nickname })
        if (!roomSockets.has(roomId)) roomSockets.set(roomId, new Set())
        roomSockets.get(roomId)!.add(socket.id)

        socket.join(roomId)

        callback({ success: true, roomId, roomCode, playerId, room })
      } catch (err: any) {
        callback({ success: false, error: err.message })
      }
    })

    // ─── Join Room ────────────────────────────────────────
    socket.on('room:join', (payload: {
      roomCode: string
      nickname: string
      playerId?: string  // If reconnecting
    }, callback) => {
      try {
        const roomId = codeToRoom.get(payload.roomCode.toUpperCase())
        if (!roomId) return callback({ success: false, error: 'Room not found' })

        const playerId = payload.playerId ?? uuidv4()
        const { room, error } = addPlayerToRoom(roomId, playerId, payload.nickname)

        if (error) return callback({ success: false, error })

        socketPlayers.set(socket.id, { playerId, roomId, nickname: payload.nickname })
        if (!roomSockets.has(roomId)) roomSockets.set(roomId, new Set())
        roomSockets.get(roomId)!.add(socket.id)

        socket.join(roomId)

        // Notify others
        socket.to(roomId).emit('room:playerJoined', {
          playerId,
          nickname: payload.nickname,
          room,
        })

        callback({ success: true, roomId, roomCode: payload.roomCode.toUpperCase(), playerId, room })
      } catch (err: any) {
        callback({ success: false, error: err.message })
      }
    })

    // ─── Take Seat ────────────────────────────────────────
    socket.on('room:takeSeat', (payload: { seatNumber: number }, callback) => {
      const playerInfo = socketPlayers.get(socket.id)
      if (!playerInfo) return callback?.({ success: false, error: 'Not connected to a room' })

      const { room, error } = takeSeat(playerInfo.roomId, playerInfo.playerId, payload.seatNumber)
      if (error) return callback?.({ success: false, error })

      io.to(playerInfo.roomId).emit('room:update', { room })
      callback?.({ success: true, room })
    })

    // ─── Buy Chips ────────────────────────────────────────
    socket.on('room:buyChips', (payload: { amount: number }, callback) => {
      const playerInfo = socketPlayers.get(socket.id)
      if (!playerInfo) return callback?.({ success: false, error: 'Not in a room' })

      const room = getRoom(playerInfo.roomId)
      if (!room) return callback?.({ success: false, error: 'Room not found' })

      const player = room.players.find(p => p.playerId === playerInfo.playerId)
      if (!player) return callback?.({ success: false, error: 'Player not found' })

      // For MVP, self-service buy-in only from lobby
      if (room.status !== 'LOBBY') {
        return callback?.({ success: false, error: 'Game already started — ask host to approve rebuy' })
      }

      const { room: updated } = require('./roomManager').buyChips(playerInfo.roomId, playerInfo.playerId, payload.amount)
      io.to(playerInfo.roomId).emit('room:update', { room: updated })
      callback?.({ success: true, room: updated })
    })

    // ─── Start Game ───────────────────────────────────────
    socket.on('game:start', (_, callback) => {
      const playerInfo = socketPlayers.get(socket.id)
      if (!playerInfo) return callback?.({ success: false, error: 'Not in a room' })

      const room = getRoom(playerInfo.roomId)
      if (!room) return callback?.({ success: false, error: 'Room not found' })

      // Only host can start
      const player = room.players.find(p => p.playerId === playerInfo.playerId)
      if (!player?.isHost) return callback?.({ success: false, error: 'Only the host can start the game' })

      const { room: updated, error } = startGame(playerInfo.roomId)
      if (error) return callback?.({ success: false, error })

      io.to(playerInfo.roomId).emit('game:started', { room: updated })
      io.to(playerInfo.roomId).emit('room:update', { room: updated })
      callback?.({ success: true, room: updated })
    })

    // ─── Player Action ────────────────────────────────────
    socket.on('game:action', (request: PlayerActionRequest, callback) => {
      const playerInfo = socketPlayers.get(socket.id)
      if (!playerInfo) return callback?.({ success: false, error: 'Not in a room' })

      // Ensure playerId from socket, not from client (anti-cheat)
      const validatedRequest: PlayerActionRequest = {
        ...request,
        playerId: playerInfo.playerId,  // Always use server-tracked playerId
      }

      const { room, error } = handlePlayerAction(playerInfo.roomId, validatedRequest)
      if (error) return callback?.({ success: false, error })

      io.to(playerInfo.roomId).emit('room:update', { room })

      if (room.currentHand?.isComplete) {
        io.to(playerInfo.roomId).emit('game:handComplete', {
          hand: room.currentHand,
          room,
        })
        // Auto-start next hand after 5 seconds
        setTimeout(() => {
          const r = getRoom(playerInfo.roomId)
          if (r && r.status === 'ACTIVE') {
            const { room: nextRoom, error } = startNewHand(playerInfo.roomId)
            if (!error) {
              io.to(playerInfo.roomId).emit('room:update', { room: nextRoom })
            }
          }
        }, 5000)
      }

      callback?.({ success: true, room })
    })

    // ─── Chap ─────────────────────────────────────────────
    socket.on('game:chap', (_, callback) => {
      const playerInfo = socketPlayers.get(socket.id)
      if (!playerInfo) return callback?.({ success: false, error: 'Not in a room' })

      const room = getRoom(playerInfo.roomId)
      if (!room) return callback?.({ success: false, error: 'Room not found' })

      const player = room.players.find(p => p.playerId === playerInfo.playerId)
      if (!player?.isHost) return callback?.({ success: false, error: 'Only the host can start Chap' })

      const { room: updated, error } = startChapHand(playerInfo.roomId)
      if (error) return callback?.({ success: false, error })

      io.to(playerInfo.roomId).emit('room:update', { room: updated })
      // Chap resolves immediately
      if (updated.currentHand?.isComplete) {
        io.to(playerInfo.roomId).emit('game:handComplete', { hand: updated.currentHand, room: updated })
        setTimeout(() => {
          const r = getRoom(playerInfo.roomId)
          if (r && r.status === 'ACTIVE') {
            const { room: nextRoom } = startNewHand(playerInfo.roomId)
            if (nextRoom) io.to(playerInfo.roomId).emit('room:update', { room: nextRoom })
          }
        }, 5000)
      }
      callback?.({ success: true, room: updated })
    })

    // ─── Rebuy Approval ───────────────────────────────────
    socket.on('game:approveRebuy', (payload: { targetPlayerId: string; amount: number }, callback) => {
      const playerInfo = socketPlayers.get(socket.id)
      if (!playerInfo) return callback?.({ success: false, error: 'Not in a room' })

      const room = getRoom(playerInfo.roomId)
      const player = room?.players.find(p => p.playerId === playerInfo.playerId)
      if (!player?.isHost) return callback?.({ success: false, error: 'Only host can approve rebuys' })

      const { room: updated, error } = approveRebuy(playerInfo.roomId, payload.targetPlayerId, payload.amount)
      if (error) return callback?.({ success: false, error })

      io.to(playerInfo.roomId).emit('room:update', { room: updated })
      callback?.({ success: true, room: updated })
    })

    // ─── Admin Actions ────────────────────────────────────
    socket.on('admin:pause', () => {
      const playerInfo = socketPlayers.get(socket.id)
      if (!playerInfo) return
      const room = getRoom(playerInfo.roomId)
      const player = room?.players.find(p => p.playerId === playerInfo.playerId)
      if (!player?.isHost) return
      const updated = pauseGame(playerInfo.roomId)
      if (updated) io.to(playerInfo.roomId).emit('room:update', { room: updated })
    })

    socket.on('admin:resume', () => {
      const playerInfo = socketPlayers.get(socket.id)
      if (!playerInfo) return
      const room = getRoom(playerInfo.roomId)
      const player = room?.players.find(p => p.playerId === playerInfo.playerId)
      if (!player?.isHost) return
      const updated = resumeGame(playerInfo.roomId)
      if (updated) io.to(playerInfo.roomId).emit('room:update', { room: updated })
    })

    socket.on('admin:kick', (payload: { targetPlayerId: string }) => {
      const playerInfo = socketPlayers.get(socket.id)
      if (!playerInfo) return
      const room = getRoom(playerInfo.roomId)
      const player = room?.players.find(p => p.playerId === playerInfo.playerId)
      if (!player?.isHost) return
      const updated = kickPlayer(playerInfo.roomId, payload.targetPlayerId)
      if (updated) io.to(playerInfo.roomId).emit('room:update', { room: updated })
    })

    socket.on('admin:adjustChips', (payload: { targetPlayerId: string; newAmount: number }) => {
      const playerInfo = socketPlayers.get(socket.id)
      if (!playerInfo) return
      const room = getRoom(playerInfo.roomId)
      const player = room?.players.find(p => p.playerId === playerInfo.playerId)
      if (!player?.isHost) return
      const updated = adjustChips(playerInfo.roomId, payload.targetPlayerId, payload.newAmount)
      if (updated) io.to(playerInfo.roomId).emit('room:update', { room: updated })
    })

    socket.on('admin:endNight', (_, callback) => {
      const playerInfo = socketPlayers.get(socket.id)
      if (!playerInfo) return callback?.({ success: false, error: 'Not in a room' })
      const room = getRoom(playerInfo.roomId)
      const player = room?.players.find(p => p.playerId === playerInfo.playerId)
      if (!player?.isHost) return callback?.({ success: false, error: 'Host only' })
      const result = endNight(playerInfo.roomId)
      if (!result) return callback?.({ success: false, error: 'Failed' })
      io.to(playerInfo.roomId).emit('game:nightEnded', result)
      callback?.({ success: true, ...result })
    })

    // ─── Disconnect ───────────────────────────────────────
    socket.on('disconnect', () => {
      const playerInfo = socketPlayers.get(socket.id)
      if (playerInfo) {
        setPlayerConnected(playerInfo.roomId, playerInfo.playerId, false)
        roomSockets.get(playerInfo.roomId)?.delete(socket.id)
        const room = getRoom(playerInfo.roomId)
        if (room) {
          socket.to(playerInfo.roomId).emit('room:playerDisconnected', {
            playerId: playerInfo.playerId,
            room,
          })
        }
        socketPlayers.delete(socket.id)
      }
    })

    // ─── Heartbeat ────────────────────────────────────────
    socket.on('ping', () => socket.emit('pong'))
  })

  return io
}
