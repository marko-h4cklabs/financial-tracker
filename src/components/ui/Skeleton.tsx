interface SkeletonProps {
  className?: string
  style?: React.CSSProperties
}

export default function Skeleton({ className = '', style }: SkeletonProps) {
  return (
    <div
      className={`rounded animate-pulse ${className}`}
      style={{ background: 'var(--bg-elevated)', ...style }}
    />
  )
}

export function SkeletonRow({ cols = 5 }: { cols?: number }) {
  return (
    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton style={{ height: '14px', width: i === 0 ? '140px' : '80px' }} />
        </td>
      ))}
    </tr>
  )
}

export function SkeletonCard() {
  return (
    <div className="rounded-lg p-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
      <Skeleton style={{ height: '12px', width: '60px', marginBottom: '12px' }} />
      <Skeleton style={{ height: '28px', width: '120px', marginBottom: '8px' }} />
      <Skeleton style={{ height: '12px', width: '80px' }} />
    </div>
  )
}
