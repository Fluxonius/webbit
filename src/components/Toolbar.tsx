import { useRef } from 'react'
import type { TorrentSnapshot } from '../../shared/types.ts'

export function Toolbar({
  selected,
  onAddMagnet,
  onAddTorrentFiles,
  onSeedFiles,
  onPause,
  onResume,
  onRemove,
}: {
  selected: TorrentSnapshot | null
  onAddMagnet: () => void
  onAddTorrentFiles: (files: File[]) => void
  onSeedFiles: (files: File[]) => void
  onPause: () => void
  onResume: () => void
  onRemove: () => void
}) {
  const torrentInput = useRef<HTMLInputElement>(null)
  const seedInput = useRef<HTMLInputElement>(null)

  const canPause =
    selected != null && !selected.paused && selected.status !== 'error'
  const canResume = selected != null && selected.paused

  return (
    <div className="toolbar">
      <button className="primary" onClick={onAddMagnet}>
        ＋ Magnet
      </button>
      <button onClick={() => torrentInput.current?.click()}>⬆ .torrent</button>
      <button onClick={() => seedInput.current?.click()}>🌱 Seed files</button>

      <span style={{ width: 8 }} />

      <button disabled={!canResume} onClick={onResume}>
        ▶ Resume
      </button>
      <button disabled={!canPause} onClick={onPause}>
        ⏸ Pause
      </button>
      <button className="danger" disabled={!selected} onClick={onRemove}>
        🗑 Remove
      </button>

      <input
        ref={torrentInput}
        type="file"
        accept=".torrent,application/x-bittorrent"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length) onAddTorrentFiles(files)
          e.target.value = ''
        }}
      />
      <input
        ref={seedInput}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length) onSeedFiles(files)
          e.target.value = ''
        }}
      />
    </div>
  )
}
