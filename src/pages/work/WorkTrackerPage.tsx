import { useEffect, useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, ClipboardList, Clock, Users, ChevronDown, ChevronRight, MoreVertical, Check } from 'lucide-react'
import { format, startOfWeek, startOfMonth, isBefore, isToday, parseISO } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/authStore'
import { useIsMobile } from '@/hooks/useIsMobile'
import { formatDate, formatDuration } from '@/lib/formatters'
import type { WorkLog, ChecklistItem, Client, Profile, WorkCategory, ChecklistPriority } from '@/types'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import StatCard from '@/components/ui/StatCard'
import { WorkCategoryBadge, WORK_CATEGORY_COLORS, PRIORITY_COLORS } from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonCard } from '@/components/ui/Skeleton'
import LogWorkModal from '@/components/modules/LogWorkModal'
import ChecklistItemModal from '@/components/modules/ChecklistItemModal'
import toast from 'react-hot-toast'

type EnrichedLog = WorkLog & {
  client?: { id: string; name: string } | null
  deal?: { id: string; title: string } | null
  profile?: { id: string; full_name: string; avatar_initials?: string | null } | null
}

type EnrichedItem = ChecklistItem & {
  client?: { id: string; name: string } | null
  deal?: { id: string; title: string } | null
  assignee?: { id: string; full_name: string; avatar_initials?: string | null } | null
}

type GroupBy = 'none' | 'client' | 'member' | 'date'

const WORK_CATEGORIES: WorkCategory[] = ['strategy', 'creative', 'copywriting', 'ads', 'social_media', 'reporting', 'meeting', 'admin', 'general']
const CATEGORY_LABELS: Record<WorkCategory, string> = {
  strategy: 'Strategy', creative: 'Creative', copywriting: 'Copywriting',
  ads: 'Ads', social_media: 'Social', reporting: 'Reporting',
  meeting: 'Meeting', admin: 'Admin', general: 'General',
}

const CHECKLIST_PRIORITIES: ChecklistPriority[] = ['urgent', 'high', 'medium', 'low']
const PRIORITY_LABELS: Record<ChecklistPriority, string> = { urgent: 'Urgent', high: 'High', medium: 'Medium', low: 'Low' }

