import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activityLogger'
import type { Expense, Client, Deal } from '@/types'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import Button from '@/components/ui/Button'

const CATEGORIES = ['software','hardware','advertising','travel','office','contractor','subscription','tax','other'] as const

const schema = z.object({
  title: z.string().min(1, 'Title is required'),
  amount: z.coerce.number().min(0.01, 'Amount required'),
  currency: z.string().default('EUR'),
  category: z.enum(CATEGORIES),
  expense_date: z.string().min(1, 'Date required'),
  deal_id: z.string().optional(),
  client_id: z.string().optional(),
  notes: z.string().optional(),
  receipt_url: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface Props {
  isOpen: boolean
  onClose: () => void
  expense: Expense | null
  clients: Client[]
  deals: Deal[]
  currentUserId: string
  preselectedDealId?: string
  onSaved: () => void
}

export default function ExpenseFormModal({ isOpen, onClose, expense, clients, deals, currentUserId, preselectedDealId, onSaved }: Props) {
  const isEdit = !!expense

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { currency: 'EUR', category: 'other', expense_date: new Date().toISOString().slice(0, 10) },
  })

  const selectedDealId = watch('deal_id')

  useEffect(() => {
    if (expense) {
      reset({
        title: expense.title,
        amount: expense.amount,
        currency: expense.currency,
        category: expense.category,
        expense_date: expense.expense_date,
        deal_id: expense.deal_id ?? '',
        client_id: expense.client_id ?? '',
        notes: expense.notes ?? '',
        receipt_url: expense.receipt_url ?? '',
      })
    } else {
      reset({
        currency: 'EUR',
        category: 'other',
        expense_date: new Date().toISOString().slice(0, 10),
        deal_id: preselectedDealId ?? '',
      })
    }
  }, [expense, reset, isOpen, preselectedDealId])

  // Auto-fill client from deal
  useEffect(() => {
    if (selectedDealId) {
      const deal = deals.find((d) => d.id === selectedDealId)
      if (deal?.client_id) setValue('client_id', deal.client_id)
    }
  }, [selectedDealId, deals, setValue])

  const onSubmit = async (data: FormData) => {
    const payload = {
      title: data.title,
      amount: data.amount,
      currency: data.currency,
      category: data.category,
      expense_date: data.expense_date,
      deal_id: data.deal_id || null,
      client_id: data.client_id || null,
      notes: data.notes || null,
      receipt_url: data.receipt_url || null,
    }

    if (isEdit && expense) {
      const { error } = await supabase.from('expenses').update(payload).eq('id', expense.id)
      if (error) { toast.error('Failed to update expense'); return }
      await logActivity({ entity_type: 'expense', entity_id: expense.id, action: 'update', description: `Updated expense "${data.title}"` })
      toast.success('Expense updated')
    } else {
      const { data: created, error } = await supabase.from('expenses').insert({ ...payload, created_by: currentUserId }).select().single()
      if (error) { toast.error('Failed to create expense'); return }
      await logActivity({ entity_type: 'expense', entity_id: created.id, action: 'create', description: `Added expense "${data.title}"` })
      toast.success('Expense added')
    }

    onSaved()
  }

  const categoryOptions = CATEGORIES.map((c) => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }))
  const clientOptions = clients.map((c) => ({ value: c.id, label: c.company ? `${c.name} — ${c.company}` : c.name }))
  const dealOptions = deals.map((d) => ({ value: d.id, label: d.title }))

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Expense' : 'Add Expense'} size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label="Title *" error={errors.title?.message} {...register('title')} />
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <Input label="Amount *" type="number" step="0.01" error={errors.amount?.message} {...register('amount')} />
          </div>
          <Select label="Currency"
            options={[{ value: 'EUR', label: 'EUR' }, { value: 'HRK', label: 'HRK' }, { value: 'USD', label: 'USD' }]}
            {...register('currency')} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select label="Category *" options={categoryOptions} error={errors.category?.message} {...register('category')} />
          <Input label="Date *" type="date" error={errors.expense_date?.message} {...register('expense_date')} />
        </div>
        <Select label="Link to Deal" placeholder="No deal" options={dealOptions} {...register('deal_id')} />
        <Select label="Link to Client" placeholder="No client" options={clientOptions} {...register('client_id')} />
        <Input label="Receipt URL" placeholder="https://…" {...register('receipt_url')} />
        <Textarea label="Notes" rows={2} {...register('notes')} />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>{isEdit ? 'Save Changes' : 'Add Expense'}</Button>
        </div>
      </form>
    </Modal>
  )
}
