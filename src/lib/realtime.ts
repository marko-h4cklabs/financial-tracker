import { supabase } from './supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

export type RealtimePayload = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: Record<string, unknown>
  old: Record<string, unknown>
}

export function subscribeToTable(
  channelName: string,
  table: string,
  callback: (payload: RealtimePayload) => void,
  filter?: string
): RealtimeChannel {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pgConfig: any = { event: '*', schema: 'public', table }
  if (filter) pgConfig.filter = filter

  return supabase
    .channel(channelName)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .on('postgres_changes', pgConfig, (payload: any) =>
      callback({
        eventType: payload.eventType as RealtimePayload['eventType'],
        new: (payload.new ?? {}) as Record<string, unknown>,
        old: (payload.old ?? {}) as Record<string, unknown>,
      })
    )
    .subscribe()
}
