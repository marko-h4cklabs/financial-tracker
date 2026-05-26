import { forwardRef, useState } from 'react'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, id, ...props }, ref) => {
    const [focused, setFocused] = useState(false)
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-medium uppercase tracking-wider"
            style={{ color: 'var(--text-secondary)' }}
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          rows={4}
          className="w-full px-3 py-2.5 rounded text-sm outline-none transition-all resize-y"
          style={{
            background: 'var(--bg-elevated)',
            border: `1px solid ${error ? 'var(--status-red)' : focused ? 'var(--gold-primary)' : 'var(--border-default)'}`,
            color: 'var(--text-primary)',
            minHeight: '80px',
          }}
          onFocus={(e) => { setFocused(true); props.onFocus?.(e) }}
          onBlur={(e) => { setFocused(false); props.onBlur?.(e) }}
          {...props}
        />
        {error && <p className="text-xs" style={{ color: 'var(--status-red)' }}>{error}</p>}
        {hint && !error && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{hint}</p>}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'

export default Textarea
