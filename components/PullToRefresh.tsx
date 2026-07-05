'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

const THRESHOLD = 65

export function PullToRefresh() {
  const pathname = usePathname()
  const [pullDist, setPullDist] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  // Home page refreshes only via the header refresh button
  const disabled = pathname === '/'

  useEffect(() => {
    if (disabled) return
    let startY = 0
    let pulling = false

    const onStart = (e: TouchEvent) => {
      if (document.body.hasAttribute('data-modal-open')) return
      if (window.scrollY <= 0 && !refreshing) {
        startY = e.touches[0].clientY
        pulling = true
      }
    }

    const onMove = (e: TouchEvent) => {
      if (!pulling) return
      const dy = e.touches[0].clientY - startY
      if (dy > 0 && window.scrollY <= 0) {
        setPullDist(Math.min(dy * 0.5, 90))
      } else {
        pulling = false
        setPullDist(0)
      }
    }

    const onEnd = () => {
      if (!pulling) return
      pulling = false
      setPullDist(d => {
        if (d >= THRESHOLD * 0.5) {
          setRefreshing(true)
          setTimeout(() => window.location.reload(), 150)
        }
        return 0
      })
    }

    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
    }
  }, [refreshing, disabled])

  if (pullDist === 0 && !refreshing) return null

  return (
    <div
      className="fixed left-0 right-0 top-0 z-50 flex justify-center pointer-events-none"
      style={{
        transform: `translateY(${refreshing ? 14 : Math.min(pullDist, 80) - 6}px)`,
        transition: pullDist === 0 ? 'transform 0.2s' : 'none',
      }}
    >
      <span className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-800/90 border border-gray-700 shadow-lg">
        <svg
          className={`w-5 h-5 text-gray-200 ${refreshing ? 'animate-spin' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transform: refreshing ? undefined : `rotate(${pullDist * 3}deg)` }}
        >
          <path d="M23 4v6h-6" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
      </span>
    </div>
  )
}
