import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activityLogger'
import type { ChecklistItem, Client, Deal, Profile } from '@/types'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import Button from '@/components/ui/Button'

const schema = z.object({
  client_id: z.string().min(1, 'Client is required'),
  deal_id: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  assigned_to: z.string().optional(),
  due_date: z.string().optional(),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface Props {
  isOpen: boolean
  onClose: () => void
  item: ChecklistItem | null
  clients: Client[]
  profiles: Profile[]
  currentUserId: string
  preselectedClientId?: string
  onSaved: () => void
}

export default function ChecklistItemModal({ isOpen, onClose, item, clients, profiles, currentUserId, preselectedClientId, onSaved }: Props) {
  const isEdit = !!item
  const [deals, setDeals] = useState<Deal[]>([])

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { priority: 'medium', assigned_to: currentUserId },
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
    if (item) {
      reset({
        client_id: item.client_id ?? '',
        deal_id: item.deal_id ?? '',
        title: item.title,
        priority: item.priority,
        assigned_to: item.assigned_to ?? '',
        due_date: item.due_date ?? '',
        notes: item.notes ?? '',
      })
    } else {
      reset({
        client_id: preselectedClientId ?? '',
        deal_id: '',
        title: '',
        priority: 'medium',
        assigned_to: currentUserId,
        due_date: '',
        notes: '',
      })
    }
  }, [item, isOpen, reset, preselectedClientId, currentUserId])

  const onSubmit = async (data: FormData) => {
    const payload = {
      client_id: data.client_id,
      deal_id: data.deal_id || null,
      title: data.title,
      priority: data.priority,
      assigned_to: data.assigned_to || null,
      due_date: data.due_date || null,
      notes: data.notes || null,
    }

    if (isEdit && item) {
      const { error } = await supabase.from('checklist_items').update(payload).eq('id', item.id)
      if (error) { toast.error('Failed to update'); return }
      await logActivity({ entity_type: 'checklist_item', entity_id: item.id, action: 'update', description: `Updated task "${data.title}"` })
      toast.success('Task updated')
    } else {
      const { data: created, error } = await supabase.from('checklist_items').insert({ ...payload, created_by: currentUserId }).select().single()
      if (error) { toast.error('Failed to create task'); return }
      await logActivity({ entity_type: 'checklist_item', entity_id: created.id, action: 'create', description: `Created task "${data.title}"` })
      toast.success('Task created')
    }
    onSaved()
  }

  const clientOptions = clients.map((c) => ({ value: c.id, label: c.company ? `${c.name} — ${c.company}` : c.name }))
  const dealOptions = deals.map((d) => ({ value: d.id, label: d.title }))
  const profileOptions = profiles.map((p) => ({ value: p.id, label: p.full_name }))
  const priorityOptions = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' },
  ]

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Task' : 'Add Task'} size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select label="Client *" placeholder="Select client" options={clientOptions} error={errors.client_id?.message} {...register('client_id')} />
          <Select label="Deal (optional)" placeholder="No deal" options={dealOptions} {...register('deal_id')} />
        </div>

        <Input label="What needs to be done? *" placeholder="e.g. Prepare Q3 performance report" error={errors.title?.message} {...register('title')} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select label="Priority *" options={priorityOptions} {...register('priority')} />
          <Input label="Due Date (optional)" type="date" {...register('due_date')} />
        </div>

        <Select label="Assign To" placeholder="Unassigned" options={profileOptions} {...register('assigned_to')} />
        <Textarea label="Notes (optional)" rows={2} {...register('notes')} />

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>{isEdit ? 'Save Changes' : 'Add Task'}</Button>
        </div>
      </form>
    </Modal>
  )
}