export default function WorkTrackerPage() {
  const navigate = useNavigate()
  const { profile, isAdmin } = useAuth()
  const isMobile = useIsMobile()

  const [activeTab, setActiveTab] = useState<'logs' | 'checklists'>('logs')

  // Shared reference data
  const [clients, setClients] = useState<Client[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])

  // Work Logs
  const [logs, setLogs] = useState<EnrichedLog[]>([])
  const [logsLoading, setLogsLoading] = useState(true)
  const [logSearch, setLogSearch] = useState('')
  const [logClientFilter, setLogClientFilter] = useState('')
  const [logMemberFilter, setLogMemberFilter] = useState('')
  const [logCategoryFilter, setLogCategoryFilter] = useState<WorkCategory[]>([])
  const [logDateFrom, setLogDateFrom] = useState('')
  const [logDateTo, setLogDateTo] = useState('')
  const [logDealFilter, setLogDealFilter] = useState('')
  const [groupBy, setGroupBy] = useState<GroupBy>('none')
  const [logModal, setLogModal] = useState<{ open: boolean; log: WorkLog | null; preClientId?: string }>({ open: false, log: null })

  // Checklists
  const [items, setItems] = useState<EnrichedItem[]>([])
  const [itemsLoading, setItemsLoading] = useState(true)
  const [myTasksOnly, setMyTasksOnly] = useState(false)
  const [checkSearch, setCheckSearch] = useState('')
  const [checkClientFilter, setCheckClientFilter] = useState('')
  const [checkMemberFilter, setCheckMemberFilter] = useState('')
  const [checkPriorityFilter, setCheckPriorityFilter] = useState<ChecklistPriority[]>([])
  const [checkStatusFilter, setCheckStatusFilter] = useState<'all' | 'pending' | 'done'>('all')
  const [checkDueFilter, setCheckDueFilter] = useState<'all' | 'overdue' | 'today' | 'week'>('all')
  const [itemModal, setItemModal] = useState<{ open: boolean; item: ChecklistItem | null; preClientId?: string }>({ open: false, item: null })
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const fetchShared = useCallback(async () => {
    const [{ data: c }, { data: p }] = await Promise.all([
      supabase.from('clients').select('id, name, company').order('name'),
      supabase.from('profiles').select('*').eq('is_active', true),
    ])
    setClients((c ?? []) as Client[])
    setProfiles((p ?? []) as Profile[])
  }, [])

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true)
    const { data, error } = await supabase
      .from('work_logs')
      .select('*, client:client_id(id, name), deal:deal_id(id, title), profile:logged_by(id, full_name, avatar_initials)')
      .order('worked_on', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) { toast.error('Failed to load work logs'); setLogsLoading(false); return }
    setLogs((data ?? []) as EnrichedLog[])
    setLogsLoading(false)
  }, [])

  const fetchItems = useCallback(async () => {
    setItemsLoading(true)
    const { data, error } = await supabase
      .from('checklist_items')
      .select('*, client:client_id(id, name), deal:deal_id(id, title), assignee:assigned_to(id, full_name, avatar_initials)')
      .order('sort_order')
      .order('created_at', { ascending: false })
    if (error) { toast.error('Failed to load tasks'); setItemsLoading(false); return }
    setItems((data ?? []) as EnrichedItem[])
    setItemsLoading(false)
  }, [])

  useEffect(() => {
    fetchShared()
    fetchLogs()
    fetchItems()
  }, [fetchShared, fetchLogs, fetchItems])

  // Close three-dot menu on outside click
  useEffect(() => {
    if (!openMenuId) return
    const handler = () => setOpenMenuId(null)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [openMenuId])

  // KPIs computed from loaded data
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const weekStartStr = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const monthStartStr = format(startOfMonth(new Date()), 'yyyy-MM-dd')

  const kpis = useMemo(() => {
    const todayCount = logs.filter((l) => l.worked_on === todayStr).length
    const weekCount = logs.filter((l) => l.worked_on >= weekStartStr).length
    const myMonthCount = logs.filter((l) => l.logged_by === profile?.id && l.worked_on >= monthStartStr).length

    const monthLogs = logs.filter((l) => l.worked_on >= monthStartStr)
    const clientCounts: Record<string, { count: number; name: string }> = {}
    monthLogs.forEach((l) => {
      if (!l.client_id) return
      const name = (l.client as { name?: string } | null)?.name ?? 'Unknown'
      clientCounts[l.client_id] = { count: (clientCounts[l.client_id]?.count ?? 0) + 1, name }
    })
    const topClient = Object.values(clientCounts).sort((a, b) => b.count - a.count)[0]?.name ?? '—'

    return { todayCount, weekCount, myMonthCount, topClient }
  }, [logs, profile, todayStr, weekStartStr, monthStartStr])

  // Filtered work logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const q = logSearch.toLowerCase()
      const clientObj = log.client as { name?: string } | null
      const matchSearch = !q || log.title.toLowerCase().includes(q) ||
        (log.description ?? '').toLowerCase().includes(q) ||
        (clientObj?.name ?? '').toLowerCase().includes(q)
      const matchClient = !logClientFilter || log.client_id === logClientFilter
      const matchMember = !logMemberFilter || log.logged_by === logMemberFilter
      const matchCategory = logCategoryFilter.length === 0 || logCategoryFilter.includes(log.category)
      const matchFrom = !logDateFrom || log.worked_on >= logDateFrom
      const matchTo = !logDateTo || log.worked_on <= logDateTo
      const matchDeal = !logDealFilter || log.deal_id === logDealFilter
      return matchSearch && matchClient && matchMember && matchCategory && matchFrom && matchTo && matchDeal
    })
  }, [logs, logSearch, logClientFilter, logMemberFilter, logCategoryFilter, logDateFrom, logDateTo, logDealFilter])

  // Grouped logs
  const groupedLogs = useMemo(() => {
    if (groupBy === 'none') return null
    const map = new Map<string, { label: string; logs: EnrichedLog[]; totalMinutes: number }>()
    filteredLogs.forEach((log) => {
      let key: string
      let label: string
      if (groupBy === 'client') {
        key = log.client_id ?? 'none'
        label = (log.client as { name?: string } | null)?.name ?? 'No client'
      } else if (groupBy === 'member') {
        key = log.logged_by ?? 'none'
        label = (log.profile as { full_name?: string } | null)?.full_name ?? 'Unknown'
      } else {
        key = log.worked_on
        label = formatDate(log.worked_on)
      }
      const entry = map.get(key)
      if (entry) {
        entry.logs.push(log)
        entry.totalMinutes += log.duration_minutes ?? 0
      } else {
        map.set(key, { label, logs: [log], totalMinutes: log.duration_minutes ?? 0 })
      }
    })
    return Array.from(map.values())
  }, [filteredLogs, groupBy])

  // Filtered checklist items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const q = checkSearch.toLowerCase()
      const clientObj = item.client as { name?: string } | null
      const matchSearch = !q || item.title.toLowerCase().includes(q) || (clientObj?.name ?? '').toLowerCase().includes(q)
      const matchClient = !checkClientFilter || item.client_id === checkClientFilter
      const matchMember = !checkMemberFilter || item.assigned_to === checkMemberFilter
      const matchPriority = checkPriorityFilter.length === 0 || checkPriorityFilter.includes(item.priority)
      const matchMyTasks = !myTasksOnly || item.assigned_to === profile?.id
      const matchStatus = checkStatusFilter === 'all' || (checkStatusFilter === 'pending' ? !item.is_done : item.is_done)
      let matchDue = true
      if (checkDueFilter !== 'all' && item.due_date) {
        const d = parseISO(item.due_date)
        if (checkDueFilter === 'overdue') matchDue = !item.is_done && isBefore(d, new Date()) && !isToday(d)
        else if (checkDueFilter === 'today') matchDue = isToday(d)
        else if (checkDueFilter === 'week') matchDue = d >= new Date() && d <= new Date(Date.now() + 7 * 86400000)
      } else if (checkDueFilter !== 'all') {
        matchDue = false
      }
      return matchSearch && matchClient && matchMember && matchPriority && matchMyTasks && matchStatus && matchDue
    })
  }, [items, checkSearch, checkClientFilter, checkMemberFilter, checkPriorityFilter, myTasksOnly, checkStatusFilter, checkDueFilter, profile])

  // Group checklist items by client
  const checklistByClient = useMemo(() => {
    const map = new Map<string, { clientName: string; pendingItems: EnrichedItem[]; doneItems: EnrichedItem[] }>()
    filteredItems.forEach((item) => {
      const clientId = item.client_id ?? 'none'
      const clientName = (item.client as { name?: string } | null)?.name ?? 'No client'
      const entry = map.get(clientId) ?? { clientName, pendingItems: [], doneItems: [] }
      if (item.is_done) entry.doneItems.push(item)
      else entry.pendingItems.push(item)
      map.set(clientId, entry)
    })
    return Array.from(map.entries()).map(([clientId, data]) => ({ clientId, ...data }))
  }, [filteredItems])

  async function deleteLog(log: EnrichedLog) {
    if (!confirm(`Delete work log "${log.title}"?`)) return
    await supabase.from('work_logs').delete().eq('id', log.id)
    toast.success('Work log deleted')
    fetchLogs()
  }

  async function toggleItemDone(item: EnrichedItem) {
    const newDone = !item.is_done
    setItems((prev) => prev.map((i) => i.id === item.id ? {
      ...i,
      is_done: newDone,
      done_by: newDone ? profile?.id ?? null : null,
      done_at: newDone ? new Date().toISOString() : null,
    } : i))
    const { error } = await supabase.from('checklist_items').update({
      is_done: newDone,
      done_by: newDone ? profile?.id ?? null : null,
      done_at: newDone ? new Date().toISOString() : null,
    }).eq('id', item.id)
    if (error) {
      setItems((prev) => prev.map((i) => i.id === item.id ? item : i))
      toast.error('Failed to update task')
    }
  }

  async function deleteItem(item: EnrichedItem) {
    if (!confirm(`Delete task "${item.title}"?`)) return
    await supabase.from('checklist_items').delete().eq('id', item.id)
    toast.success('Task deleted')
    fetchItems()
  }

  const deals = useMemo(() => {
    const dealMap = new Map<string, { id: string; title: string }>()
    logs.forEach((l) => {
      const d = l.deal as { id?: string; title?: string } | null
      if (d?.id) dealMap.set(d.id, { id: d.id, title: d.title ?? '' })
    })
    return Array.from(dealMap.values())
  }, [logs])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg md:text-xl font-medium" style={{ color: 'var(--text-primary)' }}>Work Tracker</h1>
          <div className="flex rounded overflow-hidden" style={{ border: '1px solid var(--border-default)' }}>
            {(['logs', 'checklists'] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className="px-3 py-1.5 text-xs transition-colors"
                style={{
                  background: activeTab === tab ? 'var(--gold-muted)' : 'transparent',
                  color: activeTab === tab ? 'var(--gold-primary)' : 'var(--text-muted)',
                }}>
                {tab === 'logs' ? 'Work Logs' : 'Checklists'}
              </button>
            ))}
          </div>
        </div>
        {activeTab === 'logs' && (
          <Button onClick={() => setLogModal({ open: true, log: null })} className="hidden md:flex">
            <Plus size={14} /> Log Work
          </Button>
        )}
        {activeTab === 'checklists' && (
          <Button onClick={() => setItemModal({ open: true, item: null })} className="hidden md:flex">
            <Plus size={14} /> Add Task
          </Button>
        )}
      </div>

      {/* ===== WORK LOGS TAB ===== */}
      {activeTab === 'logs' && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {logsLoading
              ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
              : <>
                <StatCard label="Logged Today" value={kpis.todayCount} icon={Clock} goldAccent />
                <StatCard label="This Week" value={kpis.weekCount} icon={Users} />
                <StatCard label="Your Logs This Month" value={kpis.myMonthCount} icon={ClipboardList} />
                <StatCard label="Top Client This Month" value={kpis.topClient} icon={ClipboardList} />
              </>
            }
          </div>

          {/* Filters */}
          <Card>
            <div className="px-4 py-3 space-y-3">
              <div className="flex flex-wrap gap-2">
                <input
                  placeholder="Search logs…"
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  className="flex-1 min-w-[160px] px-3 py-2 rounded text-sm outline-none"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--gold-primary)')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-default)')}
                />
                <select value={logClientFilter} onChange={(e) => setLogClientFilter(e.target.value)}
                  className="px-3 py-2 rounded text-sm outline-none"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: logClientFilter ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  <option value="">All clients</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select value={logMemberFilter} onChange={(e) => setLogMemberFilter(e.target.value)}
                  className="px-3 py-2 rounded text-sm outline-none"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: logMemberFilter ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  <option value="">All members</option>
                  {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
                <input type="date" value={logDateFrom} onChange={(e) => setLogDateFrom(e.target.value)}
                  className="px-3 py-2 rounded text-sm outline-none"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: logDateFrom ? 'var(--text-primary)' : 'var(--text-muted)' }} />
                <input type="date" value={logDateTo} onChange={(e) => setLogDateTo(e.target.value)}
                  className="px-3 py-2 rounded text-sm outline-none"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: logDateTo ? 'var(--text-primary)' : 'var(--text-muted)' }} />
                <select value={logDealFilter} onChange={(e) => setLogDealFilter(e.target.value)}
                  className="px-3 py-2 rounded text-sm outline-none"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: logDealFilter ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  <option value="">All deals</option>
                  {deals.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
                </select>
              </div>
              {/* Category chips */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Category:</span>
                {WORK_CATEGORIES.map((cat) => {
                  const active = logCategoryFilter.includes(cat)
                  const color = WORK_CATEGORY_COLORS[cat]
                  return (
                    <button key={cat} onClick={() => setLogCategoryFilter((prev) =>
                      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat])}
                      className="px-2.5 py-1 rounded-full text-[11px] capitalize transition-all"
                      style={{
                        background: active ? `${color}22` : 'var(--bg-elevated)',
                        border: `1px solid ${active ? color : 'var(--border-default)'}`,
                        color: active ? color : 'var(--text-muted)',
                      }}>
                      {CATEGORY_LABELS[cat]}
                    </button>
                  )
                })}
                {logCategoryFilter.length > 0 && (
                  <button onClick={() => setLogCategoryFilter([])} className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Clear ×</button>
                )}
                <span className="ml-auto flex items-center gap-1.5">
                  <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Group:</span>
                  {(['none', 'client', 'member', 'date'] as GroupBy[]).map((g) => (
                    <button key={g} onClick={() => setGroupBy(g)}
                      className="px-2.5 py-1 rounded text-[11px] capitalize"
                      style={{
                        background: groupBy === g ? 'var(--gold-muted)' : 'transparent',
                        color: groupBy === g ? 'var(--gold-primary)' : 'var(--text-muted)',
                        border: `1px solid ${groupBy === g ? 'var(--gold-primary)' : 'var(--border-default)'}`,
                      }}>
                      {g === 'none' ? 'None' : g === 'member' ? 'Member' : g.charAt(0).toUpperCase() + g.slice(1)}
                    </button>
                  ))}
                </span>
              </div>
            </div>
          </Card>

          {/* Logs list — flat or grouped */}
          {logsLoading ? (
            <Card>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <div className="h-4 rounded w-48" style={{ background: 'var(--bg-elevated)' }} />
                  <div className="h-4 rounded w-24" style={{ background: 'var(--bg-elevated)' }} />
                </div>
              ))}
            </Card>
          ) : filteredLogs.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No work logs found"
              description={logSearch || logCategoryFilter.length ? 'Try adjusting filters' : 'Log your first work entry'}
              action={!logSearch && !logCategoryFilter.length ? { label: 'Log Work', onClick: () => setLogModal({ open: true, log: null }) } : undefined} />
          ) : groupedLogs ? (
            <div className="space-y-4">
              {groupedLogs.map((group) => (
                <Card key={group.label}>
                  <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{group.label}</h3>
                    <span className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace' }}>
                      {group.logs.length} log{group.logs.length !== 1 ? 's' : ''}
                      {group.totalMinutes > 0 ? ` · ${formatDuration(group.totalMinutes)}` : ''}
                    </span>
                  </div>
                  {isMobile
                    ? <div className="p-3 space-y-2">{group.logs.map((log) => <LogCard key={log.id} log={log} currentUserId={profile?.id ?? ''} isAdmin={isAdmin} onEdit={(l) => setLogModal({ open: true, log: l as WorkLog })} onDelete={deleteLog} />)}</div>
                    : <div>{group.logs.map((log) => <LogRow key={log.id} log={log} currentUserId={profile?.id ?? ''} isAdmin={isAdmin} onEdit={(l) => setLogModal({ open: true, log: l as WorkLog })} onDelete={deleteLog} navigate={navigate} />)}</div>
                  }
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              {isMobile
                ? <div className="p-3 space-y-2">{filteredLogs.map((log) => <LogCard key={log.id} log={log} currentUserId={profile?.id ?? ''} isAdmin={isAdmin} onEdit={(l) => setLogModal({ open: true, log: l as WorkLog })} onDelete={deleteLog} />)}</div>
                : (
                  <>
                    {/* Table header */}
                    <div className="flex items-center gap-4 px-5 py-2.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <span className="text-[10px] uppercase tracking-wider w-20 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>Date</span>
                      <span className="text-[10px] uppercase tracking-wider w-36 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>Member</span>
                      <span className="text-[10px] uppercase tracking-wider w-28 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>Client</span>
                      <span className="text-[10px] uppercase tracking-wider w-24 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>Deal</span>
                      <span className="text-[10px] uppercase tracking-wider flex-1" style={{ color: 'var(--text-muted)' }}>Title</span>
                      <span className="text-[10px] uppercase tracking-wider flex-shrink-0" style={{ color: 'var(--text-muted)' }}>Category</span>
                      <span className="text-[10px] uppercase tracking-wider w-16 text-right flex-shrink-0" style={{ color: 'var(--text-muted)' }}>Time</span>
                      <span className="w-20 flex-shrink-0" />
                    </div>
                    {filteredLogs.map((log) => <LogRow key={log.id} log={log} currentUserId={profile?.id ?? ''} isAdmin={isAdmin} onEdit={(l) => setLogModal({ open: true, log: l as WorkLog })} onDelete={deleteLog} navigate={navigate} />)}
                  </>
                )
              }
            </Card>
          )}

          {/* Mobile FAB */}
          <button className="fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl z-20 md:hidden"
            style={{ background: 'var(--gold-primary)', color: '#0A0A0A' }}
            onClick={() => setLogModal({ open: true, log: null })}>
            <Plus size={22} />
          </button>
        </>
      )}

      {/* ===== CHECKLISTS TAB ===== */}
      {activeTab === 'checklists' && (
        <>
          {/* Filters */}
          <Card>
            <div className="px-4 py-3 space-y-3">
              <div className="flex flex-wrap gap-2 items-center">
                {/* My Tasks toggle */}
                <div className="flex rounded overflow-hidden" style={{ border: '1px solid var(--border-default)' }}>
                  {([false, true] as const).map((val) => (
                    <button key={String(val)} onClick={() => setMyTasksOnly(val)}
                      className="px-3 py-1.5 text-xs transition-colors"
                      style={{
                        background: myTasksOnly === val ? 'var(--gold-muted)' : 'transparent',
                        color: myTasksOnly === val ? 'var(--gold-primary)' : 'var(--text-muted)',
                      }}>
                      {val ? 'My Tasks' : 'All Clients'}
                    </button>
                  ))}
                </div>
                <input placeholder="Search tasks…" value={checkSearch} onChange={(e) => setCheckSearch(e.target.value)}
                  className="flex-1 min-w-[140px] px-3 py-2 rounded text-sm outline-none"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--gold-primary)')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-default)')} />
                <select value={checkClientFilter} onChange={(e) => setCheckClientFilter(e.target.value)}
                  className="px-3 py-2 rounded text-sm outline-none"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: checkClientFilter ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  <option value="">All clients</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select value={checkMemberFilter} onChange={(e) => setCheckMemberFilter(e.target.value)}
                  className="px-3 py-2 rounded text-sm outline-none"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: checkMemberFilter ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  <option value="">All members</option>
                  {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                {/* Priority chips */}
                {CHECKLIST_PRIORITIES.map((pr) => {
                  const active = checkPriorityFilter.includes(pr)
                  const color = PRIORITY_COLORS[pr]
                  return (
                    <button key={pr} onClick={() => setCheckPriorityFilter((prev) =>
                      prev.includes(pr) ? prev.filter((p) => p !== pr) : [...prev, pr])}
                      className="px-2.5 py-1 rounded-full text-[11px] transition-all"
                      style={{
                        background: active ? `${color}22` : 'var(--bg-elevated)',
                        border: `1px solid ${active ? color : 'var(--border-default)'}`,
                        color: active ? color : 'var(--text-muted)',
                      }}>
                      {PRIORITY_LABELS[pr]}
                    </button>
                  )
                })}
                {checkPriorityFilter.length > 0 && (
                  <button onClick={() => setCheckPriorityFilter([])} className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Clear ×</button>
                )}
                <span className="ml-auto flex items-center gap-1.5">
                  {(['all', 'pending', 'done'] as const).map((s) => (
                    <button key={s} onClick={() => setCheckStatusFilter(s)}
                      className="px-2.5 py-1 rounded text-[11px] capitalize transition-colors"
                      style={{
                        background: checkStatusFilter === s ? 'var(--bg-elevated)' : 'transparent',
                        color: checkStatusFilter === s ? 'var(--text-primary)' : 'var(--text-muted)',
                        border: `1px solid ${checkStatusFilter === s ? 'var(--border-default)' : 'transparent'}`,
                      }}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                  <span className="mx-1 text-[10px]" style={{ color: 'var(--border-default)' }}>|</span>
                  {(['all', 'overdue', 'today', 'week'] as const).map((d) => (
                    <button key={d} onClick={() => setCheckDueFilter(d)}
                      className="px-2.5 py-1 rounded text-[11px] capitalize transition-colors"
                      style={{
                        background: checkDueFilter === d ? 'var(--bg-elevated)' : 'transparent',
                        color: checkDueFilter === d ? 'var(--text-primary)' : 'var(--text-muted)',
                        border: `1px solid ${checkDueFilter === d ? 'var(--border-default)' : 'transparent'}`,
                      }}>
                      {d === 'all' ? 'Any due' : d.charAt(0).toUpperCase() + d.slice(1)}
                    </button>
                  ))}
                </span>
              </div>
            </div>
          </Card>

          {/* Client sections */}
          {itemsLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}</div>
          ) : checklistByClient.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No tasks found"
              description={checkSearch || checkPriorityFilter.length ? 'Try adjusting filters' : 'Add your first task'}
              action={!checkSearch && !checkPriorityFilter.length ? { label: 'Add Task', onClick: () => setItemModal({ open: true, item: null }) } : undefined} />
          ) : (
            <div className="space-y-3">
              {checklistByClient.map(({ clientId, clientName, pendingItems, doneItems }) => (
                <ClientSection
                  key={clientId}
                  clientId={clientId}
                  clientName={clientName}
                  pendingItems={pendingItems}
                  doneItems={doneItems}
                  navigate={navigate}
                  currentUserId={profile?.id ?? ''}
                  isAdmin={isAdmin}
                  onToggle={toggleItemDone}
                  onEdit={(item) => setItemModal({ open: true, item: item as ChecklistItem })}
                  onDelete={deleteItem}
                  openMenuId={openMenuId}
                  setOpenMenuId={setOpenMenuId}
                  onQuickAdd={(cid) => setItemModal({ open: true, item: null, preClientId: cid })}
                />
              ))}
            </div>
          )}

          {/* Mobile FAB */}
          <button className="fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl z-20 md:hidden"
            style={{ background: 'var(--gold-primary)', color: '#0A0A0A' }}
            onClick={() => setItemModal({ open: true, item: null })}>
            <Plus size={22} />
          </button>
        </>
      )}

      {/* Modals */}
      <LogWorkModal
        isOpen={logModal.open}
        onClose={() => setLogModal({ open: false, log: null })}
        log={logModal.log}
        clients={clients}
        currentUserId={profile?.id ?? ''}
        preselectedClientId={logModal.preClientId}
        onSaved={() => { fetchLogs(); setLogModal({ open: false, log: null }) }}
      />
      <ChecklistItemModal
        isOpen={itemModal.open}
        onClose={() => setItemModal({ open: false, item: null })}
        item={itemModal.item}
        clients={clients}
        profiles={profiles}
        currentUserId={profile?.id ?? ''}
        preselectedClientId={itemModal.preClientId}
        onSaved={() => { fetchItems(); setItemModal({ open: false, item: null }) }}
      />
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function getInitials(name?: string | null, override?: string | null): string {
  if (override) return override
  return name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() ?? '?'
}

