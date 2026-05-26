import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, Clock, Briefcase, Receipt, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatRelativeDate, formatDaysUntil } from '@/lib/formatters'
import StatCard from '@/components/ui/StatCard'
import Card from '@/components/ui/Card'
// Badge used dynamically via stageColors map
import { SkeletonCard } from '@/components/ui/Skeleton'
import Button from '@/components/ui/Button'
import toast from 'react-hot-toast'
import type { ActivityLog, Installment, Invoice, DealStage } from '@/types'
import { differenceInDays, startOfMonth, endOfMonth } from 'date-fns'

interface KPIs {
  revenueThisMonth: number
  revenueLastMonth: number
  pendingPayments: number
  pendingCount: number
  activeDealsCount: number
  pipelineValue: number
  expensesThisMonth: number
}

interface PipelineColumn {
  stage: DealStage
  count: number
  total: number
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const [kpis, setKpis] = useState<KPIs | null>(null)
  const [pipeline, setPipeline] = useState<PipelineColumn[]>([])
  const [activity, setActivity] = useState<ActivityLog[]>([])
  const [upcomingInstallments, setUpcomingInstallments] = useState<Installment[]>([])
  const [overdueInvoices, setOverdueInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    try {
      await Promise.all([fetchKPIs(), fetchPipeline(), fetchActivity(), fetchInstallments(), fetchOverdueInvoices()])
    } finally {
      setLoading(false)
    }
  }

