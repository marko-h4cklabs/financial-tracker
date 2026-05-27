import { useLocation } from 'react-router-dom'
import { Search, Menu } from 'lucide-react'
import { format } from 'date-fns'
import { useAuth } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'

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
  const { toggleSidebar } = useUIStore()

  const pathBase = '/' + location.pathname.split('/')[1]
  const title = pageTitles[pathBase] ?? 'Aurelius Tracker'

  const initials = profile?.avatar_initials
    ?? profile?.full_name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    ?? '?'

  const today = format(new Date(), 'EEEE, d MMMM yyyy')

  return (
    <header
      className="fixed top-0 right-0 h-14 flex items-center justify-between px-4 z-10
        left-0 md:left-14 lg:left-60"
      style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)' }}
    >
      {/* Left: hamburger (mobile) + title */}
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
        <button onClick={toggleSidebar}
          className="w-9 h-9 rounded flex items-center justify-center md:hidden"
          style={{ color: 'var(--text-muted)' }}>
          <Menu size={20} />
        </button>

        {/* Wordmark on mobile (sidebar is hidden) */}
        <span className="text-sm font-light tracking-[0.25em] uppercase md:hidden"
          style={{ fontFamily: 'Cormorant Garamond, serif', color: 'var(--gold-primary)' }}>
          Aurelius
        </span>

        {/* Page title on tablet+ */}
        <h2 className="text-base font-medium hidden md:block" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h2>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        <span className="text-sm hidden xl:block" style={{ color: 'var(--text-muted)' }}>{today}</span>

        {/* Command palette trigger — tablet+ only */}
        <button onClick={onOpenPalette}
          className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded text-xs transition-colors"
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

        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
          style={{ background: 'var(--gold-muted)', border: '1px solid var(--gold-dark)', color: 'var(--gold-light)', fontFamily: 'DM Mono, monospace' }}>
          {initials}
        </div>
      </div>
    </header>
  )
}
