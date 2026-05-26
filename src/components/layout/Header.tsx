import { useLocation } from 'react-router-dom'
import { Search } from 'lucide-react'
import { format } from 'date-fns'
import { useAuth } from '@/store/authStore'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/clients': 'Clients',
  '/deals': 'Deals',
  '/invoices': 'Invoices',
  '/installments': 'Payment Schedule',
  '/expenses': 'Expenses',
  '/admin': 'Admin',
  '/settings': 'Settings',
}

interface Props {
  onOpenPalette: () => void
}

export default function Header({ onOpenPalette }: Props) {
  const location = useLocation()
  const { profile } = useAuth()

  const pathBase = '/' + location.pathname.split('/')[1]
  const title = pageTitles[pathBase] ?? 'Aurelius Tracker'

  const initials = profile?.avatar_initials
    ?? profile?.full_name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    ?? '?'

  const today = format(new Date(), 'EEEE, d MMMM yyyy')

  return (
    <header
      className="fixed top-0 right-0 left-60 h-14 flex items-center justify-between px-6 z-10"
      style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)' }}
    >
      <h2 className="text-base font-medium" style={{ color: 'var(--text-primary)' }}>{title}</h2>

      <div className="flex items-center gap-3">
        <span className="text-sm hidden lg:block" style={{ color: 'var(--text-muted)' }}>{today}</span>

        {/* Command palette trigger */}
        <button onClick={onOpenPalette}
          className="flex items-center gap-2 px-3 py-1.5 rounded text-xs transition-colors"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-muted)' }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--gold-primary)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-default)')}>
          <Search size={12} />
          <span>Search</span>
          <kbd className="ml-1 text-[10px] px-1 py-0.5 rounded"
            style={{ background: 'var(--bg-surface)', fontFamily: 'DM Mono, monospace' }}>
            ⌘K
          </kbd>
        </button>

        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold"
          style={{
            background: 'var(--gold-muted)',
            border: '1px solid var(--gold-dark)',
            color: 'var(--gold-light)',
            fontFamily: 'DM Mono, monospace',
          }}>
          {initials}
        </div>
      </div>
    </header>
  )
}
