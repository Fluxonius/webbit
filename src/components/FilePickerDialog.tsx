import { useMemo, useState } from 'react'
import type { TorrentSnapshot } from '../../shared/types.ts'
import { buildTree } from '../filetree.ts'
import { formatBytes } from '../format.ts'
import { FileTree } from './FileTree.tsx'
import { Modal } from './Modal.tsx'

// Opens once a torrent's metadata is in but the user hasn't chosen files yet.
// Nothing downloads until they confirm.
export function FilePickerDialog({
  torrent,
  onDismiss,
  onDiscard,
  onConfirm,
}: {
  torrent: TorrentSnapshot
  /** Escape / backdrop / ✕ — close the dialog but keep the torrent. */
  onDismiss: () => void
  /** The explicit, labelled destructive action. */
  onDiscard: () => void
  onConfirm: (indices: number[]) => void
}) {
  const tree = useMemo(() => buildTree(torrent.files), [torrent.files])
  // Default: everything selected.
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(torrent.files.map((f) => f.index)),
  )

  const toggle = (indices: number[], on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      for (const i of indices) {
        if (on) next.add(i)
        else next.delete(i)
      }
      return next
    })
  }

  const chosen = torrent.files.filter((f) => selected.has(f.index))
  const totalSize = chosen.reduce((s, f) => s + f.length, 0)

  return (
    <Modal
      wide
      onClose={onDismiss}
      title={
        <span title={torrent.name} style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
          Choose files — {torrent.name}
        </span>
      }
      footer={
        <>
          <span className="hint" style={{ margin: 0 }} aria-live="polite">
            {chosen.length} of {torrent.files.length} files · {formatBytes(totalSize)}
          </span>
          <div className="right">
            <button className="danger" onClick={onDiscard}>
              Discard torrent
            </button>
            <button
              className="primary"
              disabled={chosen.length === 0}
              onClick={() => onConfirm([...selected])}
            >
              Download {chosen.length} file{chosen.length === 1 ? '' : 's'}
            </button>
          </div>
        </>
      }
    >
      <div className="modal-body">
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <button
            className="icon-btn"
            onClick={() => setSelected(new Set(torrent.files.map((f) => f.index)))}
          >
            Select all
          </button>
          <button className="icon-btn" onClick={() => setSelected(new Set())}>
            Select none
          </button>
        </div>
        <FileTree nodes={tree} selected={selected} onToggle={toggle} />
      </div>
    </Modal>
  )
}
