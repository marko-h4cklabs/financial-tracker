import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  delta?: string
  deltaPositive?: boolean
  icon?: LucideIcon
  subtitle?: string
  goldAccent?: boolean
}

export default function StatCard({
  label,
  value,
  delta,
  deltaPositive,
  icon: Icon,
  subtitle,
  goldAccent = false,
}: StatCardProps) {
  return (
    <div
      className="rounded-lg p-5"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderTop: goldAccent ? '1px solid var(--gold-primary)' : undefined,
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          {label}
        </span>
        {Icon && (
          <div
            className="w-7 h-7 rounded flex items-center justify-center"
            style={{ background: 'var(--gold-muted)' }}
          >
            <Icon size={14} style={{ color: 'var(--gold-primary)' }} />
          </div>
        )}
      </div>

      <div
        className="text-2xl font-light mb-1"
        style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-primary)' }}
      >
        {value}
      </div>

      {subtitle && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>
      )}

      {delta && (
        <p
          className="text-xs mt-1"
          style={{ color: deltaPositive ? 'var(--status-green)' : 'var(--status-red)' }}
        >
          {deltaPositive ? '↑' : '↓'} {delta}
        </p>
      )}
    </div>
  )
}
