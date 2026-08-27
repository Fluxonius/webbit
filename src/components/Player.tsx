import type { FileInfo } from '../../shared/types.ts'
import { streamURL } from '../api.ts'

// Streams a file straight from the engine's HTTP range endpoint. WebTorrent
// fetches the needed pieces on demand, so playback and seeking work before the
// download finishes.
export function Player({ infoHash, file }: { infoHash: string; file: FileInfo }) {
  const url = streamURL(infoHash, file.index)

  return (
    <div className="player">
      {file.mime.startsWith('video/') && (
        <video src={url} controls autoPlay />
      )}
      {file.mime.startsWith('audio/') && <audio src={url} controls autoPlay />}
      {file.mime.startsWith('image/') && <img src={url} alt={file.name} />}
      {file.mime === 'application/pdf' && <iframe src={url} title={file.name} />}
      {file.mime === 'text/plain' && <iframe src={url} title={file.name} />}
    </div>
  )
}
