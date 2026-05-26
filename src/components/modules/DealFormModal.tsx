import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activityLogger'
import type { Deal, Client, Profile } from '@/types'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import Button from '@/components/ui/Button'

const schema = z.object({
  title: z.string().min(1, 'Title is required'),
  client_id: z.string().optional(),
  stage: z.enum(['lead', 'proposal', 'negotiation', 'won', 'lost', 'paused']),
  value: z.coerce.number().min(0, 'Value must be 0 or more'),
  currency: z.string().default('EUR'),
  probability: z.coerce.number().min(0).max(100).default(50),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  assigned_to: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
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
    defaultValues: { stage: 'lead', currency: 'EUR', probability: 50 },
  })

  const probability = watch('probability')

  useEffect(() => {
    if (deal) {
      reset({
        title: deal.title,
        client_id: deal.client_id ?? '',
        stage: deal.stage,
        value: deal.value,
        currency: deal.currency,
        probability: deal.probability,
        start_date: deal.start_date ?? '',
        end_date: deal.end_date ?? '',
        assigned_to: deal.assigned_to ?? '',
        description: deal.description ?? '',
        notes: deal.notes ?? '',
      })
    } else {
      reset({ stage: 'lead', currency: 'EUR', probability: 50, client_id: preselectedClientId ?? '' })
    }
  }, [deal, reset, isOpen, preselectedClientId])

  const onSubmit = async (data: FormData) => {
    const payload = {
      title: data.title,
      client_id: data.client_id || null,
      stage: data.stage,
      value: data.value,
      currency: data.currency,
      probability: data.probability,
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      assigned_to: data.assigned_to || null,
      description: data.description || null,
      notes: data.notes || null,
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

        <div className="grid grid-cols-2 gap-4">
          <Select label="Client" placeholder="No client" options={clientOptions} {...register('client_id')} />
          <Select
            label="Stage *"
            options={[
              { value: 'lead', label: 'Lead' },
              { value: 'proposal', label: 'Proposal' },
              { value: 'negotiation', label: 'Negotiation' },
              { value: 'won', label: 'Won' },
              { value: 'lost', label: 'Lost' },
              { value: 'paused', label: 'Paused' },
            ]}
            error={errors.stage?.message}
            {...register('stage')}
          />
        </div>

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

        <div>
          <label className="block text-xs font-medium uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            Probability: {probability}%
          </label>
          <input
            type="range" min="0" max="100" step="5"
            className="w-full accent-gold h-1 rounded"
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
