# webbit

A local web-based torrent client built on [WebTorrent](https://github.com/webtorrent/webtorrent).
Add `.torrent` files and magnet links, choose which files to download, pause/resume, and watch
live speeds, peers, and progress — the things a regular torrent client shows — all from a browser
tab.

## Why there's a tiny local engine (and not just a webpage)

A browser tab can only talk to other **WebRTC** peers. It cannot open the TCP/uTP connections that
qBittorrent, Transmission, and seedboxes use, so a pure in-browser client can never reach normal
public swarms. webbit therefore runs the WebTorrent engine in a small **local Node process** that
speaks real BitTorrent (TCP, uTP, DHT, PEX). The browser is just the control panel, talking to it
over WebSocket + HTTP.

Nothing is installed system-wide: no daemon, no autostart, no registry entry. It's one project
folder, and it runs only while `npm run dev` is open. Downloads land in `./downloads`. Delete the
folder and it's all gone.

## Run

```bash
npm install
npm run dev
```

Then open http://localhost:5173. `npm run dev` starts both the Node engine (port 8080) and the
Vite UI (port 5173); Ctrl-C stops both.

> If `npm install` complains about root-owned files in `~/.npm` (an old npm bug), run
> `sudo chown -R $(id -u):$(id -g) "$HOME/.npm"` once.

## What it does

- **Add** by magnet link or `.torrent` upload, or drag-drop onto the window.
- **Choose files first** — a torrent is added metadata-only (`deselect: true`); the file picker
  opens automatically and *nothing downloads* until you confirm a selection.
- **Live table** — Name, Size, Progress, ↓/↑ Speed, Peers, ETA, Ratio, Status (sortable).
- **Pause / Resume** — pause drops piece selection so downloading truly stops, not just new peers.
- **Peers tab** — real connected peers with decoded client names (qBittorrent, Transmission,
  µTorrent, WebTorrent…), connection type (µTP / TCP / WebRTC), and per-peer speeds.
- **Stream & preview** — play video/audio, view images and PDFs straight from a partial download
  via HTTP range requests; ⬇ saves any file to your computer.
- **Seed** — drop files in to create a torrent and get a shareable magnet link.
- **Survives restart** — session (magnet, chosen files, paused state) is persisted; on boot the
  engine re-adds each torrent, verifies data already on disk, and resumes.

## Layout

```
server/            Node torrent engine (native TypeScript, no build step)
  index.ts         Express HTTP API + WebSocket snapshot stream + range streaming
  engine.ts        WebTorrent wrapper: add/choose/pause/resume/remove, snapshots
  peers.ts         peer-id -> client-name decoding
  persistence.ts   session.json + .torrent cache for restart-resume
src/               React + Vite UI
shared/types.ts    data contract shared by server and client
downloads/         where files are saved (git-ignored)
```

## Reach — honest limits

- This client sees **WebRTC and normal (TCP/uTP/DHT) peers** because the engine is in Node.
- Public magnets can take a little while to find peers via DHT/trackers; a torrent with no live
  seeders will stay at 0 peers (the Info tab explains this rather than spinning forever).
- IndexedDB/quota limits don't apply — data is written to the real filesystem.
```
