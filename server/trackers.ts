// Extra announce URLs appended to every torrent. Public magnets often ship a
// thin or stale tracker list; adding reliable open trackers (and a couple of
// WebRTC ones) improves peer discovery. DHT and PEX do most of the work, but
// these help torrents that are DHT-shy.
export const EXTRA_TRACKERS: string[] = [
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://open.demonii.com:1337/announce',
  'udp://tracker.openbittorrent.com:6969/announce',
  'udp://explodie.org:6969/announce',
  'udp://tracker.torrent.eu.org:451/announce',
  'udp://open.stealth.si:80/announce',
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.webtorrent.dev',
]
