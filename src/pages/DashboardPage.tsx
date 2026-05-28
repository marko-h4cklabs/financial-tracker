import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, Clock, Briefcase, Receipt, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatRelativeDate, formatDaysUntil, formatDuration } from '@/lib/formatters'
import StatCard from '@/components/ui/StatCard'
import Card from '@/components/ui/Card'
import { SkeletonCard } from '@/components/ui/Skeleton'
import Button from '@/components/ui/Button'
import toast from 'react-hot-toast'
import type { ActivityLog, Installment, DealStage } from '@/types'
import { differenceInDays, startOfMonth, endOfMonth, startOfWeek, format } from 'date-fns'

type Period = 'month' | 'overall'

interface KPIs {
  revenue: number
  revenueLastMonth: number
  pendingPayments: number
  pendingCount: number
  activeDealsCount: number
  pipelineValue: number
  expenses: number
}

interface PipelineColumn {
  stage: DealStage
  count: number
  total: number
}

const PIPELINE_STAGES: DealStage[] = ['proposal', 'won', 'lost']

const stageColors: Record<DealStage, string> = {
  proposal: 'var(--status-blue)',
  won: 'var(--status-green)',
  lost: 'var(--status-red)',
}

const stageLabels: Record<DealStage, string> = {
  proposal: 'Proposal',
  won: 'Won',
  lost: 'Lost',
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const [period, setPeriod] = useState<Period>(() =>
    (localStorage.getItem('dashboard_period') as Period) ?? 'month'
  )
  const [kpis, setKpis] = useState<KPIs | null>(null)
  const [pipeline, setPipeline] = useState<PipelineColumn[]>([])
  const [activity, setActivity] = useState<ActivityLog[]>([])
  const [upcomingInstallments, setUpcomingInstallments] = useState<Installment[]>([])
  const [loading, setLoading] = useState(true)

  const mountedRef = useRef(false)
  const [teamActivity, setTeamActivity] = useState<{ memberId: string; name: string; initials: string; count: number; totalMinutes: number }[]>([])
  const [recentDone, setRecentDone] = useState<{ id: string; title: string; clientName: string; doneByName: string }[]>([])

  useEffect(() => {
    fetchAll()
    fetchTeamActivity()
  }, [])

  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return }
    fetchKPIs(period)
  }, [period])

  function handlePeriodChange(p: Period) {
    setPeriod(p)
    localStorage.setItem('dashboard_period', p)
  }

  async function fetchAll() {
    setLoading(true)
    try {
      await Promise.all([fetchKPIs(period), fetchPipeline(), fetchActivity(), fetchInstallments()])
    } finally {
      setLoading(false)
    }
  }

  async function fetchKPIs(p: Period) {
    const now = new Date()
    const monthStart = startOfMonth(now).toISOString()
    const monthEnd = endOfMonth(now).toISOString()
    const lastMonthStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1)).toISOString()
    const lastMonthEnd = endOfMonth(new Date(now.getFullYear(), now.getMonth() - 1)).toISOString()

    // Get invoice IDs that have linked installments (exclude from invoice revenue to avoid double-counting)
    const { data: linkedInvRows } = await supabase
      .from('installments')
      .select('invoice_id')
      .not('invoice_id', 'is', null)
    const excludedInvIds = new Set(
      (linkedInvRows ?? []).map((r) => r.invoice_id as string).filter(Boolean)
    )

    // Paid installments
    let instQ = supabase.from('installments').select('amount').eq('status', 'paid')
    if (p === 'month') instQ = instQ.gte('paid_at', monthStart).lte('paid_at', monthEnd)

    // Paid invoices without linked installments
    let invQ = supabase.from('invoices').select('id, total').eq('status', 'paid')
    if (p === 'month') invQ = invQ.gte('paid_at', monthStart).lte('paid_at', monthEnd)

    // Last month (for delta — only relevant in month mode)
    const lastInstQ = supabase.from('installments').select('amount').eq('status', 'paid')
      .gte('paid_at', lastMonthStart).lte('paid_at', lastMonthEnd)
    const lastInvQ = supabase.from('invoices').select('id, total').eq('status', 'paid')
      .gte('paid_at', lastMonthStart).lte('paid_at', lastMonthEnd)

    // Expenses
    let expQ = supabase.from('expenses').select('amount')
    if (p === 'month') {
      expQ = expQ
        .gte('expense_date', monthStart.slice(0, 10))
        .lte('expense_date', monthEnd.slice(0, 10))
    }

    const [paidInst, paidInv, lastPaidInst, lastPaidInv, installments, deals, expenses] = await Promise.all([
      instQ,
      invQ,
      lastInstQ,
      lastInvQ,
      supabase.from('installments').select('amount').in('status', ['pending', 'overdue']),
      supabase.from('deals').select('value, stage').eq('stage', 'proposal'),
      expQ,
    ])

    const instRevenue = (paidInst.data ?? []).reduce((s, r) => s + Number(r.amount), 0)
    const invRevenue = (paidInv.data ?? [])
      .filter((inv: { id: string; total: number }) => !excludedInvIds.has(inv.id))
      .reduce((s, r) => s + Number(r.total), 0)
    const revenue = instRevenue + invRevenue

    const lastInstRevenue = (lastPaidInst.data ?? []).reduce((s, r) => s + Number(r.amount), 0)
    const lastInvRevenue = (lastPaidInv.data ?? [])
      .filter((inv: { id: string; total: number }) => !excludedInvIds.has(inv.id))
      .reduce((s, r) => s + Number(r.total), 0)
    const revenueLastMonth = lastInstRevenue + lastInvRevenue

    const pending = (installments.data ?? []).reduce((s, r) => s + Number(r.amount), 0)
    const pipelineVal = (deals.data ?? []).reduce((s, r) => s + Number(r.value), 0)
    const expenses_ = (expenses.data ?? []).reduce((s, r) => s + Number(r.amount), 0)

    setKpis({
      revenue,
      revenueLastMonth,
      pendingPayments: pending,
      pendingCount: installments.data?.length ?? 0,
      activeDealsCount: deals.data?.length ?? 0,
      pipelineValue: pipelineVal,
      expenses: expenses_,
    })
  }

  async function fetchPipeline() {
    const { data } = await supabase.from('deals').select('stage, value')
    if (!data) return
    setPipeline(
      PIPELINE_STAGES.map((stage) => {
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

  async function fetchTeamActivity() {
    const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)

    const [{ data: logsData }, { data: doneData }] = await Promise.all([
      supabase.from('work_logs')
        .select('logged_by, duration_minutes, profile:logged_by(id, full_name, avatar_initials)')
        .gte('worked_on', weekStart),
      supabase.from('checklist_items')
        .select('id, title, done_at, client:client_id(name), doneByProfile:done_by(full_name)')
        .eq('is_done', true)
        .gte('done_at', todayStart.toISOString())
        .order('done_at', { ascending: false })
        .limit(5),
    ])

    // Build team activity
    const memberMap = new Map<string, { name: string; initials: string; count: number; totalMinutes: number }>()
    ;(logsData ?? []).forEach((row) => {
      if (!row.logged_by) return
      const prof = row.profile as { id?: string; full_name?: string; avatar_initials?: string } | null
      const name = prof?.full_name ?? 'Unknown'
      const initials = prof?.avatar_initials ?? name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
      const entry = memberMap.get(row.logged_by) ?? { name, initials, count: 0, totalMinutes: 0 }
      entry.count += 1
      entry.totalMinutes += row.duration_minutes ?? 0
      memberMap.set(row.logged_by, entry)
    })
    setTeamActivity(
      Array.from(memberMap.entries())
        .map(([memberId, data]) => ({ memberId, ...data }))
        .sort((a, b) => b.count - a.count)
    )

    // Build recently done tasks
    setRecentDone(
      (doneData ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        clientName: (row.client as { name?: string } | null)?.name ?? '—',
        doneByName: (row.doneByProfile as { full_name?: string } | null)?.full_name ?? '—',
      }))
    )
  }

  async function markInstallmentPaid(id: string) {
    const { error } = await supabase
      .from('installments')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', id)
    if (error) { toast.error('Failed to update'); return }
    toast.success('Marked as paid')
    setUpcomingInstallments((prev) => prev.filter((i) => i.id !== id))
    fetchKPIs(period)
  }

  const revenueDelta = kpis && kpis.revenueLastMonth > 0 && period === 'month'
    ? Math.abs(Math.round(((kpis.revenue - kpis.revenueLastMonth) / kpis.revenueLastMonth) * 100)) + '% vs last month'
    : undefined
  const revenueUp = kpis ? kpis.revenue >= kpis.revenueLastMonth : true

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Period Toggle */}
      <div className="flex items-center justify-end">
        <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
          {(['month', 'overall'] as Period[]).map((p) => (
            <button key={p} onClick={() => handlePeriodChange(p)}
              className="px-3 py-1.5 rounded text-xs font-medium transition-all"
              style={period === p
                ? { background: 'var(--gold-primary)', color: '#0A0A0A' }
                : { color: 'var(--text-muted)' }}>
              {p === 'month' ? 'This Month' : 'Overall'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard
              label={period === 'month' ? 'Revenue This Month' : 'Total Revenue'}
              value={formatCurrency(kpis?.revenue ?? 0)}
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
              label={period === 'month' ? 'Monthly Expenses' : 'Total Expenses'}
              value={formatCurrency(kpis?.expenses ?? 0)}
              icon={Receipt}
            />
          </>
        )}
      </div>

      {/* Pipeline + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pipeline */}
        <div className="col-span-1 lg:col-span-2">
          <Card goldAccent>
            <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Deal Pipeline</h3>
            </div>
            <div className="p-4 md:p-5">
              <div className="overflow-x-auto">
              <div className="grid grid-cols-3 gap-3 min-w-[280px]">
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

      {/* Upcoming Installments */}
      <Card>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Upcoming Payments</h3>
          <button onClick={() => navigate('/installments')} className="text-xs" style={{ color: 'var(--gold-primary)' }}>
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
      {/* Team Activity This Week */}
      {(teamActivity.length > 0 || recentDone.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Work logs by member */}
          <Card>
            <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Team Activity This Week</h3>
            </div>
            {teamActivity.length === 0 ? (
              <p className="px-5 py-6 text-xs text-center" style={{ color: 'var(--text-muted)' }}>No work logged this week</p>
            ) : (
              <div className="p-4 space-y-3">
                {(() => {
                  const maxCount = Math.max(...teamActivity.map((m) => m.count), 1)
                  return teamActivity.map((member) => (
                    <div key={member.memberId} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-semibold flex-shrink-0"
                        style={{ background: 'var(--gold-muted)', color: 'var(--gold-primary)', fontFamily: 'DM Mono, monospace' }}>
                        {member.initials}
                      </div>
                      <span className="text-xs w-28 truncate" style={{ color: 'var(--text-secondary)' }}>{member.name}</span>
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                        <div className="h-full rounded-full" style={{ width: `${(member.count / maxCount) * 100}%`, background: 'var(--gold-primary)' }} />
                      </div>
                      <span className="text-[10px] w-16 text-right flex-shrink-0" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-muted)' }}>
                        {member.count} log{member.count !== 1 ? 's' : ''}
                        {member.totalMinutes > 0 ? ` · ${formatDuration(member.totalMinutes)}` : ''}
                      </span>
                    </div>
                  ))
                })()}
              </div>
            )}
          </Card>

          {/* Recently completed tasks */}
          <Card>
            <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Completed Today</h3>
            </div>
            {recentDone.length === 0 ? (
              <p className="px-5 py-6 text-xs text-center" style={{ color: 'var(--text-muted)' }}>No tasks completed today yet</p>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {recentDone.map((task) => (
                  <div key={task.id} className="flex items-start gap-3 px-5 py-3">
                    <div className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ borderColor: 'var(--gold-primary)', background: 'var(--gold-primary)' }}>
                      <CheckCircle size={10} style={{ color: '#0A0A0A' }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{task.title}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {task.clientName} · by {task.doneByName}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
