import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  createColumnHelper, type SortingState,
} from '@tanstack/react-table'
import { Plus, Copy, FileText, TrendingUp, Clock, AlertTriangle, XCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activityLogger'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { startOfMonth, endOfMonth } from 'date-fns'
import type { Invoice, Client, InvoiceStatus } from '@/types'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Table from '@/components/ui/Table'
import StatCard from '@/components/ui/StatCard'
import { InvoiceStatusBadge } from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonRow, SkeletonCard } from '@/components/ui/Skeleton'
import toast from 'react-hot-toast'

type EnrichedInvoice = Invoice & { client?: Client }
const helper = createColumnHelper<EnrichedInvoice>()

export default function InvoicesPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [invoices, setInvoices] = useState<EnrichedInvoice[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [kpiLoading, setKpiLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? '')
  const [clientFilter, setClientFilter] = useState('')
  const [sorting, setSorting] = useState<SortingState>([])
  const [kpis, setKpis] = useState({ totalInvoiced: 0, paidThisMonth: 0, pending: 0, overdue: 0 })

  useEffect(() => { fetchInvoices(); fetchClients(); fetchKpis() }, [])

  async function fetchClients() {
    const { data } = await supabase.from('clients').select('id, name, company')
    setClients((data ?? []) as Client[])
  }

  async function fetchKpis() {
    setKpiLoading(true)
    const now = new Date()
    const ms = startOfMonth(now).toISOString()
    const me = endOfMonth(now).toISOString()
    const [{ data: all }, { data: paid }, { data: pending }, { data: overdue }] = await Promise.all([
      supabase.from('invoices').select('total'),
      supabase.from('invoices').select('total').eq('status', 'paid').gte('paid_at', ms).lte('paid_at', me),
      supabase.from('invoices').select('total').in('status', ['sent', 'draft']),
      supabase.from('invoices').select('total').eq('status', 'overdue'),
    ])
    setKpis({
      totalInvoiced: (all ?? []).reduce((s, r) => s + Number(r.total), 0),
      paidThisMonth: (paid ?? []).reduce((s, r) => s + Number(r.total), 0),
      pending: (pending ?? []).reduce((s, r) => s + Number(r.total), 0),
      overdue: (overdue ?? []).reduce((s, r) => s + Number(r.total), 0),
    })
    setKpiLoading(false)
  }

  async function fetchInvoices() {
    setLoading(true)
    const { data, error } = await supabase
      .from('invoices')
      .select('*, client:client_id(id, name, company)')
      .order('created_at', { ascending: false })
    if (error) { toast.error('Failed to load invoices'); setLoading(false); return }
    setInvoices((data ?? []) as EnrichedInvoice[])
    setLoading(false)
  }

  async function markAsPaid(inv: EnrichedInvoice) {
    const { error } = await supabase.from('invoices')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', inv.id)
    if (error) { toast.error('Failed to update'); return }
    await logActivity({ entity_type: 'invoice', entity_id: inv.id, action: 'payment', description: `Invoice ${inv.invoice_number} marked as paid` })
    toast.success('Invoice marked as paid')
    fetchInvoices(); fetchKpis()
  }

  async function duplicateInvoice(inv: EnrichedInvoice) {
    const { data: items } = await supabase.from('invoice_items').select('*').eq('invoice_id', inv.id)
    const newNum = `AUR-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`
    const { data: newInv, error } = await supabase.from('invoices').insert({
      invoice_number: newNum, client_id: inv.client_id, deal_id: inv.deal_id,
      title: `${inv.title} (copy)`, status: 'draft',
      issue_date: new Date().toISOString().slice(0, 10),
      due_date: inv.due_date, subtotal: inv.subtotal, tax_rate: inv.tax_rate,
      tax_amount: inv.tax_amount, total: inv.total, currency: inv.currency, notes: inv.notes,
    }).select().single()
    if (error || !newInv) { toast.error('Failed to duplicate'); return }
    if (items?.length) {
      await supabase.from('invoice_items').insert(
        items.map(({ invoice_id: _iid, ...item }: { invoice_id: string; [k: string]: unknown }) => ({ ...item, invoice_id: newInv.id }))
      )
    }
    toast.success('Invoice duplicated')
    fetchInvoices()
    navigate(`/invoices/${newInv.id}`)
  }

  async function cancelInvoice(id: string, num: string) {
    if (!confirm(`Cancel invoice ${num}?`)) return
    await supabase.from('invoices').update({ status: 'cancelled' }).eq('id', id)
    await logActivity({ entity_type: 'invoice', entity_id: id, action: 'update', description: `Invoice ${num} cancelled` })
    toast.success('Invoice cancelled')
    fetchInvoices()
  }

  const today = new Date().toISOString().slice(0, 10)
  const filtered = useMemo(() => {
    return invoices
      .map((inv) => ({
        ...inv,
        status: (inv.status !== 'paid' && inv.status !== 'cancelled' && inv.due_date && inv.due_date < today
          ? 'overdue' : inv.status) as InvoiceStatus,
      }))
      .filter((inv) => {
        const q = search.toLowerCase()
        const client = inv.client as { name?: string } | undefined
        const matchSearch = !q || inv.invoice_number.toLowerCase().includes(q) || inv.title.toLowerCase().includes(q) || (client?.name ?? '').toLowerCase().includes(q)
        const matchStatus = !statusFilter || inv.status === statusFilter
        const matchClient = !clientFilter || inv.client_id === clientFilter
        return matchSearch && matchStatus && matchClient
      })
  }, [invoices, search, statusFilter, clientFilter, today])

  const columns = useMemo(() => [
    helper.accessor('invoice_number', {
      header: 'Invoice #',
      cell: ({ getValue }) => (
        <span style={{ fontFamily: 'DM Mono, monospace', color: 'var(--gold-primary)', fontSize: '13px' }}>{getValue()}</span>
      ),
    }),
    helper.display({
      id: 'client',
      header: 'Client',
      cell: ({ row }) => {
        const c = row.original.client as { name?: string } | undefined
        return <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{c?.name ?? '—'}</span>
      },
    }),
    helper.accessor('title', {
      header: 'Title',
      cell: ({ getValue }) => <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{getValue()}</span>,
    }),
    helper.display({
      id: 'dates',
      header: 'Issue / Due',
      cell: ({ row }) => (
        <div>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{formatDate(row.original.issue_date)}</p>
          <p className="text-xs" style={{ color: row.original.due_date && row.original.due_date < today && row.original.status !== 'paid' ? 'var(--status-red)' : 'var(--text-muted)' }}>
            Due {formatDate(row.original.due_date)}
          </p>
        </div>
      ),
    }),
    helper.accessor('status', {
      header: 'Status',
      cell: ({ getValue }) => <InvoiceStatusBadge status={getValue()} />,
    }),
    helper.accessor('total', {
      header: 'Total',
      cell: ({ row }) => (
        <span style={{ fontFamily: 'DM Mono, monospace', color: 'var(--gold-primary)', fontSize: '13px' }}>
          {formatCurrency(row.original.total, row.original.currency)}
        </span>
      ),
    }),
    helper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const inv = row.original
        return (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {(inv.status === 'sent' || inv.status === 'overdue') && (
              <button onClick={() => markAsPaid(inv)}
                className="text-xs px-2 py-1 rounded"
                style={{ color: 'var(--status-green)', border: '1px solid rgba(76,175,125,0.3)', background: 'rgba(76,175,125,0.08)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(76,175,125,0.15)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(76,175,125,0.08)' }}>
                Mark Paid
              </button>
            )}
            <button onClick={() => duplicateInvoice(inv)} className="p-1.5 rounded" style={{ color: 'var(--text-muted)' }} title="Duplicate"
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}>
              <Copy size={13} />
            </button>
            {inv.status !== 'paid' && inv.status !== 'cancelled' && (
              <button onClick={() => cancelInvoice(inv.id, inv.invoice_number)} className="p-1.5 rounded" style={{ color: 'var(--text-muted)' }} title="Cancel"
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--status-red)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}>
                <XCircle size={13} />
              </button>
            )}
          </div>
        )
      },
    }),
  ], [today])

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
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-medium" style={{ color: 'var(--text-primary)' }}>Invoices</h1>
        <Button onClick={() => navigate('/invoices/new')}><Plus size={14} /> New Invoice</Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {kpiLoading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : <>
            <StatCard label="Total Invoiced" value={formatCurrency(kpis.totalInvoiced)} icon={TrendingUp} goldAccent />
            <StatCard label="Paid This Month" value={formatCurrency(kpis.paidThisMonth)} icon={TrendingUp} />
            <StatCard label="Pending" value={formatCurrency(kpis.pending)} icon={Clock} />
            <StatCard label="Overdue" value={formatCurrency(kpis.overdue)} icon={AlertTriangle} />
          </>
        }
      </div>

      <Card>
        <div className="flex items-center gap-3 px-4 py-3">
          <input placeholder="Search invoice #, title, client…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-3 py-2 rounded text-sm outline-none"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--gold-primary)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-default)')} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded text-sm outline-none"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: statusFilter ? 'var(--text-primary)' : 'var(--text-muted)' }}>
            <option value="">All statuses</option>
            {['draft','sent','paid','overdue','cancelled'].map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>
            ))}
          </select>
          <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}
            className="px-3 py-2 rounded text-sm outline-none"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: clientFilter ? 'var(--text-primary)' : 'var(--text-muted)' }}>
            <option value="">All clients</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </Card>

      <Card>
        {loading ? (
          <table className="w-full"><tbody>{Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} cols={7} />)}</tbody></table>
        ) : filtered.length === 0 ? (
          <EmptyState icon={FileText} title="No invoices found"
            description={search || statusFilter ? 'Try adjusting your filters' : 'Create your first invoice'}
            action={!search && !statusFilter ? { label: 'New Invoice', onClick: () => navigate('/invoices/new') } : undefined} />
        ) : (
          <Table table={table} onRowClick={(row) => navigate(`/invoices/${row.id}`)} />
        )}
      </Card>
    </div>
  )
}
