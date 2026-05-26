import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activityLogger'
import type { Client, Profile } from '@/types'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import Button from '@/components/ui/Button'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  company: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().default('Croatia'),
  tax_id: z.string().optional(),
  status: z.enum(['active', 'inactive', 'lead', 'churned']),
  assigned_to: z.string().optional(),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface Props {
  isOpen: boolean
  onClose: () => void
  client: Client | null
  profiles: Profile[]
  currentUserId: string
  onSaved: () => void
}

export default function ClientFormModal({ isOpen, onClose, client, profiles, currentUserId, onSaved }: Props) {
  const isEdit = !!client

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { country: 'Croatia', status: 'active' },
  })

  useEffect(() => {
    if (client) {
      reset({
        name: client.name,
        company: client.company ?? '',
        email: client.email ?? '',
        phone: client.phone ?? '',
        address: client.address ?? '',
        city: client.city ?? '',
        country: client.country ?? 'Croatia',
        tax_id: client.tax_id ?? '',
        status: client.status,
        assigned_to: client.assigned_to ?? '',
        notes: client.notes ?? '',
      })
    } else {
      reset({ country: 'Croatia', status: 'active' })
    }
  }, [client, reset, isOpen])

  const onSubmit = async (data: FormData) => {
    const payload = {
      name: data.name,
      company: data.company || null,
      email: data.email || null,
      phone: data.phone || null,
      address: data.address || null,
      city: data.city || null,
      country: data.country,
      tax_id: data.tax_id || null,
      status: data.status,
      assigned_to: data.assigned_to || null,
      notes: data.notes || null,
    }

    if (isEdit && client) {
      const { error } = await supabase.from('clients').update(payload).eq('id', client.id)
      if (error) { toast.error('Failed to update client'); return }
      await logActivity({ entity_type: 'client', entity_id: client.id, action: 'update', description: `Updated client ${data.name}` })
      toast.success('Client updated')
    } else {
      const { data: created, error } = await supabase.from('clients').insert({ ...payload, created_by: currentUserId }).select().single()
      if (error) { toast.error('Failed to create client'); return }
      await logActivity({ entity_type: 'client', entity_id: created.id, action: 'create', description: `Created client ${data.name}` })
      toast.success('Client created')
    }

    onSaved()
  }

  const profileOptions = profiles.map((p) => ({ value: p.id, label: p.full_name }))

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Client' : 'New Client'} size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Full Name *" error={errors.name?.message} {...register('name')} />
          <Input label="Company" {...register('company')} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Email" type="email" error={errors.email?.message} {...register('email')} />
          <Input label="Phone" {...register('phone')} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Address" {...register('address')} />
          <Input label="City" {...register('city')} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Country" {...register('country')} />
          <Input label="Tax ID / OIB" {...register('tax_id')} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Status *"
            error={errors.status?.message}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
              { value: 'lead', label: 'Lead' },
              { value: 'churned', label: 'Churned' },
            ]}
            {...register('status')}
          />
          <Select
            label="Assigned To"
            placeholder="Unassigned"
            options={profileOptions}
            {...register('assigned_to')}
          />
        </div>
        <Textarea label="Notes" rows={3} {...register('notes')} />

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>
            {isEdit ? 'Save Changes' : 'Create Client'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