function LogRow({ log, currentUserId, isAdmin, onEdit, onDelete, navigate }: {
  log: EnrichedLog
  currentUserId: string
  isAdmin: boolean
  onEdit: (log: EnrichedLog) => void
  onDelete: (log: EnrichedLog) => void
  navigate: ReturnType<typeof useNavigate>
}) {
  const client = log.client as { id?: string; name?: string } | null
  const deal = log.deal as { id?: string; title?: string } | null
  const prof = log.profile as { full_name?: string; avatar_initials?: string } | null
  const initials = getInitials(prof?.full_name, prof?.avatar_initials)
  const canEdit = log.logged_by === currentUserId || isAdmin

  return (
    <div className="flex items-center gap-4 px-5 py-3"
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
      <span className="text-xs w-20 flex-shrink-0" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-muted)' }}>
        {formatDate(log.worked_on)}
      </span>
      <div className="flex items-center gap-2 w-36 flex-shrink-0">
        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-semibold flex-shrink-0"
          style={{ background: 'var(--gold-muted)', color: 'var(--gold-primary)', fontFamily: 'DM Mono, monospace' }}>
          {initials}
        </div>
        <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{prof?.full_name ?? '—'}</span>
      </div>
      <button className="text-xs w-28 truncate text-left flex-shrink-0"
        style={{ color: 'var(--text-secondary)' }}
        onClick={() => client?.id && navigate(`/clients/${client.id}`)}>
        {client?.name ?? '—'}
      </button>
      <button className="text-xs w-24 truncate text-left flex-shrink-0"
        style={{ color: 'var(--text-muted)' }}
        onClick={() => deal?.id && navigate(`/deals/${deal.id}`)}>
        {deal?.title ?? '—'}
      </button>
      <span className="text-sm font-medium truncate flex-1 min-w-0" style={{ color: 'var(--text-primary)' }}>{log.title}</span>
      <div className="flex-shrink-0"><WorkCategoryBadge category={log.category} /></div>
      <span className="text-xs w-16 text-right flex-shrink-0" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-muted)' }}>
        {log.duration_minutes ? formatDuration(log.duration_minutes) : '—'}
      </span>
      {canEdit && (
        <div className="flex items-center gap-1 flex-shrink-0 w-20">
          <button onClick={() => onEdit(log)} className="text-xs px-2 py-1 rounded" style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}>Edit</button>
          <button onClick={() => onDelete(log)} className="text-xs px-2 py-1 rounded" style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--status-red)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}>Del</button>
        </div>
      )}
    </div>
  )
}

