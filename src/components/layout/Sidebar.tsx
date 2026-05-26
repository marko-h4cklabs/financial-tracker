import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Briefcase,
  FileText,
  CalendarClock,
  Receipt,
  ShieldCheck,
  Settings,
  LogOut,
} from 'lucide-react'
import { useAuth } from '@/store/authStore'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/deals', label: 'Deals', icon: Briefcase },
  { to: '/invoices', label: 'Invoices', icon: FileText },
  { to: '/installments', label: 'Installments', icon: CalendarClock },
  { to: '/expenses', label: 'Expenses', icon: Receipt },
]

export default function Sidebar() {
  const { profile, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const initials = profile?.avatar_initials
    ?? profile?.full_name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    ?? '?'

  return (
    <aside
      className="fixed inset-y-0 left-0 flex flex-col w-60 z-20"
      style={{ background: 'var(--bg-surface)', borderRight: '1px solid var(--border-subtle)' }}
    >
      {/* Logo */}
      <div className="px-5 pt-6 pb-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div
          className="text-xl font-light tracking-[0.35em] uppercase"
          style={{ fontFamily: 'Cormorant Garamond, serif', color: 'var(--gold-primary)' }}
        >
          Aurelius
        </div>
        <div className="text-[9px] tracking-[0.3em] uppercase mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Tracker
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-0.5 px-2">
          {navItems.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-all relative ${
                    isActive ? 'nav-active' : 'nav-idle'
                  }`
                }
                style={({ isActive }) => ({
                  color: isActive ? 'var(--gold-primary)' : 'var(--text-secondary)',
                  background: isActive ? 'var(--gold-muted)' : 'transparent',
                })}
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span
                        className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full"
                        style={{ background: 'var(--gold-primary)' }}
                      />
                    )}
                    <Icon size={16} strokeWidth={isActive ? 2 : 1.5} />
                    <span className={isActive ? 'font-medium' : ''}>{label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>

        {/* Divider */}
        <div className="mx-4 my-3" style={{ borderTop: '1px solid var(--border-subtle)' }} />

        <ul className="space-y-0.5 px-2">
          {isAdmin && (
            <li>
              <NavLink
                to="/admin"
                className="flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-all relative"
                style={({ isActive }) => ({
                  color: isActive ? 'var(--gold-primary)' : 'var(--text-secondary)',
                  background: isActive ? 'var(--gold-muted)' : 'transparent',
                })}
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span
                        className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full"
                        style={{ background: 'var(--gold-primary)' }}
                      />
                    )}
                    <ShieldCheck size={16} strokeWidth={isActive ? 2 : 1.5} />
                    <span className={isActive ? 'font-medium' : ''}>Admin</span>
                  </>
                )}
              </NavLink>
            </li>
          )}
          <li>
            <NavLink
              to="/settings"
              className="flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-all relative"
              style={({ isActive }) => ({
                color: isActive ? 'var(--gold-primary)' : 'var(--text-secondary)',
                background: isActive ? 'var(--gold-muted)' : 'transparent',
              })}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span
                      className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full"
                      style={{ background: 'var(--gold-primary)' }}
                    />
                  )}
                  <Settings size={16} strokeWidth={isActive ? 2 : 1.5} />
                  <span className={isActive ? 'font-medium' : ''}>Settings</span>
                </>
              )}
            </NavLink>
          </li>
        </ul>
      </nav>

      {/* User footer */}
      <div className="px-3 py-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
            style={{
              background: 'var(--gold-muted)',
              border: '1px solid var(--gold-dark)',
              color: 'var(--gold-light)',
              fontFamily: 'DM Mono, monospace',
            }}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
              {profile?.full_name ?? 'User'}
            </p>
            <p
              className="text-[10px] uppercase tracking-wider truncate"
              style={{ color: isAdmin ? 'var(--gold-primary)' : 'var(--text-muted)' }}
            >
              {profile?.role ?? 'member'}
            </p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2 px-3 py-2 rounded text-xs transition-all"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--status-red)'
            e.currentTarget.style.background = 'rgba(224,82,82,0.08)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-muted)'
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <LogOut size={13} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  )
}
