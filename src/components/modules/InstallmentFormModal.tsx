import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activityLogger'
import type { Installment } from '@/types'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import Button from '@/components/ui/Button'

const schema = z.object({
  title: z.string().min(1, 'Title is required'),
  amount: z.coerce.number().min(0.01, 'Amount required'),
  currency: z.string().default('EUR'),
  due_date: z.string().min(1, 'Due date is required'),
  status: z.enum(['pending', 'paid', 'overdue', 'cancelled']),
  payment_method: z.enum(['bank_transfer', 'cash', 'card', 'other']).optional(),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface Props {
  isOpen: boolean
  onClose: () => void
  installment: Installment | null
  dealId: string
  clientId?: string | null
  currentUserId: string
  onSaved: () => void
}

export default function InstallmentFormModal({ isOpen, onClose, installment, dealId, clientId, currentUserId, onSaved }: Props) {
  const isEdit = !!installment

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { currency: 'EUR', status: 'pending' },
  })

  useEffect(() => {
    if (installment) {
      reset({
        title: installment.title,
        amount: installment.amount,
        currency: installment.currency,
        due_date: installment.due_date,
        status: installment.status,
        payment_method: installment.payment_method ?? undefined,
        notes: installment.notes ?? '',
      })
    } else {
      reset({ currency: 'EUR', status: 'pending' })
    }
  }, [installment, reset, isOpen])

  const onSubmit = async (data: FormData) => {
    const payload = {
      title: data.title,
      amount: data.amount,
      currency: data.currency,
      due_date: data.due_date,
      status: data.status,
      payment_method: data.payment_method ?? null,
      notes: data.notes || null,
      deal_id: dealId,
      client_id: clientId ?? null,
    }

    if (isEdit && installment) {
      const { error } = await supabase.from('installments').update(payload).eq('id', installment.id)
      if (error) { toast.error('Failed to update installment'); return }
      await logActivity({ entity_type: 'installment', entity_id: installment.id, action: 'update', description: `Updated installment "${data.title}"` })
      toast.success('Installment updated')
    } else {
      const { data: created, error } = await supabase.from('installments').insert({ ...payload, created_by: currentUserId }).select().single()
      if (error) { toast.error('Failed to create installment'); return }
      await logActivity({ entity_type: 'installment', entity_id: created.id, action: 'create', description: `Added installment "${data.title}"` })
      toast.success('Installment added')
    }

    onSaved()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Installment' : 'Add Installment'} size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label="Title *" error={errors.title?.message} {...register('title')} />
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <Input label="Amount *" type="number" step="0.01" error={errors.amount?.message} {...register('amount')} />
          </div>
          <Select
            label="Currency"
            options={[{ value: 'EUR', label: 'EUR' }, { value: 'HRK', label: 'HRK' }, { value: 'USD', label: 'USD' }]}
            {...register('currency')}
          />
        </div>
        <Input label="Due Date *" type="date" error={errors.due_date?.message} {...register('due_date')} />
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Status"
            options={[
              { value: 'pending', label: 'Pending' },
              { value: 'paid', label: 'Paid' },
              { value: 'overdue', label: 'Overdue' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
            {...register('status')}
          />
          <Select
            label="Payment Method"
            placeholder="Not set"
            options={[
              { value: 'bank_transfer', label: 'Bank Transfer' },
              { value: 'cash', label: 'Cash' },
              { value: 'card', label: 'Card' },
              { value: 'other', label: 'Other' },
            ]}
            {...register('payment_method')}
          />
        </div>
        <Textarea label="Notes" rows={2} {...register('notes')} />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>{isEdit ? 'Save Changes' : 'Add Installment'}</Button>
        </div>
      </form>
    </Modal>
  )
}
