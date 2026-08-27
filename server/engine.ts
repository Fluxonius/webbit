import fs from 'node:fs'
import path from 'node:path'
import WebTorrent from 'webtorrent'
import type { Torrent, TorrentFile } from 'webtorrent'
import parseTorrent from 'parse-torrent'
import type {
  FileInfo,
  GlobalStats,
  PeerInfo,
  TorrentSnapshot,
  TorrentStatus,
} from '../shared/types.ts'
import { DOWNLOAD_DIR } from './paths.ts'
import { EXTRA_TRACKERS } from './trackers.ts'
import { decodeClient, connectionKind, lookupCountry } from './peers.ts'
import {
  cacheTorrentFile,
  deleteCachedTorrentFile,
  loadSession,
  readCachedTorrentFile,
  saveSession,
  type SessionEntry,
} from './persistence.ts'

interface Managed {
  torrent: Torrent
  kind: 'download' | 'seed'
  addedAt: number
  hasChosen: boolean // has the user picked files yet?
  desiredSelected: Set<number> // file indices the user wants
  appliedSelected: Set<number> // indices currently selected on the torrent
  paused: boolean
  error?: string
  seedPaths?: string[]
  swept: boolean // have unselected leftovers been cleaned since completion?
}

const EXT_MIME: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  avi: 'video/x-msvideo',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  flac: 'audio/flac',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  pdf: 'application/pdf',
  txt: 'text/plain',
}

export function mimeFor(file: TorrentFile): string {
  if (file.type && file.type !== 'application/octet-stream') return file.type
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return EXT_MIME[ext] ?? file.type ?? 'application/octet-stream'
}

function isStreamable(mime: string): boolean {
  return (
    mime.startsWith('video/') ||
    mime.startsWith('audio/') ||
    mime.startsWith('image/') ||
    mime === 'application/pdf' ||
    mime === 'text/plain'
  )
}

// Popcount over a bitfield buffer, used to estimate how much of a torrent a
// remote peer already has.
function countBits(buf: Uint8Array | undefined, maxBits: number): number {
  if (!buf) return 0
  let bits = 0
  for (let i = 0; i < buf.length; i++) {
    let b = buf[i]
    while (b) {
      bits += b & 1
      b >>= 1
    }
  }
  return Math.min(bits, maxBits)
}

export class WebbitEngine {
  private client: WebTorrent
  private managed = new Map<string, Managed>()
  private saveTimer: ReturnType<typeof setTimeout> | null = null

  constructor() {
    this.client = new WebTorrent()
    this.client.on('error', (err) => {
      // Client-level errors are usually non-fatal (a single torrent failing).
      console.error('[engine] client error:', String(err))
    })
  }

  /** Restore any torrents from the previous session. */
  restore(): void {
    const entries = loadSession()
    for (const entry of entries) {
      try {
        this.restoreEntry(entry)
      } catch (err) {
        console.error('[engine] failed to restore', entry.infoHash, err)
      }
    }
  }

  private restoreEntry(entry: SessionEntry): void {
    if (this.managed.has(entry.infoHash)) return

    if (entry.kind === 'seed') {
      const paths = (entry.seedPaths ?? []).filter((p) => fs.existsSync(p))
      if (paths.length === 0) {
        // Source files are gone; keep a placeholder row flagged as errored so
        // the user knows re-adding is needed, rather than silently dropping it.
        return
      }
      this.doSeed(paths, entry.addedAt)
      return
    }

    const cached = readCachedTorrentFile(entry.infoHash)
    const torrentId: string | Buffer = cached ?? entry.magnetURI
    const torrent = this.client.add(torrentId, {
      path: DOWNLOAD_DIR,
      deselect: true,
      announce: EXTRA_TRACKERS,
    })
    const m: Managed = {
      torrent,
      kind: 'download',
      addedAt: entry.addedAt,
      hasChosen: entry.hasChosen,
      desiredSelected: new Set(entry.selectedIndices),
      appliedSelected: new Set(),
      paused: entry.paused,
      swept: false,
    }
    this.managed.set(entry.infoHash, m)
    this.wireTorrent(m)
  }

