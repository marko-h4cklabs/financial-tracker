import { forwardRef, useState } from 'react'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  hint?: string
  options: { value: string; label: string }[]
  placeholder?: string
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, options, placeholder, id, ...props }, ref) => {
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
        <select
          ref={ref}
          id={inputId}
          className="w-full px-3 py-2.5 rounded text-sm outline-none transition-all appearance-none"
          style={{
            background: 'var(--bg-elevated)',
            border: `1px solid ${error ? 'var(--status-red)' : focused ? 'var(--gold-primary)' : 'var(--border-default)'}`,
            color: props.value === '' || props.value === undefined ? 'var(--text-muted)' : 'var(--text-primary)',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%235A5248' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 12px center',
            paddingRight: '2.5rem',
          }}
          onFocus={(e) => { setFocused(true); props.onFocus?.(e) }}
          onBlur={(e) => { setFocused(false); props.onBlur?.(e) }}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} style={{ background: 'var(--bg-elevated)' }}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs" style={{ color: 'var(--status-red)' }}>{error}</p>}
        {hint && !error && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{hint}</p>}
      </div>
    )
  }
)

Select.displayName = 'Select'

export default Select
