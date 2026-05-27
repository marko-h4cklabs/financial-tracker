import type { DealStage, InvoiceStatus, ClientStatus, InstallmentStatus, ExpenseCategory } from '@/types'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'gold' | 'muted'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  size?: 'sm' | 'md'
}

const variantStyles: Record<BadgeVariant, React.CSSProperties> = {
  default: { background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' },
  success: { background: 'rgba(76,175,125,0.12)', color: 'var(--status-green)', border: '1px solid rgba(76,175,125,0.25)' },
  warning: { background: 'rgba(224,160,48,0.12)', color: 'var(--status-yellow)', border: '1px solid rgba(224,160,48,0.25)' },
  danger: { background: 'rgba(224,82,82,0.12)', color: 'var(--status-red)', border: '1px solid rgba(224,82,82,0.25)' },
  info: { background: 'rgba(74,144,217,0.12)', color: 'var(--status-blue)', border: '1px solid rgba(74,144,217,0.25)' },
  purple: { background: 'rgba(155,111,212,0.12)', color: 'var(--status-purple)', border: '1px solid rgba(155,111,212,0.25)' },
  gold: { background: 'var(--gold-muted)', color: 'var(--gold-primary)', border: '1px solid rgba(201,168,76,0.3)' },
  muted: { background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' },
}

export function Badge({ children, variant = 'default', size = 'sm' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded font-medium ${size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'} tracking-wide uppercase`}
      style={variantStyles[variant]}
    >
      {children}
    </span>
  )
}

export function DealStageBadge({ stage }: { stage: DealStage }) {
  const map: Record<DealStage, { label: string; variant: BadgeVariant }> = {
    proposal: { label: 'Proposal', variant: 'info' },
    won: { label: 'Won', variant: 'success' },
    lost: { label: 'Lost', variant: 'danger' },
  }
  const { label, variant } = map[stage]
  return <Badge variant={variant}>{label}</Badge>
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const map: Record<InvoiceStatus, { label: string; variant: BadgeVariant }> = {
    draft: { label: 'Draft', variant: 'muted' },
    sent: { label: 'Sent', variant: 'info' },
    paid: { label: 'Paid', variant: 'success' },
    overdue: { label: 'Overdue', variant: 'danger' },
    cancelled: { label: 'Cancelled', variant: 'default' },
  }
  const { label, variant } = map[status]
  return <Badge variant={variant}>{label}</Badge>
}

export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  const map: Record<ClientStatus, { label: string; variant: BadgeVariant }> = {
    active: { label: 'Active', variant: 'success' },
    inactive: { label: 'Inactive', variant: 'muted' },
    lead: { label: 'Lead', variant: 'info' },
    churned: { label: 'Churned', variant: 'danger' },
  }
  const { label, variant } = map[status]
  return <Badge variant={variant}>{label}</Badge>
}

export function InstallmentStatusBadge({ status }: { status: InstallmentStatus }) {
  const map: Record<InstallmentStatus, { label: string; variant: BadgeVariant }> = {
    pending: { label: 'Pending', variant: 'warning' },
    paid: { label: 'Paid', variant: 'success' },
    overdue: { label: 'Overdue', variant: 'danger' },
    cancelled: { label: 'Cancelled', variant: 'muted' },
  }
  const { label, variant } = map[status]
  return <Badge variant={variant}>{label}</Badge>
}

export function CategoryBadge({ category }: { category: ExpenseCategory }) {
  const map: Record<ExpenseCategory, { label: string; variant: BadgeVariant }> = {
    software: { label: 'Software', variant: 'info' },
    hardware: { label: 'Hardware', variant: 'purple' },
    advertising: { label: 'Advertising', variant: 'gold' },
    travel: { label: 'Travel', variant: 'warning' },
    office: { label: 'Office', variant: 'default' },
    contractor: { label: 'Contractor', variant: 'success' },
    subscription: { label: 'Subscription', variant: 'info' },
    tax: { label: 'Tax', variant: 'danger' },
    other: { label: 'Other', variant: 'muted' },
  }
  const { label, variant } = map[category]
  return <Badge variant={variant}>{label}</Badge>
}

export default Badge
