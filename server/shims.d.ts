// parse-torrent ships no types; declare the tiny slice we use.
declare module 'parse-torrent' {
  interface ParsedTorrent {
    infoHash: string
    name?: string
    length?: number
    files?: Array<{ name: string; length: number; path: string }>
  }
  export default function parseTorrent(
    id: string | Uint8Array | Buffer,
  ): Promise<ParsedTorrent>
}
