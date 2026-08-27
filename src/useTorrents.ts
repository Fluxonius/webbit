import { useEffect, useRef, useState } from 'react'
import type { GlobalStats, ServerMessage, TorrentSnapshot } from '../shared/types.ts'

const EMPTY_STATS: GlobalStats = {
  downloadSpeed: 0,
  uploadSpeed: 0,
  numPeers: 0,
  numTorrents: 0,
  downloadPath: '',
}

export interface LiveData {
  torrents: TorrentSnapshot[]
  stats: GlobalStats
  connected: boolean
}

// Subscribes to the server's 1Hz snapshot stream over WebSocket, with
// automatic reconnect so the UI recovers when the engine restarts.
export function useTorrents(): LiveData {
  const [torrents, setTorrents] = useState<TorrentSnapshot[]>([])
  const [stats, setStats] = useState<GlobalStats>(EMPTY_STATS)
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    let closed = false
    let retry: ReturnType<typeof setTimeout>

    const connect = () => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws'
      const ws = new WebSocket(`${proto}://${location.host}/ws`)
      wsRef.current = ws

      ws.onopen = () => setConnected(true)
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data) as ServerMessage
          if (msg.type === 'snapshot') {
            setTorrents(msg.torrents)
            setStats(msg.stats)
          }
        } catch {
          /* ignore malformed frame */
        }
      }
      ws.onclose = () => {
        setConnected(false)
        if (!closed) retry = setTimeout(connect, 1000)
      }
      ws.onerror = () => ws.close()
    }

    connect()
    return () => {
      closed = true
      clearTimeout(retry)
      wsRef.current?.close()
    }
  }, [])

  return { torrents, stats, connected }
}