  /** Add a torrent by magnet URI or .torrent buffer. Returns the infoHash. */
  async add(torrentId: string | Buffer): Promise<string> {
    // Resolve the infoHash up front. WebTorrent sets torrent.infoHash only after
    // an async parse, so reading it right after client.add() yields undefined.
    const parsed = await parseTorrent(torrentId)
    const infoHash = String(parsed.infoHash ?? '').toLowerCase()
    if (!infoHash) throw new Error('Could not parse torrent info hash')
    if (this.managed.has(infoHash)) return infoHash

    const torrent = this.client.add(torrentId, {
      path: DOWNLOAD_DIR,
      deselect: true,
      announce: EXTRA_TRACKERS,
    })
    const m: Managed = {
      torrent,
      kind: 'download',
      addedAt: Date.now(),
      hasChosen: false,
      desiredSelected: new Set(),
      appliedSelected: new Set(),
      paused: false,
      swept: false,
    }
    this.managed.set(infoHash, m)
    this.wireTorrent(m)
    return infoHash
  }

  /** Seed one or more files already on disk. Resolves with the infoHash. */
  seedFiles(paths: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        this.doSeed(paths, Date.now(), resolve)
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    })
  }

  private doSeed(
    paths: string[],
    addedAt: number,
    onReady?: (infoHash: string) => void,
  ): void {
    const torrent = this.client.seed(paths, { announce: EXTRA_TRACKERS }, (t) => {
      const infoHash = t.infoHash
      const existing = this.managed.get(infoHash)
      if (existing) existing.seedPaths = paths
      this.persistSoon()
      onReady?.(infoHash)
    })
    const m: Managed = {
      torrent,
      kind: 'seed',
      addedAt,
      hasChosen: true, // seeds have nothing to choose
      desiredSelected: new Set(),
      appliedSelected: new Set(),
      paused: false,
      seedPaths: paths,
      swept: false,
    }
    // infoHash may not be known until hashing completes; register on metadata.
    const register = () => {
      if (torrent.infoHash && !this.managed.has(torrent.infoHash)) {
        this.managed.set(torrent.infoHash, m)
        this.wireTorrent(m)
      }
    }
    if (torrent.infoHash) register()
    else torrent.on('metadata', register)
  }

  private wireTorrent(m: Managed): void {
    const t = m.torrent
    t.on('metadata', () => {
      if (t.torrentFile) cacheTorrentFile(t.infoHash, t.torrentFile)
    })
    t.on('ready', () => {
      // For a fresh download the user still needs to choose files. For restored
      // torrents and seeds, apply the saved selection immediately.
      if (m.hasChosen || m.kind === 'seed') this.reconcile(m)
      // A restored torrent whose selected files are already complete: sweep any
      // leftover partial files from earlier deselections.
      if (t.done) this.cleanupUnselected(t.infoHash)
      this.persistSoon()
    })
    t.on('done', () => {
      // Selected files finished — remove stubs of files the user didn't keep.
      this.cleanupUnselected(t.infoHash)
      this.persistSoon()
    })
    t.on('error', (err) => {
      m.error = String(err instanceof Error ? err.message : err)
      this.persistSoon()
    })
    // 'warning' events (tracker timeouts etc.) are noisy and non-fatal; ignore.
  }

  /** Apply the user's file choice. */
  choose(infoHash: string, indices: number[]): boolean {
    const m = this.managed.get(infoHash)
    if (!m) return false
    m.desiredSelected = new Set(indices)
    m.hasChosen = true
    m.error = undefined
    this.reconcile(m)
    this.persistSoon()
    return true
  }

  /** Change selection later (from the Files tab). */
  setFileSelected(infoHash: string, index: number, selected: boolean): boolean {
    const m = this.managed.get(infoHash)
    if (!m) return false
    if (selected) m.desiredSelected.add(index)
    else m.desiredSelected.delete(index)
    m.hasChosen = true
    this.reconcile(m)
    // Unchecking a file means "I don't want it" — remove its leftover data so
    // it doesn't linger on disk as an unopenable partial file.
    if (!selected) this.deleteFileData(m, index)
    this.persistSoon()
    return true
  }

  pause(infoHash: string): boolean {
    const m = this.managed.get(infoHash)
    if (!m) return false
    m.paused = true
    m.torrent.pause()
    this.reconcile(m) // deselect everything so no pieces are requested
    this.persistSoon()
    return true
  }

  resume(infoHash: string): boolean {
    const m = this.managed.get(infoHash)
    if (!m) return false
    m.paused = false
    m.torrent.resume()
    this.reconcile(m)
    this.persistSoon()
    return true
  }

  // Delete a single file's on-disk data. Returns real bytes freed (sparse-aware:
  // counts allocated blocks, not the file's logical length).
  private deleteFileData(m: Managed, index: number): number {
    const f = m.torrent.files[index]
    if (!f) return 0
    const full = path.join(DOWNLOAD_DIR, f.path)
    try {
      const st = fs.statSync(full)
      const realBytes = st.blocks * 512
      fs.rmSync(full, { force: true })
      return realBytes
    } catch {
      return 0 // file was never created on disk
    }
  }

  /** Delete on-disk data for every file the user hasn't selected. */
  cleanupUnselected(infoHash: string): { removed: number; bytesFreed: number } {
    const m = this.managed.get(infoHash)
    if (!m || !m.torrent.ready || m.kind === 'seed') return { removed: 0, bytesFreed: 0 }
    let removed = 0
    let bytesFreed = 0
    for (let i = 0; i < m.torrent.files.length; i++) {
      if (m.desiredSelected.has(i)) continue
      const freed = this.deleteFileData(m, i)
      if (freed > 0) {
        removed++
        bytesFreed += freed
      }
    }
    if (removed > 0) console.log(`[engine] cleaned ${removed} unselected file(s) from ${infoHash}`)
    return { removed, bytesFreed }
  }

  // True once every file the user selected is fully downloaded. Used instead of
  // WebTorrent's own `done`, which can stay false forever over shared boundary
  // pieces between a selected and a deselected file.
  private allSelectedComplete(m: Managed): boolean {
    const t = m.torrent
    if (!t.ready || m.kind !== 'download' || !m.hasChosen) return false
    if (m.desiredSelected.size === 0) return false
    for (const i of m.desiredSelected) {
      const f = t.files[i]
      if (!f || f.progress < 0.999) return false
    }
    return true
  }

  // 1 Hz maintenance: sweep leftover files once a torrent's selected files are
  // complete. Keyed off a per-torrent flag so it runs exactly once per completion.
  tick(): void {
    for (const [infoHash, m] of this.managed) {
      if (m.kind !== 'download' || !m.hasChosen) continue
      const complete = this.allSelectedComplete(m)
      if (complete && !m.swept) {
        this.cleanupUnselected(infoHash)
        m.swept = true
      } else if (!complete && m.swept) {
        m.swept = false // a re-selected file needs downloading again
      }
    }
  }

  remove(infoHash: string, deleteData: boolean): boolean {
    const m = this.managed.get(infoHash)
    if (!m) return false
    this.managed.delete(infoHash)
    deleteCachedTorrentFile(infoHash)
    try {
      m.torrent.destroy({ destroyStore: deleteData })
    } catch (err) {
      console.error('[engine] destroy failed:', err)
    }
    this.persistSoon()
    return true
  }

  // Reconcile the torrent's applied piece selections toward the desired set.
  // When paused, the desired set is treated as empty so nothing downloads.
  private reconcile(m: Managed): void {
    const t = m.torrent
    if (!t.ready || m.kind === 'seed') return
    const target = m.paused ? new Set<number>() : m.desiredSelected
    for (const idx of target) {
      if (!m.appliedSelected.has(idx)) {
        t.files[idx]?.select()
        m.appliedSelected.add(idx)
      }
    }
    for (const idx of [...m.appliedSelected]) {
      if (!target.has(idx)) {
        t.files[idx]?.deselect()
        m.appliedSelected.delete(idx)
      }
    }
  }

  private deriveStatus(m: Managed): TorrentStatus {
    const t = m.torrent
    if (m.error) return 'error'
    if (!t.ready) return 'connecting'
    if (m.kind === 'download' && !m.hasChosen) return 'choosing'
    if (m.paused) return 'paused'
    if (m.kind === 'seed') return 'seeding'
    if (this.allSelectedComplete(m)) return 'seeding'
    return 'downloading'
  }

  private buildFiles(m: Managed): FileInfo[] {
    const t = m.torrent
    if (!t.ready) return []
    return t.files.map((f, index) => {
      const mime = mimeFor(f)
      const selected = m.kind === 'seed' ? true : m.desiredSelected.has(index)
      return {
        index,
        name: f.name,
        path: f.path,
        length: f.length,
        // Deselected files report no data: any bytes on disk are incidental
        // boundary spillover that gets swept, and showing it confuses the UI.
        downloaded: selected ? f.downloaded : 0,
        progress: selected ? f.progress : 0,
        selected,
        streamable: isStreamable(mime),
        mime,
      }
    })
  }

  snapshot(): TorrentSnapshot[] {
    const out: TorrentSnapshot[] = []
    for (const m of this.managed.values()) {
      const t = m.torrent
      const status = this.deriveStatus(m)
      const files = this.buildFiles(m)

      // Size/progress reflect the SELECTED files, not the whole torrent, so a
      // partial selection shows an accurate bar.
      let length = t.length
      let downloaded = t.downloaded
      if (t.ready && m.kind === 'download' && m.hasChosen) {
        const selected = files.filter((f) => f.selected)
        length = selected.reduce((s, f) => s + f.length, 0)
        downloaded = selected.reduce((s, f) => s + f.downloaded, 0)
      }
      const progress = length > 0 ? Math.min(downloaded / length, 1) : 0

      out.push({
        infoHash: t.infoHash,
        name: t.name || t.infoHash,
        magnetURI: t.magnetURI,
        status,
        progress,
        length,
        downloaded,
        uploaded: t.uploaded,
        downloadSpeed: m.paused ? 0 : t.downloadSpeed,
        uploadSpeed: t.uploadSpeed,
        numPeers: t.numPeers,
        ratio: t.ratio,
        timeRemaining:
          status === 'downloading' && Number.isFinite(t.timeRemaining)
            ? t.timeRemaining
            : null,
        addedAt: m.addedAt,
        files,
        error: m.error,
        ready: t.ready,
        paused: m.paused,
      })
    }
    return out.sort((a, b) => a.addedAt - b.addedAt)
  }

  peers(infoHash: string): PeerInfo[] {
    const m = this.managed.get(infoHash)
    if (!m || !m.torrent.ready) return []
    const numPieces = m.torrent.pieces.length || 1
    return m.torrent.wires.map((w) => {
      const address = `${w.remoteAddress ?? '?'}:${w.remotePort ?? 0}`
      // Seeders advertise "have all" via a bufferless bitfield whose get() is
      // always true, so fall back to sampling get() when there's no buffer.
      const pp = w.peerPieces
      let have = 0
      if (pp) {
        if (pp.buffer) have = countBits(pp.buffer, numPieces)
        else if (pp.get(0)) have = numPieces
      }
      return {
        id: address,
        address,
        client: decodeClient(w.peerId),
        downloadSpeed: Math.round(w.downloadSpeed()),
        uploadSpeed: Math.round(w.uploadSpeed()),
        progress: numPieces > 0 ? have / numPieces : 0,
        flags: connectionKind(w.type),
        ...lookupCountry(w.remoteAddress),
      }
    })
  }

  globalStats(): GlobalStats {
    let numPeers = 0
    for (const m of this.managed.values()) numPeers += m.torrent.numPeers
    return {
      downloadSpeed: this.client.downloadSpeed,
      uploadSpeed: this.client.uploadSpeed,
      numPeers,
      numTorrents: this.managed.size,
      downloadPath: DOWNLOAD_DIR,
    }
  }

  getFile(infoHash: string, index: number): TorrentFile | null {
    const m = this.managed.get(infoHash)
    if (!m || !m.torrent.ready) return null
    return m.torrent.files[index] ?? null
  }

  private persistSoon(): void {
    if (this.saveTimer) return
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      this.persistNow()
    }, 1000)
  }

  private persistNow(): void {
    const entries: SessionEntry[] = []
    for (const m of this.managed.values()) {
      const t = m.torrent
      if (!t.infoHash) continue
      entries.push({
        infoHash: t.infoHash,
        magnetURI: t.magnetURI,
        name: t.name || t.infoHash,
        kind: m.kind,
        selectedIndices: [...m.desiredSelected],
        hasChosen: m.hasChosen,
        paused: m.paused,
        addedAt: m.addedAt,
        seedPaths: m.seedPaths,
      })
    }
    saveSession(entries)
  }

  destroy(): void {
    this.persistNow()
    this.client.destroy()
  }
}
