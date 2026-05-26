import { supabase } from './supabase'

interface LogActivityParams {
  entity_type: string
  entity_id?: string
  action: string
  description?: string
  metadata?: Record<string, unknown>
}

export async function logActivity(params: LogActivityParams): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  await supabase.from('activity_log').insert({
    user_id: session.user.id,
    entity_type: params.entity_type,
    entity_id: params.entity_id ?? null,
    action: params.action,
    description: params.description ?? null,
    metadata: params.metadata ?? null,
  })
}
