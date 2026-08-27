import type { TorrentStatus } from '../shared/types.ts'

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  // Clamp low as well as high: speeds are fractional, and for 0 < n < 1 the
  // log is negative, which used to index units[-1] and render "819.2 undefined".
  const exp = Math.floor(Math.log(n) / Math.log(1024))
  const i = Math.min(Math.max(exp, 0), units.length - 1)
  const v = n / Math.pow(1024, i)
  return `${v.toFixed(i === 0 ? 0 : v < 10 ? 2 : 1)} ${units[i]}`
}

export function formatSpeed(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—'
  return `${formatBytes(n)}/s`
}

export function formatPercent(p: number): string {
  return `${Math.min(Math.max(p, 0), 1).toLocaleString(undefined, {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}`
}

export interface Eta {
  text: string
  /** Why there's no number, so "—" doesn't have to mean two different things. */
  hint: string
}

// The server sends null both when a torrent isn't downloading at all and when
// it is but has no estimate yet. Those are different situations and used to
// render identically, so split them apart using the status.
export function formatEta(ms: number | null, status: TorrentStatus): Eta {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) {
    switch (status) {
      case 'downloading':
        return { text: '∞', hint: 'No estimate yet — waiting for a steady download rate' }
      case 'paused':
        return { text: '—', hint: 'Paused, so nothing is being downloaded' }
      case 'seeding':
      case 'done':
        return { text: '—', hint: 'Already complete' }
      case 'connecting':
        return { text: '—', hint: 'Still looking for peers' }
      case 'choosing':
        return { text: '—', hint: 'No files chosen yet' }
      default:
        return { text: '—', hint: 'Not downloading' }
    }
  }
  const s = Math.round(ms / 1000)
  const hint = 'Estimated time until the selected files finish'
  if (s < 60) return { text: `${s}s`, hint }
  const m = Math.floor(s / 60)
  if (m < 60) return { text: `${m}m ${s % 60}s`, hint }
  const h = Math.floor(m / 60)
  if (h < 24) return { text: `${h}h ${m % 60}m`, hint }
  const d = Math.floor(h / 24)
  return { text: `${d}d ${h % 24}h`, hint }
}

export function formatRatio(r: number): string {
  if (!Number.isFinite(r)) return '∞'
  return r.toFixed(2)
}

/**
 * ISO 3166-1 alpha-2 -> the regional-indicator pair that renders as that flag.
 *
 * Not an icon: the design system's icon set has no 250-country flag range, and
 * this is data about a peer rather than a piece of UI furniture. Platforms that
 * don't draw flags (Windows) fall back to the two letters, which still answers
 * the question. Always paired with the country name in a tooltip so the glyph
 * is never the only carrier.
 */
export function countryFlag(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return ''
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  )
}
