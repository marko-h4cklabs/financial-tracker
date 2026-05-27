import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'

type Tab = 'profile' | 'security'

const profileSchema = z.object({
  full_name: z.string().min(1, 'Name is required'),
  avatar_initials: z.string().max(2, 'Max 2 characters').optional(),
})
type ProfileFormData = z.infer<typeof profileSchema>

const passwordSchema = z.object({
  password: z.string().min(8, 'Minimum 8 characters'),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, { message: 'Passwords do not match', path: ['confirm'] })
type PasswordFormData = z.infer<typeof passwordSchema>

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('profile')

  return (
    <div className="space-y-4 max-w-2xl w-full">
      <h1 className="text-xl md:text-2xl font-light tracking-widest uppercase"
        style={{ fontFamily: 'Cormorant Garamond, serif', color: 'var(--gold-primary)' }}>
        Settings
      </h1>

      <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--bg-elevated)', width: 'fit-content' }}>
        {(['profile', 'security'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-1.5 text-sm rounded-md transition-all capitalize"
            style={tab === t
              ? { background: 'var(--gold-primary)', color: '#0A0A0A', fontWeight: 600 }
              : { color: 'var(--text-muted)' }}>
            {t === 'profile' ? 'Profile' : 'Security'}
          </button>
        ))}
      </div>

      {tab === 'profile' && <ProfileTab />}
      {tab === 'security' && <SecurityTab />}
    </div>
  )
}

function ProfileTab() {
  const { profile, fetchProfile, user } = useAuthStore()

  const { register, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: '', avatar_initials: '' },
  })

  useEffect(() => {
    if (profile) {
      reset({ full_name: profile.full_name, avatar_initials: profile.avatar_initials ?? '' })
    }
  }, [profile, reset])

  const onSubmit = async (data: ProfileFormData) => {
    if (!user) return
    const { error } = await supabase.from('profiles').update({
      full_name: data.full_name,
      avatar_initials: data.avatar_initials?.toUpperCase() || null,
    }).eq('id', user.id)

    if (error) { toast.error('Failed to save'); return }
    await fetchProfile(user.id)
    toast.success('Profile updated')
    reset({ full_name: data.full_name, avatar_initials: data.avatar_initials })
  }

  const initials = profile?.avatar_initials
    ?? profile?.full_name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    ?? '?'

  return (
    <Card className="p-6">
      <div className="flex items-center gap-5 mb-6 pb-6" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-semibold flex-shrink-0"
          style={{ background: 'var(--gold-muted)', border: '2px solid var(--gold-dark)', color: 'var(--gold-light)', fontFamily: 'DM Mono, monospace' }}>
          {initials}
        </div>
        <div>
          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{profile?.full_name}</p>
          <p className="text-xs mt-0.5 uppercase tracking-wider"
            style={{ color: profile?.role === 'admin' ? 'var(--gold-primary)' : 'var(--text-muted)' }}>
            {profile?.role}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label="Full Name *" error={errors.full_name?.message} {...register('full_name')} />
        <div>
          <Input label="Avatar Initials" placeholder="e.g. MK" maxLength={2}
            error={errors.avatar_initials?.message} {...register('avatar_initials')} />
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Up to 2 characters shown in your avatar. Leave blank to auto-generate from name.
          </p>
        </div>
        <div className="pt-2">
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>Save Profile</Button>
        </div>
      </form>
    </Card>
  )
}

function SecurityTab() {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  })

  const onSubmit = async (data: PasswordFormData) => {
    const { error } = await supabase.auth.updateUser({ password: data.password })
    if (error) { toast.error(error.message); return }
    toast.success('Password updated successfully')
    reset()
  }

  return (
    <Card className="p-6">
      <p className="text-xs uppercase tracking-wider mb-5" style={{ color: 'var(--text-muted)' }}>Change Password</p>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label="New Password *" type="password" error={errors.password?.message} {...register('password')} />
        <Input label="Confirm Password *" type="password" error={errors.confirm?.message} {...register('confirm')} />
        <div className="pt-2">
          <Button type="submit" loading={isSubmitting}>Update Password</Button>
        </div>
      </form>
    </Card>
  )
}
