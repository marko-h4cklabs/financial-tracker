interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
}

const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' }

export default function LoadingSpinner({ size = 'md' }: LoadingSpinnerProps) {
  return (
    <div
      className={`${sizes[size]} rounded-full border-2 animate-spin`}
      style={{ borderColor: 'var(--border-subtle)', borderTopColor: 'var(--gold-primary)' }}
    />
  )
}
