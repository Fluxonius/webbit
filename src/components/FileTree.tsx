import { useState, type ReactNode } from 'react'
import { CaretRightIcon, FolderIcon } from '@phosphor-icons/react'
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
  label,
  onChange,
}: {
  checked: boolean
  indeterminate: boolean
  label: string
  onChange: (v: boolean) => void
}) {
  return (
    <input
      className="ds-check"
      type="checkbox"
      aria-label={label}
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
    const pct = Math.round(f.progress * 100)
    return (
      <li className="ds-treerow file-row">
        <input
          className="ds-check"
          type="checkbox"
          aria-label={`Download ${f.name}`}
          checked={isSel}
          onChange={(e) => onToggle([f.index], e.target.checked)}
        />
        <span className="fname" title={f.name}>
          {f.name}
        </span>
        {showProgress && (
          <div
            className="ds-progress"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${f.name} download progress`}
          >
            <span style={{ width: `${pct}%` }} />
          </div>
        )}
        <span className="fsize">{formatBytes(f.length)}</span>
        {renderActions?.(f)}
      </li>
    )
  }

  const all = indicesUnder(node)
  const selCount = all.filter((i) => selected.has(i)).length
  const checked = selCount === all.length && all.length > 0
  const indeterminate = selCount > 0 && selCount < all.length

  return (
    <li>
      <div className="ds-treerow folder-row">
        {/* The twisty is a separate target from the row: expanding a folder
            must not also change what is selected for download. */}
        <button
          type="button"
          className="ds-twisty"
          aria-expanded={open}
          aria-label={`${open ? 'Collapse' : 'Expand'} ${node.name}`}
          onClick={() => setOpen(!open)}
        >
          <CaretRightIcon aria-hidden="true" />
        </button>
        <TriCheckbox
          checked={checked}
          indeterminate={indeterminate}
          label={`Download everything in ${node.name}`}
          onChange={(v) => onToggle(all, v)}
        />
        <FolderIcon aria-hidden="true" />
        <span className="fname" title={node.name}>
          {node.name}
        </span>
        <span className="fsize">
          {selCount}/{all.length} · {formatBytes(totalSizeUnder(node))}
        </span>
      </div>
      {open && (
        <ul className="ds-tree">
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
        </ul>
      )}
    </li>
  )
}

export function FileTree(props: Props) {
  return (
    <ul className="ds-tree filetree">
      {props.nodes.map((node, i) => (
        <NodeRow
          key={node.type === 'file' ? node.file.index : `${node.name}-${i}`}
          node={node}
          {...props}
        />
      ))}
    </ul>
  )
}
