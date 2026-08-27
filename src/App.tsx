import { useCallback, useEffect, useRef, useState } from 'react'
import type { TorrentSnapshot } from '../shared/types.ts'
import { api } from './api.ts'
import { useTorrents } from './useTorrents.ts'
import { useToasts } from './useToasts.ts'
import { Toolbar } from './components/Toolbar.tsx'
import { TorrentTable } from './components/TorrentTable.tsx'
import { StatusBar } from './components/StatusBar.tsx'
import { DetailPanel } from './components/DetailPanel.tsx'
import { DropZone } from './components/DropZone.tsx'
import { AddTorrentDialog } from './components/AddTorrentDialog.tsx'
import { FilePickerDialog } from './components/FilePickerDialog.tsx'
import { Modal } from './components/Modal.tsx'
import { ToastList } from './components/ToastList.tsx'

export function App() {
  const { torrents, stats, connected } = useTorrents()
  const { toasts, notify, dismiss, attempt } = useToasts()
  const [selectedHash, setSelectedHash] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [removing, setRemoving] = useState<TorrentSnapshot | null>(null)
  const [detailHeight, setDetailHeight] = useState(300)
  // Pickers the user closed without choosing. Dismissing must not destroy the
  // torrent, but the picker also can't immediately reopen, so remember it and
  // let selecting the row bring it back.
  const [dismissedPickers, setDismissedPickers] = useState<Set<string>>(new Set())

  const selected = torrents.find((t) => t.infoHash === selectedHash) ?? null

  // Auto-open the file picker for any torrent that has metadata but no chosen
  // files yet (i.e. freshly added). Nothing downloads until the user confirms.
  const picking =
    torrents.find(
      (t) => t.status === 'choosing' && t.files.length > 0 && !dismissedPickers.has(t.infoHash),
    ) ?? null

  // Selecting a row re-opens a picker the user had dismissed.
  const selectTorrent = useCallback((infoHash: string) => {
    setSelectedHash(infoHash)
    setDismissedPickers((prev) => {
      if (!prev.has(infoHash)) return prev
      const next = new Set(prev)
      next.delete(infoHash)
      return next
    })
  }, [])

  // ---- actions ----
  const addMagnet = useCallback(async (magnet: string) => {
    const { infoHash } = await api.addMagnet(magnet)
    setSelectedHash(infoHash)
  }, [])

  const addTorrentFiles = useCallback(
    async (files: File[]) => {
      for (const f of files) {
        try {
          const { infoHash } = await api.addTorrentFile(f)
          setSelectedHash(infoHash)
        } catch (err) {
          notify(`Failed to add ${f.name}: ${err instanceof Error ? err.message : err}`)
        }
      }
    },
    [notify],
  )

  const seedFiles = useCallback(
    async (files: File[]) => {
      try {
        const { infoHash } = await api.seedFiles(files)
        setSelectedHash(infoHash)
      } catch (err) {
        notify(`Failed to seed: ${err instanceof Error ? err.message : err}`)
      }
    },
    [notify],
  )

  // ---- detail panel resize ----
  const dragRef = useRef(false)
  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragRef.current) return
      const h = window.innerHeight - e.clientY - 28 // minus status bar
      setDetailHeight(Math.min(Math.max(h, 120), window.innerHeight - 200))
    }
    const up = () => (dragRef.current = false)
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
  }, [])

  return (
    <div className="app">
      <div className="topbar">
        <span className="brand">
          <span className={`dot ${connected ? '' : 'off'}`} />
          webbit
        </span>
        <Toolbar
          selected={selected}
          onAddMagnet={() => setShowAdd(true)}
          onAddTorrentFiles={addTorrentFiles}
          onSeedFiles={seedFiles}
          onPause={() => selected && attempt(() => api.pause(selected.infoHash), 'Could not pause')}
          onResume={() => selected && attempt(() => api.resume(selected.infoHash), 'Could not resume')}
          onRemove={() => selected && setRemoving(selected)}
        />
      </div>

      <div className="main">
        <div className="table-wrap">
          {torrents.length === 0 ? (
            <div className="empty">
              <h2>No torrents yet</h2>
              <div>
                Add a <b>magnet link</b> or a <b>.torrent file</b>, or drop files here to seed.
              </div>
            </div>
          ) : (
            <TorrentTable
              torrents={torrents}
              selected={selectedHash}
              onSelect={selectTorrent}
            />
          )}
        </div>

        {selected && (
          <>
            <div
              className="detail-resizer"
              onMouseDown={() => (dragRef.current = true)}
            />
            <div className="detail" style={{ height: detailHeight }}>
              <DetailPanel torrent={selected} attempt={attempt} />
            </div>
          </>
        )}
      </div>

      <StatusBar stats={stats} />

      <ToastList toasts={toasts} onDismiss={dismiss} />

      <DropZone onTorrents={addTorrentFiles} onSeed={seedFiles} />

      {showAdd && (
        <AddTorrentDialog onClose={() => setShowAdd(false)} onAdd={addMagnet} />
      )}

      {picking && (
        <FilePickerDialog
          torrent={picking}
          onDismiss={() =>
            setDismissedPickers((prev) => new Set(prev).add(picking.infoHash))
          }
          onDiscard={() => attempt(() => api.remove(picking.infoHash, true), 'Could not discard torrent')}
          onConfirm={(indices) =>
            attempt(() => api.choose(picking.infoHash, indices), 'Could not start download')
          }
        />
      )}

      {removing && (
        <RemoveDialog
          torrent={removing}
          onClose={() => setRemoving(null)}
          onConfirm={(deleteData) => {
            attempt(() => api.remove(removing.infoHash, deleteData), 'Could not remove torrent')
            if (selectedHash === removing.infoHash) setSelectedHash(null)
            setRemoving(null)
          }}
        />
      )}
    </div>
  )
}

function RemoveDialog({
  torrent,
  onClose,
  onConfirm,
}: {
  torrent: TorrentSnapshot
  onClose: () => void
  onConfirm: (deleteData: boolean) => void
}) {
  const [deleteData, setDeleteData] = useState(false)
  return (
    <Modal
      title="Remove torrent"
      onClose={onClose}
      footer={
        <div className="right">
          <button onClick={onClose}>Cancel</button>
          <button className="danger primary" onClick={() => onConfirm(deleteData)}>
            Remove
          </button>
        </div>
      }
    >
      <div className="modal-body">
        <p style={{ margin: '0 0 12px' }}>
          Remove <b>{torrent.name}</b> from the list?
        </p>
        <label className="check">
          <input
            type="checkbox"
            checked={deleteData}
            onChange={(e) => setDeleteData(e.target.checked)}
          />
          Also delete downloaded data from disk
        </label>
      </div>
    </Modal>
  )
}
