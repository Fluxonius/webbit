import type { PeerInfo } from '../shared/types.ts'

async function post(path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(path, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error ?? res.statusText)
  return data
}

export const api = {
  addMagnet: (magnet: string) =>
    post('/api/add-magnet', { magnet }) as Promise<{ infoHash: string }>,

  addTorrentFile: async (file: File): Promise<{ infoHash: string }> => {
    const res = await fetch('/api/add-torrent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-bittorrent' },
      body: file,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error((data as { error?: string }).error ?? res.statusText)
    return data as { infoHash: string }
  },

  seedFiles: async (files: File[]): Promise<{ infoHash: string }> => {
    const group = Math.random().toString(36).slice(2) + Date.now().toString(36)
    for (const file of files) {
      await fetch(`/api/seed/${group}/file?name=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: file,
      })
    }
    return post(`/api/seed/${group}/commit`) as Promise<{ infoHash: string }>
  },

  choose: (infoHash: string, indices: number[]) => post('/api/choose', { infoHash, indices }),
  setFileSelected: (infoHash: string, index: number, selected: boolean) =>
    post('/api/file-selected', { infoHash, index, selected }),
  pause: (infoHash: string) => post('/api/pause', { infoHash }),
  resume: (infoHash: string) => post('/api/resume', { infoHash }),
  remove: (infoHash: string, deleteData: boolean) =>
    post('/api/remove', { infoHash, deleteData }),
  cleanup: (infoHash: string) =>
    post('/api/cleanup', { infoHash }) as Promise<{ removed: number; bytesFreed: number }>,

  peers: async (infoHash: string): Promise<PeerInfo[]> => {
    const res = await fetch(`/api/peers/${infoHash}`)
    const data = (await res.json()) as { peers: PeerInfo[] }
    return data.peers
  },
}

export function streamURL(infoHash: string, index: number): string {
  return `/stream/${infoHash}/${index}`
}
export function downloadURL(infoHash: string, index: number): string {
  return `/download/${infoHash}/${index}`
}
