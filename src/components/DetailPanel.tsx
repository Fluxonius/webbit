import { useEffect, useMemo, useState } from 'react'
import {
  CheckIcon,
  CopyIcon,
  DownloadSimpleIcon,
  PlayIcon,
  WarningIcon,
  XIcon,
} from '@phosphor-icons/react'
import type { FileInfo, PeerInfo, TorrentSnapshot } from '../../shared/types.ts'
import type { Toasts } from '../useToasts.ts'
import { api, downloadURL } from '../api.ts'
import { buildTree } from '../filetree.ts'
import { countryFlag, formatBytes, formatSpeed } from '../format.ts'
import { FileTree } from './FileTree.tsx'
import { Player } from './Player.tsx'

type Tab = 'files' | 'peers' | 'info'

const TAB_LABEL: Record<Tab, string> = { files: 'Files', peers: 'Peers', info: 'Info' }

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

  const count: Record<Tab, number | null> = {
    files: torrent.files.length,
    peers: torrent.numPeers,
    info: null,
  }

  return (
    <>
      {/* Underline tabs: these are pages of content, not filters over the same
          content, which is what a segmented control would mean. */}
      <div className="ds-tabs detail-tabs" role="tablist" aria-label="Torrent details">
        {(['files', 'peers', 'info'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            id={`detail-tab-${t}`}
            aria-selected={tab === t}
            aria-controls="detail-tabpanel"
            tabIndex={tab === t ? 0 : -1}
            className="ds-tab"
            onClick={() => setTab(t)}
          >
            {TAB_LABEL[t]}
            {count[t] !== null ? ` (${count[t]})` : ''}
          </button>
        ))}
      </div>
      <div
        className="tab-body"
        id="detail-tabpanel"
        role="tabpanel"
        aria-labelledby={`detail-tab-${tab}`}
        tabIndex={0}
      >
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
        <div className="player-wrap">
          <div className="player-head">
            <span className="fname">{live.name}</span>
            <button
              className="ds-btn ds-btn--s ds-btn--outline ds-btn--neutral"
              onClick={() => onPlay(null)}
            >
              <XIcon aria-hidden="true" />
              Close player
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
          <span className="row-actions">
            {f.streamable && (
              <button
                className="ds-btn ds-iconbtn ds-btn--s ds-btn--plain ds-btn--neutral"
                title="Stream / preview"
                aria-label={`Stream ${f.name}`}
                onClick={() => onPlay(f)}
              >
                <PlayIcon aria-hidden="true" />
              </button>
            )}
            {/* A styled <a>, not an <a> wrapping a <button>: nesting a button
                inside a link is invalid HTML and left the control unnamed. */}
            <a
              className="ds-btn ds-iconbtn ds-btn--s ds-btn--plain ds-btn--neutral"
              href={downloadURL(torrent.infoHash, f.index)}
              download
              title="Download to my computer"
              aria-label={`Download ${f.name}`}
            >
              <DownloadSimpleIcon aria-hidden="true" />
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
    return (
      <div className="ds-empty">
        <p className="ds-empty-body">No connected peers right now.</p>
      </div>
    )
  }

  return (
    <table className="ds-table" aria-label="Connected peers">
      <thead>
        <tr>
          <th>Address</th>
          <th>Client</th>
          <th>Conn</th>
          <th className="ds-num">Progress</th>
          <th className="ds-num">Down</th>
          <th className="ds-num">Up</th>
        </tr>
      </thead>
      <tbody>
        {peers.map((p) => (
          <tr key={p.id}>
            {/* Left-aligned like its header: an address is an identifier read
                from the left, not a quantity compared on its last digit. */}
            <td className="addr-cell">
              <span
                className="flag"
                title={p.countryName || 'Unknown location'}
                aria-label={p.countryName || 'Unknown location'}
                role="img"
              >
                {countryFlag(p.country) || '··'}
              </span>
              <span className="mono">{p.address}</span>
            </td>
            <td>{p.client}</td>
            <td>{p.flags}</td>
            <td className="ds-num">{Math.round(p.progress * 100)}%</td>
            <td className="ds-num">{formatSpeed(p.downloadSpeed)}</td>
            <td className="ds-num">{formatSpeed(p.uploadSpeed)}</td>
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
        <div className="ds-alert ds-alert--danger" role="alert">
          <WarningIcon aria-hidden="true" />
          <div>
            <span className="ds-alert-title">Error</span>
            <p className="ds-alert-body">{torrent.error}</p>
          </div>
        </div>
      )}
      {noPeersLong && !torrent.error && (
        <div className="ds-alert ds-alert--warning">
          <WarningIcon aria-hidden="true" />
          <div>
            <span className="ds-alert-title">No peers connected</span>
            <p className="ds-alert-body">
              If this stays at 0, the torrent may be dead (no seeders), or peer discovery is
              still warming up via DHT and trackers. Public torrents can take a little while to
              find peers.
            </p>
          </div>
        </div>
      )}
      <dl className="ds-dl">
        <dt>Name</dt>
        <dd>{torrent.name}</dd>
        <dt>Info hash</dt>
        <dd className="mono">{torrent.infoHash}</dd>
        <dt>Size (selected)</dt>
        <dd className="mono">{formatBytes(torrent.length)}</dd>
        <dt>Downloaded</dt>
        <dd className="mono">{formatBytes(torrent.downloaded)}</dd>
        <dt>Uploaded</dt>
        <dd className="mono">{formatBytes(torrent.uploaded)}</dd>
        <dt>Ratio</dt>
        <dd className="mono">{torrent.ratio.toFixed(2)}</dd>
        <dt>Peers</dt>
        <dd className="mono">{torrent.numPeers}</dd>
        <dt>Added</dt>
        <dd>{new Date(torrent.addedAt).toLocaleString()}</dd>
        <dt>Magnet</dt>
        <dd>
          <button
            className="ds-btn ds-btn--s ds-btn--outline ds-btn--neutral"
            onClick={() => {
              void navigator.clipboard.writeText(torrent.magnetURI)
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            }}
          >
            {copied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
            {copied ? 'Copied' : 'Copy magnet link'}
          </button>
        </dd>
      </dl>
    </div>
  )
}
