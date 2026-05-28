import { useEffect } from 'react'
import Button from '@/components/ui/Button'

interface Props {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  confirmVariant?: 'danger' | 'primary'
}

export default function ConfirmDialog({
  isOpen, onClose, onConfirm, title, message,
  confirmLabel = 'Delete', confirmVariant = 'danger',
}: Props) {
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const confirmStyle =
    confirmVariant === 'danger'
      ? { background: 'rgba(224,82,82,0.12)', color: 'var(--status-red)', border: '1px solid rgba(224,82,82,0.3)' }
      : { background: 'var(--gold-muted)', color: 'var(--gold-primary)', border: '1px solid rgba(201,168,76,0.3)' }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="rounded-lg p-6 w-full max-w-sm space-y-4"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', boxShadow: '0 24px 64px rgba(0,0,0,0.8)' }}
      >
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{message}</p>
        <div className="flex gap-3 pt-1">
          <Button variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
          <button
            onClick={() => { onConfirm(); onClose() }}
            className="flex-1 px-4 py-2 rounded text-sm font-medium transition-colors"
            style={confirmStyle}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
