'use client'

import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'

let sharedSocket: Socket | null = null

export function useSocket() {
  const [isConnected, setIsConnected] = useState(false)
  const [socket, setSocket] = useState<Socket | null>(null)

  useEffect(() => {
    if (!sharedSocket || !sharedSocket.connected) {
      sharedSocket = io(window.location.origin, {
        path: '/api/socket',
        transports: ['websocket', 'polling'],
      })
    }

    setSocket(sharedSocket)

    const onConnect = () => setIsConnected(true)
    const onDisconnect = () => setIsConnected(false)

    sharedSocket.on('connect', onConnect)
    sharedSocket.on('disconnect', onDisconnect)
    if (sharedSocket.connected) setIsConnected(true)

    return () => {
      sharedSocket?.off('connect', onConnect)
      sharedSocket?.off('disconnect', onDisconnect)
    }
  }, [])

  return { socket, isConnected }
}
