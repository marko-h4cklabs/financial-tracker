import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { UserPlus, ChevronLeft, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/formatters'
import type { Profile, ActivityLog } from '@/types'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'

type Tab = 'team' | 'activity' | 'financial'

const createSchema = z.object({
  full_name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'Min 8 characters'),
  role: z.enum(['admin', 'member']),
})
type CreateFormData = z.infer<typeof createSchema>

const ACTION_COLORS: Record<string, string> = {
  create: 'var(--status-green)',
  update: 'var(--gold-primary)',
  delete: 'var(--status-red)',
  payment: '#60A5FA',
  status_change: '#A78BFA',
}

interface TopClient { id: string; name: string; company: string | null; revenue: number }
interface MemberRow extends Profile { email?: string }

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('team')

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-light tracking-widest uppercase"
        style={{ fontFamily: 'Cormorant Garamond, serif', color: 'var(--gold-primary)' }}>
        Admin
      </h1>

      <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--bg-elevated)', width: 'fit-content' }}>
        {(['team', 'activity', 'financial'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-1.5 text-sm rounded-md transition-all"
            style={tab === t
              ? { background: 'var(--gold-primary)', color: '#0A0A0A', fontWeight: 600 }
              : { color: 'var(--text-muted)' }}>
            {t === 'activity' ? 'Activity Log' : t === 'financial' ? 'Financial Overview' : 'Team Members'}
          </button>
        ))}
      </div>

      {tab === 'team' && <TeamTab />}
      {tab === 'activity' && <ActivityTab />}
      {tab === 'financial' && <FinancialTab />}
    </div>
  )
}

