import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { MoreHorizontal, MoreVertical } from 'lucide-react'

export interface ActionItem {
  label: string
  action: () => void
  danger?: boolean
}

interface Props {
  items: ActionItem[]
  iconSize?: number
  vertical?: boolean   // use MoreVertical icon (for checklist rows)
  minWidth?: number
}

export default function TableActionsMenu({
  items,
  iconSize = 15,
  vertical = false,
  minWidth = 140,
}: Props) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const Icon = vertical ? MoreVertical : MoreHorizontal

  function handleOpen(e: React.MouseEvent) {
    e.stopPropagation()
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    setPos({
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
    })
    setOpen((prev) => !prev)
  }

  useEffect(() => {
    if (!open) return

    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node
      if (!btnRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false)
      }
    }
    function handleScroll() { setOpen(false) }
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }

    document.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('scroll', handleScroll, true)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('scroll', handleScroll, true)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="w-7 h-7 rounded flex items-center justify-center"
        style={{ color: 'var(--text-muted)' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
      >
        <Icon size={iconSize} />
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[9999] rounded shadow-xl py-1"
          style={{
            top: pos.top,
            right: pos.right,
            minWidth,
            background: 'var(--bg-overlay)',
            border: '1px solid var(--border-default)',
          }}
        >
          {items.map(({ label, action, danger = false }) => (
            <button
              key={label}
              onClick={(e) => { e.stopPropagation(); action(); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-xs"
              style={{ color: danger ? 'var(--status-red)' : 'var(--text-secondary)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = danger ? 'rgba(224,82,82,0.08)' : 'var(--bg-elevated)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}
