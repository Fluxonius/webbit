import { ArrowDownIcon, ArrowUpIcon, StackIcon, UsersIcon } from '@phosphor-icons/react'
import type { GlobalStats } from '../../shared/types.ts'
import { formatSpeed } from '../format.ts'

export function StatusBar({ stats }: { stats: GlobalStats }) {
  return (
    <div className="statusbar">
      {/* Each icon is decorative — the visible label next to it carries the
          meaning, so the icon must not be announced twice. */}
      <span className="metric">
        <ArrowDownIcon aria-hidden="true" />
        <span className="sr-only">Download speed</span>
        <b>{formatSpeed(stats.downloadSpeed)}</b>
      </span>
      <span className="metric">
        <ArrowUpIcon aria-hidden="true" />
        <span className="sr-only">Upload speed</span>
        <b>{formatSpeed(stats.uploadSpeed)}</b>
      </span>
      <span className="metric">
        <UsersIcon aria-hidden="true" />
        peers <b>{stats.numPeers}</b>
      </span>
      <span className="metric">
        <StackIcon aria-hidden="true" />
        torrents <b>{stats.numTorrents}</b>
      </span>
      <span className="path" title={stats.downloadPath}>
        {stats.downloadPath}
      </span>
    </div>
  )
}
