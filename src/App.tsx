import { useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import AppShell from '@/components/layout/AppShell'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

import LoginPage from '@/pages/auth/LoginPage'

const DashboardPage    = lazy(() => import('@/pages/DashboardPage'))
const ClientsPage      = lazy(() => import('@/pages/clients/ClientsPage'))
const ClientDetailPage = lazy(() => import('@/pages/clients/ClientDetailPage'))
const DealsPage        = lazy(() => import('@/pages/deals/DealsPage'))
const DealDetailPage   = lazy(() => import('@/pages/deals/DealDetailPage'))
const InstallmentsPage = lazy(() => import('@/pages/installments/InstallmentsPage'))
const ExpensesPage     = lazy(() => import('@/pages/expenses/ExpensesPage'))
const WorkTrackerPage  = lazy(() => import('@/pages/work/WorkTrackerPage'))
const AdminPage        = lazy(() => import('@/pages/admin/AdminPage'))
const SettingsPage     = lazy(() => import('@/pages/settings/SettingsPage'))

function Protected({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  )
}

const PageFallback = (
  <div className="flex items-center justify-center py-24">
    <LoadingSpinner size="lg" />
  </div>
)

export default function App() {
  const initialize = useAuthStore((s) => s.initialize)

  useEffect(() => {
    initialize()
  }, [initialize])

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-default)',
            fontSize: '13px',
          },
        }}
      />
      <Suspense fallback={PageFallback}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          <Route path="/dashboard"    element={<Protected><DashboardPage /></Protected>} />
          <Route path="/clients"      element={<Protected><ClientsPage /></Protected>} />
          <Route path="/clients/:id"  element={<Protected><ClientDetailPage /></Protected>} />
          <Route path="/deals"        element={<Protected><DealsPage /></Protected>} />
          <Route path="/deals/:id"    element={<Protected><DealDetailPage /></Protected>} />
          <Route path="/installments" element={<Protected><InstallmentsPage /></Protected>} />
          <Route path="/expenses"     element={<Protected><ExpensesPage /></Protected>} />
          <Route path="/work"         element={<Protected><WorkTrackerPage /></Protected>} />
          <Route path="/settings"     element={<Protected><SettingsPage /></Protected>} />
          <Route path="/admin"        element={<Protected><AdminPage /></Protected>} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
