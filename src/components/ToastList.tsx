import { InfoIcon, WarningCircleIcon, XIcon } from '@phosphor-icons/react'
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
      {toasts.map((t) => {
        const isError = t.tone === 'error'
        return (
          <div key={t.id} className={`ds-toast toast${isError ? ' toast--error' : ''}`}>
            {/* Tone is carried by the icon and the message text, not by colour
                alone — an error toast reads as an error in greyscale too. */}
            {isError ? (
              <WarningCircleIcon aria-hidden="true" />
            ) : (
              <InfoIcon aria-hidden="true" />
            )}
            <span className="toast-msg">{t.message}</span>
            <button
              aria-label="Dismiss message"
              title="Dismiss message"
              className="ds-btn ds-iconbtn ds-btn--s ds-btn--plain ds-btn--neutral"
              onClick={() => onDismiss(t.id)}
            >
              <XIcon aria-hidden="true" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
