import { useEffect, useState, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  createColumnHelper, type SortingState,
} from '@tanstack/react-table'
import { Plus, LayoutGrid, List, MoreHorizontal, GripVertical, ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { useIsMobile } from '@/hooks/useIsMobile'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activityLogger'
import { useAuth } from '@/store/authStore'
import { formatCurrency, formatDate, formatDaysUntil } from '@/lib/formatters'
import type { Deal, Client, Profile, DealStage } from '@/types'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Table from '@/components/ui/Table'
import Badge, { DealStageBadge } from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonRow } from '@/components/ui/Skeleton'
import DealFormModal from '@/components/modules/DealFormModal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useRealtimeSync } from '@/hooks/useRealtimeSync'
import toast from 'react-hot-toast'
import { Briefcase } from 'lucide-react'

type ViewMode = 'kanban' | 'table'

type EnrichedDeal = Deal & { client?: Client; assigned_profile?: Profile }

const STAGES: DealStage[] = ['proposal', 'won', 'lost']

const STAGE_LABELS: Record<DealStage, string> = {
  proposal: 'Proposal',
  won: 'Won',
  lost: 'Lost',
}

const STAGE_COLORS: Record<DealStage, { text: string; bg: string; border: string }> = {
  proposal: { text: 'var(--status-blue)',  bg: 'rgba(74,144,217,0.06)',  border: 'rgba(74,144,217,0.15)' },
  won:      { text: 'var(--status-green)', bg: 'rgba(76,175,125,0.08)',  border: 'rgba(76,175,125,0.2)' },
  lost:     { text: 'var(--status-red)',   bg: 'rgba(224,82,82,0.06)',   border: 'rgba(224,82,82,0.15)' },
}

const helper = createColumnHelper<EnrichedDeal>()

function dealValueDisplay(deal: EnrichedDeal) {
  if (deal.deal_type === 'retainer' && deal.retainer_amount != null) {
    return `${formatCurrency(deal.retainer_amount, deal.currency)}/mo`
  }
  return formatCurrency(deal.value, deal.currency)
}

