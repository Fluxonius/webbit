// Minimal ambient types for the slice of the WebTorrent API this project uses.
// WebTorrent ships no type declarations of its own.
declare module 'webtorrent' {
  import type { Readable } from 'node:stream'

  interface Wire {
    peerId: string | null
    remoteAddress?: string
    remotePort?: number
    type?: string
    downloaded: number
    uploaded: number
    downloadSpeed(): number
    uploadSpeed(): number
    peerPieces?: { buffer?: Uint8Array; get(i: number): boolean }
  }

  type Bytes = Uint8Array

  interface TorrentFile {
    name: string
    path: string
    length: number
    downloaded: number
    progress: number
    type: string
    select(priority?: number): void
    deselect(): void
    createReadStream(opts?: { start?: number; end?: number }): Readable
  }

  interface Torrent {
    infoHash: string
    name: string
    magnetURI: string
    torrentFile: Bytes
    length: number
    pieceLength: number
    pieces: unknown[]
    ready: boolean
    paused: boolean
    done: boolean
    numPeers: number
    downloaded: number
    uploaded: number
    downloadSpeed: number
    uploadSpeed: number
    progress: number
    ratio: number
    timeRemaining: number
    files: TorrentFile[]
    wires: Wire[]
    select(start: number, end: number, priority?: number | boolean): void
    deselect(start: number, end: number, priority?: number | boolean): void
    pause(): void
    resume(): void
    rescanFiles(cb?: (err: Error | null) => void): void
    destroy(opts?: { destroyStore?: boolean }, cb?: (err: Error | null) => void): void
    addWebSeed(url: string): void
    on(event: 'metadata', cb: () => void): this
    on(event: 'ready', cb: () => void): this
    on(event: 'done', cb: () => void): this
    on(event: 'wire', cb: (wire: Wire, addr?: string) => void): this
    on(event: 'error', cb: (err: Error | string) => void): this
    on(event: 'warning', cb: (err: Error | string) => void): this
    on(event: string, cb: (...args: unknown[]) => void): this
  }

  interface AddOptions {
    path?: string
    deselect?: boolean
    paused?: boolean
    announce?: string[]
    strategy?: 'rarest' | 'sequential'
  }

  interface ClientOptions {
    maxConns?: number
    dht?: boolean
    lsd?: boolean
    utp?: boolean
    downloadLimit?: number
    uploadLimit?: number
  }

  class WebTorrent {
    constructor(opts?: ClientOptions)
    torrents: Torrent[]
    downloadSpeed: number
    uploadSpeed: number
    add(
      torrentId: string | Buffer | Uint8Array,
      opts?: AddOptions,
      cb?: (torrent: Torrent) => void,
    ): Torrent
    seed(
      input: string | Buffer | File | Array<string | Buffer | File>,
      opts?: AddOptions,
      cb?: (torrent: Torrent) => void,
    ): Torrent
    get(id: string): Promise<Torrent | null> | Torrent | null
    remove(
      id: string | Torrent,
      opts?: { destroyStore?: boolean },
      cb?: (err: Error | null) => void,
    ): void
    destroy(cb?: (err: Error | null) => void): void
    on(event: 'torrent', cb: (torrent: Torrent) => void): this
    on(event: 'error', cb: (err: Error | string) => void): this
    on(event: string, cb: (...args: unknown[]) => void): this
  }

  export default WebTorrent
  export type { Torrent, TorrentFile, Wire }
}
