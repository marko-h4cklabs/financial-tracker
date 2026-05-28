import { useEffect, useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  createColumnHelper, type SortingState,
} from '@tanstack/react-table'
import { Plus, CalendarClock, CheckCircle, Clock, AlertTriangle, TrendingUp, MoreHorizontal, X, ChevronDown, ChevronRight } from 'lucide-react'
import { useIsMobile } from '@/hooks/useIsMobile'
import { format, addDays, differenceInDays, startOfMonth, endOfMonth, isSameDay } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activityLogger'
import { useAuth } from '@/store/authStore'
import { formatCurrency, formatDate, formatDaysUntil } from '@/lib/formatters'
import type { Installment, Client, Deal, InstallmentStatus, PaymentMethod } from '@/types'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Table from '@/components/ui/Table'
import StatCard from '@/components/ui/StatCard'
import { InstallmentStatusBadge } from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { SkeletonRow, SkeletonCard } from '@/components/ui/Skeleton'
import InstallmentFormModal from '@/components/modules/InstallmentFormModal'
import { useRealtimeSync } from '@/hooks/useRealtimeSync'
import toast from 'react-hot-toast'

type EnrichedInstallment = Installment & { client?: Client; deal?: Deal }
type SlidePanelType = 'due_overall' | 'overdue' | 'paid_month'

const helper = createColumnHelper<EnrichedInstallment>()

const PANEL_TITLES: Record<SlidePanelType, string> = {
  due_overall: 'Due Overall',
  overdue: 'Overdue',
  paid_month: 'Paid This Month',
}

