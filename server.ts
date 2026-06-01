// ============================================================
// FearFold Poker — Custom Next.js + Socket.IO Server
// Run with: npx tsx server.ts
// ============================================================

import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { createSocketServer } from './src/server/socketServer'

const port = parseInt(process.env.PORT ?? '3000', 10)
const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true)
    handle(req, res, parsedUrl)
  })

  createSocketServer(httpServer)

  httpServer.listen(port, () => {
    console.log(`
    ╔═══════════════════════════════════╗
    ║  🃏  FearFold Poker Server        ║
    ║  Running on http://localhost:${port}  ║
    ╚═══════════════════════════════════╝
    `)
  })
})
