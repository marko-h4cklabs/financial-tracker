import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit, Plus, CheckCircle, ChevronRight, Repeat } from 'lucide-react'
import { format, addMonths, differenceInMonths } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activityLogger'
import { formatCurrency, formatDate, formatRelativeDate } from '@/lib/formatters'
import { useAuth } from '@/store/authStore'
import type { Deal, Client, Profile, Installment, Invoice, Expense, ActivityLog, DealStage } from '@/types'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { DealStageBadge, InstallmentStatusBadge, InvoiceStatusBadge, CategoryBadge } from '@/components/ui/Badge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import DealFormModal from '@/components/modules/DealFormModal'
import InstallmentFormModal from '@/components/modules/InstallmentFormModal'
import toast from 'react-hot-toast'

type Tab = 'overview' | 'installments' | 'invoices' | 'expenses' | 'activity'

const STAGE_STEPS: DealStage[] = ['proposal', 'won']

const STAGE_LABELS: Record<DealStage, string> = {
  proposal: 'Proposal',
  won: 'Won',
  lost: 'Lost',
}

export default function DealDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [deal, setDeal] = useState<Deal | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [installments, setInstallments] = useState<Installment[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [activity, setActivity] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [showEditModal, setShowEditModal] = useState(false)
  const [showInstallmentModal, setShowInstallmentModal] = useState(false)
  const [editInstallment, setEditInstallment] = useState<Installment | null>(null)
  const [markingPaid, setMarkingPaid] = useState<string | null>(null)
  const [generatingInstallments, setGeneratingInstallments] = useState(false)

  const fetchDeal = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const [{ data: d }, { data: inst }, { data: inv }, { data: exp }, { data: act }, { data: c }, { data: p }] = await Promise.all([
      supabase.from('deals').select('*, client:client_id(id, name, company), assigned_profile:assigned_to(id, full_name)').eq('id', id).single(),
      supabase.from('installments').select('*').eq('deal_id', id).order('due_date', { ascending: true }),
      supabase.from('invoices').select('*').eq('deal_id', id).order('created_at', { ascending: false }),
      supabase.from('expenses').select('*').eq('deal_id', id).order('expense_date', { ascending: false }),
      supabase.from('activity_log').select('*, user:user_id(full_name, avatar_initials)').eq('entity_id', id).order('created_at', { ascending: false }).limit(20),
      supabase.from('clients').select('id, name, company').eq('status', 'active'),
      supabase.from('profiles').select('*').eq('is_active', true),
    ])

    if (d) setDeal(d as Deal)
    setInstallments((inst ?? []) as Installment[])
    setInvoices((inv ?? []) as Invoice[])
    setExpenses((exp ?? []) as Expense[])
    setActivity((act ?? []) as ActivityLog[])
    setClients((c ?? []) as Client[])
    setProfiles((p ?? []) as Profile[])
    setLoading(false)
  }, [id])

  useEffect(() => { fetchDeal() }, [fetchDeal])

  async function changeStage(newStage: DealStage) {
    if (!id || !deal) return
    if (!confirm(`Move deal to ${STAGE_LABELS[newStage]}?`)) return
    const { error } = await supabase.from('deals').update({ stage: newStage }).eq('id', id)
    if (error) { toast.error('Failed to update stage'); return }
    await logActivity({ entity_type: 'deal', entity_id: id, action: 'status_change', description: `Stage changed to ${STAGE_LABELS[newStage]}` })
    setDeal((prev) => prev ? { ...prev, stage: newStage } : prev)
    toast.success(`Stage updated to ${STAGE_LABELS[newStage]}`)
  }

  async function generateRetainerInstallments() {
    if (!deal?.retainer_amount || !deal?.retainer_start_date) {
      toast.error('Missing retainer details'); return
    }
    if (!confirm('Generate monthly installments for this retainer? Existing installments will not be affected.')) return
    setGeneratingInstallments(true)

    const startDate = new Date(deal.retainer_start_date)
    const endDate = deal.retainer_end_date ? new Date(deal.retainer_end_date) : addMonths(startDate, 11)
    const billingDay = deal.retainer_billing_day ?? 1

    const toCreate = []
    let current = startDate
    while (current <= endDate) {
      const year = current.getFullYear()
      const month = current.getMonth()
      const lastDay = new Date(year, month + 1, 0).getDate()
      const dueDate = format(new Date(year, month, Math.min(billingDay, lastDay)), 'yyyy-MM-dd')
      toCreate.push({
        deal_id: deal.id,
        client_id: deal.client_id,
        title: `Retainer — ${format(current, 'MMMM yyyy')}`,
        amount: deal.retainer_amount,
        currency: deal.currency,
        due_date: dueDate,
        status: 'pending',
        created_by: profile?.id ?? null,
      })
      current = addMonths(current, 1)
    }

    const { error } = await supabase.from('installments').insert(toCreate)
    setGeneratingInstallments(false)
    if (error) { toast.error('Failed to generate installments'); return }
    await logActivity({ entity_type: 'deal', entity_id: deal.id, action: 'create', description: `Generated ${toCreate.length} retainer installments` })
    toast.success(`Generated ${toCreate.length} installments`)
    fetchDeal()
  }

  async function markInstallmentPaid(instId: string) {
    setMarkingPaid(instId)
    const paidAt = new Date().toISOString()
    const { error } = await supabase.from('installments').update({ status: 'paid', paid_at: paidAt }).eq('id', instId)
    setMarkingPaid(null)
    if (error) { toast.error('Failed to mark as paid'); return }
    await logActivity({ entity_type: 'installment', entity_id: instId, action: 'payment', description: 'Installment marked as paid' })
    toast.success('Marked as paid')
    fetchDeal()
  }

  if (loading) return <div className="flex items-center justify-center py-24"><LoadingSpinner size="lg" /></div>

  if (!deal) {
    return <Card className="p-8 text-center"><p style={{ color: 'var(--text-muted)' }}>Deal not found.</p></Card>
  }

  const client = deal.client as { id?: string; name?: string; company?: string } | undefined
  const assignedProfile = deal.assigned_profile as { full_name?: string } | undefined

  const totalValue = Number(deal.value)
  const totalInvoiced = invoices.reduce((s, i) => s + Number(i.total), 0)
  const totalPaid = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + Number(i.total), 0)
  const balance = totalValue - totalPaid

  const paidInstallments = installments.filter((i) => i.status === 'paid').reduce((s, i) => s + Number(i.amount), 0)
  const totalInstallments = installments.reduce((s, i) => s + Number(i.amount), 0)

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'installments', label: `Installments (${installments.length})` },
    { key: 'invoices', label: `Invoices (${invoices.length})` },
    { key: 'expenses', label: `Expenses (${expenses.length})` },
    { key: 'activity', label: 'Activity' },
  ]

  const currentStepIdx = STAGE_STEPS.indexOf(deal.stage)

  return (
    <div className="space-y-5">
      <button onClick={() => navigate('/deals')} className="flex items-center gap-2 text-sm"
        style={{ color: 'var(--text-muted)' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}>
        <ArrowLeft size={14} /> Back to Deals
      </button>

      {/* Header card */}
      <Card className="p-4 md:p-5">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            {client?.name && (
              <button onClick={() => navigate(`/clients/${client.id}`)} className="text-xs mb-1 transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--gold-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}>
                {client.name}{client.company ? ` — ${client.company}` : ''}
              </button>
            )}
            <h1 className="text-xl md:text-2xl font-light mb-2"
              style={{ fontFamily: 'Cormorant Garamond, serif', color: 'var(--text-primary)' }}>
              {deal.title}
            </h1>
            <div className="flex items-center gap-3">
              <DealStageBadge stage={deal.stage} />
              <span className="text-lg md:text-xl font-light" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--gold-primary)' }}>
                {formatCurrency(deal.value, deal.currency)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto flex-shrink-0">
            <Button variant="secondary" size="sm" onClick={() => setShowEditModal(true)}><Edit size={13} /> Edit</Button>
            <Button size="sm" onClick={() => { setEditInstallment(null); setShowInstallmentModal(true) }}><Plus size={13} /> Installment</Button>
            <Button size="sm" variant="secondary" onClick={() => navigate(`/invoices/new?deal=${id}`)}><Plus size={13} /> Invoice</Button>
          </div>
        </div>

        {/* Stage progress tracker */}
        <div className="mt-4 md:mt-5">
          {deal.stage === 'lost' ? (
            <div className="flex items-center gap-3">
              <span className="text-xs px-2.5 py-1 rounded-full font-medium uppercase tracking-wider"
                style={{ background: 'rgba(224,82,82,0.12)', color: 'var(--status-red)', border: '1px solid rgba(224,82,82,0.25)' }}>
                Deal Lost
              </span>
              <button onClick={() => changeStage('proposal')} className="text-xs"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--gold-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}>
                Reopen as Proposal →
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <div className="flex items-center gap-0 min-w-max md:min-w-0">
              {STAGE_STEPS.map((step, idx) => {
                const isDone = currentStepIdx >= idx
                const isCurrent = idx === currentStepIdx
                const isLast = idx === STAGE_STEPS.length - 1
                return (
                  <div key={step} className="flex items-center flex-1">
                    <button onClick={() => changeStage(step)}
                      className="flex flex-col items-center gap-1.5 group"
                      style={{ minWidth: '60px' }}>
                      <div className="w-6 h-6 rounded-full flex items-center justify-center transition-all"
                        style={{
                          background: isDone ? 'var(--gold-primary)' : 'var(--bg-elevated)',
                          border: `2px solid ${isCurrent ? 'var(--gold-primary)' : isDone ? 'var(--gold-primary)' : 'var(--border-default)'}`,
                        }}>
                        {isDone && <CheckCircle size={12} style={{ color: '#0A0A0A' }} />}
                      </div>
                      <span className="text-[10px] uppercase tracking-wider"
                        style={{ color: isCurrent ? 'var(--gold-primary)' : isDone ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                        {STAGE_LABELS[step]}
                      </span>
                    </button>
                    {!isLast && (
                      <div className="flex-1 h-0.5 mx-1"
                        style={{ background: currentStepIdx > idx ? 'var(--gold-primary)' : 'var(--border-subtle)' }} />
                    )}
                  </div>
                )
              })}
              {/* Quick-lose button */}
              <button onClick={() => changeStage('lost')}
                className="ml-4 text-xs px-2.5 py-1 rounded flex-shrink-0"
                style={{ color: 'var(--status-red)', border: '1px solid rgba(224,82,82,0.3)', background: 'rgba(224,82,82,0.06)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(224,82,82,0.12)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(224,82,82,0.06)' }}>
                Mark Lost
              </button>
            </div>
            </div>
          )}
        </div>
      </Card>

      {/* Tabs */}
      <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="flex gap-1 min-w-max md:min-w-0">
        {tabs.map(({ key, label }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className="px-3 md:px-4 py-2.5 text-xs md:text-sm relative transition-colors whitespace-nowrap"
            style={{ color: activeTab === key ? 'var(--gold-primary)' : 'var(--text-muted)' }}>
            {label}
            {activeTab === key && <span className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: 'var(--gold-primary)' }} />}
          </button>
        ))}
        </div>
      </div>

      {/* Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="col-span-1 lg:col-span-2 space-y-4">
            {/* Retainer Info Card */}
            {deal.deal_type === 'retainer' && deal.retainer_amount != null && (
              <Card className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Repeat size={14} style={{ color: 'var(--gold-primary)' }} />
                    <h3 className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Retainer Info</h3>
                  </div>
                  <Button size="sm" variant="secondary" loading={generatingInstallments} onClick={generateRetainerInstallments}>
                    Generate Installments
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-y-3 text-sm">
                  {[
                    ['Monthly Amount', formatCurrency(deal.retainer_amount, deal.currency)],
                    ['Billing Day', deal.retainer_billing_day ? `Day ${deal.retainer_billing_day} of each month` : '—'],
                    ['Start Date', formatDate(deal.retainer_start_date)],
                    ['End Date', deal.retainer_end_date ? formatDate(deal.retainer_end_date) : 'Ongoing'],
                    ['Contract Value', formatCurrency(deal.value, deal.currency)],
                    ['Months Remaining', deal.retainer_end_date
                      ? `${Math.max(0, differenceInMonths(new Date(deal.retainer_end_date), new Date()))} months`
                      : 'Ongoing'],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
                      <p style={{
                        color: label === 'Monthly Amount' || label === 'Contract Value' ? 'var(--gold-primary)' : 'var(--text-primary)',
                        fontFamily: label === 'Monthly Amount' || label === 'Contract Value' ? 'DM Mono, monospace' : undefined,
                      }}>{value}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <Card className="p-5">
              <h3 className="text-xs font-medium uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>Deal Details</h3>
              <div className="grid grid-cols-2 gap-y-3 text-sm">
                {[
                  ['Start Date', formatDate(deal.start_date)],
                  ['End Date', formatDate(deal.end_date)],
                  ['Probability', `${deal.probability}%`],
                  ['Assigned To', assignedProfile?.full_name ?? '—'],
                  ['Currency', deal.currency],
                  ['Created', formatDate(deal.created_at)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
                    <p style={{ color: 'var(--text-primary)' }}>{value}</p>
                  </div>
                ))}
              </div>
              {deal.description && (
                <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Description</p>
                  <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{deal.description}</p>
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-3">
            <Card className="p-4" goldAccent>
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Total Value</p>
              <p className="text-xl font-light" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--gold-primary)' }}>
                {formatCurrency(totalValue, deal.currency)}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Invoiced</p>
              <p className="text-xl font-light" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-primary)' }}>
                {formatCurrency(totalInvoiced, deal.currency)}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Collected</p>
              <p className="text-xl font-light" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--status-green)' }}>
                {formatCurrency(totalPaid, deal.currency)}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Balance</p>
              <p className="text-xl font-light" style={{ fontFamily: 'DM Mono, monospace', color: balance > 0 ? 'var(--status-yellow)' : 'var(--text-muted)' }}>
                {formatCurrency(balance, deal.currency)}
              </p>
            </Card>
          </div>
        </div>
      )}

      {/* Installments */}
      {activeTab === 'installments' && (
        <Card>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Payment Schedule</h3>
            <Button size="sm" onClick={() => { setEditInstallment(null); setShowInstallmentModal(true) }}>
              <Plus size={13} /> Add Installment
            </Button>
          </div>

          {installments.length === 0 ? (
            <p className="px-5 py-8 text-sm text-center" style={{ color: 'var(--text-muted)' }}>No installments added yet</p>
          ) : (
            <>
              <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {installments.map((inst) => {
                  const statusColor = inst.status === 'paid' ? 'var(--status-green)' : inst.status === 'overdue' ? 'var(--status-red)' : 'var(--status-yellow)'
                  return (
                    <div key={inst.id} className="flex items-center justify-between px-5 py-3 gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: statusColor }} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{inst.title}</p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            Due {formatDate(inst.due_date)}
                            {inst.paid_at && ` · Paid ${format(new Date(inst.paid_at), 'dd/MM/yyyy')}`}
                            {inst.payment_method && ` via ${inst.payment_method.replace('_', ' ')}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <InstallmentStatusBadge status={inst.status} />
                        <span style={{ fontFamily: 'DM Mono, monospace', color: 'var(--gold-primary)', fontSize: '13px' }}>
                          {formatCurrency(inst.amount, inst.currency)}
                        </span>
                        {inst.status === 'pending' && (
                          <Button size="sm" variant="secondary" loading={markingPaid === inst.id}
                            onClick={() => markInstallmentPaid(inst.id)}>
                            <CheckCircle size={12} /> Paid
                          </Button>
                        )}
                        <button onClick={() => { setEditInstallment(inst); setShowInstallmentModal(true) }}
                          className="text-xs px-2 py-1 rounded" style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}>
                          Edit
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
              {/* Total row */}
              <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: '1px solid var(--border-default)', background: 'var(--bg-elevated)' }}>
                <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Paid {formatCurrency(paidInstallments)} of {formatCurrency(totalInstallments)}
                </span>
                <span className="text-sm font-medium" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-primary)' }}>
                  Remaining: {formatCurrency(totalInstallments - paidInstallments)}
                </span>
              </div>
            </>
          )}
        </Card>
      )}

      {/* Invoices */}
      {activeTab === 'invoices' && (
        <Card>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Invoices</h3>
            <Button size="sm" onClick={() => navigate(`/invoices/new?deal=${id}`)}>
              <Plus size={13} /> Create Invoice
            </Button>
          </div>
          {invoices.length === 0 ? (
            <p className="px-5 py-8 text-sm text-center" style={{ color: 'var(--text-muted)' }}>No invoices yet</p>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
              {invoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between px-5 py-3 cursor-pointer"
                  onClick={() => navigate(`/invoices/${inv.id}`)}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <div>
                    <p className="text-sm font-medium" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--gold-primary)' }}>{inv.invoice_number}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{inv.title} · Due {formatDate(inv.due_date)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <InvoiceStatusBadge status={inv.status} />
                    <span style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-primary)', fontSize: '13px' }}>
                      {formatCurrency(inv.total, inv.currency)}
                    </span>
                    <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Expenses */}
      {activeTab === 'expenses' && (
        <Card>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Expenses</h3>
            <Button size="sm" onClick={() => navigate(`/expenses?deal=${id}`)}>
              <Plus size={13} /> Add Expense
            </Button>
          </div>
          {expenses.length === 0 ? (
            <p className="px-5 py-8 text-sm text-center" style={{ color: 'var(--text-muted)' }}>No expenses linked to this deal</p>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
              {expenses.map((exp) => (
                <div key={exp.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{exp.title}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatDate(exp.expense_date)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <CategoryBadge category={exp.category} />
                    <span style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-primary)', fontSize: '13px' }}>
                      {formatCurrency(exp.amount, exp.currency)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Activity */}
      {activeTab === 'activity' && (
        <Card>
          <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Activity History</h3>
          </div>
          {activity.length === 0 ? (
            <p className="px-5 py-8 text-sm text-center" style={{ color: 'var(--text-muted)' }}>No activity logged yet</p>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
              {activity.map((item) => {
                const user = item.user as { full_name?: string; avatar_initials?: string } | undefined
                const initials = user?.avatar_initials ?? user?.full_name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() ?? '?'
                const actionColor: Record<string, string> = {
                  create: 'var(--status-green)', update: 'var(--status-blue)',
                  delete: 'var(--status-red)', payment: 'var(--gold-primary)', status_change: 'var(--status-purple)',
                }
                return (
                  <div key={item.id} className="flex gap-3 px-5 py-3">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0"
                      style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}>
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider"
                          style={{ background: 'var(--bg-elevated)', color: actionColor[item.action] ?? 'var(--text-muted)' }}>
                          {item.action}
                        </span>
                        <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{item.description ?? item.action}</p>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {user?.full_name ?? 'Unknown'} · {formatRelativeDate(item.created_at)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      )}

      <DealFormModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        deal={deal}
        clients={clients}
        profiles={profiles}
        currentUserId={profile?.id ?? ''}
        onSaved={() => { fetchDeal(); setShowEditModal(false) }}
      />

      <InstallmentFormModal
        isOpen={showInstallmentModal}
        onClose={() => { setShowInstallmentModal(false); setEditInstallment(null) }}
        installment={editInstallment}
        dealId={id ?? ''}
        clientId={deal.client_id}
        currentUserId={profile?.id ?? ''}
        onSaved={() => { fetchDeal(); setShowInstallmentModal(false); setEditInstallment(null) }}
      />
    </div>
  )
}
