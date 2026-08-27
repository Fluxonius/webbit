import fs from 'node:fs'
import path from 'node:path'
import { SESSION_FILE, TORRENT_CACHE_DIR } from './paths.ts'

// One persisted record per torrent. Enough to fully restore the session after a
// server restart: partial downloads resume, selections are preserved, paused
// torrents stay paused.
export interface SessionEntry {
  infoHash: string
  magnetURI: string
  name: string
  kind: 'download' | 'seed'
  selectedIndices: number[]
  hasChosen: boolean
  paused: boolean
  addedAt: number
  // For seeds, the on-disk source paths so seeding can resume automatically.
  seedPaths?: string[]
}

export function loadSession(): SessionEntry[] {
  try {
    const raw = fs.readFileSync(SESSION_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed as SessionEntry[]
    return []
  } catch {
    return []
  }
}

export function saveSession(entries: SessionEntry[]): void {
  try {
    fs.writeFileSync(SESSION_FILE, JSON.stringify(entries, null, 2))
  } catch (err) {
    console.error('[persistence] failed to write session:', err)
  }
}

// The .torrent metadata is cached so a restart can restore instantly without
// re-fetching metadata from peers.
export function cacheTorrentFile(infoHash: string, data: Uint8Array): void {
  try {
    fs.writeFileSync(path.join(TORRENT_CACHE_DIR, `${infoHash}.torrent`), data)
  } catch (err) {
    console.error('[persistence] failed to cache torrent file:', err)
  }
}

export function readCachedTorrentFile(infoHash: string): Buffer | null {
  try {
    return fs.readFileSync(path.join(TORRENT_CACHE_DIR, `${infoHash}.torrent`))
  } catch {
    return null
  }
}

export function deleteCachedTorrentFile(infoHash: string): void {
  try {
    fs.rmSync(path.join(TORRENT_CACHE_DIR, `${infoHash}.torrent`), { force: true })
  } catch {
    /* ignore */
  }
}
