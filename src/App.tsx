import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import AppShell from '@/components/layout/AppShell'

import LoginPage from '@/pages/auth/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import ClientsPage from '@/pages/clients/ClientsPage'
import ClientDetailPage from '@/pages/clients/ClientDetailPage'
import DealsPage from '@/pages/deals/DealsPage'
import DealDetailPage from '@/pages/deals/DealDetailPage'
import InstallmentsPage from '@/pages/installments/InstallmentsPage'
import ExpensesPage from '@/pages/expenses/ExpensesPage'
import WorkTrackerPage from '@/pages/work/WorkTrackerPage'
import AdminPage from '@/pages/admin/AdminPage'
import SettingsPage from '@/pages/settings/SettingsPage'

function Protected({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  )
}

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
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        <Route path="/dashboard" element={<Protected><DashboardPage /></Protected>} />
        <Route path="/clients" element={<Protected><ClientsPage /></Protected>} />
        <Route path="/clients/:id" element={<Protected><ClientDetailPage /></Protected>} />
        <Route path="/deals" element={<Protected><DealsPage /></Protected>} />
        <Route path="/deals/:id" element={<Protected><DealDetailPage /></Protected>} />
        <Route path="/installments" element={<Protected><InstallmentsPage /></Protected>} />
        <Route path="/expenses" element={<Protected><ExpensesPage /></Protected>} />
        <Route path="/work" element={<Protected><WorkTrackerPage /></Protected>} />
        <Route path="/settings" element={<Protected><SettingsPage /></Protected>} />

        <Route
          path="/admin"
          element={
            <ProtectedRoute adminOnly>
              <AppShell><AdminPage /></AppShell>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
