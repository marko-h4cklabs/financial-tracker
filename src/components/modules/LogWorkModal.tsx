import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activityLogger'
import type { WorkLog, Client, Deal, WorkCategory } from '@/types'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import Button from '@/components/ui/Button'

const CATEGORIES: WorkCategory[] = ['strategy', 'creative', 'copywriting', 'ads', 'social_media', 'reporting', 'meeting', 'admin', 'general']

const CATEGORY_LABELS: Record<WorkCategory, string> = {
  strategy: 'Strategy', creative: 'Creative', copywriting: 'Copywriting',
  ads: 'Ads', social_media: 'Social Media', reporting: 'Reporting',
  meeting: 'Meeting', admin: 'Admin', general: 'General',
}

const schema = z.object({
  client_id: z.string().min(1, 'Client is required'),
  deal_id: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  category: z.enum(['strategy', 'creative', 'copywriting', 'ads', 'social_media', 'reporting', 'meeting', 'admin', 'general']),
  worked_on: z.string().min(1, 'Date is required'),
  duration_value: z.coerce.number().min(0).optional(),
  duration_unit: z.enum(['minutes', 'hours']).default('minutes'),
  description: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface Props {
  isOpen: boolean
  onClose: () => void
  log: WorkLog | null
  clients: Client[]
  currentUserId: string
  preselectedClientId?: string
  onSaved: () => void
}

export default function LogWorkModal({ isOpen, onClose, log, clients, currentUserId, preselectedClientId, onSaved }: Props) {
  const isEdit = !!log
  const [deals, setDeals] = useState<Deal[]>([])

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { category: 'general', worked_on: new Date().toISOString().slice(0, 10), duration_unit: 'minutes' },
  })

  const clientId = watch('client_id')

  useEffect(() => {
    if (clientId) {
      supabase.from('deals').select('id, title').eq('client_id', clientId)
        .then(({ data }) => setDeals((data ?? []) as Deal[]))
    } else {
      setDeals([])
    }
  }, [clientId])

  useEffect(() => {
    if (log) {
      const mins = log.duration_minutes
      const useHours = mins && mins >= 60 && mins % 60 === 0
      reset({
        client_id: log.client_id ?? '',
        deal_id: log.deal_id ?? '',
        title: log.title,
        category: log.category,
        worked_on: log.worked_on,
        duration_value: useHours ? mins / 60 : (mins ?? undefined),
        duration_unit: useHours ? 'hours' : 'minutes',
        description: log.description ?? '',
      })
    } else {
      reset({
        client_id: preselectedClientId ?? '',
        deal_id: '',
        title: '',
        category: 'general',
        worked_on: new Date().toISOString().slice(0, 10),
        duration_value: undefined,
        duration_unit: 'minutes',
        description: '',
      })
    }
  }, [log, isOpen, reset, preselectedClientId])

  const onSubmit = async (data: FormData) => {
    const durationMinutes = data.duration_value
      ? data.duration_unit === 'hours' ? Math.round(data.duration_value * 60) : Math.round(data.duration_value)
      : null

    const payload = {
      client_id: data.client_id,
      deal_id: data.deal_id || null,
      title: data.title,
      category: data.category,
      worked_on: data.worked_on,
      duration_minutes: durationMinutes,
      description: data.description || null,
    }

    if (isEdit && log) {
      const { error } = await supabase.from('work_logs').update(payload).eq('id', log.id)
      if (error) { toast.error('Failed to update'); return }
      await logActivity({ entity_type: 'work_log', entity_id: log.id, action: 'update', description: `Updated work log "${data.title}"` })
      toast.success('Work log updated')
    } else {
      const { data: created, error } = await supabase.from('work_logs').insert({ ...payload, logged_by: currentUserId }).select().single()
      if (error) { toast.error('Failed to save'); return }
      await logActivity({ entity_type: 'work_log', entity_id: created.id, action: 'create', description: `Logged work: "${data.title}"` })
      toast.success('Work logged')
    }
    onSaved()
  }

  const clientOptions = clients.map((c) => ({ value: c.id, label: c.company ? `${c.name} — ${c.company}` : c.name }))
  const dealOptions = deals.map((d) => ({ value: d.id, label: d.title }))
  const categoryOptions = CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Work Log' : 'Log Work'} size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select label="Client *" placeholder="Select client" options={clientOptions} error={errors.client_id?.message} {...register('client_id')} />
          <Select label="Deal (optional)" placeholder="No deal" options={dealOptions} {...register('deal_id')} />
        </div>

        <Input label="What did you work on? *" placeholder="e.g. Created 3 ad creatives for Meta campaign" error={errors.title?.message} {...register('title')} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select label="Category *" options={categoryOptions} error={errors.category?.message} {...register('category')} />
          <Input label="Date *" type="date" error={errors.worked_on?.message} {...register('worked_on')} />
        </div>

        <div>
          <label className="block text-xs font-medium uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            Duration (optional)
          </label>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input type="number" step="0.5" min="0" placeholder="e.g. 90" {...register('duration_value')} />
            </div>
            <select
              {...register('duration_unit')}
              className="px-3 py-2 rounded text-sm outline-none"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
            >
              <option value="minutes">min</option>
              <option value="hours">hours</option>
            </select>
          </div>
        </div>

        <Textarea label="Notes (optional)" rows={3} placeholder="Additional context…" {...register('description')} />

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>{isEdit ? 'Save Changes' : 'Log Work'}</Button>
        </div>
      </form>
    </Modal>
  )
}
