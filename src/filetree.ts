import type { FileInfo } from '../shared/types.ts'

export interface FileNode {
  type: 'file'
  file: FileInfo
}
export interface FolderNode {
  type: 'folder'
  name: string
  path: string
  children: TreeNode[]
}
export type TreeNode = FileNode | FolderNode

// Build a nested folder tree from the flat file list using each file's path.
export function buildTree(files: FileInfo[]): TreeNode[] {
  const root: FolderNode = { type: 'folder', name: '', path: '', children: [] }

  for (const file of files) {
    const parts = file.path.split('/').filter(Boolean)
    let cursor = root
    for (let i = 0; i < parts.length - 1; i++) {
      const seg = parts[i]
      const soFar = parts.slice(0, i + 1).join('/')
      let next = cursor.children.find(
        (c): c is FolderNode => c.type === 'folder' && c.name === seg,
      )
      if (!next) {
        next = { type: 'folder', name: seg, path: soFar, children: [] }
        cursor.children.push(next)
      }
      cursor = next
    }
    cursor.children.push({ type: 'file', file })
  }

  // Collapse a single top-level folder (the usual torrent-name wrapper) so the
  // tree isn't needlessly nested one level deep.
  if (root.children.length === 1 && root.children[0].type === 'folder') {
    return root.children
  }
  return root.children
}

// All file indices under a node (recursively).
export function indicesUnder(node: TreeNode): number[] {
  if (node.type === 'file') return [node.file.index]
  return node.children.flatMap(indicesUnder)
}

export function totalSizeUnder(node: TreeNode): number {
  if (node.type === 'file') return node.file.length
  return node.children.reduce((s, c) => s + totalSizeUnder(c), 0)
}
