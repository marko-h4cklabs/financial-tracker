import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Receipt, TrendingDown, Tag, AlertCircle, MoreHorizontal } from 'lucide-react'
import { useIsMobile } from '@/hooks/useIsMobile'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/authStore'
import { formatCurrency, formatDate } from '@/lib/formatters'
import type { Expense, Client, Deal, ExpenseCategory } from '@/types'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import StatCard from '@/components/ui/StatCard'
import { CategoryBadge } from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonCard } from '@/components/ui/Skeleton'
import ExpenseFormModal from '@/components/modules/ExpenseFormModal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useRealtimeSync } from '@/hooks/useRealtimeSync'
import toast from 'react-hot-toast'

type EnrichedExpense = Expense & { client?: Client; deal?: Deal; created_by_profile?: { full_name: string } }

type ViewTab = 'list' | 'summary'

const CATEGORIES: ExpenseCategory[] = ['software','hardware','advertising','travel','office','contractor','subscription','tax','other']

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  software: 'var(--status-blue)',
  hardware: 'var(--status-purple)',
  advertising: 'var(--gold-primary)',
  travel: 'var(--status-yellow)',
  office: 'var(--text-secondary)',
  contractor: 'var(--status-green)',
  subscription: 'var(--status-blue)',
  tax: 'var(--status-red)',
  other: 'var(--text-muted)',
}

