import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { differenceInMonths } from 'date-fns'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activityLogger'
import { formatCurrency } from '@/lib/formatters'
import type { Deal, Client, Profile } from '@/types'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import Button from '@/components/ui/Button'

const schema = z.object({
  title: z.string().min(1, 'Title is required'),
  client_id: z.string().optional(),
  stage: z.enum(['proposal', 'won', 'lost']),
  deal_type: z.enum(['one_time', 'retainer']).default('one_time'),
  value: z.coerce.number().min(0).optional(),
  retainer_amount: z.coerce.number().min(0).optional(),
  retainer_billing_day: z.coerce.number().int().min(1).max(31).optional(),
  retainer_start_date: z.string().optional(),
  retainer_end_date: z.string().optional(),
  currency: z.string().default('EUR'),
  probability: z.coerce.number().min(0).max(100).default(50),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  assigned_to: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.deal_type === 'one_time' && (data.value === undefined || data.value === null)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['value'], message: 'Value is required' })
  }
  if (data.deal_type === 'retainer') {
    if (!data.retainer_amount) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['retainer_amount'], message: 'Monthly amount is required' })
    if (!data.retainer_billing_day) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['retainer_billing_day'], message: 'Billing day is required' })
    if (!data.retainer_start_date) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['retainer_start_date'], message: 'Start date is required' })
  }
})

type FormData = z.infer<typeof schema>

interface Props {
  isOpen: boolean
  onClose: () => void
  deal: Deal | null
  clients: Client[]
  profiles: Profile[]
  currentUserId: string
  preselectedClientId?: string
  onSaved: () => void
}

