import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, Briefcase, FileText,
  CalendarClock, Receipt, ClipboardList, ShieldCheck, Settings, LogOut, X,
} from 'lucide-react'
import { useAuth } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/clients',   label: 'Clients',   icon: Users },
  { to: '/deals',     label: 'Deals',     icon: Briefcase },
  { to: '/invoices',  label: 'Invoices',  icon: FileText },
  { to: '/installments', label: 'Installments', icon: CalendarClock },
  { to: '/expenses',  label: 'Expenses',  icon: Receipt },
  { to: '/work',     label: 'Work Tracker', icon: ClipboardList },
]

export default function Sidebar() {
  const { profile, isAdmin, signOut } = useAuth()
  const { sidebarOpen, closeSidebar } = useUIStore()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const initials = profile?.avatar_initials
    ?? profile?.full_name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    ?? '?'

  const handleNavClick = () => {
    // Auto-close on mobile
    if (window.innerWidth < 768) closeSidebar()
  }

  return (
    <>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 md:hidden"
          onClick={closeSidebar}
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 flex flex-col z-30
          w-60 md:w-14 lg:w-60
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
        style={{ background: 'var(--bg-surface)', borderRight: '1px solid var(--border-subtle)' }}
      >
        {/* Logo + mobile close button */}
        <div className="px-5 pt-5 pb-4 flex items-center justify-between flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="overflow-hidden">
            <div className="text-xl font-light tracking-[0.35em] uppercase whitespace-nowrap"
              style={{ fontFamily: 'Cormorant Garamond, serif', color: 'var(--gold-primary)' }}>
              Aurelius
            </div>
            <div className="text-[9px] tracking-[0.3em] uppercase mt-0.5 md:hidden lg:block whitespace-nowrap"
              style={{ color: 'var(--text-muted)' }}>
              Tracker
            </div>
          </div>
          {/* Close button — mobile only */}
          <button onClick={closeSidebar}
            className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0 md:hidden"
            style={{ color: 'var(--text-muted)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden">
          <ul className="space-y-0.5 px-2">
            {navItems.map(({ to, label, icon: Icon }) => (
              <li key={to} className="relative group">
                <NavLink to={to} onClick={handleNavClick}
                  className={({ isActive }) =>
                    `flex items-center gap-3 py-2.5 rounded text-sm transition-all relative overflow-hidden
                     md:justify-center lg:justify-start px-3 md:px-0 lg:px-3
                     ${isActive ? 'nav-active' : 'nav-idle'}`
                  }
                  style={({ isActive }) => ({
                    color: isActive ? 'var(--gold-primary)' : 'var(--text-secondary)',
                    background: isActive ? 'var(--gold-muted)' : 'transparent',
                  })}
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full"
                          style={{ background: 'var(--gold-primary)' }} />
                      )}
                      <Icon size={16} strokeWidth={isActive ? 2 : 1.5} className="flex-shrink-0 md:mx-auto lg:mx-0" />
                      <span className={`whitespace-nowrap md:hidden lg:block ${isActive ? 'font-medium' : ''}`}>
                        {label}
                      </span>
                    </>
                  )}
                </NavLink>
                {/* Tablet tooltip */}
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 rounded text-xs whitespace-nowrap
                  hidden md:block lg:hidden pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50"
                  style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}>
                  {label}
                </div>
              </li>
            ))}
          </ul>

          <div className="mx-3 my-3" style={{ borderTop: '1px solid var(--border-subtle)' }} />

          <ul className="space-y-0.5 px-2">
            {isAdmin && (
              <li className="relative group">
                <NavLink to="/admin" onClick={handleNavClick}
                  className="flex items-center gap-3 py-2.5 rounded text-sm transition-all relative overflow-hidden
                    md:justify-center lg:justify-start px-3 md:px-0 lg:px-3"
                  style={({ isActive }) => ({
                    color: isActive ? 'var(--gold-primary)' : 'var(--text-secondary)',
                    background: isActive ? 'var(--gold-muted)' : 'transparent',
                  })}
                >
                  {({ isActive }) => (
                    <>
                      {isActive && <span className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full" style={{ background: 'var(--gold-primary)' }} />}
                      <ShieldCheck size={16} strokeWidth={isActive ? 2 : 1.5} className="flex-shrink-0 md:mx-auto lg:mx-0" />
                      <span className={`whitespace-nowrap md:hidden lg:block ${isActive ? 'font-medium' : ''}`}>Admin</span>
                    </>
                  )}
                </NavLink>
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 rounded text-xs whitespace-nowrap
                  hidden md:block lg:hidden pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50"
                  style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}>
                  Admin
                </div>
              </li>
            )}
            <li className="relative group">
              <NavLink to="/settings" onClick={handleNavClick}
                className="flex items-center gap-3 py-2.5 rounded text-sm transition-all relative overflow-hidden
                  md:justify-center lg:justify-start px-3 md:px-0 lg:px-3"
                style={({ isActive }) => ({
                  color: isActive ? 'var(--gold-primary)' : 'var(--text-secondary)',
                  background: isActive ? 'var(--gold-muted)' : 'transparent',
                })}
              >
                {({ isActive }) => (
                  <>
                    {isActive && <span className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full" style={{ background: 'var(--gold-primary)' }} />}
                    <Settings size={16} strokeWidth={isActive ? 2 : 1.5} className="flex-shrink-0 md:mx-auto lg:mx-0" />
                    <span className={`whitespace-nowrap md:hidden lg:block ${isActive ? 'font-medium' : ''}`}>Settings</span>
                  </>
                )}
              </NavLink>
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 rounded text-xs whitespace-nowrap
                hidden md:block lg:hidden pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50"
                style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}>
                Settings
              </div>
            </li>
          </ul>
        </nav>

        {/* User footer */}
        <div className="px-3 py-4 flex-shrink-0" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-3 mb-3 md:justify-center lg:justify-start overflow-hidden">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
              style={{ background: 'var(--gold-muted)', border: '1px solid var(--gold-dark)', color: 'var(--gold-light)', fontFamily: 'DM Mono, monospace' }}>
              {initials}
            </div>
            <div className="min-w-0 md:hidden lg:block">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                {profile?.full_name ?? 'User'}
              </p>
              <p className="text-[10px] uppercase tracking-wider truncate"
                style={{ color: isAdmin ? 'var(--gold-primary)' : 'var(--text-muted)' }}>
                {profile?.role ?? 'member'}
              </p>
            </div>
          </div>
          <div className="relative group">
            <button onClick={handleSignOut}
              className="w-full flex items-center gap-2 px-3 py-2 rounded text-xs transition-all
                md:justify-center lg:justify-start"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--status-red)'; e.currentTarget.style.background = 'rgba(224,82,82,0.08)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}>
              <LogOut size={13} className="flex-shrink-0" />
              <span className="md:hidden lg:block">Sign out</span>
            </button>
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 rounded text-xs whitespace-nowrap
              hidden md:block lg:hidden pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50"
              style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}>
              Sign out
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
