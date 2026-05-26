export interface Profile {
  id: string
  username: string
  full_name: string
  role: 'admin' | 'member'
  avatar_initials: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type ClientStatus = 'active' | 'inactive' | 'lead' | 'churned'

export interface Client {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  country: string
  tax_id: string | null
  status: ClientStatus
  notes: string | null
  tags: string[] | null
  assigned_to: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // joined
  assigned_profile?: Profile
}

export type DealStage = 'lead' | 'proposal' | 'negotiation' | 'won' | 'lost' | 'paused'

export interface Deal {
  id: string
  client_id: string | null
  title: string
  description: string | null
  stage: DealStage
  value: number
  currency: string
  start_date: string | null
  end_date: string | null
  probability: number
  assigned_to: string | null
  created_by: string | null
  notes: string | null
  tags: string[] | null
  created_at: string
  updated_at: string
  // joined
  client?: Client
  assigned_profile?: Profile
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'

export interface Invoice {
  id: string
  invoice_number: string
  client_id: string | null
  deal_id: string | null
  title: string
  status: InvoiceStatus
  issue_date: string
  due_date: string | null
  subtotal: number
  tax_rate: number
  tax_amount: number
  total: number
  currency: string
  notes: string | null
  paid_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // joined
  client?: Client
  deal?: Deal
  items?: InvoiceItem[]
}

export interface InvoiceItem {
  id: string
  invoice_id: string
  description: string
  quantity: number
  unit_price: number
  amount: number
  sort_order: number
}

export type InstallmentStatus = 'pending' | 'paid' | 'overdue' | 'cancelled'
export type PaymentMethod = 'bank_transfer' | 'cash' | 'card' | 'other'

export interface Installment {
  id: string
  deal_id: string | null
  invoice_id: string | null
  client_id: string | null
  title: string
  amount: number
  currency: string
  due_date: string
  status: InstallmentStatus
  paid_at: string | null
  payment_method: PaymentMethod | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // joined
  deal?: Deal
  client?: Client
  invoice?: Invoice
}

export type ExpenseCategory =
  | 'software'
  | 'hardware'
  | 'advertising'
  | 'travel'
  | 'office'
  | 'contractor'
  | 'subscription'
  | 'tax'
  | 'other'

export interface Expense {
  id: string
  title: string
  amount: number
  currency: string
  category: ExpenseCategory
  deal_id: string | null
  client_id: string | null
  expense_date: string
  receipt_url: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // joined
  deal?: Deal
  client?: Client
  created_by_profile?: Profile
}

export type ActivityAction = 'create' | 'update' | 'delete' | 'payment' | 'status_change'

export interface ActivityLog {
  id: string
  user_id: string | null
  entity_type: string
  entity_id: string | null
  action: string
  description: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  // joined
  user?: Profile
}
