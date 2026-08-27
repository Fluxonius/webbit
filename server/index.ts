import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import express from 'express'
import { WebSocketServer } from 'ws'
import type { ServerMessage } from '../shared/types.ts'
import { WebbitEngine, mimeFor } from './engine.ts'
import { DOWNLOAD_DIR, STATE_DIR, ensureDirs } from './paths.ts'

const PORT = 8080
const SEED_STAGING = path.join(STATE_DIR, 'seed-staging')

ensureDirs()
fs.mkdirSync(SEED_STAGING, { recursive: true })

const engine = new WebbitEngine()
engine.restore()

const app = express()
app.use(express.json({ limit: '2mb' }))

function safeName(name: string): string {
  // Strip path separators and traversal from user-supplied filenames.
  return path.basename(name).replace(/[/\\]/g, '_') || 'file'
}

// ---- Add torrents --------------------------------------------------------

app.post('/api/add-magnet', async (req, res) => {
  const magnet = String(req.body?.magnet ?? '').trim()
  if (!magnet.startsWith('magnet:')) {
    res.status(400).json({ error: 'Not a magnet link' })
    return
  }
  try {
    const infoHash = await engine.add(magnet)
    res.json({ infoHash })
  } catch (err) {
    res.status(500).json({ error: String(err instanceof Error ? err.message : err) })
  }
})

// Raw .torrent file bytes in the request body.
app.post(
  '/api/add-torrent',
  express.raw({ type: 'application/x-bittorrent', limit: '10mb' }),
  async (req, res) => {
    const buf = req.body as Buffer
    if (!buf || buf.length === 0) {
      res.status(400).json({ error: 'Empty .torrent body' })
      return
    }
    try {
      const infoHash = await engine.add(buf)
      res.json({ infoHash })
    } catch (err) {
      res.status(500).json({ error: String(err instanceof Error ? err.message : err) })
    }
  },
)

// ---- Seeding (grouped multi-file upload) --------------------------------

app.post(
  '/api/seed/:group/file',
  express.raw({ type: 'application/octet-stream', limit: '2gb' }),
  (req, res) => {
    const group = safeName(req.params.group)
    const name = safeName(String(req.query.name ?? 'file'))
    const dir = path.join(SEED_STAGING, group)
    fs.mkdirSync(dir, { recursive: true })
    try {
      fs.writeFileSync(path.join(dir, name), req.body as Buffer)
      res.json({ ok: true })
    } catch (err) {
      res.status(500).json({ error: String(err instanceof Error ? err.message : err) })
    }
  },
)

app.post('/api/seed/:group/commit', async (req, res) => {
  const group = safeName(req.params.group)
  const dir = path.join(SEED_STAGING, group)
  let files: string[]
  try {
    files = fs.readdirSync(dir).map((f) => path.join(dir, f))
  } catch {
    files = []
  }
  if (files.length === 0) {
    res.status(400).json({ error: 'No files uploaded for this group' })
    return
  }
  try {
    const infoHash = await engine.seedFiles(files)
    res.json({ infoHash })
  } catch (err) {
    res.status(500).json({ error: String(err instanceof Error ? err.message : err) })
  }
})

// ---- Torrent control -----------------------------------------------------

// These all act on one torrent, and every one of them can fail the same two
// ways: a malformed request, or an infoHash the engine doesn't know. Both used
// to come back as 200 {ok:false}, which the client's `res.ok` check read as
// success — so a failed pause looked exactly like a successful one and the UI
// stayed silent. Give failures a real status code.
function requireInfoHash(req: express.Request, res: express.Response): string | null {
  const infoHash = req.body?.infoHash
  if (typeof infoHash !== 'string' || infoHash.length === 0) {
    res.status(400).json({ error: 'infoHash is required' })
    return null
  }
  return infoHash
}

function sendResult(res: express.Response, ok: boolean, action: string): void {
  if (!ok) {
    res.status(404).json({ error: `Cannot ${action}: no such torrent` })
    return
  }
  res.json({ ok: true })
}

app.post('/api/choose', (req, res) => {
  const infoHash = requireInfoHash(req, res)
  if (infoHash === null) return
  const { indices } = req.body ?? {}
  if (!Array.isArray(indices)) {
    res.status(400).json({ error: 'indices must be an array' })
    return
  }
  sendResult(res, engine.choose(infoHash, indices.map(Number)), 'choose files')
})

app.post('/api/file-selected', (req, res) => {
  const infoHash = requireInfoHash(req, res)
  if (infoHash === null) return
  const { index, selected } = req.body ?? {}
  if (!Number.isInteger(Number(index))) {
    res.status(400).json({ error: 'index must be an integer' })
    return
  }
  sendResult(
    res,
    engine.setFileSelected(infoHash, Number(index), Boolean(selected)),
    'change file selection',
  )
})

app.post('/api/pause', (req, res) => {
  const infoHash = requireInfoHash(req, res)
  if (infoHash === null) return
  sendResult(res, engine.pause(infoHash), 'pause')
})

app.post('/api/resume', (req, res) => {
  const infoHash = requireInfoHash(req, res)
  if (infoHash === null) return
  sendResult(res, engine.resume(infoHash), 'resume')
})

