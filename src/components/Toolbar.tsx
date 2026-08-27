import { useRef } from 'react'
import { MagnetIcon, PauseIcon, PlayIcon, PlantIcon, TrashIcon, UploadSimpleIcon } from '@phosphor-icons/react'
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
      {/* Adding a magnet is the app's one default action, so it is the only
          filled button on the bar. Everything else is outline. */}
      <button className="ds-btn ds-btn--filled ds-btn--neutral" onClick={onAddMagnet}>
        <MagnetIcon aria-hidden="true" />
        Magnet
      </button>
      <button
        className="ds-btn ds-btn--outline ds-btn--neutral"
        onClick={() => torrentInput.current?.click()}
      >
        <UploadSimpleIcon aria-hidden="true" />
        .torrent
      </button>
      <button
        className="ds-btn ds-btn--outline ds-btn--neutral"
        onClick={() => seedInput.current?.click()}
      >
        <PlantIcon aria-hidden="true" />
        Seed files
      </button>

      <span className="toolbar-sep" aria-hidden="true" />

      <button
        className="ds-btn ds-btn--outline ds-btn--neutral"
        disabled={!canResume}
        onClick={onResume}
      >
        <PlayIcon aria-hidden="true" />
        Resume
      </button>
      <button
        className="ds-btn ds-btn--outline ds-btn--neutral"
        disabled={!canPause}
        onClick={onPause}
      >
        <PauseIcon aria-hidden="true" />
        Pause
      </button>
      <button
        className="ds-btn ds-btn--outline ds-btn--destructive"
        disabled={!selected}
        onClick={onRemove}
      >
        <TrashIcon aria-hidden="true" />
        Remove
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