function LogCard({ log, currentUserId, isAdmin, onEdit, onDelete }: {
  log: EnrichedLog
  currentUserId: string
  isAdmin: boolean
  onEdit: (log: EnrichedLog) => void
  onDelete: (log: EnrichedLog) => void
}) {
  const client = log.client as { id?: string; name?: string } | null
  const prof = log.profile as { full_name?: string; avatar_initials?: string } | null
  const initials = getInitials(prof?.full_name, prof?.avatar_initials)
  const canEdit = log.logged_by === currentUserId || isAdmin

  return (
    <div className="rounded-lg p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-semibold flex-shrink-0 mt-0.5"
            style={{ background: 'var(--gold-muted)', color: 'var(--gold-primary)', fontFamily: 'DM Mono, monospace' }}>
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{log.title}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {client?.name ?? '—'} · {formatDate(log.worked_on)}
            </p>
          </div>
        </div>
        <WorkCategoryBadge category={log.category} />
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-muted)' }}>
          {log.duration_minutes ? formatDuration(log.duration_minutes) : '—'}
        </span>
        {canEdit && (
          <div className="flex gap-1">
            <button onClick={() => onEdit(log)} className="text-xs px-2 py-1 rounded"
              style={{ color: 'var(--text-muted)', border: '1px solid var(--border-default)' }}>Edit</button>
            <button onClick={() => onDelete(log)} className="text-xs px-2 py-1 rounded"
              style={{ color: 'var(--status-red)', border: '1px solid rgba(224,82,82,0.2)' }}>Delete</button>
          </div>
        )}
      </div>
    </div>
  )
}

