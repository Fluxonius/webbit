import { useState, type ReactNode } from 'react'
import type { FileInfo } from '../../shared/types.ts'
import { indicesUnder, totalSizeUnder, type TreeNode } from '../filetree.ts'
import { formatBytes } from '../format.ts'

interface Props {
  nodes: TreeNode[]
  selected: Set<number>
  onToggle: (indices: number[], selected: boolean) => void
  showProgress?: boolean
  renderActions?: (file: FileInfo) => ReactNode
}

function TriCheckbox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean
  indeterminate: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = indeterminate && !checked
      }}
      onChange={(e) => onChange(e.target.checked)}
      onClick={(e) => e.stopPropagation()}
    />
  )
}

type NodeProps = Omit<Props, 'nodes'> & { node: TreeNode }

function NodeRow({ node, selected, onToggle, showProgress, renderActions }: NodeProps) {
  const [open, setOpen] = useState(true)

  if (node.type === 'file') {
    const f = node.file
    const isSel = selected.has(f.index)
    return (
      <div className="file-row" style={{ paddingLeft: 20 }}>
        <input
          type="checkbox"
          checked={isSel}
          onChange={(e) => onToggle([f.index], e.target.checked)}
        />
        <span className="fname" title={f.name}>
          {f.name}
        </span>
        {showProgress && (
          <div className={`miniprog ${f.progress >= 1 ? 'done' : ''}`} title={`${Math.round(f.progress * 100)}%`}>
            <span style={{ width: `${Math.round(f.progress * 100)}%` }} />
          </div>
        )}
        <span className="fsize">{formatBytes(f.length)}</span>
        {renderActions?.(f)}
      </div>
    )
  }

  const all = indicesUnder(node)
  const selCount = all.filter((i) => selected.has(i)).length
  const checked = selCount === all.length && all.length > 0
  const indeterminate = selCount > 0 && selCount < all.length

  return (
    <div>
      <div className="folder-row" onClick={() => setOpen(!open)}>
        <span style={{ width: 12, color: 'var(--text-faint)' }}>{open ? '▾' : '▸'}</span>
        <TriCheckbox
          checked={checked}
          indeterminate={indeterminate}
          onChange={(v) => onToggle(all, v)}
        />
        <span style={{ flex: 1 }}>
          📁 {node.name}{' '}
          <span className="fsize">
            ({selCount}/{all.length} · {formatBytes(totalSizeUnder(node))})
          </span>
        </span>
      </div>
      {open && (
        <div style={{ marginLeft: 14 }}>
          {node.children.map((child, i) => (
            <NodeRow
              key={child.type === 'file' ? child.file.index : `${node.path}/${child.name}-${i}`}
              node={child}
              selected={selected}
              onToggle={onToggle}
              showProgress={showProgress}
              renderActions={renderActions}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function FileTree(props: Props) {
  return (
    <div className="filetree">
      {props.nodes.map((node, i) => (
        <NodeRow
          key={node.type === 'file' ? node.file.index : `${node.name}-${i}`}
          node={node}
          {...props}
        />
      ))}
    </div>
  )
}
