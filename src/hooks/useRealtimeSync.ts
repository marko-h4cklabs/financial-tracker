import { useEffect, useRef, useState } from 'react'
import { subscribeToTable, type RealtimePayload } from '@/lib/realtime'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'

export type FlashType = 'new' | 'updated' | null

interface Options {
  filter?: string
  getToastMessage?: (payload: RealtimePayload) => string | null
}

const TEAMMATE_TOAST_STYLE = {
  style: {
    background: 'var(--bg-elevated)',
    color: 'var(--text-primary)',
    border: '1px solid var(--gold-primary)',
    fontSize: '13px',
  },
  icon: '✦',
  duration: 3500,
}

export function useRealtimeSync(
  table: string,
  refetch: () => void,
  options?: Options
): { flashId: string | null; flashType: FlashType } {
  const refetchRef = useRef(refetch)
  const optionsRef = useRef(options)
  useEffect(() => { refetchRef.current = refetch }, [refetch])
  useEffect(() => { optionsRef.current = options }, [options])

  const [flashId, setFlashId] = useState<string | null>(null)
  const [flashType, setFlashType] = useState<FlashType>(null)

  useEffect(() => {
    const channelName = `${table}-${Math.random().toString(36).slice(2)}`

    const channel = subscribeToTable(
      channelName,
      table,
      (payload) => {
        // Flash animation for new/updated items
        const id = (payload.new?.id ?? payload.old?.id) as string | undefined
        if (id && payload.eventType !== 'DELETE') {
          const ftype: FlashType = payload.eventType === 'INSERT' ? 'new' : 'updated'
          setFlashId(id)
          setFlashType(ftype)
          setTimeout(() => { setFlashId(null); setFlashType(null) }, 1600)
        }

        // Teammate toast (only for other users' changes)
        const currentUserId = useAuthStore.getState().user?.id
        const changedBy = (payload.new?.created_by ?? payload.new?.logged_by) as string | undefined
        if (changedBy && changedBy !== currentUserId && optionsRef.current?.getToastMessage) {
          const msg = optionsRef.current.getToastMessage(payload)
          if (msg) toast(msg, TEAMMATE_TOAST_STYLE)
        }

        // Trigger refetch
        refetchRef.current()
      },
      optionsRef.current?.filter
    )

    return () => {
      channel.unsubscribe()
    }
  }, [table]) // stable — re-subscribe only if table name changes

  return { flashId, flashType }
}
