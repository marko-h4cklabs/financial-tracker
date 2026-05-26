import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Edit, Plus, Mail, Phone, MapPin, FileText, Briefcase } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/formatters'
import type { Client, Deal, Invoice, Installment, Expense, Profile } from '@/types'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { ClientStatusBadge, DealStageBadge, InvoiceStatusBadge, InstallmentStatusBadge, CategoryBadge } from '@/components/ui/Badge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ClientFormModal from '@/components/modules/ClientFormModal'

type Tab = 'overview' | 'deals' | 'invoices' | 'installments' | 'expenses' | 'notes'

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [client, setClient] = useState<Client | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [installments, setInstallments] = useState<Installment[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [showEditModal, setShowEditModal] = useState(false)
  const [notes, setNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  const fetchClient = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const [{ data: c }, { data: d }, { data: i }, { data: inst }, { data: e }, { data: p }] = await Promise.all([
      supabase.from('clients').select('*, assigned_profile:assigned_to(id, full_name)').eq('id', id).single(),
      supabase.from('deals').select('*, assigned_profile:assigned_to(id, full_name)').eq('client_id', id).order('created_at', { ascending: false }),
      supabase.from('invoices').select('*').eq('client_id', id).order('created_at', { ascending: false }),
      supabase.from('installments').select('*, deal:deal_id(title)').eq('client_id', id).order('due_date', { ascending: true }),
      supabase.from('expenses').select('*').eq('client_id', id).order('expense_date', { ascending: false }),
      supabase.from('profiles').select('*').eq('is_active', true),
    ])
    if (c) { setClient(c as Client); setNotes((c as Client).notes ?? '') }
    setDeals((d ?? []) as Deal[])
    setInvoices((i ?? []) as Invoice[])
    setInstallments((inst ?? []) as Installment[])
    setExpenses((e ?? []) as Expense[])
    setProfiles((p ?? []) as Profile[])
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
  const lifetimeValue = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + Number(i.total), 0)
  const pendingTotal = installments.filter((i) => i.status === 'pending' || i.status === 'overdue').reduce((s, i) => s + Number(i.amount), 0)
  const assignedProfile = client.assigned_profile as { full_name?: string } | undefined

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'deals', label: `Deals (${deals.length})` },
    { key: 'invoices', label: `Invoices (${invoices.length})` },
    { key: 'installments', label: `Installments (${installments.length})` },
    { key: 'expenses', label: `Expenses (${expenses.length})` },
    { key: 'notes', label: 'Notes' },
  ]

  return (
    <div className="space-y-5">
      <button onClick={() => navigate('/clients')} className="flex items-center gap-2 text-sm"
        style={{ color: 'var(--text-muted)' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}>
        <ArrowLeft size={14} /> Back to Clients
      </button>

      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-semibold"
              style={{ background: 'var(--gold-muted)', color: 'var(--gold-primary)', border: '2px solid var(--gold-dark)', fontFamily: 'DM Mono, monospace' }}>
              {initials}
            </div>
            <div>
              <h1 className="text-2xl font-light mb-1" style={{ fontFamily: 'Cormorant Garamond, serif', color: 'var(--text-primary)' }}>
                {client.name}
              </h1>
              <div className="flex items-center gap-3">
                {client.company && <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{client.company}</span>}
                <ClientStatusBadge status={client.status} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowEditModal(true)}><Edit size={13} /> Edit</Button>
            <Button size="sm" onClick={() => navigate(`/deals?client=${id}`)}><Plus size={13} /> New Deal</Button>
            <Button size="sm" variant="secondary" onClick={() => navigate(`/invoices/new?client=${id}`)}><FileText size={13} /> New Invoice</Button>
          </div>
        </div>
      </Card>

      <div className="flex gap-1" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        {tabs.map(({ key, label }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className="px-4 py-2.5 text-sm relative transition-colors"
            style={{ color: activeTab === key ? 'var(--gold-primary)' : 'var(--text-muted)' }}>
            {label}
            {activeTab === key && <span className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: 'var(--gold-primary)' }} />}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
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
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Lifetime Value</p>
              <p className="text-2xl font-light" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--gold-primary)' }}>{formatCurrency(lifetimeValue)}</p>
            </Card>
            <Card className="p-5">
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Pending Amount</p>
              <p className="text-2xl font-light" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--status-yellow)' }}>{formatCurrency(pendingTotal)}</p>
            </Card>
            <Card className="p-5">
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Client Since</p>
              <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{formatDate(client.created_at)}</p>
            </Card>
          </div>
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

      {activeTab === 'invoices' && (
        <Card>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Invoices</h3>
            <Button size="sm" onClick={() => navigate(`/invoices/new?client=${id}`)}><Plus size={13} /> New Invoice</Button>
          </div>
          {invoices.length === 0 ? <p className="px-5 py-8 text-sm text-center" style={{ color: 'var(--text-muted)' }}>No invoices yet</p> : (
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
                    <span style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-primary)', fontSize: '13px' }}>{formatCurrency(inv.total, inv.currency)}</span>
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

      {activeTab === 'notes' && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Notes</h3>
            {savingNotes && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Saving…</span>}
          </div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={saveNotes}
            placeholder="Add notes about this client…" rows={8}
            className="w-full px-3 py-2.5 rounded text-sm outline-none resize-y"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--gold-primary)')}
          />
        </Card>
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
    </div>
  )
}
