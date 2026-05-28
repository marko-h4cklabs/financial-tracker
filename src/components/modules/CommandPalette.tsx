import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, Briefcase,
  CalendarClock, Receipt, ClipboardList, ShieldCheck, Settings, Search,
} from 'lucide-react'

interface Command {
  id: string
  label: string
  description?: string
  icon: React.ElementType
  action: () => void
  keywords?: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
}

export default function CommandPalette({ isOpen, onClose }: Props) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const go = useCallback((path: string) => {
    navigate(path)
    onClose()
  }, [navigate, onClose])

  const commands: Command[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, action: () => go('/dashboard') },
    { id: 'clients', label: 'Clients', description: 'View all clients', icon: Users, action: () => go('/clients'), keywords: 'client customer' },
    { id: 'clients-new', label: 'New Client', icon: Users, action: () => go('/clients?new=1'), keywords: 'add client create' },
    { id: 'deals', label: 'Deals', description: 'Pipeline & deals', icon: Briefcase, action: () => go('/deals'), keywords: 'deal pipeline kanban' },
    { id: 'deals-new', label: 'New Deal', icon: Briefcase, action: () => go('/deals?new=1'), keywords: 'add deal create' },
    { id: 'installments', label: 'Installments', description: 'Payment schedule', icon: CalendarClock, action: () => go('/installments'), keywords: 'payment installment schedule' },
    { id: 'expenses', label: 'Expenses', description: 'Track expenses', icon: Receipt, action: () => go('/expenses'), keywords: 'expense cost spend' },
    { id: 'expenses-new', label: 'New Expense', icon: Receipt, action: () => go('/expenses?new=1'), keywords: 'add expense create' },
    { id: 'work', label: 'Work Tracker', description: 'Logs & checklists', icon: ClipboardList, action: () => go('/work'), keywords: 'work log checklist task' },
    { id: 'settings', label: 'Settings', icon: Settings, action: () => go('/settings'), keywords: 'profile password' },
    { id: 'admin', label: 'Admin Panel', icon: ShieldCheck, action: () => go('/admin'), keywords: 'admin users team activity' },
  ]

  const filtered = commands.filter((c) => {
    if (!query) return true
    const q = query.toLowerCase()
    return (
      c.label.toLowerCase().includes(q) ||
      (c.description?.toLowerCase().includes(q) ?? false) ||
      (c.keywords?.includes(q) ?? false)
    )
  })

  useEffect(() => { setSelected(0) }, [query])
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const el = listRef.current?.children[selected] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [selected, isOpen])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(s + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)) }
    if (e.key === 'Enter' && filtered[selected]) { filtered[selected].action() }
    if (e.key === 'Escape') onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-lg rounded-xl overflow-hidden shadow-2xl"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderTop: '2px solid var(--gold-primary)' }}>
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search commands…"
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: 'var(--text-primary)' }}
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace' }}>
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="py-1.5 max-h-72 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-4 py-6 text-sm text-center" style={{ color: 'var(--text-muted)' }}>No results.</p>
          ) : filtered.map((cmd, i) => {
            const Icon = cmd.icon
            const isSelected = i === selected
            return (
              <button key={cmd.id}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-none"
                style={{
                  background: isSelected ? 'var(--gold-muted)' : 'transparent',
                  borderLeft: isSelected ? '2px solid var(--gold-primary)' : '2px solid transparent',
                }}
                onMouseEnter={() => setSelected(i)}
                onClick={() => cmd.action()}>
                <Icon size={15} style={{ color: isSelected ? 'var(--gold-primary)' : 'var(--text-muted)', flexShrink: 0 }} />
                <div className="min-w-0">
                  <p className="text-sm" style={{ color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                    {cmd.label}
                  </p>
                  {cmd.description && (
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{cmd.description}</p>
                  )}
                </div>
                {isSelected && (
                  <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace' }}>
                    ↵
                  </kbd>
                )}
              </button>
            )
          })}
        </div>

        <div className="px-4 py-2 flex items-center gap-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          {[['↑↓', 'navigate'], ['↵', 'open'], ['esc', 'close']].map(([key, label]) => (
            <div key={key} className="flex items-center gap-1.5">
              <kbd className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace' }}>{key}</kbd>
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
