import { useId, useState } from 'react'
import { Modal } from './Modal.tsx'

export function AddTorrentDialog({
  onClose,
  onAdd,
}: {
  onClose: () => void
  onAdd: (magnet: string) => Promise<void>
}) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputId = useId()
  const errorId = useId()

  const valid = value.trim().startsWith('magnet:?xt=urn:btih:')

  const submit = async () => {
    if (!valid) return
    setBusy(true)
    setError(null)
    try {
      await onAdd(value.trim())
      onClose()
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err))
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Add magnet link"
      onClose={onClose}
      footer={
        <div className="right">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" disabled={!valid || busy} onClick={submit}>
            {busy ? 'Adding…' : 'Add torrent'}
          </button>
        </div>
      }
    >
      <div className="modal-body">
        <label className="field-label" htmlFor={inputId}>
          Magnet link
        </label>
        <input
          id={inputId}
          type="text"
          placeholder="magnet:?xt=urn:btih:…"
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
          }}
        />
        <p className="hint">
          Paste a magnet link. After the metadata loads you'll choose which files to download.
        </p>
        {error && (
          <p id={errorId} role="alert" className="hint" style={{ color: 'var(--red)' }}>
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
