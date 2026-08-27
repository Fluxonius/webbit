import { useMemo, useRef, useState } from 'react'
import type { TorrentSnapshot } from '../../shared/types.ts'
import { formatBytes, formatEta, formatPercent, formatRatio, formatSpeed } from '../format.ts'

type SortKey =
  | 'name'
  | 'length'
  | 'progress'
  | 'downloadSpeed'
  | 'uploadSpeed'
  | 'numPeers'
  | 'timeRemaining'
  | 'ratio'
  | 'status'

interface Column {
  key: SortKey
  label: string
  num?: boolean
  // Fixed pixel width. Snapshots arrive at 1 Hz and every value changes length
  // as it goes ("—" -> "1.23 MB/s", "59s" -> "1m 0s"), so with the browser's
  // default auto layout every tick re-measures and every column visibly jumps.
  // These are sized to the widest realistic value, so the grid never moves.
  // Name has no width: it absorbs the leftover space.
  width?: number
}

const COLUMNS: Column[] = [
  { key: 'name', label: 'Name' },
  { key: 'length', label: 'Size', num: true, width: 88 },
  { key: 'progress', label: 'Progress', num: true, width: 152 },
  { key: 'downloadSpeed', label: '↓ Speed', num: true, width: 104 },
  { key: 'uploadSpeed', label: '↑ Speed', num: true, width: 104 },
  { key: 'numPeers', label: 'Peers', num: true, width: 72 },
  { key: 'timeRemaining', label: 'ETA', num: true, width: 76 },
  { key: 'ratio', label: 'Ratio', num: true, width: 76 },
  { key: 'status', label: 'Status', width: 108 },
]

function ProgressBar({ t }: { t: TorrentSnapshot }) {
  const cls =
    t.status === 'seeding' || t.status === 'done'
      ? 'pbar done'
      : t.status === 'paused'
        ? 'pbar paused'
        : 'pbar'
  const pct = Math.round(t.progress * 100)
  return (
    <div
      className={cls}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={`${formatPercent(t.progress)}, ${t.status}`}
    >
      <span style={{ width: `${pct}%` }} />
      {/* The percentage is already in aria-valuetext; don't read it twice. */}
      <em aria-hidden="true">{formatPercent(t.progress)}</em>
    </div>
  )
}

export function TorrentTable({
  torrents,
  selected,
  onSelect,
}: {
  torrents: TorrentSnapshot[]
  selected: string | null
  onSelect: (infoHash: string) => void
}) {
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [asc, setAsc] = useState(true)

  const sorted = useMemo(() => {
    const arr = [...torrents]
    arr.sort((a, b) => {
      let av: number | string
      let bv: number | string
      if (sortKey === 'name' || sortKey === 'status') {
        av = a[sortKey]
        bv = b[sortKey]
      } else {
        av = (a[sortKey] as number) ?? 0
        bv = (b[sortKey] as number) ?? 0
      }
      const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : av - (bv as number)
      return asc ? cmp : -cmp
    })
    return arr
  }, [torrents, sortKey, asc])

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setAsc(!asc)
    else {
      setSortKey(key)
      setAsc(true)
    }
  }

  // Roving tabindex: the list is a single tab stop, and the arrow keys move
  // within it — so Tab doesn't have to walk past every torrent to reach the
  // rest of the page. Falls back to the first row when nothing is selected.
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([])
  const activeIndex = Math.max(
    0,
    sorted.findIndex((t) => t.infoHash === selected),
  )

  const onRowKeyDown = (e: React.KeyboardEvent, i: number) => {
    let next: number
    switch (e.key) {
      case 'ArrowDown':
        next = Math.min(i + 1, sorted.length - 1)
        break
      case 'ArrowUp':
        next = Math.max(i - 1, 0)
        break
      case 'Home':
        next = 0
        break
      case 'End':
        next = sorted.length - 1
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        onSelect(sorted[i].infoHash)
        return
      default:
        return
    }
    e.preventDefault()
    onSelect(sorted[next].infoHash)
    rowRefs.current[next]?.focus()
  }

  return (
    <table className="torrents" aria-label="Torrents">
      <colgroup>
        {COLUMNS.map((c) => (
          <col key={c.key} style={c.width ? { width: c.width } : undefined} />
        ))}
      </colgroup>
      <thead>
        <tr>
          {COLUMNS.map((c) => (
            <th
              key={c.key}
              className={sortKey === c.key ? 'sorted' : ''}
              // Announced by screen readers as the column's current sort state.
              aria-sort={sortKey === c.key ? (asc ? 'ascending' : 'descending') : 'none'}
            >
              <button
                type="button"
                className={`th-sort${c.num ? ' num' : ''}`}
                onClick={() => toggleSort(c.key)}
              >
                {c.label}
                <span className="sort-arrow" aria-hidden="true">
                  {sortKey === c.key ? (asc ? '▲' : '▼') : ''}
                </span>
              </button>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sorted.map((t, i) => (
          <tr
            key={t.infoHash}
            ref={(el) => {
              rowRefs.current[i] = el
            }}
            className={selected === t.infoHash ? 'selected' : ''}
            tabIndex={i === activeIndex ? 0 : -1}
            aria-current={selected === t.infoHash ? true : undefined}
            onClick={() => onSelect(t.infoHash)}
            onKeyDown={(e) => onRowKeyDown(e, i)}
          >
            <td>
              <div className="name-cell" title={t.name}>
                {t.name}
              </div>
            </td>
            <td className="num">{formatBytes(t.length)}</td>
            <td className="num">
              <ProgressBar t={t} />
            </td>
            <td className="num">{formatSpeed(t.downloadSpeed)}</td>
            <td className="num">{formatSpeed(t.uploadSpeed)}</td>
            <td className="num">{t.numPeers}</td>
            <td className="num" title={formatEta(t.timeRemaining, t.status).hint}>
              {formatEta(t.timeRemaining, t.status).text}
            </td>
            <td className="num">{formatRatio(t.ratio)}</td>
            <td>
              <span className={`pill ${t.status}`}>{t.status}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