// ── Team Tab ──────────────────────────────────────────────────────────────────
function TeamTab() {
  const [members, setMembers] = useState<MemberRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editMember, setEditMember] = useState<MemberRow | null>(null)

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').order('created_at')
    setMembers((data ?? []) as MemberRow[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchMembers() }, [fetchMembers])

  async function toggleActive(member: MemberRow) {
    const next = !member.is_active
    const { error } = await supabase.from('profiles').update({ is_active: next }).eq('id', member.id)
    if (error) { toast.error('Failed to update'); return }
    toast.success(`User ${next ? 'activated' : 'deactivated'}`)
    fetchMembers()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <UserPlus size={14} className="mr-1.5" /> Add Team Member
        </Button>
      </div>

      <Card>
        {loading ? (
          <div className="p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                {['Name', 'Role', 'Status', 'Joined', 'Actions'].map((h, i) => (
                  <th key={h} className={`px-4 py-3 text-[10px] uppercase tracking-wider font-medium ${i === 4 ? 'text-right' : 'text-left'}`}
                    style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
                        style={{ background: 'var(--bg-elevated)', color: 'var(--gold-primary)' }}>
                        {m.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{m.full_name}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-medium"
                      style={m.role === 'admin'
                        ? { background: 'rgba(201,168,76,0.15)', color: 'var(--gold-primary)' }
                        : { background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                      {m.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-medium"
                      style={m.is_active
                        ? { background: 'rgba(34,197,94,0.1)', color: 'var(--status-green)' }
                        : { background: 'rgba(239,68,68,0.1)', color: 'var(--status-red)' }}>
                      {m.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {m.created_at ? format(new Date(m.created_at), 'dd MMM yyyy') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="text-xs px-2 py-1 rounded"
                        style={{ color: 'var(--gold-primary)', border: '1px solid var(--border-default)' }}
                        onClick={() => setEditMember(m)}>
                        Edit
                      </button>
                      <button className="text-xs px-2 py-1 rounded"
                        style={{
                          color: m.is_active ? 'var(--status-red)' : 'var(--status-green)',
                          border: '1px solid var(--border-default)',
                        }}
                        onClick={() => toggleActive(m)}>
                        {m.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <CreateUserModal isOpen={showCreate} onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); fetchMembers() }} />
      {editMember && (
        <EditUserModal member={editMember} onClose={() => setEditMember(null)} onSaved={() => { setEditMember(null); fetchMembers() }} />
      )}
    </div>
  )
}

// ── Create User Modal ─────────────────────────────────────────────────────────
function CreateUserModal({ isOpen, onClose, onSaved }: { isOpen: boolean; onClose: () => void; onSaved: () => void }) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CreateFormData>({
    resolver: zodResolver(createSchema),
    defaultValues: { role: 'member' },
  })

  useEffect(() => { if (!isOpen) reset() }, [isOpen, reset])

  const onSubmit = async (data: CreateFormData) => {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(data),
    })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error ?? 'Failed to create user'); return }
    toast.success('User created successfully')
    onSaved()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Team Member" size="sm">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label="Full Name *" error={errors.full_name?.message} {...register('full_name')} />
        <Input label="Email *" type="email" error={errors.email?.message} {...register('email')} />
        <Input label="Password *" type="password" error={errors.password?.message} {...register('password')} />
        <Select label="Role" options={[{ value: 'member', label: 'Member' }, { value: 'admin', label: 'Admin' }]} {...register('role')} />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>Create User</Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Edit User Modal ───────────────────────────────────────────────────────────
const editSchema = z.object({
  full_name: z.string().min(1, 'Name is required'),
  role: z.enum(['admin', 'member']),
})
type EditFormData = z.infer<typeof editSchema>

function EditUserModal({ member, onClose, onSaved }: { member: MemberRow; onClose: () => void; onSaved: () => void }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues: { full_name: member.full_name, role: member.role as 'admin' | 'member' },
  })

  const onSubmit = async (data: EditFormData) => {
    const { error } = await supabase.from('profiles').update(data).eq('id', member.id)
    if (error) { toast.error('Failed to update'); return }
    toast.success('User updated')
    onSaved()
  }

  return (
    <Modal isOpen={true} onClose={onClose} title="Edit Team Member" size="sm">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label="Full Name *" error={errors.full_name?.message} {...register('full_name')} />
        <Select label="Role" options={[{ value: 'member', label: 'Member' }, { value: 'admin', label: 'Admin' }]} {...register('role')} />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>Save Changes</Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Activity Log Tab ──────────────────────────────────────────────────────────
const PAGE_SIZE = 20

function ActivityTab() {
  const [logs, setLogs] = useState<(ActivityLog & { profile?: { full_name: string } })[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [filterUser, setFilterUser] = useState('')
  const [filterEntity, setFilterEntity] = useState('')
  const [filterAction, setFilterAction] = useState('')

  useEffect(() => {
    supabase.from('profiles').select('*').then(({ data }) => setProfiles((data ?? []) as Profile[]))
  }, [])

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('activity_log')
      .select('*, profile:created_by(full_name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (filterUser) q = q.eq('created_by', filterUser)
    if (filterEntity) q = q.eq('entity_type', filterEntity)
    if (filterAction) q = q.eq('action', filterAction)

    const { data, count } = await q
    setLogs((data ?? []) as (ActivityLog & { profile?: { full_name: string } })[])
    setTotal(count ?? 0)
    setLoading(false)
  }, [page, filterUser, filterEntity, filterAction])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'User', value: filterUser, onChange: (v: string) => { setFilterUser(v); setPage(0) },
              options: [{ value: '', label: 'All Users' }, ...profiles.map((p) => ({ value: p.id, label: p.full_name }))] },
            { label: 'Entity', value: filterEntity, onChange: (v: string) => { setFilterEntity(v); setPage(0) },
              options: [{ value: '', label: 'All Entities' }, ...['client','deal','invoice','installment','expense'].map((e) => ({ value: e, label: e.charAt(0).toUpperCase() + e.slice(1) }))] },
            { label: 'Action', value: filterAction, onChange: (v: string) => { setFilterAction(v); setPage(0) },
              options: [{ value: '', label: 'All Actions' }, ...['create','update','delete','payment','status_change'].map((a) => ({ value: a, label: a.replace('_', ' ') }))] },
          ].map(({ label, value, onChange, options }) => (
            <div key={label}>
              <label className="block text-[10px] uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>{label}</label>
              <select value={value} onChange={(e) => onChange(e.target.value)}
                className="w-full px-3 py-2 rounded text-sm outline-none"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}>
                {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        {loading ? (
          <div className="p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No activity found.</div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                  {['Time', 'User', 'Action', 'Entity', 'Description'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] uppercase tracking-wider font-medium"
                      style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td className="px-4 py-3 text-xs font-mono whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                      {format(new Date(log.created_at), 'dd MMM, HH:mm')}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {(log.profile as { full_name: string } | undefined)?.full_name ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold"
                        style={{
                          background: `${ACTION_COLORS[log.action] ?? 'var(--text-muted)'}22`,
                          color: ACTION_COLORS[log.action] ?? 'var(--text-muted)',
                        }}>
                        {log.action.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs capitalize" style={{ color: 'var(--text-muted)' }}>
                      {log.entity_type}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {log.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
                </p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPage((p) => p - 1)} disabled={page === 0}
                    className="p-1 rounded disabled:opacity-30" style={{ color: 'var(--text-muted)' }}>
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{page + 1} / {totalPages}</span>
                  <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages - 1}
                    className="p-1 rounded disabled:opacity-30" style={{ color: 'var(--text-muted)' }}>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  )
}

// ── Financial Overview Tab ────────────────────────────────────────────────────
interface MonthlyData { month: string; revenue: number; expenses: number }

function FinancialTab() {
  const [monthly, setMonthly] = useState<MonthlyData[]>([])
  const [topClients, setTopClients] = useState<TopClient[]>([])
  const [teamStats, setTeamStats] = useState<{ name: string; deals: number; revenue: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const now = new Date()
      const months: MonthlyData[] = []

      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10)
        const label = format(d, 'MMM yy')

        const [{ data: installs }, { data: exps }] = await Promise.all([
          supabase.from('installments').select('amount').eq('status', 'paid').gte('due_date', start).lte('due_date', end),
          supabase.from('expenses').select('amount').gte('expense_date', start).lte('expense_date', end),
        ])
        months.push({
          month: label,
          revenue: (installs ?? []).reduce((s, r) => s + r.amount, 0),
          expenses: (exps ?? []).reduce((s, r) => s + r.amount, 0),
        })
      }
      setMonthly(months)

      // Top clients
      const { data: clients } = await supabase.from('clients').select('id, name, company')
      const clientRevenue: TopClient[] = []
      for (const c of (clients ?? [])) {
        const { data: installs } = await supabase.from('installments').select('amount').eq('client_id', c.id).eq('status', 'paid')
        const revenue = (installs ?? []).reduce((s, r) => s + r.amount, 0)
        if (revenue > 0) clientRevenue.push({ id: c.id, name: c.name, company: c.company, revenue })
      }
      setTopClients(clientRevenue.sort((a, b) => b.revenue - a.revenue).slice(0, 5))

      // Team performance
      const { data: profs } = await supabase.from('profiles').select('id, full_name').eq('is_active', true)
      const stats = []
      for (const p of (profs ?? [])) {
        const { data: deals } = await supabase.from('deals').select('value').eq('assigned_to', p.id).eq('stage', 'won')
        const revenue = (deals ?? []).reduce((s, r) => s + r.value, 0)
        stats.push({ name: p.full_name, deals: (deals ?? []).length, revenue })
      }
      setTeamStats(stats.sort((a, b) => b.revenue - a.revenue))

      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>

  const maxBar = Math.max(...monthly.map((m) => Math.max(m.revenue, m.expenses)), 1)

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <p className="text-[10px] uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
          Revenue vs Expenses — Last 12 Months
        </p>
        <div className="flex items-end gap-2" style={{ height: 160 }}>
          {monthly.map((m) => (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-0.5">
              <div className="w-full flex gap-0.5 items-end" style={{ height: 120 }}>
                <div className="flex-1 rounded-sm"
                  style={{ height: `${(m.revenue / maxBar) * 100}%`, background: 'var(--gold-primary)', opacity: 0.85, minHeight: 2 }} />
                <div className="flex-1 rounded-sm"
                  style={{ height: `${(m.expenses / maxBar) * 100}%`, background: 'var(--status-red)', opacity: 0.5, minHeight: 2 }} />
              </div>
              <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{m.month}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: 'var(--gold-primary)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Revenue</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: 'var(--status-red)', opacity: 0.5 }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Expenses</span>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-6">
          <p className="text-[10px] uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
            Top Clients by Revenue
          </p>
          {topClients.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No data yet.</p>
          ) : (
            <div className="space-y-3">
              {topClients.map((c, i) => (
                <div key={c.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xs w-4 text-right" style={{ color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace' }}>{i + 1}</span>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{c.name}</p>
                      {c.company && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.company}</p>}
                    </div>
                  </div>
                  <span className="text-sm" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--gold-primary)' }}>
                    {formatCurrency(c.revenue, 'EUR')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <p className="text-[10px] uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
            Team Performance (Won Deals)
          </p>
          {teamStats.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No data yet.</p>
          ) : (
            <div className="space-y-3">
              {teamStats.map((s) => (
                <div key={s.name} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{s.name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.deals} won deal{s.deals !== 1 ? 's' : ''}</p>
                  </div>
                  <span className="text-sm" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--gold-primary)' }}>
                    {formatCurrency(s.revenue, 'EUR')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
