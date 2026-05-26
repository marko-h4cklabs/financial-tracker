import { useEffect } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const widths = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl' }

export default function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className={`w-full ${widths[size]} rounded-lg flex flex-col max-h-[90vh]`}
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderTop: '2px solid var(--gold-primary)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
        }}
      >
        {/* Header */}
        {title && (
          <div
            className="flex items-center justify-between px-5 py-4 flex-shrink-0"
            style={{ borderBottom: '1px solid var(--border-subtle)' }}
          >
            <h3 className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
              {title}
            </h3>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded flex items-center justify-center transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4">
          {children}
        </div>
      </div>
    </div>
  )
}