  async function fetchKPIs() {
    const now = new Date()
    const monthStart = startOfMonth(now).toISOString()
    const monthEnd = endOfMonth(now).toISOString()
    const lastMonthStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1)).toISOString()
    const lastMonthEnd = endOfMonth(new Date(now.getFullYear(), now.getMonth() - 1)).toISOString()

    const [paid, lastPaid, installments, deals, expenses] = await Promise.all([
      supabase.from('invoices').select('total').eq('status', 'paid').gte('paid_at', monthStart).lte('paid_at', monthEnd),
      supabase.from('invoices').select('total').eq('status', 'paid').gte('paid_at', lastMonthStart).lte('paid_at', lastMonthEnd),
      supabase.from('installments').select('amount').in('status', ['pending', 'overdue']),
      supabase.from('deals').select('value, stage').in('stage', ['lead', 'proposal', 'negotiation']),
      supabase.from('expenses').select('amount').gte('expense_date', monthStart.slice(0, 10)).lte('expense_date', monthEnd.slice(0, 10)),
    ])

    const revenue = (paid.data ?? []).reduce((s, r) => s + Number(r.total), 0)
    const lastRevenue = (lastPaid.data ?? []).reduce((s, r) => s + Number(r.total), 0)
    const pending = (installments.data ?? []).reduce((s, r) => s + Number(r.amount), 0)
    const pipelineVal = (deals.data ?? []).reduce((s, r) => s + Number(r.value), 0)
    const expenses_ = (expenses.data ?? []).reduce((s, r) => s + Number(r.amount), 0)

    setKpis({
      revenueThisMonth: revenue,
      revenueLastMonth: lastRevenue,
      pendingPayments: pending,
      pendingCount: installments.data?.length ?? 0,
      activeDealsCount: deals.data?.length ?? 0,
      pipelineValue: pipelineVal,
      expensesThisMonth: expenses_,
    })
  }

  async function fetchPipeline() {
    const { data } = await supabase.from('deals').select('stage, value')
    if (!data) return

    const stages: DealStage[] = ['lead', 'proposal', 'negotiation', 'won', 'lost', 'paused']
    setPipeline(
      stages.map((stage) => {
        const rows = data.filter((d) => d.stage === stage)
        return { stage, count: rows.length, total: rows.reduce((s, r) => s + Number(r.value), 0) }
      })
    )
  }

  async function fetchActivity() {
    const { data } = await supabase
      .from('activity_log')
      .select('*, user:user_id(id, full_name, avatar_initials)')
      .order('created_at', { ascending: false })
      .limit(10)
    setActivity((data ?? []) as ActivityLog[])
  }

  async function fetchInstallments() {
    const { data } = await supabase
      .from('installments')
      .select('*, client:client_id(id, name), deal:deal_id(id, title)')
      .eq('status', 'pending')
      .order('due_date', { ascending: true })
      .limit(5)
    setUpcomingInstallments((data ?? []) as Installment[])
  }

  async function fetchOverdueInvoices() {
    const { data } = await supabase
      .from('invoices')
      .select('*, client:client_id(id, name)')
      .in('status', ['overdue', 'sent'])
      .lt('due_date', new Date().toISOString().slice(0, 10))
      .order('due_date', { ascending: true })
    setOverdueInvoices((data ?? []) as Invoice[])
  }

  async function markInstallmentPaid(id: string) {
    const { error } = await supabase
      .from('installments')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', id)
    if (error) { toast.error('Failed to update'); return }
    toast.success('Marked as paid')
    setUpcomingInstallments((prev) => prev.filter((i) => i.id !== id))
  }

  const stageColors: Record<DealStage, string> = {
    lead: 'var(--status-blue)',
    proposal: 'var(--status-purple)',
    negotiation: 'var(--status-yellow)',
    won: 'var(--status-green)',
    lost: 'var(--status-red)',
    paused: 'var(--text-muted)',
  }

  const stageLabels: Record<DealStage, string> = {
    lead: 'Lead', proposal: 'Proposal', negotiation: 'Negotiation',
    won: 'Won', lost: 'Lost', paused: 'Paused',
  }

  const revenueDelta = kpis && kpis.revenueLastMonth > 0
    ? Math.abs(Math.round(((kpis.revenueThisMonth - kpis.revenueLastMonth) / kpis.revenueLastMonth) * 100)) + '% vs last month'
    : undefined

  const revenueUp = kpis ? kpis.revenueThisMonth >= kpis.revenueLastMonth : true

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard
              label="Revenue This Month"
              value={formatCurrency(kpis?.revenueThisMonth ?? 0)}
              delta={revenueDelta}
              deltaPositive={revenueUp}
              icon={TrendingUp}
              goldAccent
            />
            <StatCard
              label="Pending Payments"
              value={formatCurrency(kpis?.pendingPayments ?? 0)}
              subtitle={`${kpis?.pendingCount ?? 0} installments`}
              icon={Clock}
            />
            <StatCard
              label="Active Deals"
              value={kpis?.activeDealsCount ?? 0}
              subtitle={`Pipeline: ${formatCurrency(kpis?.pipelineValue ?? 0)}`}
              icon={Briefcase}
            />
            <StatCard
              label="Monthly Expenses"
              value={formatCurrency(kpis?.expensesThisMonth ?? 0)}
              icon={Receipt}
            />
          </>
        )}
      </div>

      {/* Pipeline + Activity */}
      <div className="grid grid-cols-3 gap-4">
        {/* Pipeline */}
        <div className="col-span-2">
          <Card goldAccent>
            <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Deal Pipeline</h3>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-6 gap-2">
                {pipeline.map((col) => (
                  <button
                    key={col.stage}
                    onClick={() => navigate(`/deals?stage=${col.stage}`)}
                    className="flex flex-col items-center p-3 rounded transition-all text-center"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = stageColors[col.stage])}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
                  >
                    <span
                      className="text-xl font-light mb-1"
                      style={{ fontFamily: 'DM Mono, monospace', color: stageColors[col.stage] }}
                    >
                      {col.count}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                      {stageLabels[col.stage]}
                    </span>
                    <span className="text-[10px]" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-secondary)' }}>
                      {formatCurrency(col.total)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Activity Feed */}
        <Card>
          <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Recent Activity</h3>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {activity.length === 0 ? (
              <p className="px-5 py-6 text-xs text-center" style={{ color: 'var(--text-muted)' }}>No activity yet</p>
            ) : (
              activity.map((item) => {
                const user = item.user as { full_name?: string; avatar_initials?: string } | undefined
                const initials = user?.avatar_initials ?? user?.full_name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() ?? '?'
                return (
                  <div key={item.id} className="flex gap-3 px-4 py-3 relative" style={{ borderLeft: '2px solid var(--gold-primary)' }}>
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-semibold flex-shrink-0 mt-0.5"
                      style={{ background: 'var(--gold-muted)', color: 'var(--gold-primary)', fontFamily: 'DM Mono, monospace' }}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs leading-snug truncate" style={{ color: 'var(--text-primary)' }}>
                        {item.description ?? item.action}
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {formatRelativeDate(item.created_at)}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </Card>
      </div>

      {/* Installments + Overdue Invoices */}
      <div className="grid grid-cols-2 gap-4">
        {/* Upcoming Installments */}
        <Card>
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Upcoming Payments</h3>
            <button
              onClick={() => navigate('/installments')}
              className="text-xs"
              style={{ color: 'var(--gold-primary)' }}
            >
              View all →
            </button>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {upcomingInstallments.length === 0 ? (
              <p className="px-5 py-6 text-xs text-center" style={{ color: 'var(--text-muted)' }}>No upcoming payments</p>
            ) : (
              upcomingInstallments.map((inst) => {
                const days = differenceInDays(new Date(inst.due_date), new Date())
                const isOverdue = days < 0
                const client = inst.client as { name?: string } | undefined
                return (
                  <div key={inst.id} className="flex items-center justify-between px-5 py-3 gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{inst.title}</p>
                      <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{client?.name ?? '—'}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-medium" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--gold-primary)' }}>
                          {formatCurrency(inst.amount, inst.currency)}
                        </p>
                        <p className="text-[10px]" style={{ color: isOverdue ? 'var(--status-red)' : days < 7 ? 'var(--status-yellow)' : 'var(--text-muted)' }}>
                          {formatDaysUntil(inst.due_date)}
                        </p>
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => markInstallmentPaid(inst.id)}>
                        <CheckCircle size={12} />
                        Paid
                      </Button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </Card>

        {/* Overdue Invoices */}
        <Card>
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Overdue Invoices</h3>
            <button
              onClick={() => navigate('/invoices?status=overdue')}
              className="text-xs"
              style={{ color: 'var(--gold-primary)' }}
            >
              View all →
            </button>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {overdueInvoices.length === 0 ? (
              <p className="px-5 py-6 text-xs text-center" style={{ color: 'var(--text-muted)' }}>No overdue invoices</p>
            ) : (
              overdueInvoices.map((inv) => {
                const days = inv.due_date ? differenceInDays(new Date(), new Date(inv.due_date)) : 0
                const client = inv.client as { name?: string } | undefined
                return (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between px-5 py-3 gap-3 cursor-pointer"
                    onClick={() => navigate(`/invoices/${inv.id}`)}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--gold-primary)' }}>
                        {inv.invoice_number}
                      </p>
                      <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{client?.name ?? '—'}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-medium" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-primary)' }}>
                        {formatCurrency(inv.total, inv.currency)}
                      </p>
                      <p className="text-[10px]" style={{ color: 'var(--status-red)' }}>
                        {days}d overdue
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
