import type { Toast } from '../useToasts.ts'

/**
 * The live region is always mounted, not created alongside the first toast —
 * assistive tech only announces changes inside a region it was already
 * watching, so a region that appears together with its content stays silent.
 */
export function ToastList({
  toasts,
  onDismiss,
}: {
  toasts: Toast[]
  onDismiss: (id: number) => void
}) {
  return (
    <div className="toasts" role="status" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone}`}>
          <span className="toast-msg">{t.message}</span>
          <button className="icon-btn" onClick={() => onDismiss(t.id)} aria-label="Dismiss message">
            <span aria-hidden="true">✕</span>
          </button>
        </div>
      ))}
    </div>
  )
}
