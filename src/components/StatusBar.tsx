import type { GlobalStats } from '../../shared/types.ts'
import { formatSpeed } from '../format.ts'

export function StatusBar({ stats }: { stats: GlobalStats }) {
  return (
    <div className="statusbar">
      <span>
        ↓ <b>{formatSpeed(stats.downloadSpeed)}</b>
      </span>
      <span>
        ↑ <b>{formatSpeed(stats.uploadSpeed)}</b>
      </span>
      <span>
        peers <b>{stats.numPeers}</b>
      </span>
      <span>
        torrents <b>{stats.numTorrents}</b>
      </span>
      <span className="path" title={stats.downloadPath}>
        {stats.downloadPath}
      </span>
    </div>
  )
}
