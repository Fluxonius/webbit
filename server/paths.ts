import path from 'node:path'
import fs from 'node:fs'

// Everything lives under the project folder so the whole app is one deletable
// directory — no system-wide install, nothing in a registry or a daemon.
export const PROJECT_ROOT = process.cwd()
export const DOWNLOAD_DIR = path.join(PROJECT_ROOT, 'downloads')
export const STATE_DIR = path.join(PROJECT_ROOT, '.webbit')
export const TORRENT_CACHE_DIR = path.join(STATE_DIR, 'torrents')
export const SESSION_FILE = path.join(STATE_DIR, 'session.json')

export function ensureDirs(): void {
  for (const dir of [DOWNLOAD_DIR, STATE_DIR, TORRENT_CACHE_DIR]) {
    fs.mkdirSync(dir, { recursive: true })
  }
}
