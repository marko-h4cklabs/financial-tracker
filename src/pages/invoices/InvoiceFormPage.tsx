import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2, ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activityLogger'
import { useAuth } from '@/store/authStore'
import { formatCurrency } from '@/lib/formatters'
import type { Client, Deal } from '@/types'
import { useIsMobile } from '@/hooks/useIsMobile'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import toast from 'react-hot-toast'

const lineItemSchema = z.object({
  description: z.string().min(1, 'Required'),
  quantity: z.coerce.number().min(0.01),
  unit_price: z.coerce.number().min(0),
})

const schema = z.object({
  title: z.string().min(1, 'Title is required'),
  client_id: z.string().optional(),
  deal_id: z.string().optional(),
  status: z.enum(['draft', 'sent']),
  issue_date: z.string().min(1),
  due_date: z.string().optional(),
  tax_rate: z.coerce.number().min(0).max(100).default(0),
  currency: z.string().default('EUR'),
  notes: z.string().optional(),
  items: z.array(lineItemSchema).min(1, 'Add at least one line item'),
})

type FormData = z.infer<typeof schema>

export default function InvoiceFormPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { profile } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [filteredDeals, setFilteredDeals] = useState<Deal[]>([])
  const [saving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const isMobile = useIsMobile()

  const { register, control, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      status: 'draft',
      issue_date: new Date().toISOString().slice(0, 10),
      tax_rate: 0,
      currency: 'EUR',
      client_id: searchParams.get('client') ?? '',
      deal_id: searchParams.get('deal') ?? '',
      items: [{ description: '', quantity: 1, unit_price: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const watchedItems = watch('items')
  const watchedTax = watch('tax_rate')
  const watchedCurrency = watch('currency')
  const watchedTitle = watch('title')
  const watchedIssueDate = watch('issue_date')
  const watchedDueDate = watch('due_date')
  const watchedClientId = watch('client_id')
  const watchedNotes = watch('notes')

  const subtotal = watchedItems.reduce((s, item) => s + (Number(item.quantity) * Number(item.unit_price)), 0)
  const taxAmount = subtotal * (Number(watchedTax) / 100)
  const total = subtotal + taxAmount

  useEffect(() => {
    supabase.from('clients').select('id, name, company').then(({ data }) => setClients((data ?? []) as Client[]))
    supabase.from('deals').select('id, title, client_id').then(({ data }) => setDeals((data ?? []) as Deal[]))
  }, [])

  useEffect(() => {
    if (watchedClientId) {
      setFilteredDeals(deals.filter((d) => d.client_id === watchedClientId))
    } else {
      setFilteredDeals(deals)
    }
  }, [watchedClientId, deals])

  const selectedClient = clients.find((c) => c.id === watchedClientId)

  const generateInvoiceNumber = () => `AUR-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`

  const onSubmit = async (data: FormData, asSent = false) => {
    setSaving(true)
    const invoiceNumber = generateInvoiceNumber()
    const taxAmt = subtotal * (data.tax_rate / 100)

    const { data: created, error } = await supabase.from('invoices').insert({
      invoice_number: invoiceNumber,
      client_id: data.client_id || null,
      deal_id: data.deal_id || null,
      title: data.title,
      status: asSent ? 'sent' : data.status,
      issue_date: data.issue_date,
      due_date: data.due_date || null,
      subtotal,
      tax_rate: data.tax_rate,
      tax_amount: taxAmt,
      total: subtotal + taxAmt,
      currency: data.currency,
      notes: data.notes || null,
      created_by: profile?.id ?? null,
    }).select().single()

    if (error || !created) { toast.error('Failed to create invoice'); setSaving(false); return }

    await supabase.from('invoice_items').insert(
      data.items.map((item, idx) => ({
        invoice_id: created.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.quantity * item.unit_price,
        sort_order: idx,
      }))
    )

    await logActivity({ entity_type: 'invoice', entity_id: created.id, action: 'create', description: `Created invoice ${invoiceNumber}` })
    toast.success(`Invoice ${invoiceNumber} created`)
    setSaving(false)
    navigate(`/invoices/${created.id}`)
  }

  return (
    <div className="space-y-4">
      <button onClick={() => navigate('/invoices')} className="flex items-center gap-2 text-sm"
        style={{ color: 'var(--text-muted)' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}>
        <ArrowLeft size={14} /> Back to Invoices
      </button>

      <h1 className="text-xl font-medium" style={{ color: 'var(--text-primary)' }}>New Invoice</h1>

      <form onSubmit={handleSubmit((d) => onSubmit(d, false))}>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          {/* LEFT — Form (60%) */}
          <div className="col-span-1 md:col-span-3 space-y-5">
            {/* Header section */}
            <div className="rounded-lg p-5 space-y-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <h3 className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Invoice Details</h3>
              <Input label="Title *" error={errors.title?.message} {...register('title')} />
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Status"
                  options={[{ value: 'draft', label: 'Draft' }, { value: 'sent', label: 'Sent' }]}
                  {...register('status')}
                />
                <Select
                  label="Currency"
                  options={[{ value: 'EUR', label: 'EUR (€)' }, { value: 'HRK', label: 'HRK (kn)' }, { value: 'USD', label: 'USD ($)' }]}
                  {...register('currency')}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Issue Date *" type="date" {...register('issue_date')} />
                <Input label="Due Date" type="date" {...register('due_date')} />
              </div>
            </div>

            {/* Client / Deal */}
            <div className="rounded-lg p-5 space-y-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <h3 className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Bill To</h3>
              <Select
                label="Client"
                placeholder="Select client"
                options={clients.map((c) => ({ value: c.id, label: c.company ? `${c.name} — ${c.company}` : c.name }))}
                {...register('client_id')}
              />
              <Select
                label="Deal (optional)"
                placeholder="No deal"
                options={filteredDeals.map((d) => ({ value: d.id, label: d.title }))}
                {...register('deal_id')}
              />
            </div>

            {/* Line Items */}
            <div className="rounded-lg p-5 space-y-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <h3 className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Line Items</h3>

              <div className="hidden md:grid grid-cols-12 gap-2 text-[10px] uppercase tracking-wider px-1" style={{ color: 'var(--text-muted)' }}>
                <div className="col-span-6">Description</div>
                <div className="col-span-2 text-right">Qty</div>
                <div className="col-span-2 text-right">Unit Price</div>
                <div className="col-span-1 text-right">Amount</div>
                <div className="col-span-1" />
              </div>

              {fields.map((field, idx) => {
                const qty = Number(watchedItems[idx]?.quantity ?? 0)
                const price = Number(watchedItems[idx]?.unit_price ?? 0)
                const amount = qty * price
                return isMobile ? (
                  <div key={field.id} className="rounded-lg p-3 space-y-2" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}>
                    <input
                      placeholder="Description"
                      {...register(`items.${idx}.description`)}
                      className="w-full px-2 py-2 rounded text-sm outline-none"
                      style={{ background: 'var(--bg-surface)', border: `1px solid ${errors.items?.[idx]?.description ? 'var(--status-red)' : 'var(--border-subtle)'}`, color: 'var(--text-primary)' }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--gold-primary)')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = errors.items?.[idx]?.description ? 'var(--status-red)' : 'var(--border-subtle)')}
                    />
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <p className="text-[9px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Qty</p>
                        <input
                          type="number" step="0.01" min="0"
                          {...register(`items.${idx}.quantity`)}
                          className="w-full px-2 py-1.5 rounded text-sm outline-none text-right"
                          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontFamily: 'DM Mono, monospace' }}
                          onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--gold-primary)')}
                          onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-[9px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Unit Price</p>
                        <input
                          type="number" step="0.01" min="0"
                          {...register(`items.${idx}.unit_price`)}
                          className="w-full px-2 py-1.5 rounded text-sm outline-none text-right"
                          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontFamily: 'DM Mono, monospace' }}
                          onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--gold-primary)')}
                          onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
                        />
                      </div>
                      <div className="text-right flex-shrink-0 pb-0.5">
                        <p className="text-[9px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Amount</p>
                        <p className="text-sm py-1.5" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--gold-primary)' }}>
                          {formatCurrency(amount, watchedCurrency)}
                        </p>
                      </div>
                      {fields.length > 1 && (
                        <button type="button" onClick={() => remove(idx)} className="flex-shrink-0 pb-2" style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--status-red)')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div key={field.id} className="grid grid-cols-12 gap-2 items-start">
                    <div className="col-span-6">
                      <input
                        placeholder="Description"
                        {...register(`items.${idx}.description`)}
                        className="w-full px-2 py-2 rounded text-sm outline-none"
                        style={{ background: 'var(--bg-elevated)', border: `1px solid ${errors.items?.[idx]?.description ? 'var(--status-red)' : 'var(--border-default)'}`, color: 'var(--text-primary)' }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--gold-primary)')}
                        onBlur={(e) => (e.currentTarget.style.borderColor = errors.items?.[idx]?.description ? 'var(--status-red)' : 'var(--border-default)')}
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number" step="0.01" min="0"
                        {...register(`items.${idx}.quantity`)}
                        className="w-full px-2 py-2 rounded text-sm outline-none text-right"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontFamily: 'DM Mono, monospace' }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--gold-primary)')}
                        onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-default)')}
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number" step="0.01" min="0"
                        {...register(`items.${idx}.unit_price`)}
                        className="w-full px-2 py-2 rounded text-sm outline-none text-right"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontFamily: 'DM Mono, monospace' }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--gold-primary)')}
                        onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-default)')}
                      />
                    </div>
                    <div className="col-span-1 py-2 text-right text-sm" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-secondary)' }}>
                      {formatCurrency(amount, watchedCurrency)}
                    </div>
                    <div className="col-span-1 flex justify-center pt-2">
                      {fields.length > 1 && (
                        <button type="button" onClick={() => remove(idx)} style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--status-red)')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}

              <button type="button" onClick={() => append({ description: '', quantity: 1, unit_price: 0 })}
                className="flex items-center gap-2 text-xs px-3 py-2 rounded transition-colors"
                style={{ color: 'var(--gold-primary)', border: '1px dashed var(--gold-dark)', background: 'var(--gold-muted)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(201,168,76,0.18)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--gold-muted)' }}>
                <Plus size={12} /> Add Line Item
              </button>
            </div>

            {/* Totals + Notes */}
            <div className="rounded-lg p-5 space-y-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex justify-end">
                <div className="w-full md:w-64 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'var(--text-muted)' }}>Subtotal</span>
                    <span style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-secondary)' }}>{formatCurrency(subtotal, watchedCurrency)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm gap-3">
                    <span style={{ color: 'var(--text-muted)' }}>Tax (%)</span>
                    <input type="number" min="0" max="100" step="0.5"
                      {...register('tax_rate')}
                      className="w-16 px-2 py-1 rounded text-sm outline-none text-right"
                      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontFamily: 'DM Mono, monospace' }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--gold-primary)')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-default)')}
                    />
                    <span style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-secondary)' }}>{formatCurrency(taxAmount, watchedCurrency)}</span>
                  </div>
                  <div className="flex justify-between text-base font-medium pt-2" style={{ borderTop: '1px solid var(--border-default)' }}>
                    <span style={{ color: 'var(--text-primary)' }}>Total</span>
                    <span style={{ fontFamily: 'DM Mono, monospace', color: 'var(--gold-primary)' }}>{formatCurrency(total, watchedCurrency)}</span>
                  </div>
                </div>
              </div>
              <Textarea label="Notes" rows={3} placeholder="Payment terms, bank details, thank-you note…" {...register('notes')} />
            </div>

            {/* Mobile preview toggle */}
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="md:hidden w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm transition-colors"
              style={{ border: '1px solid var(--border-default)', color: 'var(--text-secondary)', background: 'var(--bg-elevated)' }}>
              {showPreview ? <><EyeOff size={14} /> Hide Preview</> : <><Eye size={14} /> Show Preview</>}
            </button>

            {/* Actions */}
            <div className="flex flex-col md:flex-row md:justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => navigate('/invoices')}>Cancel</Button>
              <Button type="submit" variant="secondary" loading={saving}>Save as Draft</Button>
              <Button type="button" loading={saving}
                onClick={handleSubmit((d) => onSubmit(d, true))}>
                Mark as Sent
              </Button>
            </div>
          </div>

          {/* RIGHT — Live Preview (40%) */}
          <div className={`col-span-1 md:col-span-2 ${!showPreview ? 'hidden md:block' : ''}`}>
            <div className="sticky top-20">
              <p className="text-xs uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Preview</p>
              <div className="rounded-lg overflow-hidden" style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderTop: '3px solid var(--gold-primary)',
              }}>
                {/* Preview header */}
                <div className="px-6 py-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-xl font-light tracking-widest uppercase"
                        style={{ fontFamily: 'Cormorant Garamond, serif', color: 'var(--gold-primary)' }}>
                        Aurelius
                      </h2>
                      <p className="text-[9px] tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>Invoice</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--gold-primary)' }}>
                        AUR-{new Date().getFullYear()}-XXXX
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {watchedIssueDate ? format(new Date(watchedIssueDate), 'dd MMM yyyy') : '—'}
                      </p>
                      {watchedDueDate && (
                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          Due {format(new Date(watchedDueDate), 'dd MMM yyyy')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 space-y-4">
                  {/* Bill To */}
                  {selectedClient && (
                    <div>
                      <p className="text-[9px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Bill To</p>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{selectedClient.name}</p>
                      {selectedClient.company && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{selectedClient.company}</p>}
                    </div>
                  )}

                  {watchedTitle && (
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{watchedTitle}</p>
                  )}

                  {/* Line items preview */}
                  {watchedItems.length > 0 && (
                    <div>
                      <div className="grid grid-cols-12 gap-1 text-[9px] uppercase tracking-wider mb-2 px-1" style={{ color: 'var(--text-muted)' }}>
                        <div className="col-span-6">Item</div>
                        <div className="col-span-2 text-right">Qty</div>
                        <div className="col-span-2 text-right">Price</div>
                        <div className="col-span-2 text-right">Amt</div>
                      </div>
                      <div className="space-y-1">
                        {watchedItems.filter((i) => i.description).map((item, idx) => (
                          <div key={idx} className="grid grid-cols-12 gap-1 text-xs">
                            <div className="col-span-6 truncate" style={{ color: 'var(--text-primary)' }}>{item.description}</div>
                            <div className="col-span-2 text-right" style={{ color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace' }}>{item.quantity}</div>
                            <div className="col-span-2 text-right" style={{ color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace' }}>{formatCurrency(Number(item.unit_price), watchedCurrency)}</div>
                            <div className="col-span-2 text-right" style={{ color: 'var(--text-secondary)', fontFamily: 'DM Mono, monospace' }}>{formatCurrency(Number(item.quantity) * Number(item.unit_price), watchedCurrency)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Totals */}
                  <div className="space-y-1 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <div className="flex justify-between text-xs">
                      <span style={{ color: 'var(--text-muted)' }}>Subtotal</span>
                      <span style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-secondary)' }}>{formatCurrency(subtotal, watchedCurrency)}</span>
                    </div>
                    {Number(watchedTax) > 0 && (
                      <div className="flex justify-between text-xs">
                        <span style={{ color: 'var(--text-muted)' }}>Tax ({watchedTax}%)</span>
                        <span style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-secondary)' }}>{formatCurrency(taxAmount, watchedCurrency)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-medium pt-1" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-primary)' }}>Total</span>
                      <span style={{ fontFamily: 'DM Mono, monospace', color: 'var(--gold-primary)' }}>{formatCurrency(total, watchedCurrency)}</span>
                    </div>
                  </div>

                  {watchedNotes && (
                    <p className="text-[10px] pt-2" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)' }}>{watchedNotes}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
