import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Edit, Plus, Mail, Phone, MapPin, FileText, Briefcase, ChevronRight, Check } from 'lucide-react'
import { isBefore, isToday, parseISO } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/authStore'
import { formatCurrency, formatDate, formatDuration } from '@/lib/formatters'
import type { Client, Deal, Installment, Expense, Profile, WorkLog, ChecklistItem } from '@/types'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { ClientStatusBadge, DealStageBadge, InstallmentStatusBadge, CategoryBadge, WorkCategoryBadge, PRIORITY_COLORS } from '@/components/ui/Badge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ClientFormModal from '@/components/modules/ClientFormModal'
import LogWorkModal from '@/components/modules/LogWorkModal'
import ChecklistItemModal from '@/components/modules/ChecklistItemModal'

type Tab = 'overview' | 'deals' | 'installments' | 'expenses' | 'work_logs' | 'tasks'

type EnrichedWorkLog = WorkLog & {
  profile?: { id: string; full_name: string; avatar_initials?: string | null } | null
}

type EnrichedChecklistItem = ChecklistItem & {
  assignee?: { id: string; full_name: string; avatar_initials?: string | null } | null
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile: currentProfile, isAdmin } = useAuth()
  const [client, setClient] = useState<Client | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [installments, setInstallments] = useState<Installment[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [workLogs, setWorkLogs] = useState<EnrichedWorkLog[]>([])
  const [clientTasks, setClientTasks] = useState<EnrichedChecklistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [showEditModal, setShowEditModal] = useState(false)
  const [showLogModal, setShowLogModal] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [editLog, setEditLog] = useState<WorkLog | null>(null)
  const [editTask, setEditTask] = useState<ChecklistItem | null>(null)
  const [notes, setNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [showDoneTasks, setShowDoneTasks] = useState(false)

  const fetchClient = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const [{ data: c }, { data: d }, { data: inst }, { data: e }, { data: p }, { data: wl }, { data: ct }] = await Promise.all([
      supabase.from('clients').select('*, assigned_profile:assigned_to(id, full_name)').eq('id', id).single(),
      supabase.from('deals').select('*, assigned_profile:assigned_to(id, full_name)').eq('client_id', id).order('created_at', { ascending: false }),
      supabase.from('installments').select('*, deal:deal_id(title)').eq('client_id', id).order('due_date', { ascending: true }),
      supabase.from('expenses').select('*').eq('client_id', id).order('expense_date', { ascending: false }),
      supabase.from('profiles').select('*').eq('is_active', true),
      supabase.from('work_logs').select('*, profile:logged_by(id, full_name, avatar_initials)').eq('client_id', id).order('worked_on', { ascending: false }),
      supabase.from('checklist_items').select('*, assignee:assigned_to(id, full_name, avatar_initials)').eq('client_id', id).order('sort_order').order('created_at', { ascending: false }),
    ])
    if (c) { setClient(c as Client); setNotes((c as Client).notes ?? '') }
    setDeals((d ?? []) as Deal[])
    setInstallments((inst ?? []) as Installment[])
    setExpenses((e ?? []) as Expense[])
    setProfiles((p ?? []) as Profile[])
    setWorkLogs((wl ?? []) as EnrichedWorkLog[])
    setClientTasks((ct ?? []) as EnrichedChecklistItem[])
    setLoading(false)
  }, [id])

  useEffect(() => { fetchClient() }, [fetchClient])

  async function saveNotes() {
    if (!id) return
    setSavingNotes(true)
    await supabase.from('clients').update({ notes }).eq('id', id)
    setSavingNotes(false)
  }

  if (loading) return <div className="flex items-center justify-center py-24"><LoadingSpinner size="lg" /></div>

  if (!client) {
    return (
      <Card className="p-8 text-center">
        <p style={{ color: 'var(--text-muted)' }}>Client not found.</p>
        <Button variant="ghost" onClick={() => navigate('/clients')} className="mt-4">← Back</Button>
      </Card>
    )
  }

  const initials = client.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
  const pendingTotal = installments.filter((i) => i.status === 'pending' || i.status === 'overdue').reduce((s, i) => s + Number(i.amount), 0)
  const assignedProfile = client.assigned_profile as { full_name?: string } | undefined

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'deals', label: `Deals (${deals.length})` },
    { key: 'installments', label: `Installments (${installments.length})` },
    { key: 'expenses', label: `Expenses (${expenses.length})` },
    { key: 'work_logs', label: `Work Logs (${workLogs.length})` },
    { key: 'tasks', label: `Tasks (${clientTasks.length})` },
  ]

  const totalLogMinutes = workLogs.reduce((s, l) => s + (l.duration_minutes ?? 0), 0)
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const monthLogMinutes = workLogs.filter((l) => l.worked_on >= monthStart).reduce((s, l) => s + (l.duration_minutes ?? 0), 0)

  async function toggleTask(task: EnrichedChecklistItem) {
    const newDone = !task.is_done
    setClientTasks((prev) => prev.map((t) => t.id === task.id ? {
      ...t, is_done: newDone,
      done_by: newDone ? currentProfile?.id ?? null : null,
      done_at: newDone ? new Date().toISOString() : null,
    } : t))
    await supabase.from('checklist_items').update({
      is_done: newDone,
      done_by: newDone ? currentProfile?.id ?? null : null,
      done_at: newDone ? new Date().toISOString() : null,
    }).eq('id', task.id)
  }

  async function deleteTask(task: EnrichedChecklistItem) {
    if (!confirm(`Delete task "${task.title}"?`)) return
    await supabase.from('checklist_items').delete().eq('id', task.id)
    setClientTasks((prev) => prev.filter((t) => t.id !== task.id))
  }

  async function deleteLog(log: EnrichedWorkLog) {
    if (!confirm(`Delete work log "${log.title}"?`)) return
    await supabase.from('work_logs').delete().eq('id', log.id)
    setWorkLogs((prev) => prev.filter((l) => l.id !== log.id))
  }

  return (
    <div className="space-y-5">
      <button onClick={() => navigate('/clients')} className="flex items-center gap-2 text-sm"
        style={{ color: 'var(--text-muted)' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}>
        <ArrowLeft size={14} /> Back to Clients
      </button>

      <Card className="p-4 md:p-5">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center text-base md:text-lg font-semibold flex-shrink-0"
              style={{ background: 'var(--gold-muted)', color: 'var(--gold-primary)', border: '2px solid var(--gold-dark)', fontFamily: 'DM Mono, monospace' }}>
              {initials}
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-light mb-1" style={{ fontFamily: 'Cormorant Garamond, serif', color: 'var(--text-primary)' }}>
                {client.name}
              </h1>
              <div className="flex items-center gap-3 flex-wrap">
                {client.company && <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{client.company}</span>}
                <ClientStatusBadge status={client.status} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto">
            <Button variant="secondary" size="sm" onClick={() => setShowEditModal(true)}><Edit size={13} /> Edit</Button>
            <Button size="sm" onClick={() => navigate(`/deals?client=${id}`)}><Plus size={13} /> Deal</Button>
          </div>
        </div>
      </Card>

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

      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="col-span-1 lg:col-span-2">
              <Card className="p-5">
                <h3 className="text-xs font-medium uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>Contact Information</h3>
                <div className="space-y-3">
                  {client.email && <div className="flex items-center gap-3"><Mail size={14} style={{ color: 'var(--text-muted)' }} /><span className="text-sm" style={{ color: 'var(--text-primary)' }}>{client.email}</span></div>}
                  {client.phone && <div className="flex items-center gap-3"><Phone size={14} style={{ color: 'var(--text-muted)' }} /><span className="text-sm" style={{ color: 'var(--text-primary)' }}>{client.phone}</span></div>}
                  {(client.address || client.city) && (
                    <div className="flex items-center gap-3">
                      <MapPin size={14} style={{ color: 'var(--text-muted)' }} />
                      <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{[client.address, client.city, client.country].filter(Boolean).join(', ')}</span>
                    </div>
                  )}
                  {client.tax_id && <div className="flex items-center gap-3"><FileText size={14} style={{ color: 'var(--text-muted)' }} /><span className="text-sm" style={{ color: 'var(--text-primary)' }}>OIB: {client.tax_id}</span></div>}
                  {assignedProfile?.full_name && <div className="flex items-center gap-3"><Briefcase size={14} style={{ color: 'var(--text-muted)' }} /><span className="text-sm" style={{ color: 'var(--text-primary)' }}>Assigned to {assignedProfile.full_name}</span></div>}
                </div>
              </Card>
            </div>
            <div className="space-y-4">
              <Card className="p-5" goldAccent>
                <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Pending Amount</p>
                <p className="text-2xl font-light" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--status-yellow)' }}>{formatCurrency(pendingTotal)}</p>
              </Card>
              <Card className="p-5">
                <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Client Since</p>
                <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{formatDate(client.created_at)}</p>
              </Card>
            </div>
          </div>
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Notes</h3>
              {savingNotes && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Saving…</span>}
            </div>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; saveNotes() }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--gold-primary)')}
              placeholder="Add notes about this client…" rows={5}
              className="w-full px-3 py-2.5 rounded text-sm outline-none resize-y"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
            />
          </Card>
        </div>
      )}

      {activeTab === 'deals' && (
        <Card>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Deals</h3>
            <Button size="sm" onClick={() => navigate(`/deals?client=${id}`)}><Plus size={13} /> New Deal</Button>
          </div>
          {deals.length === 0 ? <p className="px-5 py-8 text-sm text-center" style={{ color: 'var(--text-muted)' }}>No deals yet</p> : (
            <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
              {deals.map((deal) => (
                <div key={deal.id} className="flex items-center justify-between px-5 py-3 cursor-pointer"
                  onClick={() => navigate(`/deals/${deal.id}`)}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{deal.title}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatDate(deal.start_date)} – {formatDate(deal.end_date)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <DealStageBadge stage={deal.stage} />
                    <span style={{ fontFamily: 'DM Mono, monospace', color: 'var(--gold-primary)', fontSize: '13px' }}>{formatCurrency(deal.value, deal.currency)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {activeTab === 'installments' && (
        <Card>
          <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Payment Schedule</h3>
          </div>
          {installments.length === 0 ? <p className="px-5 py-8 text-sm text-center" style={{ color: 'var(--text-muted)' }}>No installments yet</p> : (
            <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
              {installments.map((inst) => {
                const deal = inst.deal as { title?: string } | undefined
                return (
                  <div key={inst.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{inst.title}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{deal?.title ? `${deal.title} · ` : ''}Due {formatDate(inst.due_date)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <InstallmentStatusBadge status={inst.status} />
                      <span style={{ fontFamily: 'DM Mono, monospace', color: 'var(--gold-primary)', fontSize: '13px' }}>{formatCurrency(inst.amount, inst.currency)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      )}

      {activeTab === 'expenses' && (
        <Card>
          <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Expenses</h3>
          </div>
          {expenses.length === 0 ? <p className="px-5 py-8 text-sm text-center" style={{ color: 'var(--text-muted)' }}>No expenses linked to this client</p> : (
            <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
              {expenses.map((exp) => (
                <div key={exp.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{exp.title}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatDate(exp.expense_date)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <CategoryBadge category={exp.category} />
                    <span style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-primary)', fontSize: '13px' }}>{formatCurrency(exp.amount, exp.currency)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {activeTab === 'work_logs' && (
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-6">
                <div>
                  <p className="text-xs uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>Total Logged</p>
                  <p className="text-lg font-light" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--gold-primary)' }}>
                    {totalLogMinutes > 0 ? formatDuration(totalLogMinutes) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>This Month</p>
                  <p className="text-lg font-light" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-primary)' }}>
                    {monthLogMinutes > 0 ? formatDuration(monthLogMinutes) : '—'}
                  </p>
                </div>
              </div>
              <Button size="sm" onClick={() => { setEditLog(null); setShowLogModal(true) }}><Plus size={13} /> Log Work</Button>
            </div>
          </Card>
          <Card>
            {workLogs.length === 0 ? (
              <p className="px-5 py-8 text-sm text-center" style={{ color: 'var(--text-muted)' }}>No work logged for this client yet</p>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {workLogs.map((log) => {
                  const prof = log.profile as { full_name?: string; avatar_initials?: string } | null
                  const initials = prof?.avatar_initials ?? prof?.full_name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() ?? '?'
                  const canEdit = log.logged_by === currentProfile?.id || isAdmin
                  return (
                    <div key={log.id} className="flex items-center justify-between px-5 py-3 gap-3"
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-semibold flex-shrink-0"
                          style={{ background: 'var(--gold-muted)', color: 'var(--gold-primary)', fontFamily: 'DM Mono, monospace' }}>
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{log.title}</p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {prof?.full_name ?? '—'} · {formatDate(log.worked_on)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <WorkCategoryBadge category={log.category} />
                        <span className="text-xs hidden md:block" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-muted)' }}>
                          {log.duration_minutes ? formatDuration(log.duration_minutes) : '—'}
                        </span>
                        {canEdit && (
                          <div className="flex gap-1">
                            <button onClick={() => { setEditLog(log as WorkLog); setShowLogModal(true) }} className="text-xs px-2 py-1 rounded" style={{ color: 'var(--text-muted)' }}>Edit</button>
                            <button onClick={() => deleteLog(log)} className="text-xs px-2 py-1 rounded" style={{ color: 'var(--text-muted)' }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--status-red)')}
                              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}>Delete</button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {activeTab === 'tasks' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => { setEditTask(null); setShowTaskModal(true) }}><Plus size={13} /> Add Task</Button>
          </div>
          <Card className="overflow-hidden">
            {clientTasks.filter((t) => !t.is_done).length === 0 && clientTasks.filter((t) => t.is_done).length === 0 && (
              <p className="px-5 py-8 text-sm text-center" style={{ color: 'var(--text-muted)' }}>No tasks for this client yet</p>
            )}
            {clientTasks.filter((t) => !t.is_done).map((task) => {
              const assignee = task.assignee as { full_name?: string; avatar_initials?: string } | null
              const initials = assignee?.avatar_initials ?? assignee?.full_name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() ?? null
              const priorityColor = PRIORITY_COLORS[task.priority]
              let dueDateColor = 'var(--text-muted)'
              if (task.due_date) {
                const d = parseISO(task.due_date)
                if (isToday(d)) dueDateColor = 'var(--status-yellow)'
                else if (isBefore(d, new Date())) dueDateColor = 'var(--status-red)'
              }
              return (
                <div key={task.id} className="flex items-center gap-3 px-5 py-3"
                  style={{ borderBottom: '1px solid var(--border-subtle)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <button onClick={() => toggleTask(task)}
                    className="w-4 h-4 rounded flex-shrink-0 border flex items-center justify-center"
                    style={{ borderColor: 'var(--border-default)', background: 'transparent' }}>
                  </button>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: priorityColor }} />
                  <span className="flex-1 text-sm truncate" style={{ color: 'var(--text-primary)' }}>{task.title}</span>
                  {task.due_date && (
                    <span className="text-[10px] flex-shrink-0" style={{ fontFamily: 'DM Mono, monospace', color: dueDateColor }}>{formatDate(task.due_date)}</span>
                  )}
                  {initials && (
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold flex-shrink-0"
                      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                      {initials}
                    </div>
                  )}
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => { setEditTask(task as ChecklistItem); setShowTaskModal(true) }} className="text-xs px-2 py-1 rounded" style={{ color: 'var(--text-muted)' }}>Edit</button>
                    <button onClick={() => deleteTask(task)} className="text-xs px-2 py-1 rounded" style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--status-red)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}>Delete</button>
                  </div>
                </div>
              )
            })}
            {clientTasks.filter((t) => t.is_done).length > 0 && (
              <div>
                <button onClick={() => setShowDoneTasks((s) => !s)}
                  className="w-full flex items-center gap-2 px-5 py-2.5 text-xs"
                  style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)' }}>
                  {showDoneTasks ? <span>▾</span> : <ChevronRight size={11} />}
                  {clientTasks.filter((t) => t.is_done).length} completed
                </button>
                {showDoneTasks && clientTasks.filter((t) => t.is_done).map((task) => (
                  <div key={task.id} className="flex items-center gap-3 px-5 py-3"
                    style={{ borderTop: '1px solid var(--border-subtle)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                    <button onClick={() => toggleTask(task)}
                      className="w-4 h-4 rounded flex-shrink-0 border flex items-center justify-center"
                      style={{ borderColor: 'var(--gold-primary)', background: 'var(--gold-primary)' }}>
                      <Check size={9} style={{ color: '#0A0A0A' }} />
                    </button>
                    <span className="flex-1 text-sm truncate" style={{ color: 'var(--text-muted)', textDecoration: 'line-through' }}>{task.title}</span>
                    <button onClick={() => deleteTask(task)} className="text-xs px-2 py-1 rounded" style={{ color: 'var(--text-muted)' }}>Delete</button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Suppress unused import warning */}
      {false && <Link to="/" />}

      <ClientFormModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        client={client}
        profiles={profiles}
        currentUserId=""
        onSaved={() => { fetchClient(); setShowEditModal(false) }}
      />
      <LogWorkModal
        isOpen={showLogModal}
        onClose={() => { setShowLogModal(false); setEditLog(null) }}
        log={editLog}
        clients={client ? [client] : []}
        currentUserId={currentProfile?.id ?? ''}
        preselectedClientId={id}
        onSaved={() => { fetchClient(); setShowLogModal(false); setEditLog(null) }}
      />
      <ChecklistItemModal
        isOpen={showTaskModal}
        onClose={() => { setShowTaskModal(false); setEditTask(null) }}
        item={editTask}
        clients={client ? [client] : []}
        profiles={profiles}
        currentUserId={currentProfile?.id ?? ''}
        preselectedClientId={id}
        onSaved={() => { fetchClient(); setShowTaskModal(false); setEditTask(null) }}
      />
    </div>
  )
}
