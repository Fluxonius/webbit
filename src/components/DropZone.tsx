import { useEffect, useState } from 'react'

// Whole-window drag/drop. A drop consisting entirely of .torrent files is
// treated as "add torrent"; anything else is treated as "seed these files".
export function DropZone({
  onTorrents,
  onSeed,
}: {
  onTorrents: (files: File[]) => void
  onSeed: (files: File[]) => void
}) {
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    let depth = 0
    const onEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return
      depth++
      setDragging(true)
    }
    const onLeave = () => {
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragging(false)
    }
    const onOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault()
    }
    const onDrop = (e: DragEvent) => {
      e.preventDefault()
      depth = 0
      setDragging(false)
      const files = Array.from(e.dataTransfer?.files ?? [])
      if (!files.length) return
      const allTorrents = files.every((f) => f.name.toLowerCase().endsWith('.torrent'))
      if (allTorrents) onTorrents(files)
      else onSeed(files)
    }
    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('dragover', onOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [onTorrents, onSeed])

  if (!dragging) return null
  return <div className="drag-overlay">Drop .torrent files to add · other files to seed</div>
}