app.post('/api/remove', (req, res) => {
  const infoHash = requireInfoHash(req, res)
  if (infoHash === null) return
  sendResult(res, engine.remove(infoHash, Boolean(req.body?.deleteData)), 'remove')
})

app.post('/api/cleanup', (req, res) => {
  const infoHash = requireInfoHash(req, res)
  if (infoHash === null) return
  res.json(engine.cleanupUnselected(infoHash))
})

app.get('/api/peers/:infoHash', (req, res) => {
  res.json({ peers: engine.peers(String(req.params.infoHash)) })
})

// ---- Streaming & download ------------------------------------------------

type ParsedRange = { start: number; end: number }

// Parse a single-range `Range` header against a known total size.
//   null            -> no range, or a header we can't parse (serve 200, whole file)
//   'unsatisfiable' -> syntactically valid but outside the file (serve 416)
//   {start, end}    -> inclusive byte range (serve 206)
function parseRange(header: string | undefined, total: number): ParsedRange | 'unsatisfiable' | null {
  if (!header) return null
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match) return null
  const [, rawStart, rawEnd] = match
  if (rawStart === '' && rawEnd === '') return null // "bytes=-" is malformed

  // Suffix form: "bytes=-500" asks for the LAST 500 bytes.
  if (rawStart === '') {
    const suffix = parseInt(rawEnd, 10)
    if (suffix <= 0) return 'unsatisfiable'
    return { start: Math.max(0, total - suffix), end: total - 1 }
  }

  const start = parseInt(rawStart, 10)
  if (start >= total) return 'unsatisfiable'
  // An open or over-long end is clamped to the last byte rather than rejected.
  const end = rawEnd === '' ? total - 1 : Math.min(parseInt(rawEnd, 10), total - 1)
  if (end < start) return 'unsatisfiable'
  return { start, end }
}

function serveFile(req: express.Request, res: express.Response, asAttachment: boolean): void {
  const infoHash = String(req.params.infoHash)
  const index = Number(req.params.index)
  const file = engine.getFile(infoHash, index)
  if (!file) {
    res.status(404).end('File not found')
    return
  }
  const total = file.length
  const range = req.headers.range

  res.setHeader('Accept-Ranges', 'bytes')
  // Use the engine's extension-aware mime, not WebTorrent's raw file.type —
  // the UI picks its <video>/<img>/<iframe> element from the same value, and a
  // mismatched Content-Type makes the browser refuse to render inline.
  res.setHeader('Content-Type', mimeFor(file))
  if (asAttachment) {
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`)
  }

  let start = 0
  let end = total - 1

  // RFC 7233: a Range we can't parse must be ignored (plain 200), and a
  // suffix range ("bytes=-500") means the LAST 500 bytes.
  const parsed = total > 0 ? parseRange(range, total) : null
  if (parsed === 'unsatisfiable') {
    res.status(416).setHeader('Content-Range', `bytes */${total}`)
    res.end()
    return
  }
  if (parsed) {
    start = parsed.start
    end = parsed.end
    res.status(206)
    res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`)
  }
  res.setHeader('Content-Length', String(total === 0 ? 0 : end - start + 1))
  if (total === 0) {
    res.end()
    return
  }

  const stream = file.createReadStream({ start, end })
  stream.on('error', (err) => {
    console.error('[stream] error:', err)
    if (!res.headersSent) res.status(500)
    res.end()
  })
  req.on('close', () => stream.destroy())
  stream.pipe(res)
}

app.get('/stream/:infoHash/:index', (req, res) => serveFile(req, res, false))
app.get('/download/:infoHash/:index', (req, res) => serveFile(req, res, true))

// ---- Static production build (optional) ----------------------------------

const DIST = path.join(process.cwd(), 'dist')
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST))
  app.get(/^(?!\/api|\/stream|\/download|\/ws).*/, (_req, res) => {
    res.sendFile(path.join(DIST, 'index.html'))
  })
}

// ---- HTTP + WebSocket wiring ---------------------------------------------

const server = http.createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

function broadcast(msg: ServerMessage): void {
  const data = JSON.stringify(msg)
  for (const ws of wss.clients) {
    if (ws.readyState === ws.OPEN) ws.send(data)
  }
}

// Push a full snapshot once per second, after running engine maintenance
// (sweeping leftover files once selected downloads complete).
setInterval(() => {
  engine.tick()
  broadcast({ type: 'snapshot', torrents: engine.snapshot(), stats: engine.globalStats() })
}, 1000)

wss.on('connection', (ws) => {
  // Send an immediate snapshot so a freshly opened tab isn't blank for ~1s.
  ws.send(
    JSON.stringify({
      type: 'snapshot',
      torrents: engine.snapshot(),
      stats: engine.globalStats(),
    } satisfies ServerMessage),
  )
})

// Bind to loopback only. The API has no authentication: anything that can
// reach it can stream your files, add torrents, and delete data — so it must
// not be reachable from the rest of the network.
server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  webbit engine listening on http://localhost:${PORT}`)
  console.log(`  downloads -> ${DOWNLOAD_DIR}`)
  console.log(`  open the UI at http://localhost:5173 (dev) \n`)
})

function shutdown(): void {
  console.log('\n[engine] shutting down, saving session…')
  engine.destroy()
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 2000)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
