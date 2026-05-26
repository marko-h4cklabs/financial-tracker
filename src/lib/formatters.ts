import { format, formatDistanceToNow, differenceInDays } from 'date-fns'

export function formatCurrency(amount: number, currency = 'EUR'): string {
  const symbols: Record<string, string> = { EUR: '€', HRK: 'kn', USD: '$' }
  const symbol = symbols[currency] ?? currency
  return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  try {
    return format(new Date(date), 'dd/MM/yyyy')
  } catch {
    return '—'
  }
}

export function formatRelativeDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true })
  } catch {
    return '—'
  }
}

export function formatDaysUntil(date: string | null | undefined): string {
  if (!date) return '—'
  try {
    const days = differenceInDays(new Date(date), new Date())
    if (days < 0) return `${Math.abs(days)}d overdue`
    if (days === 0) return 'Today'
    if (days === 1) return 'Tomorrow'
    return `in ${days}d`
  } catch {
    return '—'
  }
}

export function formatInvoiceNumber(n: number): string {
  return `AUR-${new Date().getFullYear()}-${String(n).padStart(4, '0')}`
}
