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

// geoip-country ships no type declarations. Only the fields this app reads.
declare module 'geoip-country' {
  interface CountryRecord {
    country: string
    name?: string
  }
  const geoip: { lookup(ip: string): CountryRecord | null }
  export default geoip
}