export default function ExpensesPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { profile } = useAuth()
  const [expenses, setExpenses] = useState<EnrichedExpense[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [kpiLoading, setKpiLoading] = useState(true)
  const [viewTab, setViewTab] = useState<ViewTab>('list')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory[]>([])
  const [clientFilter, setClientFilter] = useState('')
  const [dealFilter, setDealFilter] = useState(searchParams.get('deal') ?? '')
  const [showModal, setShowModal] = useState(false)
  const [editExpense, setEditExpense] = useState<Expense | null>(null)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null)
  const [kpis, setKpis] = useState({ thisMonth: 0, thisYear: 0, topCategory: '', unlinked: 0 })
  const [monthlyData, setMonthlyData] = useState<{ month: string; total: number; byCategory: Record<string, number> }[]>([])

  useEffect(() => { fetchExpenses(); fetchClients(); fetchDeals(); fetchKpis(); fetchMonthlyData() }, [])

  useRealtimeSync('expenses', () => { fetchExpenses(); fetchKpis() }, {
    getToastMessage: (p) => p.eventType === 'INSERT'
      ? `New expense: "${(p.new?.title as string) ?? 'Unknown'}"`
      : null,
  })

  async function fetchClients() {
    const { data } = await supabase.from('clients').select('id, name, company')
    setClients((data ?? []) as Client[])
  }

  async function fetchDeals() {
    const { data } = await supabase.from('deals').select('id, title, client_id')
    setDeals((data ?? []) as Deal[])
  }

  async function fetchExpenses() {
    setLoading(true)
    const { data, error } = await supabase
      .from('expenses')
      .select('*, client:client_id(id, name), deal:deal_id(id, title), created_by_profile:created_by(full_name)')
      .order('expense_date', { ascending: false })
    if (error) { toast.error('Failed to load expenses'); setLoading(false); return }
    setExpenses((data ?? []) as EnrichedExpense[])
    setLoading(false)
  }

  async function fetchKpis() {
    setKpiLoading(true)
    const now = new Date()
    const ms = startOfMonth(now).toISOString().slice(0, 10)
    const me = endOfMonth(now).toISOString().slice(0, 10)
    const ys = `${now.getFullYear()}-01-01`
    const ye = `${now.getFullYear()}-12-31`

    const [{ data: monthData }, { data: yearData }, { data: unlinked }] = await Promise.all([
      supabase.from('expenses').select('amount, category').gte('expense_date', ms).lte('expense_date', me),
      supabase.from('expenses').select('amount').gte('expense_date', ys).lte('expense_date', ye),
      supabase.from('expenses').select('id').is('deal_id', null).is('client_id', null),
    ])

    const monthTotal = (monthData ?? []).reduce((s, r) => s + Number(r.amount), 0)
    const yearTotal = (yearData ?? []).reduce((s, r) => s + Number(r.amount), 0)

    // Find top category
    const catTotals: Record<string, number> = {}
    ;(monthData ?? []).forEach((r) => { catTotals[r.category] = (catTotals[r.category] ?? 0) + Number(r.amount) })
    const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''

    setKpis({ thisMonth: monthTotal, thisYear: yearTotal, topCategory: topCat, unlinked: unlinked?.length ?? 0 })
    setKpiLoading(false)
  }

  async function fetchMonthlyData() {
    const { data } = await supabase.from('expenses').select('amount, category, expense_date').order('expense_date')
    if (!data) return

    const months: { month: string; total: number; byCategory: Record<string, number> }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = subMonths(new Date(), i)
      const key = format(d, 'yyyy-MM')
      const label = format(d, 'MMM yy')
      const rows = data.filter((r) => r.expense_date.startsWith(key))
      const byCategory: Record<string, number> = {}
      rows.forEach((r) => { byCategory[r.category] = (byCategory[r.category] ?? 0) + Number(r.amount) })
      months.push({ month: label, total: rows.reduce((s, r) => s + Number(r.amount), 0), byCategory })
    }
    setMonthlyData(months)
  }

  async function deleteExpense(id: string) {
    await supabase.from('expenses').delete().eq('id', id)
    toast.success('Expense deleted')
    fetchExpenses(); fetchKpis()
  }

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      const q = search.toLowerCase()
      const client = e.client as { name?: string } | undefined
      const matchSearch = !q || e.title.toLowerCase().includes(q) || (e.notes ?? '').toLowerCase().includes(q) || (client?.name ?? '').toLowerCase().includes(q)
      const matchCat = categoryFilter.length === 0 || categoryFilter.includes(e.category)
      const matchClient = !clientFilter || e.client_id === clientFilter
      const matchDeal = !dealFilter || e.deal_id === dealFilter
      return matchSearch && matchCat && matchClient && matchDeal
    })
  }, [expenses, search, categoryFilter, clientFilter, dealFilter])

  // Category chart data for this month
  const thisMonthCategoryTotals = useMemo(() => {
    const now = new Date()
    const ms = startOfMonth(now).toISOString().slice(0, 10)
    const me = endOfMonth(now).toISOString().slice(0, 10)
    const monthExpenses = expenses.filter((e) => e.expense_date >= ms && e.expense_date <= me)
    const totals: Record<ExpenseCategory, number> = {} as Record<ExpenseCategory, number>
    CATEGORIES.forEach((c) => { totals[c] = 0 })
    monthExpenses.forEach((e) => { totals[e.category] = (totals[e.category] ?? 0) + Number(e.amount) })
    const maxVal = Math.max(...Object.values(totals), 1)
    return CATEGORIES.map((c) => ({ category: c, total: totals[c], pct: (totals[c] / maxVal) * 100 })).filter((r) => r.total > 0).sort((a, b) => b.total - a.total)
  }, [expenses])

  // 12-month totals for summary
  const maxMonthTotal = Math.max(...monthlyData.map((m) => m.total), 1)

  const toggleCategory = (cat: ExpenseCategory) => {
    setCategoryFilter((prev) => prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat])
  }

  const isMobile = useIsMobile()

  return (
    <div className="space-y-4" onClick={() => setMenuOpen(null)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 md:gap-4">
          <h1 className="text-lg md:text-xl font-medium" style={{ color: 'var(--text-primary)' }}>Expenses</h1>
          <div className="flex rounded overflow-hidden" style={{ border: '1px solid var(--border-default)' }}>
            {(['list','summary'] as ViewTab[]).map((v) => (
              <button key={v} onClick={() => setViewTab(v)}
                className="px-3 py-1.5 text-xs transition-colors"
                style={{ background: viewTab === v ? 'var(--gold-muted)' : 'transparent', color: viewTab === v ? 'var(--gold-primary)' : 'var(--text-muted)' }}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <Button onClick={() => { setEditExpense(null); setShowModal(true) }} className="hidden md:flex"><Plus size={14} /> Add Expense</Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {kpiLoading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : <>
            <StatCard label="This Month" value={formatCurrency(kpis.thisMonth)} icon={TrendingDown} goldAccent />
            <StatCard label="This Year" value={formatCurrency(kpis.thisYear)} icon={Receipt} />
            <StatCard label="Top Category" value={kpis.topCategory ? kpis.topCategory.charAt(0).toUpperCase() + kpis.topCategory.slice(1) : '—'} icon={Tag} />
            <StatCard label="Unlinked" value={kpis.unlinked} subtitle="Not tied to deal/client" icon={AlertCircle} />
          </>
        }
      </div>

      {/* LIST VIEW */}
      {viewTab === 'list' && (
        <>
          {/* Category chart */}
          {thisMonthCategoryTotals.length > 0 && (
            <Card className="p-5">
              <h3 className="text-xs font-medium uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
                This Month by Category
              </h3>
              <div className="space-y-2.5">
                {thisMonthCategoryTotals.map(({ category, total, pct }) => (
                  <div key={category} className="flex items-center gap-3">
                    <span className="text-xs w-24 text-right capitalize" style={{ color: 'var(--text-secondary)' }}>{category}</span>
                    <div className="flex-1 h-2 rounded-full" style={{ background: 'var(--bg-elevated)' }}>
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${CATEGORY_COLORS[category]}, ${CATEGORY_COLORS[category]}aa)` }} />
                    </div>
                    <span className="text-xs w-20 text-right" style={{ fontFamily: 'DM Mono, monospace', color: CATEGORY_COLORS[category] }}>
                      {formatCurrency(total)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Filters */}
          <Card>
            <div className="px-4 py-3 space-y-3">
              <div className="flex items-center gap-3">
                <input placeholder="Search expenses…" value={search} onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 px-3 py-2 rounded text-sm outline-none"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--gold-primary)')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-default)')} />
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
              {/* Category chip filters */}
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => {
                  const active = categoryFilter.includes(cat)
                  return (
                    <button key={cat} onClick={() => toggleCategory(cat)}
                      className="px-2.5 py-1 rounded-full text-[11px] capitalize transition-all"
                      style={{
                        background: active ? `${CATEGORY_COLORS[cat]}22` : 'var(--bg-elevated)',
                        border: `1px solid ${active ? CATEGORY_COLORS[cat] : 'var(--border-default)'}`,
                        color: active ? CATEGORY_COLORS[cat] : 'var(--text-muted)',
                      }}>
                      {cat}
                    </button>
                  )
                })}
                {categoryFilter.length > 0 && (
                  <button onClick={() => setCategoryFilter([])}
                    className="px-2.5 py-1 rounded-full text-[11px]"
                    style={{ color: 'var(--text-muted)' }}>
                    Clear ×
                  </button>
                )}
              </div>
            </div>
          </Card>

          {/* Expenses list — desktop/tablet */}
          {!isMobile && (
            <Card>
              {loading ? (
                <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between px-5 py-4 gap-4 animate-pulse">
                      <div className="h-4 rounded w-48" style={{ background: 'var(--bg-elevated)' }} />
                      <div className="h-4 rounded w-20" style={{ background: 'var(--bg-elevated)' }} />
                    </div>
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <EmptyState icon={Receipt} title="No expenses found"
                  description={search || categoryFilter.length ? 'Try adjusting your filters' : 'Add your first expense'}
                  action={!search && !categoryFilter.length ? { label: 'Add Expense', onClick: () => setShowModal(true) } : undefined} />
              ) : (
                <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                  {filtered.map((exp) => {
                    const client = exp.client as { id?: string; name?: string } | undefined
                    const deal = exp.deal as { id?: string; title?: string } | undefined
                    const createdBy = exp.created_by_profile as { full_name?: string } | undefined
                    return (
                      <div key={exp.id} className="flex items-center justify-between px-5 py-3 gap-4"
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
                            style={{ background: `${CATEGORY_COLORS[exp.category]}18`, border: `1px solid ${CATEGORY_COLORS[exp.category]}33` }}>
                            <Receipt size={14} style={{ color: CATEGORY_COLORS[exp.category] }} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{exp.title}</p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatDate(exp.expense_date)}</span>
                              {client?.name && <button onClick={() => navigate(`/clients/${client.id}`)} className="text-xs hover:underline" style={{ color: 'var(--text-muted)' }}>{client.name}</button>}
                              {deal?.title && <button onClick={() => navigate(`/deals/${deal.id}`)} className="text-xs hover:underline" style={{ color: 'var(--text-muted)' }}>{deal.title}</button>}
                              {createdBy?.full_name && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>by {createdBy.full_name}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <CategoryBadge category={exp.category} />
                          <span style={{ fontFamily: 'DM Mono, monospace', color: 'var(--gold-primary)', fontSize: '13px', minWidth: '80px', textAlign: 'right' }}>
                            {formatCurrency(exp.amount, exp.currency)}
                          </span>
                          <div className="relative" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setMenuOpen(menuOpen === exp.id ? null : exp.id)}
                              className="w-7 h-7 rounded flex items-center justify-center"
                              style={{ color: 'var(--text-muted)' }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}>
                              <MoreHorizontal size={14} />
                            </button>
                            {menuOpen === exp.id && (
                              <div className="absolute right-0 top-8 w-32 rounded shadow-lg z-20 py-1"
                                style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-default)' }}>
                                <button onClick={() => { setEditExpense(exp); setShowModal(true); setMenuOpen(null) }}
                                  className="w-full text-left px-3 py-2 text-xs" style={{ color: 'var(--text-secondary)' }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                                  Edit
                                </button>
                                <button onClick={() => { setDeleteTarget({ id: exp.id, title: exp.title }); setMenuOpen(null) }}
                                  className="w-full text-left px-3 py-2 text-xs" style={{ color: 'var(--status-red)' }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(224,82,82,0.08)')}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
          )}

          {/* Expenses cards — mobile */}
          {isMobile && (
            <div className="space-y-2">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-lg p-4 animate-pulse" style={{ background: 'var(--bg-surface)', height: 80 }} />
                ))
              ) : filtered.length === 0 ? (
                <EmptyState icon={Receipt} title="No expenses found"
                  description={search || categoryFilter.length ? 'Try adjusting filters' : 'Add your first expense'} />
              ) : filtered.map((exp) => (
                <div key={exp.id} className="rounded-lg p-4"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: `${CATEGORY_COLORS[exp.category]}18`, border: `1px solid ${CATEGORY_COLORS[exp.category]}33` }}>
                        <Receipt size={13} style={{ color: CATEGORY_COLORS[exp.category] }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{exp.title}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatDate(exp.expense_date)}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <CategoryBadge category={exp.category} />
                      <span style={{ fontFamily: 'DM Mono, monospace', color: 'var(--gold-primary)', fontSize: '13px', fontWeight: 600 }}>
                        {formatCurrency(exp.amount, exp.currency)}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-2">
                    <button onClick={() => { setEditExpense(exp); setShowModal(true) }}
                      className="text-xs px-3 py-1.5 rounded"
                      style={{ color: 'var(--text-muted)', border: '1px solid var(--border-default)' }}>Edit</button>
                    <button onClick={() => setDeleteTarget({ id: exp.id, title: exp.title })}
                      className="text-xs px-3 py-1.5 rounded"
                      style={{ color: 'var(--status-red)', border: '1px solid rgba(224,82,82,0.2)' }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Mobile FAB */}
          <button
            className="fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl z-20 md:hidden"
            style={{ background: 'var(--gold-primary)', color: '#0A0A0A' }}
            onClick={() => { setEditExpense(null); setShowModal(true) }}>
            <Plus size={22} />
          </button>
        </>
      )}

      {/* SUMMARY VIEW */}
      {viewTab === 'summary' && (
        <div className="space-y-4">
          {/* Monthly totals chart */}
          <Card className="p-5">
            <h3 className="text-sm font-medium mb-5" style={{ color: 'var(--text-primary)' }}>Monthly Expenses — Last 12 Months</h3>
            <div className="flex items-end gap-2 h-32">
              {monthlyData.map((m) => (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1.5">
                  <span className="text-[9px]" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-muted)' }}>
                    {m.total > 0 ? formatCurrency(m.total).replace('€','') : ''}
                  </span>
                  <div className="w-full rounded-t"
                    style={{
                      height: `${Math.max((m.total / maxMonthTotal) * 88, m.total > 0 ? 4 : 0)}px`,
                      background: `linear-gradient(180deg, var(--gold-primary), var(--gold-dark))`,
                      minHeight: m.total > 0 ? '4px' : '0',
                      opacity: 0.85,
                    }} />
                  <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{m.month}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Monthly totals table */}
          <Card>
            <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Monthly Breakdown</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Month</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Total</th>
                    {CATEGORIES.filter((c) => monthlyData.some((m) => (m.byCategory[c] ?? 0) > 0)).map((c) => (
                      <th key={c} className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider capitalize" style={{ color: CATEGORY_COLORS[c] }}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...monthlyData].reverse().map((m) => (
                    <tr key={m.month} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td className="px-5 py-3 text-sm" style={{ color: 'var(--text-primary)' }}>{m.month}</td>
                      <td className="px-4 py-3 text-right font-medium" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--gold-primary)' }}>
                        {m.total > 0 ? formatCurrency(m.total) : '—'}
                      </td>
                      {CATEGORIES.filter((c) => monthlyData.some((mm) => (mm.byCategory[c] ?? 0) > 0)).map((c) => (
                        <td key={c} className="px-4 py-3 text-right text-xs" style={{ fontFamily: 'DM Mono, monospace', color: m.byCategory[c] ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                          {m.byCategory[c] ? formatCurrency(m.byCategory[c]) : '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Profit estimate */}
          <ProfitEstimate />
        </div>
      )}

      <ExpenseFormModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditExpense(null) }}
        expense={editExpense}
        clients={clients}
        deals={deals}
        currentUserId={profile?.id ?? ''}
        preselectedDealId={dealFilter || undefined}
        onSaved={() => { fetchExpenses(); fetchKpis(); fetchMonthlyData(); setShowModal(false); setEditExpense(null) }}
      />
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteExpense(deleteTarget.id)}
        title={`Delete "${deleteTarget?.title}"?`}
        message="This cannot be undone."
      />
    </div>
  )
}

function ProfitEstimate() {
  const [data, setData] = useState<{ invoiced: number; expenses: number } | null>(null)

  useEffect(() => {
    const now = new Date()
    const ys = `${now.getFullYear()}-01-01`
    const ye = `${now.getFullYear()}-12-31`
    Promise.all([
      supabase.from('invoices').select('total').eq('status', 'paid').gte('paid_at', new Date(ys).toISOString()).lte('paid_at', new Date(ye + 'T23:59:59').toISOString()),
      supabase.from('expenses').select('amount').gte('expense_date', ys).lte('expense_date', ye),
    ]).then(([{ data: inv }, { data: exp }]) => {
      setData({
        invoiced: (inv ?? []).reduce((s, r) => s + Number(r.total), 0),
        expenses: (exp ?? []).reduce((s, r) => s + Number(r.amount), 0),
      })
    })
  }, [])

  if (!data) return null
  const profit = data.invoiced - data.expenses
  const margin = data.invoiced > 0 ? Math.round((profit / data.invoiced) * 100) : 0

  return (
    <Card className="p-5" goldAccent>
      <h3 className="text-xs font-medium uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
        Profit Estimate — {new Date().getFullYear()}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        {[
          { label: 'Revenue Collected', value: data.invoiced, color: 'var(--status-green)' },
          { label: 'Total Expenses', value: data.expenses, color: 'var(--status-red)' },
          { label: 'Estimated Profit', value: profit, color: profit >= 0 ? 'var(--gold-primary)' : 'var(--status-red)' },
        ].map(({ label, value, color }) => (
          <div key={label}>
            <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
            <p className="text-xl font-light" style={{ fontFamily: 'DM Mono, monospace', color }}>{formatCurrency(value)}</p>
          </div>
        ))}
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span style={{ color: 'var(--text-muted)' }}>Margin</span>
          <span style={{ color: margin >= 0 ? 'var(--status-green)' : 'var(--status-red)', fontFamily: 'DM Mono, monospace' }}>{margin}%</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
          <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, margin))}%`, background: margin >= 0 ? 'var(--status-green)' : 'var(--status-red)' }} />
        </div>
      </div>
    </Card>
  )
}
