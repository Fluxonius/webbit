import { useEffect, useMemo, useState } from 'react'
import type { FileInfo, PeerInfo, TorrentSnapshot } from '../../shared/types.ts'
import type { Toasts } from '../useToasts.ts'
import { api, downloadURL } from '../api.ts'
import { buildTree } from '../filetree.ts'
import { formatBytes, formatSpeed } from '../format.ts'
import { FileTree } from './FileTree.tsx'
import { Player } from './Player.tsx'

type Tab = 'files' | 'peers' | 'info'

export function DetailPanel({
  torrent,
  attempt,
}: {
  torrent: TorrentSnapshot
  attempt: Toasts['attempt']
}) {
  const [tab, setTab] = useState<Tab>('files')
  const [playing, setPlaying] = useState<FileInfo | null>(null)

  // Reset the open player when switching torrents.
  useEffect(() => {
    setPlaying(null)
  }, [torrent.infoHash])

  return (
    <>
      <div className="tabs">
        {(['files', 'peers', 'info'] as Tab[]).map((t) => (
          <button
            key={t}
            className={`tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'files' ? 'Files' : t === 'peers' ? 'Peers' : 'Info'}
            {t === 'files' ? ` (${torrent.files.length})` : ''}
            {t === 'peers' ? ` (${torrent.numPeers})` : ''}
          </button>
        ))}
      </div>
      <div className="tab-body">
        {tab === 'files' && (
          <FilesTab torrent={torrent} playing={playing} onPlay={setPlaying} attempt={attempt} />
        )}
        {tab === 'peers' && <PeersTab infoHash={torrent.infoHash} />}
        {tab === 'info' && <InfoTab torrent={torrent} />}
      </div>
    </>
  )
}

function FilesTab({
  torrent,
  playing,
  onPlay,
  attempt,
}: {
  torrent: TorrentSnapshot
  playing: FileInfo | null
  onPlay: (f: FileInfo | null) => void
  attempt: Toasts['attempt']
}) {
  const tree = useMemo(() => buildTree(torrent.files), [torrent.files])
  const selected = useMemo(
    () => new Set(torrent.files.filter((f) => f.selected).map((f) => f.index)),
    [torrent.files],
  )

  const toggle = (indices: number[], on: boolean) => {
    for (const i of indices) {
      attempt(
        () => api.setFileSelected(torrent.infoHash, i, on),
        `Could not ${on ? 'select' : 'deselect'} file`,
      )
    }
  }

  const live = playing ? torrent.files.find((f) => f.index === playing.index) ?? playing : null

  return (
    <div>
      {live && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6, gap: 10 }}>
            <b style={{ flex: 1 }}>{live.name}</b>
            <button className="icon-btn" onClick={() => onPlay(null)}>
              <span aria-hidden="true">✕</span> Close player
            </button>
          </div>
          <Player infoHash={torrent.infoHash} file={live} />
        </div>
      )}
      <FileTree
        nodes={tree}
        selected={selected}
        onToggle={toggle}
        showProgress
        renderActions={(f) => (
          <span style={{ display: 'inline-flex', gap: 4 }}>
            {f.streamable && (
              <button
                className="icon-btn"
                title="Stream / preview"
                aria-label={`Stream ${f.name}`}
                onClick={() => onPlay(f)}
              >
                <span aria-hidden="true">▶</span>
              </button>
            )}
            {/* A styled <a>, not an <a> wrapping a <button>: nesting a button
                inside a link is invalid HTML and left the control unnamed. */}
            <a
              className="icon-btn"
              href={downloadURL(torrent.infoHash, f.index)}
              download
              title="Download to my computer"
              aria-label={`Download ${f.name}`}
            >
              <span aria-hidden="true">⬇</span>
            </a>
          </span>
        )}
      />
    </div>
  )
}

function PeersTab({ infoHash }: { infoHash: string }) {
  const [peers, setPeers] = useState<PeerInfo[]>([])

  useEffect(() => {
    let alive = true
    const poll = async () => {
      try {
        const p = await api.peers(infoHash)
        if (alive) setPeers(p)
      } catch {
        /* ignore */
      }
    }
    poll()
    const id = setInterval(poll, 1500)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [infoHash])

  if (peers.length === 0) {
    return <p className="hint">No connected peers right now.</p>
  }

  return (
    <table className="data">
      <thead>
        <tr>
          <th>Address</th>
          <th>Client</th>
          <th>Conn</th>
          <th style={{ textAlign: 'right' }}>Progress</th>
          <th style={{ textAlign: 'right' }}>↓</th>
          <th style={{ textAlign: 'right' }}>↑</th>
        </tr>
      </thead>
      <tbody>
        {peers.map((p) => (
          <tr key={p.id}>
            <td>{p.address}</td>
            <td>{p.client}</td>
            <td>{p.flags}</td>
            <td style={{ textAlign: 'right' }}>{Math.round(p.progress * 100)}%</td>
            <td style={{ textAlign: 'right' }}>{formatSpeed(p.downloadSpeed)}</td>
            <td style={{ textAlign: 'right' }}>{formatSpeed(p.uploadSpeed)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function InfoTab({ torrent }: { torrent: TorrentSnapshot }) {
  const [copied, setCopied] = useState(false)
  const noPeersLong =
    torrent.status === 'connecting' || (torrent.numPeers === 0 && !torrent.paused)

  return (
    <div>
      {torrent.error && (
        <div className="diag-note" style={{ borderLeftColor: 'var(--red)' }}>
          <b>Error:</b> {torrent.error}
        </div>
      )}
      {noPeersLong && !torrent.error && (
        <div className="diag-note">
          <b>No peers connected.</b> If this stays at 0, the torrent may be dead (no seeders),
          or peer discovery is still warming up via DHT and trackers. Public torrents can take a
          little while to find peers.
        </div>
      )}
      <dl className="kv">
        <dt>Name</dt>
        <dd>{torrent.name}</dd>
        <dt>Info hash</dt>
        <dd>{torrent.infoHash}</dd>
        <dt>Size (selected)</dt>
        <dd>{formatBytes(torrent.length)}</dd>
        <dt>Downloaded</dt>
        <dd>{formatBytes(torrent.downloaded)}</dd>
        <dt>Uploaded</dt>
        <dd>{formatBytes(torrent.uploaded)}</dd>
        <dt>Ratio</dt>
        <dd>{torrent.ratio.toFixed(2)}</dd>
        <dt>Peers</dt>
        <dd>{torrent.numPeers}</dd>
        <dt>Added</dt>
        <dd>{new Date(torrent.addedAt).toLocaleString()}</dd>
        <dt>Magnet</dt>
        <dd>
          <button
            className="icon-btn"
            onClick={() => {
              void navigator.clipboard.writeText(torrent.magnetURI)
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            }}
          >
            {copied ? 'Copied ✓' : 'Copy magnet link'}
          </button>
        </dd>
      </dl>
    </div>
  )
}
