import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required'),
  password: z.string().min(1, 'Password is required'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const navigate = useNavigate()
  const signIn = useAuthStore((s) => s.signIn)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  const onSubmit = async (data: LoginForm) => {
    setIsSubmitting(true)
    try {
      await signIn(data.email, data.password)
      navigate('/dashboard')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid credentials'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      {/* Noise texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundSize: '256px 256px',
        }}
      />
      {/* Faint gold radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(201,168,76,0.04) 0%, transparent 70%)',
        }}
      />

      <div className="relative w-full max-w-sm mx-4">
        {/* Card */}
        <div
          className="rounded-lg p-8"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 0 0 1px rgba(201,168,76,0.08), 0 24px 48px rgba(0,0,0,0.6)',
          }}
        >
          {/* Logo */}
          <div className="text-center mb-8">
            <h1
              className="text-3xl font-light tracking-[0.3em] uppercase"
              style={{ fontFamily: 'Cormorant Garamond, serif', color: 'var(--gold-primary)' }}
            >
              Aurelius
            </h1>
            <p className="text-xs tracking-widest uppercase mt-1" style={{ color: 'var(--text-muted)' }}>
              Internal Operations
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label
                className="block text-xs font-medium uppercase tracking-wider mb-1.5"
                style={{ color: 'var(--text-secondary)' }}
              >
                Email
              </label>
              <input
                type="text"
                autoComplete="email"
                {...register('email')}
                className="w-full px-3 py-2.5 rounded text-sm transition-all outline-none"
                style={{
                  background: 'var(--bg-elevated)',
                  border: `1px solid ${errors.email ? 'var(--status-red)' : 'var(--border-default)'}`,
                  color: 'var(--text-primary)',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--gold-primary)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = errors.email ? 'var(--status-red)' : 'var(--border-default)')}
              />
              {errors.email && (
                <p className="text-xs mt-1" style={{ color: 'var(--status-red)' }}>
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label
                className="block text-xs font-medium uppercase tracking-wider mb-1.5"
                style={{ color: 'var(--text-secondary)' }}
              >
                Password
              </label>
              <input
                type="password"
                autoComplete="current-password"
                {...register('password')}
                className="w-full px-3 py-2.5 rounded text-sm transition-all outline-none"
                style={{
                  background: 'var(--bg-elevated)',
                  border: `1px solid ${errors.password ? 'var(--status-red)' : 'var(--border-default)'}`,
                  color: 'var(--text-primary)',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--gold-primary)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = errors.password ? 'var(--status-red)' : 'var(--border-default)')}
              />
              {errors.password && (
                <p className="text-xs mt-1" style={{ color: 'var(--status-red)' }}>
                  {errors.password.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 rounded text-sm font-medium tracking-wide transition-all mt-2"
              style={{
                background: isSubmitting ? 'var(--gold-dark)' : 'var(--gold-primary)',
                color: '#0A0A0A',
                opacity: isSubmitting ? 0.7 : 1,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
              }}
            >
              {isSubmitting ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
