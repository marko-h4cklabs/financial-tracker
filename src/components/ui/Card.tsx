interface CardProps {
  children: React.ReactNode
  className?: string
  goldAccent?: boolean
  style?: React.CSSProperties
  onClick?: () => void
}

export default function Card({ children, className = '', goldAccent = false, style, onClick }: CardProps) {
  return (
    <div
      className={`rounded-lg ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderTop: goldAccent ? '1px solid var(--gold-primary)' : undefined,
        ...style,
      }}
      onClick={onClick}
    >
      {children}
    </div>
  )
}
