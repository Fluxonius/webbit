import { useEffect, useId, useRef, type ReactNode } from 'react'
import { XIcon } from '@phosphor-icons/react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Shared dialog shell: Escape to close, focus trapped inside while open, focus
 * returned to whatever opened it, and the roles a screen reader needs.
 *
 * `onClose` is the *non-destructive* dismissal — Escape, backdrop click and the
 * ✕ button all route here, because none of them are a deliberate choice. Any
 * destructive action belongs on an explicit, labelled button in the footer.
 */
export function Modal({
  title,
  onClose,
  wide,
  children,
  footer,
}: {
  title: ReactNode
  onClose: () => void
  wide?: boolean
  children: ReactNode
  footer: ReactNode
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  // Callers pass an inline arrow, so `onClose` is a fresh reference on every
  // render — and the parent re-renders once a second off the snapshot stream.
  // Kept in a ref so the effect below can mount exactly once: depending on
  // `onClose` directly would re-run it every second, yanking focus back out of
  // the dialog each time.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Captured during render, not in the effect: React applies a child's
  // autoFocus while committing, which is before effects run — by then
  // document.activeElement is already inside the dialog, and we'd "restore"
  // focus to a node that is about to be removed.
  const openerRef = useRef<HTMLElement | null>(null)
  if (openerRef.current === null) openerRef.current = document.activeElement as HTMLElement | null

  useEffect(() => {
    // Land on the first control in the body — the magnet field, the file tree,
    // the checkbox. The ✕ in the header is first in DOM order but the last
    // thing anyone wants to start on.
    const root = dialogRef.current
    const body = root?.querySelector('.modal-body')
    const first =
      body?.querySelector<HTMLElement>(FOCUSABLE) ?? root?.querySelector<HTMLElement>(FOCUSABLE)
    first?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab') return
      // Trap: Tab past the last control wraps to the first, and vice versa.
      const items = [...(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])]
      if (items.length === 0) return
      const edge = e.shiftKey ? items[0] : items[items.length - 1]
      if (document.activeElement === edge) {
        e.preventDefault()
        ;(e.shiftKey ? items[items.length - 1] : items[0]).focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      // Deferred: React tears the dialog out of the DOM after this cleanup
      // runs, and removing the focused node resets focus to <body>. Restoring
      // on the next task puts it back where it came from and makes it stick.
      // A timer rather than requestAnimationFrame, which never fires while the
      // tab is hidden — focus would then be stranded on <body> on return.
      setTimeout(() => {
        // Not every cleanup is a real close: StrictMode runs mount → cleanup →
        // mount, and this would then fire after the remount and drag focus out
        // of a dialog that is still on screen. If one is open, leave it alone.
        if (document.querySelector('[role="dialog"]')) return
        openerRef.current?.focus?.()
      }, 0)
    }
  }, [])

  return (
    <div className="ds-backdrop modal-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        className={`ds-modal app-modal${wide ? ' ds-modal--wide' : ' ds-modal--form'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <span className="title" id={titleId}>
            {title}
          </span>
          {/* Plain priority: a repeated, unlabelled affordance that must not
              compete with the footer's real actions. */}
          <button
            className="ds-btn ds-iconbtn ds-btn--plain ds-btn--neutral"
            onClick={onClose}
            aria-label="Close dialog"
            title="Close dialog"
          >
            <XIcon aria-hidden="true" />
          </button>
        </div>
        {children}
        <div className="modal-foot">{footer}</div>
      </div>
    </div>
  )
}
