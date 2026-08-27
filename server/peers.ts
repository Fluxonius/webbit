import geoip from 'geoip-country'

// Decode a BitTorrent peer-id into a human client name.
// Covers the common Azureus-style ("-XXdddd-") and a few Shadow-style ids.

const AZUREUS: Record<string, string> = {
  AZ: 'Azureus',
  BT: 'BitTorrent',
  UT: 'µTorrent',
  UW: 'µTorrent Web',
  UM: 'µTorrent Mac',
  qB: 'qBittorrent',
  TR: 'Transmission',
  DE: 'Deluge',
  LT: 'libtorrent',
  lt: 'libTorrent',
  BI: 'BiglyBT',
  WW: 'WebTorrent',
  WT: 'BitTorrent',
  WD: 'WebTorrent Desktop',
  FD: 'Free Download Manager',
  TX: 'Tixati',
  FL: 'Folx',
  KT: 'KTorrent',
  RN: 'Rain',
  PI: 'PicoTorrent',
}

const SHADOW: Record<string, string> = {
  A: 'ABC',
  T: 'BitTornado',
  R: 'Tribler',
  S: 'Shad0w',
  U: 'UPnP NAT Bit Torrent',
}

function decodeAzureusVersion(prefix: string, raw: string): string {
  const name = AZUREUS[prefix]
  if (!name) return ''
  // raw is the full peer id incl. leading '-', e.g. "-qB4650-...".
  // The 4 version digits sit at indices 3..6.
  const digits = raw.slice(3, 7)
  if (/^\d{4}$/.test(digits)) {
    const version = `${digits[0]}.${digits[1]}.${digits[2]}`.replace(/(\.0)+$/, '')
    return `${name} ${version}`.trim()
  }
  return name
}

/**
 * @param peerIdHex hex-encoded 20-byte peer id, or empty
 */
export function decodeClient(peerIdHex: string | null | undefined): string {
  if (!peerIdHex) return 'unknown'
  let raw: string
  try {
    raw = Buffer.from(peerIdHex, 'hex').toString('latin1')
  } catch {
    return 'unknown'
  }
  if (!raw) return 'unknown'

  // Azureus style: -XXdddd-
  if (raw[0] === '-' && /[A-Za-z]{2}/.test(raw.slice(1, 3))) {
    const prefix = raw.slice(1, 3)
    const decoded = decodeAzureusVersion(prefix, raw)
    if (decoded) return decoded
    return `${prefix} (unknown)`
  }

  // WebTorrent uses "-WW" too, handled above. Shadow style: single letter + version
  const shadow = SHADOW[raw[0]]
  if (shadow) return shadow

  // Mainline: 'M' major-minor-rev
  if (raw[0] === 'M' && /\d/.test(raw[1])) return 'Mainline'

  return 'unknown'
}

/** Friendly label for a wire connection type. */
export function connectionKind(type: string | undefined): string {
  if (!type) return ''
  if (type.startsWith('webrtc')) return 'WebRTC'
  if (type.startsWith('utp')) return 'µTP'
  if (type.startsWith('tcp')) return 'TCP'
  if (type === 'webSeed') return 'Web Seed'
  return type
}

/**
 * Country of a peer's IP, looked up against a local database — no request
 * leaves this machine, which matters when the addresses in question are the
 * user's torrent peers.
 *
 * Returns empty strings for a private, reserved or unknown address rather than
 * guessing; the UI renders that as a neutral placeholder.
 */
export function lookupCountry(ip: string | undefined): { country: string; countryName: string } {
  if (!ip) return { country: '', countryName: '' }
  const hit = geoip.lookup(ip)
  if (!hit?.country) return { country: '', countryName: '' }
  return { country: hit.country, countryName: hit.name || hit.country }
}