export default function DealsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { profile } = useAuth()

  const [deals, setDeals] = useState<EnrichedDeal[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<ViewMode>('kanban')
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState(searchParams.get('stage') ?? '')
  const [assignedFilter, setAssignedFilter] = useState('')
  const [sorting, setSorting] = useState<SortingState>([])
  const [showModal, setShowModal] = useState(false)
  const [editDeal, setEditDeal] = useState<Deal | null>(null)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null)

  const dragId = useRef<string | null>(null)
  const [dragOver, setDragOver] = useState<DealStage | null>(null)
  const [mobileStageIdx, setMobileStageIdx] = useState(0)
  const [moveMenuOpen, setMoveMenuOpen] = useState<string | null>(null)
  const isMobile = useIsMobile()

  useEffect(() => {
    fetchDeals()
    fetchClients()
    fetchProfiles()
  }, [])

  const { flashId, flashType } = useRealtimeSync('deals', fetchDeals, {
    getToastMessage: (p) => {
      if (p.eventType === 'INSERT') return `New deal: "${(p.new?.title as string) ?? 'Unknown'}"`
      if (p.eventType === 'UPDATE' && p.new?.stage !== p.old?.stage)
        return `Deal moved to ${(p.new?.stage as string) ?? 'new stage'}`
      return null
    },
  })

  async function fetchClients() {
    const { data } = await supabase.from('clients').select('id, name, company').eq('status', 'active')
    setClients((data ?? []) as Client[])
  }

  async function fetchProfiles() {
    const { data } = await supabase.from('profiles').select('*').eq('is_active', true)
    setProfiles((data ?? []) as Profile[])
  }

  async function fetchDeals() {
    setLoading(true)
    const { data, error } = await supabase
      .from('deals')
      .select('*, client:client_id(id, name, company), assigned_profile:assigned_to(id, full_name, avatar_initials)')
      .order('created_at', { ascending: false })

    if (error) { toast.error('Failed to load deals'); setLoading(false); return }
    setDeals((data ?? []) as EnrichedDeal[])
    setLoading(false)
  }

  async function updateDealStage(dealId: string, newStage: DealStage) {
    setDeals((prev) => prev.map((d) => d.id === dealId ? { ...d, stage: newStage } : d))
    const { error } = await supabase.from('deals').update({ stage: newStage }).eq('id', dealId)
    if (error) {
      toast.error('Failed to update stage')
      fetchDeals()
      return
    }
    await logActivity({ entity_type: 'deal', entity_id: dealId, action: 'status_change', description: `Moved deal to ${STAGE_LABELS[newStage]}` })
    toast.success(`Moved to ${STAGE_LABELS[newStage]}`)
  }

  async function deleteDeal(dealId: string, title: string) {
    await supabase.from('deals').delete().eq('id', dealId)
    await logActivity({ entity_type: 'deal', entity_id: dealId, action: 'delete', description: `Deleted deal "${title}"` })
    toast.success('Deal deleted')
    fetchDeals()
  }

  const filtered = useMemo(() => {
    return deals.filter((d) => {
      const q = search.toLowerCase()
      const client = d.client as { name?: string; company?: string } | undefined
      const matchSearch = !q || d.title.toLowerCase().includes(q) || (client?.name ?? '').toLowerCase().includes(q)
      const matchStage = !stageFilter || d.stage === stageFilter
      const matchAssigned = !assignedFilter || d.assigned_to === assignedFilter
      return matchSearch && matchStage && matchAssigned
    })
  }, [deals, search, stageFilter, assignedFilter])

  const columns_by_stage = useMemo(() => {
    return STAGES.map((stage) => ({
      stage,
      deals: filtered.filter((d) => d.stage === stage),
      total: filtered.filter((d) => d.stage === stage).reduce((s, d) => s + Number(d.value), 0),
    }))
  }, [filtered])

  const tableColumns = useMemo(() => [
    helper.display({
      id: 'title',
      header: 'Deal',
      cell: ({ row }) => {
        const client = row.original.client as { name?: string } | undefined
        return (
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{row.original.title}</p>
              {row.original.deal_type === 'retainer' && <Badge variant="gold" size="sm">Retainer</Badge>}
            </div>
            {client?.name && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{client.name}</p>}
          </div>
        )
      },
    }),
    helper.accessor('stage', {
      header: 'Stage',
      cell: ({ getValue }) => <DealStageBadge stage={getValue()} />,
    }),
    helper.display({
      id: 'value',
      header: 'Value',
      cell: ({ row }) => {
        const deal = row.original
        return (
          <div>
            <span style={{ fontFamily: 'DM Mono, monospace', color: 'var(--gold-primary)', fontSize: '13px' }}>
              {dealValueDisplay(deal)}
            </span>
            {deal.deal_type === 'retainer' && deal.retainer_start_date && (
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                {format(new Date(deal.retainer_start_date), 'MMM yyyy')} →{' '}
                {deal.retainer_end_date ? format(new Date(deal.retainer_end_date), 'MMM yyyy') : 'ongoing'}
              </p>
            )}
          </div>
        )
      },
    }),
    helper.display({
      id: 'assigned',
      header: 'Assigned',
      cell: ({ row }) => {
        const ap = row.original.assigned_profile as Profile | undefined
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
    helper.accessor('end_date', {
      header: 'Deadline',
      cell: ({ getValue }) => {
        const v = getValue()
        if (!v) return <span style={{ color: 'var(--text-muted)' }}>—</span>
        const rel = formatDaysUntil(v)
        const isOverdue = rel.includes('overdue')
        return (
          <div>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{formatDate(v)}</p>
            <p className="text-[10px]" style={{ color: isOverdue ? 'var(--status-red)' : 'var(--text-muted)' }}>{rel}</p>
          </div>
        )
      },
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
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}>
            <MoreHorizontal size={15} />
          </button>
          {menuOpen === row.original.id && (
            <div className="absolute right-0 top-8 w-40 rounded shadow-lg z-10 py-1"
              style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-default)' }}>
              {[
                { label: 'View', danger: false, action: () => { navigate(`/deals/${row.original.id}`); setMenuOpen(null) } },
                { label: 'Edit', danger: false, action: () => { setEditDeal(row.original); setShowModal(true); setMenuOpen(null) } },
                { label: 'Move to Won', danger: false, action: () => { updateDealStage(row.original.id, 'won'); setMenuOpen(null) } },
                { label: 'Move to Lost', danger: false, action: () => { updateDealStage(row.original.id, 'lost'); setMenuOpen(null) } },
                { label: 'Delete', danger: true, action: () => { setDeleteTarget({ id: row.original.id, title: row.original.title }); setMenuOpen(null) } },
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
    columns: tableColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const mobileStage = STAGES[mobileStageIdx]
  const mobileStageDeals = filtered.filter((d) => d.stage === mobileStage)

  return (
    <div className="space-y-4" onClick={() => { setMenuOpen(null); setMoveMenuOpen(null) }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 md:gap-4">
          <h1 className="text-lg md:text-xl font-medium" style={{ color: 'var(--text-primary)' }}>Deals</h1>
          <span className="text-xs hidden md:block" style={{ color: 'var(--text-muted)' }}>
            <span style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-primary)' }}>{deals.length}</span> total
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex rounded overflow-hidden" style={{ border: '1px solid var(--border-default)' }}>
            {(['kanban', 'table'] as ViewMode[]).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className="px-3 py-1.5 flex items-center gap-1.5 text-xs transition-colors"
                style={{
                  background: view === v ? 'var(--gold-muted)' : 'transparent',
                  color: view === v ? 'var(--gold-primary)' : 'var(--text-muted)',
                }}>
                {v === 'kanban' ? <LayoutGrid size={13} /> : <List size={13} />}
                {v === 'kanban' ? 'Pipeline' : 'List'}
              </button>
            ))}
          </div>
          <Button onClick={() => { setEditDeal(null); setShowModal(true) }} className="hidden md:flex">
            <Plus size={14} /> New Deal
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex items-center gap-2 md:gap-3 px-4 py-3">
          <input placeholder="Search deals…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-3 py-2 rounded text-sm outline-none"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--gold-primary)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-default)')} />
          <div className="hidden md:flex items-center gap-2">
            <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}
              className="px-3 py-2 rounded text-sm outline-none"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: stageFilter ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              <option value="">All stages</option>
              {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
            </select>
            <select value={assignedFilter} onChange={(e) => setAssignedFilter(e.target.value)}
              className="px-3 py-2 rounded text-sm outline-none"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: assignedFilter ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              <option value="">All team members</option>
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          </div>
        </div>
      </Card>

      {/* MOBILE KANBAN */}
      {isMobile && (
        <div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-3" style={{ scrollbarWidth: 'none' }}>
            {STAGES.map((s, i) => {
              const colors = STAGE_COLORS[s]
              const isActive = i === mobileStageIdx
              return (
                <button key={s} onClick={() => setMobileStageIdx(i)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0"
                  style={{
                    background: isActive ? colors.bg : 'var(--bg-elevated)',
                    color: isActive ? colors.text : 'var(--text-muted)',
                    border: `1px solid ${isActive ? colors.border : 'var(--border-subtle)'}`,
                  }}>
                  {STAGE_LABELS[s]} ({filtered.filter(d => d.stage === s).length})
                </button>
              )
            })}
          </div>

          <div className="flex items-center justify-between mb-2">
            <button onClick={() => setMobileStageIdx(i => Math.max(0, i - 1))} disabled={mobileStageIdx === 0}
              className="w-9 h-9 rounded flex items-center justify-center disabled:opacity-30"
              style={{ color: 'var(--text-muted)' }}>
              <ChevronLeft size={18} />
            </button>
            <p className="text-xs" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-muted)' }}>
              {mobileStageDeals.length} deal{mobileStageDeals.length !== 1 ? 's' : ''}
            </p>
            <button onClick={() => setMobileStageIdx(i => Math.min(STAGES.length - 1, i + 1))} disabled={mobileStageIdx === STAGES.length - 1}
              className="w-9 h-9 rounded flex items-center justify-center disabled:opacity-30"
              style={{ color: 'var(--text-muted)' }}>
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="space-y-2">
            {mobileStageDeals.length === 0 ? (
              <p className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>No deals in this stage</p>
            ) : mobileStageDeals.map((deal) => {
              const client = deal.client as { name?: string } | undefined
              const colors = STAGE_COLORS[deal.stage]
              return (
                <div key={deal.id}
                  className="rounded-lg p-4"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
                  onClick={() => navigate(`/deals/${deal.id}`)}>
                  {client?.name && <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{client.name}</p>}
                  <div className="flex items-center gap-2 mb-2">
                    <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{deal.title}</p>
                    {deal.deal_type === 'retainer' && <Badge variant="gold" size="sm">Retainer</Badge>}
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span style={{ fontFamily: 'DM Mono, monospace', color: colors.text, fontSize: '13px' }}>
                        {dealValueDisplay(deal)}
                      </span>
                      {deal.deal_type === 'retainer' && deal.retainer_start_date && (
                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          {format(new Date(deal.retainer_start_date), 'MMM yyyy')} → {deal.retainer_end_date ? format(new Date(deal.retainer_end_date), 'MMM yyyy') : 'ongoing'}
                        </p>
                      )}
                    </div>
                    <div className="relative" onClick={(e) => e.stopPropagation()}>
                      <button onClick={(e) => { e.stopPropagation(); setMoveMenuOpen(moveMenuOpen === deal.id ? null : deal.id) }}
                        className="px-3 py-1.5 rounded text-xs"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-muted)' }}>
                        Move ▾
                      </button>
                      {moveMenuOpen === deal.id && (
                        <div className="absolute right-0 bottom-9 w-36 rounded shadow-lg z-20 py-1"
                          style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-default)' }}>
                          {STAGES.filter(s => s !== deal.stage).map((s) => (
                            <button key={s} onClick={() => { updateDealStage(deal.id, s); setMoveMenuOpen(null) }}
                              className="w-full text-left px-3 py-2 text-xs"
                              style={{ color: STAGE_COLORS[s].text }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-elevated)' }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                              {STAGE_LABELS[s]}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* DESKTOP KANBAN VIEW */}
      {!isMobile && view === 'kanban' && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {columns_by_stage.map(({ stage, deals: stageDeals, total }) => {
            const colors = STAGE_COLORS[stage]
            const isDropTarget = dragOver === stage
            return (
              <div key={stage}
                className="flex-shrink-0 w-64 rounded-lg flex flex-col"
                style={{
                  background: isDropTarget ? colors.bg : 'var(--bg-surface)',
                  border: `1px solid ${isDropTarget ? colors.border : 'var(--border-subtle)'}`,
                  minHeight: '300px',
                  transition: 'all 0.15s',
                }}
                onDragOver={(e) => { e.preventDefault(); setDragOver(stage) }}
                onDragLeave={() => setDragOver(null)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOver(null)
                  if (dragId.current) updateDealStage(dragId.current, stage)
                  dragId.current = null
                }}>
                <div className="px-3 py-3" style={{ borderBottom: `1px solid ${colors.border}` }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: colors.text }}>
                      {STAGE_LABELS[stage]}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                      style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}>
                      {stageDeals.length}
                    </span>
                  </div>
                  {stageDeals.length > 0 && (
                    <p className="text-xs mt-1" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-muted)' }}>
                      {formatCurrency(total)}
                    </p>
                  )}
                </div>

                <div className="flex-1 p-2 space-y-2">
                  {stageDeals.map((deal) => {
                    const client = deal.client as { name?: string } | undefined
                    const ap = deal.assigned_profile as Profile | undefined
                    const initials = ap ? (ap.avatar_initials ?? ap.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()) : null
                    return (
                      <div key={deal.id}
                        draggable
                        onDragStart={() => { dragId.current = deal.id }}
                        onDragEnd={() => { dragId.current = null; setDragOver(null) }}
                        onClick={() => navigate(`/deals/${deal.id}`)}
                        className="rounded p-3 cursor-pointer group relative"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = colors.border)}
                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}>
                        <GripVertical size={12}
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ color: 'var(--text-muted)' }} />
                        {client?.name && (
                          <p className="text-[10px] uppercase tracking-wider mb-1 truncate" style={{ color: 'var(--text-muted)' }}>
                            {client.name}
                          </p>
                        )}
                        <div className="flex items-center gap-1.5 mb-2">
                          <p className="text-sm font-medium leading-snug" style={{ color: 'var(--text-primary)' }}>
                            {deal.title}
                          </p>
                          {deal.deal_type === 'retainer' && <Badge variant="gold" size="sm">Ret.</Badge>}
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <span style={{ fontFamily: 'DM Mono, monospace', color: colors.text, fontSize: '13px', fontWeight: 500 }}>
                              {dealValueDisplay(deal)}
                            </span>
                            {deal.deal_type === 'retainer' && deal.retainer_start_date && (
                              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                {format(new Date(deal.retainer_start_date), 'MMM yy')} → {deal.retainer_end_date ? format(new Date(deal.retainer_end_date), 'MMM yy') : '∞'}
                              </p>
                            )}
                          </div>
                          {initials && (
                            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold"
                              style={{ background: 'var(--bg-overlay)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}>
                              {initials}
                            </div>
                          )}
                        </div>
                        {deal.end_date && (
                          <p className="text-[10px] mt-1.5" style={{ color: formatDaysUntil(deal.end_date).includes('overdue') ? 'var(--status-red)' : 'var(--text-muted)' }}>
                            {formatDaysUntil(deal.end_date)}
                          </p>
                        )}

                        <div className="mt-2 pt-2 flex justify-end" style={{ borderTop: '1px solid var(--border-subtle)' }}
                          onClick={(e) => e.stopPropagation()}>
                          <button onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === deal.id ? null : deal.id) }}
                            className="p-1 rounded" style={{ color: 'var(--text-muted)' }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}>
                            <MoreHorizontal size={13} />
                          </button>
                          {menuOpen === deal.id && (
                            <div className="absolute bottom-8 right-2 w-36 rounded shadow-lg z-20 py-1"
                              style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-default)' }}>
                              {[
                                { label: 'View', action: () => { navigate(`/deals/${deal.id}`); setMenuOpen(null) }, danger: false },
                                { label: 'Edit', action: () => { setEditDeal(deal); setShowModal(true); setMenuOpen(null) }, danger: false },
                                { label: 'Move to Won', action: () => { updateDealStage(deal.id, 'won'); setMenuOpen(null) }, danger: false },
                                { label: 'Move to Lost', action: () => { updateDealStage(deal.id, 'lost'); setMenuOpen(null) }, danger: false },
                                { label: 'Delete', danger: true, action: () => { setDeleteTarget({ id: deal.id, title: deal.title }); setMenuOpen(null) } },
                              ].map(({ label, action, danger }) => (
                                <button key={label} onClick={action}
                                  className="w-full text-left px-3 py-1.5 text-xs"
                                  style={{ color: danger ? 'var(--status-red)' : 'var(--text-secondary)' }}
                                  onMouseEnter={(e) => { e.currentTarget.style.background = danger ? 'rgba(224,82,82,0.08)' : 'var(--bg-elevated)' }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                                  {label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {stageDeals.length === 0 && (
                    <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>Drop deals here</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* TABLE VIEW */}
      {!isMobile && view === 'table' && (
        <Card>
          {loading ? (
            <table className="w-full"><tbody>{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={7} />)}</tbody></table>
          ) : filtered.length === 0 ? (
            <EmptyState icon={Briefcase} title="No deals found"
              description={search || stageFilter ? 'Try adjusting your filters' : 'Create your first deal to get started'}
              action={!search && !stageFilter ? { label: 'New Deal', onClick: () => setShowModal(true) } : undefined} />
          ) : (
            <Table table={table} onRowClick={(row) => navigate(`/deals/${row.id}`)} flashId={flashId} flashType={flashType} />
          )}
        </Card>
      )}

      {/* Mobile FAB */}
      <button
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl z-20 md:hidden"
        style={{ background: 'var(--gold-primary)', color: '#0A0A0A' }}
        onClick={() => { setEditDeal(null); setShowModal(true) }}>
        <Plus size={22} />
      </button>

      <DealFormModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditDeal(null) }}
        deal={editDeal}
        clients={clients}
        profiles={profiles}
        currentUserId={profile?.id ?? ''}
        onSaved={() => { fetchDeals(); setShowModal(false); setEditDeal(null) }}
      />
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteDeal(deleteTarget.id, deleteTarget.title)}
        title={`Delete "${deleteTarget?.title}"?`}
        message="This cannot be undone."
      />
    </div>
  )
}
