import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table'
import { Users, MoreHorizontal, Plus, ChevronDown } from 'lucide-react'
import { useIsMobile } from '@/hooks/useIsMobile'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/authStore'
import type { Client, Profile } from '@/types'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Table from '@/components/ui/Table'
import { ClientStatusBadge } from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonRow } from '@/components/ui/Skeleton'
import ClientFormModal from '@/components/modules/ClientFormModal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useRealtimeSync } from '@/hooks/useRealtimeSync'
import toast from 'react-hot-toast'

type EnrichedClient = Client & { deal_count: number; deal_value: number; assigned_profile?: Profile }

const helper = createColumnHelper<EnrichedClient>()

export default function ClientsPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [clients, setClients] = useState<EnrichedClient[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [assignedFilter, setAssignedFilter] = useState('')
  const [sorting, setSorting] = useState<SortingState>([])
  const [showModal, setShowModal] = useState(false)
  const [editClient, setEditClient] = useState<Client | null>(null)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const isMobile = useIsMobile()

  useEffect(() => {
    fetchClients()
    fetchProfiles()
  }, [])

  const { flashId, flashType } = useRealtimeSync('clients', fetchClients, {
    getToastMessage: (p) => p.eventType === 'INSERT'
      ? `New client added: ${(p.new?.name as string) ?? 'Unknown'}`
      : null,
  })

  async function deleteClient(id: string) {
    await supabase.from('clients').delete().eq('id', id)
    toast.success('Client deleted')
    fetchClients()
  }

  async function fetchProfiles() {
    const { data } = await supabase.from('profiles').select('*').eq('is_active', true)
    setProfiles((data ?? []) as Profile[])
  }

  async function fetchClients() {
    setLoading(true)
    const { data, error } = await supabase
      .from('clients')
      .select('*, assigned_profile:assigned_to(id, full_name, avatar_initials)')
      .order('created_at', { ascending: false })

    if (error) { toast.error('Failed to load clients'); setLoading(false); return }

    const ids = (data ?? []).map((c) => c.id)
    const { data: deals } = await supabase
      .from('deals')
      .select('client_id, value')
      .in('client_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])

    const enriched = (data ?? []).map((c) => {
      const clientDeals = (deals ?? []).filter((d) => d.client_id === c.id)
      return { ...c, deal_count: clientDeals.length, deal_value: clientDeals.reduce((s, d) => s + Number(d.value), 0) }
    }) as EnrichedClient[]

    setClients(enriched)
    setLoading(false)
  }

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      const q = search.toLowerCase()
      const matchSearch = !q || c.name.toLowerCase().includes(q) || (c.company ?? '').toLowerCase().includes(q) || (c.email ?? '').toLowerCase().includes(q)
      const matchStatus = !statusFilter || c.status === statusFilter
      const matchAssigned = !assignedFilter || c.assigned_to === assignedFilter
      return matchSearch && matchStatus && matchAssigned
    })
  }, [clients, search, statusFilter, assignedFilter])

  const columns = useMemo(() => [
    helper.display({
      id: 'avatar',
      header: '',
      cell: ({ row }) => {
        const initials = row.original.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
        return (
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
            style={{ background: 'var(--gold-muted)', color: 'var(--gold-primary)', border: '1px solid var(--gold-dark)', fontFamily: 'DM Mono, monospace' }}>
            {initials}
          </div>
        )
      },
    }),
    helper.accessor('name', {
      header: 'Client',
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{row.original.name}</p>
          {row.original.company && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{row.original.company}</p>}
        </div>
      ),
    }),
    helper.accessor('status', {
      header: 'Status',
      cell: ({ getValue }) => <ClientStatusBadge status={getValue()} />,
    }),
    helper.display({
      id: 'contact',
      header: 'Contact',
      cell: ({ row }) => (
        <div>
          {row.original.email && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{row.original.email}</p>}
          {row.original.phone && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{row.original.phone}</p>}
        </div>
      ),
    }),
    helper.display({
      id: 'assigned',
      header: 'Assigned To',
      cell: ({ row }) => {
        const ap = row.original.assigned_profile
        if (!ap) return <span style={{ color: 'var(--text-muted)' }}>—</span>
        const initials = ap.avatar_initials ?? ap.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
        return (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}>
              {initials}
            </div>
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{ap.full_name}</span>
          </div>
        )
      },
    }),
    helper.accessor('deal_value', {
      header: 'Deal Value',
      cell: ({ getValue }) => (
        <span style={{ fontFamily: 'DM Mono, monospace', color: 'var(--gold-primary)', fontSize: '13px' }}>
          €{Number(getValue()).toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </span>
      ),
    }),
    helper.accessor('deal_count', {
      header: 'Deals',
      cell: ({ getValue }) => <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{getValue()}</span>,
    }),
    helper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === row.original.id ? null : row.original.id) }}
            className="w-7 h-7 rounded flex items-center justify-center"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <MoreHorizontal size={15} />
          </button>
          {menuOpen === row.original.id && (
            <div className="absolute right-0 top-8 w-36 rounded shadow-lg z-10 py-1"
              style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-default)' }}>
              {[
                { label: 'View', action: () => { navigate(`/clients/${row.original.id}`); setMenuOpen(null) }, danger: false },
                { label: 'Edit', action: () => { setEditClient(row.original); setShowModal(true); setMenuOpen(null) }, danger: false },
                {
                  label: row.original.status === 'inactive' ? 'Activate' : 'Deactivate',
                  danger: false,
                  action: async () => {
                    const s = row.original.status === 'inactive' ? 'active' : 'inactive'
                    await supabase.from('clients').update({ status: s }).eq('id', row.original.id)
                    setMenuOpen(null); fetchClients()
                  }
                },
                { label: 'Delete', danger: true, action: () => { setDeleteTarget({ id: row.original.id, name: row.original.name }); setMenuOpen(null) } },
              ].map(({ label, action, danger }) => (
                <button key={label} onClick={(e) => { e.stopPropagation(); action() }}
                  className="w-full text-left px-3 py-2 text-xs"
                  style={{ color: danger ? 'var(--status-red)' : 'var(--text-secondary)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = danger ? 'rgba(224,82,82,0.08)' : 'var(--bg-elevated)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      ),
    }),
  ], [menuOpen, navigate])

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <div className="space-y-4" onClick={() => setMenuOpen(null)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 md:gap-6">
          <h1 className="text-lg md:text-xl font-medium" style={{ color: 'var(--text-primary)' }}>Clients</h1>
          <div className="hidden md:flex items-center gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span><span style={{ color: 'var(--text-primary)', fontFamily: 'DM Mono, monospace' }}>{clients.length}</span> total</span>
            <span><span style={{ color: 'var(--status-green)', fontFamily: 'DM Mono, monospace' }}>{clients.filter(c => c.status === 'active').length}</span> active</span>
            <span><span style={{ color: 'var(--status-blue)', fontFamily: 'DM Mono, monospace' }}>{clients.filter(c => c.status === 'lead').length}</span> leads</span>
          </div>
        </div>
        <Button onClick={() => { setEditClient(null); setShowModal(true) }} className="hidden md:flex">
          <Plus size={14} /> New Client
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <div className="px-4 py-3">
          <div className="flex items-center gap-2">
            <input placeholder="Search name, company, email…" value={search} onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-3 py-2 rounded text-sm outline-none"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--gold-primary)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-default)')} />
            {/* Filters toggle on mobile */}
            <button onClick={() => setFiltersOpen((v) => !v)}
              className="flex items-center gap-1 px-3 py-2 rounded text-sm md:hidden flex-shrink-0"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-muted)' }}>
              Filters <ChevronDown size={13} className={filtersOpen ? 'rotate-180' : ''} />
            </button>
            {/* Desktop: always show selects */}
            <div className="hidden md:flex items-center gap-2">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded text-sm outline-none"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: statusFilter ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                <option value="">All statuses</option>
                {['active','inactive','lead','churned'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
              </select>
              <select value={assignedFilter} onChange={(e) => setAssignedFilter(e.target.value)}
                className="px-3 py-2 rounded text-sm outline-none"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: assignedFilter ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                <option value="">All team members</option>
                {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </div>
          </div>
          {/* Mobile expanded filters */}
          {filtersOpen && (
            <div className="mt-2 grid grid-cols-2 gap-2 md:hidden">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded text-sm outline-none"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: statusFilter ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                <option value="">All statuses</option>
                {['active','inactive','lead','churned'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
              </select>
              <select value={assignedFilter} onChange={(e) => setAssignedFilter(e.target.value)}
                className="px-3 py-2 rounded text-sm outline-none"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: assignedFilter ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                <option value="">All team</option>
                {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </div>
          )}
        </div>
      </Card>

      {/* Table (tablet+) */}
      {!isMobile && (
        <Card>
          {loading ? (
            <table className="w-full"><tbody>{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={8} />)}</tbody></table>
          ) : filtered.length === 0 ? (
            <EmptyState icon={Users} title="No clients found"
              description={search || statusFilter ? 'Try adjusting your filters' : 'Add your first client to get started'}
              action={!search && !statusFilter ? { label: 'New Client', onClick: () => setShowModal(true) } : undefined} />
          ) : (
            <Table table={table} onRowClick={(row) => navigate(`/clients/${row.id}`)} flashId={flashId} flashType={flashType} />
          )}
        </Card>
      )}

      {/* Card list (mobile) */}
      {isMobile && (
        <div className="space-y-2">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-lg p-4 animate-pulse" style={{ background: 'var(--bg-surface)', height: 80 }} />
            ))
          ) : filtered.length === 0 ? (
            <EmptyState icon={Users} title="No clients found"
              description={search || statusFilter ? 'Try adjusting your filters' : 'Add your first client'} />
          ) : (
            filtered.map((c) => {
              const initials = c.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
              const ap = c.assigned_profile
              return (
                <div key={c.id}
                  className="rounded-lg p-4 flex items-center gap-3 active:opacity-70"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
                  onClick={() => navigate(`/clients/${c.id}`)}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0"
                    style={{ background: 'var(--gold-muted)', color: 'var(--gold-primary)', fontFamily: 'DM Mono, monospace' }}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{c.name}</p>
                      <ClientStatusBadge status={c.status} />
                    </div>
                    {c.company && <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{c.company}</p>}
                    <div className="flex items-center gap-3 mt-1">
                      {c.phone && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{c.phone}</p>}
                      {ap && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>→ {ap.full_name}</p>}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Mobile FAB */}
      <button
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl z-20 md:hidden"
        style={{ background: 'var(--gold-primary)', color: '#0A0A0A' }}
        onClick={() => { setEditClient(null); setShowModal(true) }}>
        <Plus size={22} />
      </button>

      <ClientFormModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditClient(null) }}
        client={editClient}
        profiles={profiles}
        currentUserId={profile?.id ?? ''}
        onSaved={() => { fetchClients(); setShowModal(false); setEditClient(null) }}
      />
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteClient(deleteTarget.id)}
        title={`Delete ${deleteTarget?.name}?`}
        message="This cannot be undone."
      />
    </div>
  )
}
