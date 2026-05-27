import { useState, useEffect } from 'react'

export function useIsTablet(): boolean {
  const [isTablet, setIsTablet] = useState(() => {
    const w = window.innerWidth
    return w >= 768 && w < 1024
  })

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px) and (max-width: 1023px)')
    const handler = (e: MediaQueryListEvent) => setIsTablet(e.matches)
    setIsTablet(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return isTablet
}
