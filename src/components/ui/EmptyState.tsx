import type { LucideIcon } from 'lucide-react'
import Button from './Button'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
        style={{ background: 'var(--gold-muted)' }}
      >
        <Icon size={24} style={{ color: 'var(--gold-dark)' }} strokeWidth={1.5} />
      </div>
      <h3 className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      {description && (
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>{description}</p>
      )}
      {action && (
        <Button variant="secondary" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}
