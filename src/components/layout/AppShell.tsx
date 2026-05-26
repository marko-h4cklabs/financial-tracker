import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'
import CommandPalette from '@/components/modules/CommandPalette'

interface AppShellProps {
  children: React.ReactNode
}

export default function AppShell({ children }: AppShellProps) {
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <Sidebar />
      <Header onOpenPalette={() => setPaletteOpen(true)} />
      <main className="ml-60 pt-14 min-h-screen">
        <div className="p-6">{children}</div>
      </main>
      <CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}
