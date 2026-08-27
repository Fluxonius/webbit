// Shared data contract between the Node engine and the React UI.
// Kept dependency-free so both the server (native TS) and the browser bundle
// can import it.

export type TorrentStatus =
  | 'connecting' // added, waiting for metadata
  | 'choosing' // metadata in, waiting for the user to pick files
  | 'downloading'
  | 'seeding' // download complete, now only uploading
  | 'paused'
  | 'done' // complete and idle (no selected files left to seed)
  | 'error'

export interface FileInfo {
  index: number
  name: string
  path: string // full path within the torrent, e.g. "Show/ep1.mkv"
  length: number
  downloaded: number
  progress: number // 0..1
  selected: boolean
  streamable: boolean // has a previewable MIME type
  mime: string
}

export interface PeerInfo {
  id: string // ip:port
  address: string
  client: string // decoded from peer-id, e.g. "qBittorrent 4.6"
  downloadSpeed: number // bytes/s from this peer
  uploadSpeed: number
  progress: number // 0..1, how much of the torrent this peer has (if known)
  flags: string // e.g. "encrypted", "utp"
  /** ISO 3166-1 alpha-2, or '' when the IP isn't in the database. */
  country: string
  /** Human-readable country name, or '' — pairs with `country` so the flag is never the only signal. */
  countryName: string
}

export interface TorrentSnapshot {
  infoHash: string
  name: string
  magnetURI: string
  status: TorrentStatus
  progress: number // 0..1
  length: number // total size of SELECTED files
  downloaded: number
  uploaded: number
  downloadSpeed: number
  uploadSpeed: number
  numPeers: number
  ratio: number
  timeRemaining: number | null // ms remaining; null when unknown/infinite
  addedAt: number
  files: FileInfo[]
  error?: string
  // Diagnostics
  ready: boolean
  paused: boolean
}

// Server -> client websocket frames
export type ServerMessage =
  | { type: 'snapshot'; torrents: TorrentSnapshot[]; stats: GlobalStats }
  | { type: 'added'; infoHash: string }
  | { type: 'error'; message: string }

// A running total across all torrents plus environment info for the status bar.
export interface GlobalStats {
  downloadSpeed: number
  uploadSpeed: number
  numPeers: number
  numTorrents: number
  downloadPath: string
}