export default function DealFormModal({ isOpen, onClose, deal, clients, profiles, currentUserId, preselectedClientId, onSaved }: Props) {
  const isEdit = !!deal

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { stage: 'proposal', deal_type: 'one_time', currency: 'EUR', probability: 50, value: 0 },
  })

  const dealType = watch('deal_type')
  const probability = watch('probability')
  const retainerAmount = watch('retainer_amount')
  const retainerStart = watch('retainer_start_date')
  const retainerEnd = watch('retainer_end_date')
  const currency = watch('currency')

  const retainerMonths = retainerStart
    ? retainerEnd
      ? Math.max(1, differenceInMonths(new Date(retainerEnd), new Date(retainerStart)) + 1)
      : 12
    : null
  const retainerTotal = retainerAmount && retainerMonths ? Number(retainerAmount) * retainerMonths : null

  useEffect(() => {
    if (deal) {
      reset({
        title: deal.title,
        client_id: deal.client_id ?? '',
        stage: deal.stage,
        deal_type: deal.deal_type ?? 'one_time',
        value: deal.value,
        retainer_amount: deal.retainer_amount ?? undefined,
        retainer_billing_day: deal.retainer_billing_day ?? undefined,
        retainer_start_date: deal.retainer_start_date ?? '',
        retainer_end_date: deal.retainer_end_date ?? '',
        currency: deal.currency,
        probability: deal.probability,
        start_date: deal.start_date ?? '',
        end_date: deal.end_date ?? '',
        assigned_to: deal.assigned_to ?? '',
        description: deal.description ?? '',
        notes: deal.notes ?? '',
      })
    } else {
      reset({ stage: 'proposal', deal_type: 'one_time', currency: 'EUR', probability: 50, value: 0, client_id: preselectedClientId ?? '' })
    }
  }, [deal, reset, isOpen, preselectedClientId])

  const onSubmit = async (data: FormData) => {
    let computedValue = data.value ?? 0

    if (data.deal_type === 'retainer' && data.retainer_amount && data.retainer_start_date) {
      const start = new Date(data.retainer_start_date)
      const end = data.retainer_end_date ? new Date(data.retainer_end_date) : null
      const months = end ? Math.max(1, differenceInMonths(end, start) + 1) : 12
      computedValue = Number(data.retainer_amount) * months
    }

    const payload = {
      title: data.title,
      client_id: data.client_id || null,
      stage: data.stage,
      deal_type: data.deal_type,
      value: computedValue,
      currency: data.currency,
      probability: data.probability,
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      assigned_to: data.assigned_to || null,
      description: data.description || null,
      notes: data.notes || null,
      retainer_amount: data.deal_type === 'retainer' ? (data.retainer_amount ?? null) : null,
      retainer_billing_day: data.deal_type === 'retainer' ? (data.retainer_billing_day ?? null) : null,
      retainer_start_date: data.deal_type === 'retainer' ? (data.retainer_start_date || null) : null,
      retainer_end_date: data.deal_type === 'retainer' ? (data.retainer_end_date || null) : null,
    }

    if (isEdit && deal) {
      const { error } = await supabase.from('deals').update(payload).eq('id', deal.id)
      if (error) { toast.error('Failed to update deal'); return }
      await logActivity({ entity_type: 'deal', entity_id: deal.id, action: 'update', description: `Updated deal "${data.title}"` })
      toast.success('Deal updated')
    } else {
      const { data: created, error } = await supabase.from('deals').insert({ ...payload, created_by: currentUserId }).select().single()
      if (error) { toast.error('Failed to create deal'); return }
      await logActivity({ entity_type: 'deal', entity_id: created.id, action: 'create', description: `Created deal "${data.title}"` })
      toast.success('Deal created')
    }

    onSaved()
  }

  const clientOptions = clients.map((c) => ({ value: c.id, label: c.company ? `${c.name} — ${c.company}` : c.name }))
  const profileOptions = profiles.map((p) => ({ value: p.id, label: p.full_name }))

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Deal' : 'New Deal'} size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label="Title *" error={errors.title?.message} {...register('title')} />

        {/* Deal Type Toggle */}
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>
            Deal Type
          </label>
          <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--bg-elevated)', width: 'fit-content' }}>
            {([['one_time', 'One-time'], ['retainer', 'Monthly Retainer']] as const).map(([val, label]) => (
              <button key={val} type="button" onClick={() => setValue('deal_type', val)}
                className="px-4 py-1.5 text-xs rounded-md transition-all"
                style={dealType === val
                  ? { background: 'var(--gold-primary)', color: '#0A0A0A', fontWeight: 600 }
                  : { color: 'var(--text-muted)' }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select label="Client" placeholder="No client" options={clientOptions} {...register('client_id')} />
          <Select
            label="Stage *"
            options={[
              { value: 'proposal', label: 'Proposal' },
              { value: 'won', label: 'Won' },
              { value: 'lost', label: 'Lost' },
            ]}
            error={errors.stage?.message}
            {...register('stage')}
          />
        </div>

        {dealType === 'one_time' ? (
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Input label="Value *" type="number" step="0.01" error={errors.value?.message} {...register('value')} />
            </div>
            <Select
              label="Currency"
              options={[{ value: 'EUR', label: 'EUR (€)' }, { value: 'HRK', label: 'HRK (kn)' }, { value: 'USD', label: 'USD ($)' }]}
              {...register('currency')}
            />
          </div>
        ) : (
          <div className="rounded-lg p-4 space-y-3" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Input label="Monthly Amount *" type="number" step="0.01" placeholder="1500"
                  error={errors.retainer_amount?.message} {...register('retainer_amount')} />
              </div>
              <Select
                label="Currency"
                options={[{ value: 'EUR', label: 'EUR (€)' }, { value: 'HRK', label: 'HRK (kn)' }, { value: 'USD', label: 'USD ($)' }]}
                {...register('currency')}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Input label="Billing Day *" type="number" min="1" max="31" placeholder="1"
                error={errors.retainer_billing_day?.message} {...register('retainer_billing_day')} />
              <Input label="Start Date *" type="date"
                error={errors.retainer_start_date?.message} {...register('retainer_start_date')} />
              <Input label="End Date" type="date" {...register('retainer_end_date')} />
            </div>
            {retainerTotal !== null && (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Contract value:{' '}
                <span style={{ fontFamily: 'DM Mono, monospace', color: 'var(--gold-primary)' }}>
                  {formatCurrency(retainerTotal, currency)}
                </span>
                {' '}({retainerMonths} month{retainerMonths !== 1 ? 's' : ''}{!retainerEnd ? ' est.' : ''})
              </p>
            )}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            Probability: {probability}%
          </label>
          <input
            type="range" min="0" max="100" step="5"
            className="w-full h-1 rounded"
            style={{ accentColor: 'var(--gold-primary)' }}
            {...register('probability')}
            onChange={(e) => setValue('probability', Number(e.target.value))}
          />
          <div className="flex justify-between text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
            <span>0%</span><span>50%</span><span>100%</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Start Date" type="date" {...register('start_date')} />
          <Input label="End Date" type="date" {...register('end_date')} />
        </div>

        <Select label="Assigned To" placeholder="Unassigned" options={profileOptions} {...register('assigned_to')} />
        <Textarea label="Description" rows={2} {...register('description')} />
        <Textarea label="Notes" rows={2} {...register('notes')} />

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>{isEdit ? 'Save Changes' : 'Create Deal'}</Button>
        </div>
      </form>
    </Modal>
  )
}