export default function InstallmentsPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [installments, setInstallments] = useState<EnrichedInstallment[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [kpiLoading, setKpiLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const [dealFilter, setDealFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [sorting, setSorting] = useState<SortingState>([])
  const [kpis, setKpis] = useState({ dueOverall: 0, overdueAmount: 0, overdueCount: 0, paidThisMonth: 0 })
  const [showModal, setShowModal] = useState(false)
  const [selectedDealId, setSelectedDealId] = useState('')

  // Three-dot menu + edit + delete
  const [actionsMenu, setActionsMenu] = useState<string | null>(null)
  const [editInstallment, setEditInstallment] = useState<EnrichedInstallment | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null)

  // Mark as paid popover
  const [paidPopover, setPaidPopover] = useState<string | null>(null)
  const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10))
  const [paidMethod, setPaidMethod] = useState<PaymentMethod>('bank_transfer')
  const [marking, setMarking] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Slide-over panel
  const [slidePanel, setSlidePanel] = useState<SlidePanelType | null>(null)

  const isMobile = useIsMobile()

  useEffect(() => { fetchInstallments(); fetchDeals(); fetchClients(); fetchKpis() }, [])

  const { flashId, flashType } = useRealtimeSync('installments', () => { fetchInstallments(); fetchKpis() }, {
    getToastMessage: (p) => {
      if (p.eventType === 'UPDATE' && p.new?.status === 'paid' && p.old?.status !== 'paid') {
        const amount = p.new?.amount as number | undefined
        return amount ? `Installment paid — ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : null
      }
      if (p.eventType === 'INSERT') return `New installment: "${(p.new?.title as string) ?? ''}"`
      return null
    },
  })

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPaidPopover(null)
      }
      setActionsMenu(null)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function fetchClients() {
    const { data } = await supabase.from('clients').select('id, name')
    setClients((data ?? []) as Client[])
  }

  async function fetchDeals() {
    const { data } = await supabase.from('deals').select('id, title, client_id')
    setDeals((data ?? []) as Deal[])
  }

  async function fetchKpis() {
    setKpiLoading(true)
    const now = new Date()
    const ms = startOfMonth(now).toISOString().slice(0, 10)
    const me = endOfMonth(now).toISOString()
    const today = now.toISOString().slice(0, 10)

    const [{ data: dueOverallData }, { data: overdueData }, { data: paidMonth }] = await Promise.all([
      supabase.from('installments').select('amount').in('status', ['pending', 'overdue']),
      supabase.from('installments').select('amount').in('status', ['pending', 'overdue']).lt('due_date', today),
      supabase.from('installments').select('amount').eq('status', 'paid')
        .gte('paid_at', new Date(ms).toISOString()).lte('paid_at', me),
    ])

    setKpis({
      dueOverall: (dueOverallData ?? []).reduce((s, r) => s + Number(r.amount), 0),
      overdueAmount: (overdueData ?? []).reduce((s, r) => s + Number(r.amount), 0),
      overdueCount: overdueData?.length ?? 0,
      paidThisMonth: (paidMonth ?? []).reduce((s, r) => s + Number(r.amount), 0),
    })
    setKpiLoading(false)
  }

  async function fetchInstallments() {
    setLoading(true)
    const { data, error } = await supabase
      .from('installments')
      .select('*, client:client_id(id, name), deal:deal_id(id, title)')
      .order('due_date', { ascending: true })
    if (error) { toast.error('Failed to load installments'); setLoading(false); return }
    setInstallments((data ?? []) as EnrichedInstallment[])
    setLoading(false)
  }

  async function confirmMarkPaid(instId: string) {
    setMarking(true)
    const { error } = await supabase.from('installments')
      .update({ status: 'paid', paid_at: new Date(paidDate).toISOString(), payment_method: paidMethod })
      .eq('id', instId)
    setMarking(false)
    if (error) { toast.error('Failed to update'); return }
    await logActivity({ entity_type: 'installment', entity_id: instId, action: 'payment', description: 'Installment marked as paid' })
    toast.success('Marked as paid')
    setPaidPopover(null)
    fetchInstallments(); fetchKpis()
  }

  async function deleteInstallment(id: string) {
    await supabase.from('installments').delete().eq('id', id)
    await logActivity({ entity_type: 'installment', entity_id: id, action: 'delete', description: 'Deleted installment' })
    toast.success('Installment deleted')
    fetchInstallments(); fetchKpis()
  }

  // Slide-over breakdown data
  const slidePanelData = useMemo(() => {
    if (!slidePanel) return []
    const now = new Date()
    const today = now.toISOString().slice(0, 10)
    const ms = startOfMonth(now).toISOString()
    const me = endOfMonth(now).toISOString()

    let subset: EnrichedInstallment[]
    if (slidePanel === 'due_overall') {
      subset = installments.filter((i) => ['pending', 'overdue'].includes(i.status))
    } else if (slidePanel === 'overdue') {
      subset = installments.filter((i) => ['pending', 'overdue'].includes(i.status) && i.due_date < today)
    } else {
      subset = installments.filter((i) => i.status === 'paid' && i.paid_at && i.paid_at >= ms && i.paid_at <= me)
    }

    const map = new Map<string, { clientId: string; clientName: string; initials: string; items: EnrichedInstallment[]; total: number }>()
    subset.forEach((inst) => {
      const client = inst.client as { name?: string } | undefined
      const clientId = inst.client_id ?? 'no-client'
      const clientName = client?.name ?? 'Unknown Client'
      const initials = clientName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
      const entry = map.get(clientId) ?? { clientId, clientName, initials, items: [], total: 0 }
      entry.items.push(inst)
      entry.total += Number(inst.amount)
      map.set(clientId, entry)
    })

    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [slidePanel, installments])

  const today = new Date().toISOString().slice(0, 10)

  const calendarDays = useMemo(() => {
    const days: Date[] = []
    for (let i = 0; i < 90; i++) days.push(addDays(new Date(), i))
    return days
  }, [])

  const installmentsByDate = useMemo(() => {
    const map: Record<string, number> = {}
    installments.filter((i) => i.status === 'pending').forEach((i) => {
      map[i.due_date] = (map[i.due_date] ?? 0) + 1
    })
    return map
  }, [installments])

  const filtered = useMemo(() => {
    return installments.filter((inst) => {
      const client = inst.client as { name?: string } | undefined
      const deal = inst.deal as { title?: string } | undefined
      const q = search.toLowerCase()
      const matchSearch = !q || inst.title.toLowerCase().includes(q) || (client?.name ?? '').toLowerCase().includes(q) || (deal?.title ?? '').toLowerCase().includes(q)
      const matchStatus = !statusFilter || inst.status === statusFilter
      const matchClient = !clientFilter || inst.client_id === clientFilter
      const matchDeal = !dealFilter || inst.deal_id === dealFilter
      const matchDate = !dateFilter || inst.due_date === dateFilter
      return matchSearch && matchStatus && matchClient && matchDeal && matchDate
    })
  }, [installments, search, statusFilter, clientFilter, dealFilter, dateFilter])

  const columns = useMemo(() => [
    helper.accessor('title', {
      header: 'Title',
      cell: ({ getValue }) => <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{getValue()}</span>,
    }),
    helper.display({
      id: 'client',
      header: 'Client',
      cell: ({ row }) => {
        const client = row.original.client as { id?: string; name?: string } | undefined
        if (!client?.name) return <span style={{ color: 'var(--text-muted)' }}>—</span>
        return (
          <button onClick={(e) => { e.stopPropagation(); navigate(`/clients/${client.id}`) }}
            className="text-sm hover:underline" style={{ color: 'var(--text-secondary)' }}>
            {client.name}
          </button>
        )
      },
    }),
    helper.display({
      id: 'deal',
      header: 'Deal',
      cell: ({ row }) => {
        const deal = row.original.deal as { id?: string; title?: string } | undefined
        if (!deal?.title) return <span style={{ color: 'var(--text-muted)' }}>—</span>
        return (
          <button onClick={(e) => { e.stopPropagation(); navigate(`/deals/${deal.id}`) }}
            className="text-sm hover:underline" style={{ color: 'var(--text-secondary)' }}>
            {deal.title}
          </button>
        )
      },
    }),
    helper.accessor('amount', {
      header: 'Amount',
      cell: ({ row }) => (
        <span style={{ fontFamily: 'DM Mono, monospace', color: 'var(--gold-primary)', fontSize: '13px' }}>
          {formatCurrency(row.original.amount, row.original.currency)}
        </span>
      ),
    }),
    helper.accessor('due_date', {
      header: 'Due Date',
      cell: ({ getValue, row }) => {
        const val = getValue()
        const rel = formatDaysUntil(val)
        const isOverdue = row.original.status !== 'paid' && val < today
        const isSoon = !isOverdue && differenceInDays(new Date(val), new Date()) < 7
        return (
          <div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{formatDate(val)}</p>
            <p className="text-[10px]" style={{ color: isOverdue ? 'var(--status-red)' : isSoon ? 'var(--status-yellow)' : row.original.status === 'paid' ? 'var(--status-green)' : 'var(--text-muted)' }}>
              {row.original.status === 'paid' ? `Paid ${formatDate(row.original.paid_at)}` : rel}
            </p>
          </div>
        )
      },
    }),
    helper.accessor('status', {
      header: 'Status',
      cell: ({ getValue }) => <InstallmentStatusBadge status={getValue()} />,
    }),
    helper.accessor('payment_method', {
      header: 'Method',
      cell: ({ getValue }) => {
        const v = getValue()
        if (!v) return <span style={{ color: 'var(--text-muted)' }}>—</span>
        return <span className="text-xs capitalize" style={{ color: 'var(--text-secondary)' }}>{v.replace('_', ' ')}</span>
      },
    }),
    helper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const inst = row.original
        const isMenuOpen = actionsMenu === inst.id
        const isMarkPaidOpen = paidPopover === inst.id
        return (
          <div className="relative flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={(e) => { e.stopPropagation(); setActionsMenu(isMenuOpen ? null : inst.id); setPaidPopover(null) }}
              className="w-7 h-7 rounded flex items-center justify-center"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}>
              <MoreHorizontal size={14} />
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 top-8 w-40 rounded shadow-lg z-30 py-1"
                style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-default)' }}>
                {inst.status === 'pending' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setActionsMenu(null); setPaidPopover(inst.id); setPaidDate(new Date().toISOString().slice(0, 10)); setPaidMethod('bank_transfer') }}
                    className="w-full text-left px-3 py-2 text-xs"
                    style={{ color: 'var(--status-green)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-elevated)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                    Mark as Paid
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); setActionsMenu(null); setEditInstallment(inst); setShowEditModal(true) }}
                  className="w-full text-left px-3 py-2 text-xs"
                  style={{ color: 'var(--text-secondary)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-elevated)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                  Edit
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setActionsMenu(null); setDeleteTarget({ id: inst.id, title: inst.title }) }}
                  className="w-full text-left px-3 py-2 text-xs"
                  style={{ color: 'var(--status-red)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(224,82,82,0.08)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                  Delete
                </button>
              </div>
            )}

            {isMarkPaidOpen && (
              <div ref={popoverRef}
                className="absolute right-0 bottom-8 w-56 rounded-lg p-3 z-30 space-y-3 shadow-xl"
                style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-default)' }}>
                <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Confirm Payment</p>
                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Date</label>
                    <input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)}
                      className="w-full px-2 py-1.5 rounded text-xs outline-none mt-1"
                      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--gold-primary)')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-default)')} />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Method</label>
                    <select value={paidMethod} onChange={(e) => setPaidMethod(e.target.value as PaymentMethod)}
                      className="w-full px-2 py-1.5 rounded text-xs outline-none mt-1"
                      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setPaidPopover(null)}
                    className="flex-1 py-1.5 rounded text-xs"
                    style={{ color: 'var(--text-muted)', border: '1px solid var(--border-default)' }}>
                    Cancel
                  </button>
                  <button onClick={() => confirmMarkPaid(inst.id)} disabled={marking}
                    className="flex-1 py-1.5 rounded text-xs font-medium"
                    style={{ background: 'var(--gold-primary)', color: '#0A0A0A' }}>
                    {marking ? '…' : 'Confirm'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      },
    }),
  ], [actionsMenu, paidPopover, paidDate, paidMethod, marking, today, navigate])

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg md:text-xl font-medium" style={{ color: 'var(--text-primary)' }}>Payment Schedule</h1>
        <Button onClick={() => setShowModal(true)} className="hidden md:flex"><Plus size={14} /> Add Installment</Button>
      </div>

      {/* KPIs — 3 clickable cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        {kpiLoading
          ? Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
          : <>
            <button onClick={() => setSlidePanel('due_overall')} className="text-left rounded-lg transition-all"
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}>
              <StatCard label="Due Overall" value={formatCurrency(kpis.dueOverall)} icon={Clock} goldAccent />
            </button>
            <button onClick={() => setSlidePanel('overdue')} className="text-left rounded-lg transition-all"
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}>
              <StatCard label="Overdue" value={formatCurrency(kpis.overdueAmount)} subtitle={`${kpis.overdueCount} installments`} icon={AlertTriangle} />
            </button>
            <button onClick={() => setSlidePanel('paid_month')} className="text-left rounded-lg transition-all"
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}>
              <StatCard label="Paid This Month" value={formatCurrency(kpis.paidThisMonth)} icon={TrendingUp} />
            </button>
          </>
        }
      </div>

      {/* Calendar Strip */}
      <Card>
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Next 90 Days</p>
        </div>
        <div className="overflow-x-auto px-4 py-3">
          <div className="flex gap-1 min-w-max">
            {calendarDays.map((day) => {
              const key = format(day, 'yyyy-MM-dd')
              const count = installmentsByDate[key] ?? 0
              const isDayToday = isSameDay(day, new Date())
              const isSelected = dateFilter === key
              return (
                <button key={key} onClick={() => setDateFilter(isSelected ? '' : key)}
                  className="flex flex-col items-center gap-1 px-2 py-2 rounded transition-all"
                  style={{
                    background: isSelected ? 'var(--gold-muted)' : isDayToday ? 'var(--bg-elevated)' : 'transparent',
                    border: `1px solid ${isSelected ? 'var(--gold-primary)' : isDayToday ? 'var(--border-default)' : 'transparent'}`,
                    minWidth: '36px',
                  }}>
                  <span className="text-[9px] uppercase" style={{ color: 'var(--text-muted)' }}>{format(day, 'EEE')}</span>
                  <span className="text-xs font-medium" style={{ color: isDayToday || isSelected ? 'var(--gold-primary)' : 'var(--text-secondary)' }}>
                    {format(day, 'd')}
                  </span>
                  {count > 0 && <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--gold-primary)' }} />}
                  {count === 0 && <div className="w-1.5 h-1.5" />}
                </button>
              )
            })}
          </div>
        </div>
        {dateFilter && (
          <div className="px-4 pb-3 flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Showing installments for {format(new Date(dateFilter), 'dd MMM yyyy')}
            </span>
            <button onClick={() => setDateFilter('')} className="text-xs" style={{ color: 'var(--gold-primary)' }}>Clear</button>
          </div>
        )}
      </Card>

      {/* Filters */}
      <Card>
        <div className="flex items-center gap-3 px-4 py-3 flex-wrap">
          <input placeholder="Search installments…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-40 px-3 py-2 rounded text-sm outline-none"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--gold-primary)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-default)')} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded text-sm outline-none"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: statusFilter ? 'var(--text-primary)' : 'var(--text-muted)' }}>
            <option value="">All statuses</option>
            {(['pending','paid','overdue','cancelled'] as InstallmentStatus[]).map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>
            ))}
          </select>
          <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}
            className="px-3 py-2 rounded text-sm outline-none"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: clientFilter ? 'var(--text-primary)' : 'var(--text-muted)' }}>
            <option value="">All clients</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={dealFilter} onChange={(e) => setDealFilter(e.target.value)}
            className="px-3 py-2 rounded text-sm outline-none"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: dealFilter ? 'var(--text-primary)' : 'var(--text-muted)' }}>
            <option value="">All deals</option>
            {deals.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
          </select>
        </div>
      </Card>

      {/* Table (tablet+) */}
      {!isMobile && (
        <Card>
          {loading ? (
            <table className="w-full"><tbody>{Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} cols={8} />)}</tbody></table>
          ) : filtered.length === 0 ? (
            <EmptyState icon={CalendarClock} title="No installments found"
              description={search || statusFilter ? 'Try adjusting your filters' : 'Add your first payment installment'}
              action={!search && !statusFilter ? { label: 'Add Installment', onClick: () => setShowModal(true) } : undefined} />
          ) : (
            <Table table={table} flashId={flashId} flashType={flashType} />
          )}
        </Card>
      )}

      {/* Mobile card list */}
      {isMobile && (
        <div className="space-y-2">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-lg p-4 animate-pulse" style={{ background: 'var(--bg-surface)', height: 96 }} />
            ))
          ) : filtered.length === 0 ? (
            <EmptyState icon={CalendarClock} title="No installments found"
              description={search || statusFilter ? 'Try adjusting your filters' : 'Add your first installment'} />
          ) : filtered.map((inst) => {
            const client = inst.client as { name?: string } | undefined
            const deal = inst.deal as { title?: string } | undefined
            const days = differenceInDays(new Date(inst.due_date), new Date())
            const isOverdue = inst.status !== 'paid' && inst.due_date < today
            return (
              <div key={inst.id} className="rounded-lg p-4"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{inst.title}</p>
                    {client?.name && <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{client.name}</p>}
                    {deal?.title && <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{deal.title}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <InstallmentStatusBadge status={inst.status} />
                    <span style={{ fontFamily: 'DM Mono, monospace', color: 'var(--gold-primary)', fontSize: '14px', fontWeight: 600 }}>
                      {formatCurrency(inst.amount, inst.currency)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs" style={{ color: isOverdue ? 'var(--status-red)' : days < 7 && inst.status !== 'paid' ? 'var(--status-yellow)' : 'var(--text-muted)' }}>
                    {inst.status === 'paid' ? `Paid ${formatDate(inst.paid_at ?? '')}` : formatDaysUntil(inst.due_date)}
                  </p>
                  <div className="flex items-center gap-2">
                    {inst.status === 'pending' && (
                      <button onClick={() => { setPaidPopover(inst.id); setPaidDate(new Date().toISOString().slice(0, 10)); setPaidMethod('bank_transfer') }}
                        className="text-xs px-2.5 py-1.5 rounded flex items-center gap-1"
                        style={{ color: 'var(--status-green)', border: '1px solid rgba(76,175,125,0.3)', background: 'rgba(76,175,125,0.08)' }}>
                        <CheckCircle size={11} /> Pay
                      </button>
                    )}
                    <button onClick={() => { setEditInstallment(inst); setShowEditModal(true) }}
                      className="text-xs px-2.5 py-1.5 rounded"
                      style={{ color: 'var(--text-muted)', border: '1px solid var(--border-default)' }}>
                      Edit
                    </button>
                    <button onClick={() => setDeleteTarget({ id: inst.id, title: inst.title })}
                      className="text-xs px-2.5 py-1.5 rounded"
                      style={{ color: 'var(--status-red)', border: '1px solid rgba(224,82,82,0.2)' }}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Mobile FAB */}
      <button
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl z-20 md:hidden"
        style={{ background: 'var(--gold-primary)', color: '#0A0A0A' }}
        onClick={() => setShowModal(true)}>
        <Plus size={22} />
      </button>

      {/* Add installment modal — requires deal selection first */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowModal(false)}>
          <div className="rounded-lg p-5 w-full max-w-xs space-y-4"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderTop: '2px solid var(--gold-primary)' }}
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Select Deal</h3>
            <select value={selectedDealId} onChange={(e) => setSelectedDealId(e.target.value)}
              className="w-full px-3 py-2.5 rounded text-sm outline-none"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: selectedDealId ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              <option value="">Choose a deal…</option>
              {deals.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
            </select>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button disabled={!selectedDealId} onClick={() => setShowModal(false)}>Continue</Button>
            </div>
          </div>
        </div>
      )}

      {selectedDealId && !showModal && (
        <InstallmentFormModal
          isOpen={true}
          onClose={() => setSelectedDealId('')}
          installment={null}
          dealId={selectedDealId}
          clientId={deals.find((d) => d.id === selectedDealId)?.client_id}
          currentUserId={profile?.id ?? ''}
          onSaved={() => { setSelectedDealId(''); fetchInstallments(); fetchKpis() }}
        />
      )}

      {showEditModal && editInstallment && (
        <InstallmentFormModal
          isOpen={true}
          onClose={() => { setShowEditModal(false); setEditInstallment(null) }}
          installment={editInstallment}
          dealId={editInstallment.deal_id ?? ''}
          clientId={editInstallment.client_id}
          currentUserId={profile?.id ?? ''}
          onSaved={() => { setShowEditModal(false); setEditInstallment(null); fetchInstallments(); fetchKpis() }}
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteInstallment(deleteTarget.id)}
        title="Delete Installment"
        message={`Delete "${deleteTarget?.title}"? This cannot be undone.`}
      />

      {/* Slide-over panel */}
      {slidePanel && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setSlidePanel(null)} />
          <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md flex flex-col shadow-2xl"
            style={{ background: 'var(--bg-surface)', borderLeft: '1px solid var(--border-default)' }}>
            <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <h2 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {PANEL_TITLES[slidePanel]} — By Client
              </h2>
              <button onClick={() => setSlidePanel(null)} className="w-7 h-7 rounded flex items-center justify-center"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}>
                <X size={15} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {slidePanelData.length === 0 ? (
                <p className="px-5 py-8 text-sm text-center" style={{ color: 'var(--text-muted)' }}>
                  No installments in this category
                </p>
              ) : (
                slidePanelData.map((breakdown) => (
                  <ClientBreakdownSection key={breakdown.clientId} breakdown={breakdown} />
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

interface ClientBreakdown {
  clientId: string
  clientName: string
  initials: string
  items: (Installment & { client?: Client; deal?: Deal })[]
  total: number
}

function ClientBreakdownSection({ breakdown }: { breakdown: ClientBreakdown }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <button onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
            style={{ background: 'var(--gold-muted)', color: 'var(--gold-primary)', fontFamily: 'DM Mono, monospace' }}>
            {breakdown.initials}
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{breakdown.clientName}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {breakdown.items.length} installment{breakdown.items.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span style={{ fontFamily: 'DM Mono, monospace', color: 'var(--gold-primary)', fontSize: '14px' }}>
            {formatCurrency(breakdown.total)}
          </span>
          {expanded
            ? <ChevronDown size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            : <ChevronRight size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
        </div>
      </button>

      {expanded && (
        <div>
          {breakdown.items.map((inst) => (
            <div key={inst.id} className="flex items-center justify-between px-5 py-3"
              style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }}>
              <div>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{inst.title}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Due {formatDate(inst.due_date)}</p>
              </div>
              <div className="flex items-center gap-3">
                <InstallmentStatusBadge status={inst.status} />
                <span style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-primary)', fontSize: '13px' }}>
                  {formatCurrency(inst.amount, inst.currency)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
