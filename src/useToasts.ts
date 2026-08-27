import { useCallback, useRef, useState } from 'react'

export interface Toast {
  id: number
  message: string
  tone: 'error' | 'info'
}

const DISMISS_AFTER = 8000

export interface Toasts {
  toasts: Toast[]
  notify: (message: string, tone?: Toast['tone']) => void
  dismiss: (id: number) => void
  /** Run an action, surfacing any failure as a toast instead of losing it. */
  attempt: (action: () => Promise<unknown>, whatFailed: string) => void
}

/**
 * In-app notifications. Replaces `alert()`, which blocks the whole window,
 * can't be styled, and can't be read by anything but the browser itself.
 */
export function useToasts(): Toasts {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const notify = useCallback(
    (message: string, tone: Toast['tone'] = 'error') => {
      const id = nextId.current++
      setToasts((prev) => [...prev, { id, message, tone }])
      setTimeout(() => dismiss(id), DISMISS_AFTER)
    },
    [dismiss],
  )

  // Every torrent action is fire-and-forget from a click handler. Without this
  // a rejected request becomes an unhandled promise rejection in the console
  // and nothing at all on screen.
  const attempt = useCallback(
    (action: () => Promise<unknown>, whatFailed: string) => {
      void action().catch((err: unknown) => {
        notify(`${whatFailed}: ${err instanceof Error ? err.message : String(err)}`)
      })
    },
    [notify],
  )

  return { toasts, notify, dismiss, attempt }
}
