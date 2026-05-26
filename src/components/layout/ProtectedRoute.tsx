import { Navigate } from 'react-router-dom'
import { useAuth } from '@/store/authStore'

interface ProtectedRouteProps {
  children: React.ReactNode
  adminOnly?: boolean
}

export default function ProtectedRoute({ children, adminOnly = false }: ProtectedRouteProps) {
  const { user, isAdmin, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div
          className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: 'var(--border-subtle)', borderTopColor: 'var(--gold-primary)' }}
        />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && !isAdmin) return <Navigate to="/dashboard" replace />

  return <>{children}</>
}
