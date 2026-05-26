import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activityLogger'
import { formatCurrency, formatDate } from '@/lib/formatters'
import type { Invoice, InvoiceItem, Client } from '@/types'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { InvoiceStatusBadge } from '@/components/ui/Badge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import Modal from '@/components/ui/Modal'
import toast from 'react-hot-toast'

type FullInvoice = Invoice & { client?: Client; items?: InvoiceItem[] }

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [invoice, setInvoice] = useState<FullInvoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [showPaidModal, setShowPaidModal] = useState(false)
  const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10))
  const [marking, setMarking] = useState(false)

  const fetchInvoice = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const [{ data: inv }, { data: items }] = await Promise.all([
      supabase.from('invoices').select('*, client:client_id(id, name, company, email, address, city, country, tax_id)').eq('id', id).single(),
      supabase.from('invoice_items').select('*').eq('invoice_id', id).order('sort_order'),
    ])
    if (inv) setInvoice({ ...(inv as FullInvoice), items: (items ?? []) as InvoiceItem[] })
    setLoading(false)
  }, [id])

  useEffect(() => { fetchInvoice() }, [fetchInvoice])

  async function markAsPaid() {
    if (!id || !invoice) return
    setMarking(true)
    const { error } = await supabase.from('invoices')
      .update({ status: 'paid', paid_at: new Date(paidDate).toISOString() })
      .eq('id', id)
    setMarking(false)
    if (error) { toast.error('Failed to update'); return }
    await logActivity({ entity_type: 'invoice', entity_id: id, action: 'payment', description: `Invoice ${invoice.invoice_number} paid` })
    toast.success('Invoice marked as paid')
    setShowPaidModal(false)
    fetchInvoice()
  }

  async function updateStatus(status: Invoice['status']) {
    if (!id || !invoice) return
    await supabase.from('invoices').update({ status }).eq('id', id)
    await logActivity({ entity_type: 'invoice', entity_id: id, action: 'update', description: `Invoice status changed to ${status}` })
    toast.success(`Status updated to ${status}`)
    fetchInvoice()
  }

  if (loading) return <div className="flex items-center justify-center py-24"><LoadingSpinner size="lg" /></div>
  if (!invoice) return <Card className="p-8 text-center"><p style={{ color: 'var(--text-muted)' }}>Invoice not found.</p></Card>

  const client = invoice.client as (Client & { tax_id?: string }) | undefined
  const items = invoice.items ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/invoices')} className="flex items-center gap-2 text-sm"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}>
          <ArrowLeft size={14} /> Back to Invoices
        </button>

        <div className="flex items-center gap-2">
          <button onClick={() => window.print()} className="flex items-center gap-2 text-xs px-3 py-1.5 rounded"
            style={{ color: 'var(--text-muted)', border: '1px solid var(--border-default)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}>
            <Printer size={13} /> Print
          </button>

          {invoice.status === 'draft' && (
            <>
              <Button size="sm" variant="secondary" onClick={() => navigate(`/invoices/new?edit=${id}`)}>Edit</Button>
              <Button size="sm" onClick={() => updateStatus('sent')}>Mark as Sent</Button>
            </>
          )}
          {(invoice.status === 'sent' || invoice.status === 'overdue') && (
            <>
              <Button size="sm" variant="secondary" onClick={() => updateStatus('cancelled')}>Cancel</Button>
              <Button size="sm" onClick={() => setShowPaidModal(true)}>Mark as Paid</Button>
            </>
          )}
          {invoice.status === 'paid' && (
            <Button size="sm" variant="secondary" onClick={() => navigate(`/invoices/new?duplicate=${id}`)}>Duplicate</Button>
          )}
        </div>
      </div>

      {/* Invoice document */}
      <div className="rounded-lg overflow-hidden print-area" style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderTop: '3px solid var(--gold-primary)',
        maxWidth: '800px',
        margin: '0 auto',
      }}>
        {/* Header */}
        <div className="px-8 py-6 flex items-start justify-between" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div>
            <h1 className="text-3xl font-light tracking-widest uppercase"
              style={{ fontFamily: 'Cormorant Garamond, serif', color: 'var(--gold-primary)' }}>
              Aurelius
            </h1>
            <p className="text-[10px] tracking-[0.3em] uppercase mt-0.5" style={{ color: 'var(--text-muted)' }}>Invoice</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-medium" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--gold-primary)' }}>
              {invoice.invoice_number}
            </p>
            <InvoiceStatusBadge status={invoice.status} />
            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
              Issued: {formatDate(invoice.issue_date)}
            </p>
            {invoice.due_date && (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Due: {formatDate(invoice.due_date)}
              </p>
            )}
            {invoice.paid_at && (
              <p className="text-xs mt-1" style={{ color: 'var(--status-green)' }}>
                Paid: {format(new Date(invoice.paid_at), 'dd MMM yyyy')}
              </p>
            )}
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* Bill To + Title */}
          <div className="grid grid-cols-2 gap-8">
            {client && (
              <div>
                <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Bill To</p>
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{client.name}</p>
                {client.company && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{client.company}</p>}
                {client.email && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{client.email}</p>}
                {client.address && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{client.address}, {client.city}</p>}
                {client.tax_id && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>OIB: {client.tax_id}</p>}
              </div>
            )}
            <div>
              <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Description</p>
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{invoice.title}</p>
            </div>
          </div>

          {/* Line items table */}
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                {['Description', 'Qty', 'Unit Price', 'Amount'].map((h, i) => (
                  <th key={h} className={`py-2 text-[10px] uppercase tracking-wider font-medium ${i > 0 ? 'text-right' : 'text-left'}`}
                    style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td className="py-3" style={{ color: 'var(--text-primary)' }}>{item.description}</td>
                  <td className="py-3 text-right" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-secondary)' }}>{item.quantity}</td>
                  <td className="py-3 text-right" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-secondary)' }}>{formatCurrency(item.unit_price, invoice.currency)}</td>
                  <td className="py-3 text-right" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-primary)' }}>{formatCurrency(item.amount, invoice.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-56 space-y-2">
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--text-muted)' }}>Subtotal</span>
                <span style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-secondary)' }}>{formatCurrency(invoice.subtotal, invoice.currency)}</span>
              </div>
              {invoice.tax_rate > 0 && (
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--text-muted)' }}>Tax ({invoice.tax_rate}%)</span>
                  <span style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-secondary)' }}>{formatCurrency(invoice.tax_amount, invoice.currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-semibold pt-2" style={{ borderTop: '1px solid var(--border-default)' }}>
                <span style={{ color: 'var(--text-primary)' }}>Total</span>
                <span style={{ fontFamily: 'DM Mono, monospace', color: 'var(--gold-primary)' }}>{formatCurrency(invoice.total, invoice.currency)}</span>
              </div>
            </div>
          </div>

          {invoice.notes && (
            <div className="pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Notes</p>
              <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{invoice.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Mark as Paid Modal */}
      <Modal isOpen={showPaidModal} onClose={() => setShowPaidModal(false)} title="Mark Invoice as Paid" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Payment Date
            </label>
            <input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded text-sm outline-none"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--gold-primary)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-default)')}
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setShowPaidModal(false)}>Cancel</Button>
            <Button loading={marking} onClick={markAsPaid}>Confirm Payment</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