function ClientSection({ clientId, clientName, pendingItems, doneItems, navigate, currentUserId, isAdmin, onToggle, onEdit, onDelete, openMenuId, setOpenMenuId, onQuickAdd }: {
  clientId: string
  clientName: string
  pendingItems: EnrichedItem[]
  doneItems: EnrichedItem[]
  navigate: ReturnType<typeof useNavigate>
  currentUserId: string
  isAdmin: boolean
  onToggle: (item: EnrichedItem) => void
  onEdit: (item: EnrichedItem) => void
  onDelete: (item: EnrichedItem) => void
  openMenuId: string | null
  setOpenMenuId: (id: string | null) => void
  onQuickAdd: (clientId: string) => void
}) {
  const hasAnyPending = pendingItems.length > 0
  const [expanded, setExpanded] = useState(hasAnyPending)
  const [showDone, setShowDone] = useState(false)
  const total = pendingItems.length + doneItems.length
  const donePct = total > 0 ? Math.round((doneItems.length / total) * 100) : 0
  const initials = clientName.slice(0, 2).toUpperCase()

  return (
    <Card className="overflow-hidden">
      <button onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
        style={{ borderBottom: expanded ? '1px solid var(--border-subtle)' : 'none' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
            style={{ background: 'var(--gold-muted)', color: 'var(--gold-primary)', fontFamily: 'DM Mono, monospace' }}>
            {initials}
          </div>
          <div>
            <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{clientName}</h3>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {pendingItems.length} pending · {doneItems.length} done
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2">
            <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${donePct}%`, background: 'var(--gold-primary)' }} />
            </div>
            <span className="text-[10px]" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-muted)' }}>{donePct}%</span>
          </div>
          {expanded
            ? <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
            : <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />}
        </div>
      </button>

      {expanded && (
        <div>
          {pendingItems.length === 0 && doneItems.length > 0 && (
            <p className="px-5 py-4 text-xs text-center" style={{ color: 'var(--text-muted)' }}>All tasks completed!</p>
          )}
          {pendingItems.map((item) => (
            <ChecklistItemRow
              key={item.id}
              item={item}
              navigate={navigate}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
              openMenuId={openMenuId}
              setOpenMenuId={setOpenMenuId}
            />
          ))}

          {doneItems.length > 0 && (
            <div>
              <button onClick={() => setShowDone((s) => !s)}
                className="w-full flex items-center gap-2 px-5 py-2.5 text-xs"
                style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)' }}>
                {showDone ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                {doneItems.length} completed
              </button>
              {showDone && doneItems.map((item) => (
                <ChecklistItemRow
                  key={item.id}
                  item={item}
                  navigate={navigate}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                  onToggle={onToggle}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  openMenuId={openMenuId}
                  setOpenMenuId={setOpenMenuId}
                />
              ))}
            </div>
          )}

          <div className="px-5 py-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <button onClick={() => onQuickAdd(clientId)}
              className="flex items-center gap-1.5 text-xs transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--gold-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}>
              <Plus size={12} /> Add task
            </button>
          </div>
        </div>
      )}
    </Card>
  )
}

function ChecklistItemRow({ item, navigate, currentUserId, isAdmin, onToggle, onEdit, onDelete, openMenuId, setOpenMenuId }: {
  item: EnrichedItem
  navigate: ReturnType<typeof useNavigate>
  currentUserId: string
  isAdmin: boolean
  onToggle: (item: EnrichedItem) => void
  onEdit: (item: EnrichedItem) => void
  onDelete: (item: EnrichedItem) => void
  openMenuId: string | null
  setOpenMenuId: (id: string | null) => void
}) {
  const assignee = item.assignee as { full_name?: string; avatar_initials?: string } | null
  const assigneeInitials = getInitials(assignee?.full_name, assignee?.avatar_initials)
  const deal = item.deal as { id?: string; title?: string } | null
  const priorityColor = PRIORITY_COLORS[item.priority]
  const canModify = item.assigned_to === currentUserId || item.created_by === currentUserId || isAdmin

  let dueDateColor = 'var(--text-muted)'
  if (item.due_date && !item.is_done) {
    const d = parseISO(item.due_date)
    if (isToday(d)) dueDateColor = 'var(--status-yellow)'
    else if (isBefore(d, new Date())) dueDateColor = 'var(--status-red)'
  }

  return (
    <div className="flex items-center gap-3 px-5 py-3 group relative"
      style={{ borderTop: '1px solid var(--border-subtle)' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
      {/* Checkbox */}
      <button onClick={() => onToggle(item)}
        className="w-4 h-4 rounded flex-shrink-0 border flex items-center justify-center transition-all"
        style={{
          borderColor: item.is_done ? 'var(--gold-primary)' : 'var(--border-default)',
          background: item.is_done ? 'var(--gold-primary)' : 'transparent',
        }}>
        {item.is_done && <Check size={9} style={{ color: '#0A0A0A' }} />}
      </button>

      {/* Priority dot */}
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: priorityColor }} />

      {/* Title */}
      <span className="flex-1 text-sm min-w-0 truncate"
        style={{
          color: item.is_done ? 'var(--text-muted)' : 'var(--text-primary)',
          textDecoration: item.is_done ? 'line-through' : 'none',
        }}>
        {item.title}
      </span>

      {/* Deal tag */}
      {deal?.title && (
        <button onClick={() => deal.id && navigate(`/deals/${deal.id}`)}
          className="text-[10px] px-1.5 py-0.5 rounded hidden md:block flex-shrink-0"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
          {deal.title.length > 16 ? `${deal.title.slice(0, 16)}…` : deal.title}
        </button>
      )}

      {/* Due date */}
      {item.due_date && (
        <span className="text-[10px] flex-shrink-0 hidden md:block"
          style={{ fontFamily: 'DM Mono, monospace', color: dueDateColor }}>
          {formatDate(item.due_date)}
        </span>
      )}

      {/* Assignee avatar */}
      {assignee && (
        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold flex-shrink-0"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
          {assigneeInitials}
        </div>
      )}

      {/* Three-dot menu */}
      {canModify && (
        <div className="relative flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === item.id ? null : item.id) }}
            className="w-6 h-6 rounded flex items-center justify-center transition-opacity"
            style={{ color: 'var(--text-muted)', opacity: openMenuId === item.id ? 1 : undefined }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={(e) => { if (openMenuId !== item.id) e.currentTarget.style.opacity = '0' }}>
            <MoreVertical size={12} />
          </button>
          {openMenuId === item.id && (
            <div className="absolute right-0 top-7 z-20 rounded-lg shadow-xl py-1 min-w-[96px]"
              style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-default)' }}>
              <button onClick={(e) => { e.stopPropagation(); onEdit(item); setOpenMenuId(null) }}
                className="w-full text-left px-3 py-2 text-xs"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                Edit
              </button>
              <button onClick={(e) => { e.stopPropagation(); onDelete(item); setOpenMenuId(null) }}
                className="w-full text-left px-3 py-2 text-xs"
                style={{ color: 'var(--status-red)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(224,82,82,0.08)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
