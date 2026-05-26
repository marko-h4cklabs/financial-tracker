import { forwardRef } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const styles: Record<Variant, React.CSSProperties> = {
  primary: {
    background: 'var(--gold-primary)',
    color: '#0A0A0A',
    border: '1px solid var(--gold-primary)',
  },
  secondary: {
    background: 'transparent',
    color: 'var(--gold-primary)',
    border: '1px solid var(--gold-dark)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid transparent',
  },
  danger: {
    background: 'rgba(224,82,82,0.1)',
    color: 'var(--status-red)',
    border: '1px solid rgba(224,82,82,0.3)',
  },
}

const hoverStyles: Record<Variant, Partial<React.CSSProperties>> = {
  primary: { background: 'var(--gold-light)' },
  secondary: { background: 'var(--gold-muted)', borderColor: 'var(--gold-primary)' },
  ghost: { background: 'var(--bg-elevated)', color: 'var(--text-primary)' },
  danger: { background: 'rgba(224,82,82,0.18)' },
}

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-sm',
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, children, disabled, style, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`inline-flex items-center justify-center gap-2 rounded font-medium transition-all outline-none ${sizeClasses[size]}`}
        style={{
          ...styles[variant],
          opacity: disabled || loading ? 0.55 : 1,
          cursor: disabled || loading ? 'not-allowed' : 'pointer',
          ...style,
        }}
        onMouseEnter={(e) => {
          if (!disabled && !loading) {
            Object.assign(e.currentTarget.style, hoverStyles[variant])
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled && !loading) {
            Object.assign(e.currentTarget.style, styles[variant])
          }
        }}
        {...props}
      >
        {loading && (
          <span
            className="w-3.5 h-3.5 rounded-full border-2 animate-spin flex-shrink-0"
            style={{ borderColor: 'transparent', borderTopColor: 'currentColor' }}
          />
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

export default Button
