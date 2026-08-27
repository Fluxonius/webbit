/**
 * The webbit mark: a torrent's piece map, mid-download.
 *
 * A 3×3 grid on the same corner law as the rest of the system. Six pieces have
 * arrived; the three still outstanding fall on the anti-diagonal, which leaves
 * the solid cells pinwheeling around an empty centre. The one accent cell is
 * the leading edge.
 *
 * Contiguous cells are deliberately NOT fused, and the outstanding pieces are
 * left as plain gaps rather than outlines: fusing turns the mark into a stack
 * of bars that reads as a list icon, and outlines at this density only muddy
 * the silhouette. The gaps carry the meaning.
 */

// Three columns of 7 with 1.5 between them fills the 24 box exactly.
const POS = [0, 8.5, 17]
const CELL = 7
const RADIUS = 2

/** Pieces that have arrived, as grid indices (row * 3 + column). */
const ARRIVED = [0, 1, 3, 5, 7, 8]
/** The leading edge — the piece that landed most recently. */
const LEADING = 5

const xy = (i: number) => ({ x: POS[i % 3], y: POS[Math.floor(i / 3)] })

export function Logo({ size = 20, connected }: { size?: number; connected?: boolean }) {
  // The leading-edge cell doubles as the engine's connection lamp, which is why
  // there is no separate status dot beside the wordmark. Colour alone never
  // carries it: the label below states it in words.
  const label =
    connected === undefined
      ? 'webbit'
      : connected
        ? 'webbit — connected to engine'
        : 'webbit — disconnected from engine'

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={label}>
      <title>{label}</title>
      {ARRIVED.map((i) => {
        const { x, y } = xy(i)
        const lamp = i === LEADING
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={CELL}
            height={CELL}
            rx={RADIUS}
            fill={
              lamp
                ? connected === false
                  ? 'var(--ds-danger-solid)'
                  : 'var(--ds-accent)'
                : 'currentColor'
            }
          />
        )
      })}
    </svg>
  )
}
