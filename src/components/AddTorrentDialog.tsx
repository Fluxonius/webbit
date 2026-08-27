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
          <button className="ds-btn ds-btn--outline ds-btn--neutral" onClick={onClose}>
            Cancel
          </button>
          {/* Ink, not accent: the confirming action of a dialog is the system's
              default action, and accent is reserved for meaning. */}
          <button
            className="ds-btn ds-btn--filled ds-btn--neutral"
            disabled={!valid || busy}
            onClick={submit}
          >
            {busy ? 'Adding…' : 'Add torrent'}
          </button>
        </div>
      }
    >
      <div className="modal-body">
        <label className="ds-label" htmlFor={inputId}>
          Magnet link
        </label>
        <input
          className="ds-input"
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
        <p className="ds-help">
          Paste a magnet link. After the metadata loads you'll choose which files to download.
        </p>
        {error && (
          <p id={errorId} role="alert" className="ds-help ds-help--error">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
