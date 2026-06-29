'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * iOS-like "liquid glass" follower: a frosted, blurred blob that appears under
 * the finger while actively dragging/swiping, then fades out. Purely decorative
 * (pointer-events: none), mounted once at the app root.
 */
export function TouchGlass() {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [active, setActive] = useState(false)
  const start = useRef<{ x: number; y: number } | null>(null)
  const fade = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0]
      start.current = { x: t.clientX, y: t.clientY }
      setPos({ x: t.clientX, y: t.clientY })
    }
    const onMove = (e: TouchEvent) => {
      const t = e.touches[0]
      const s = start.current
      if (!s) return
      const moved = Math.hypot(t.clientX - s.x, t.clientY - s.y)
      if (moved > 10) {
        if (fade.current) clearTimeout(fade.current)
        setActive(true)
        setPos({ x: t.clientX, y: t.clientY })
      }
    }
    const onEnd = () => {
      setActive(false)
      if (fade.current) clearTimeout(fade.current)
      fade.current = setTimeout(() => setPos(null), 220)
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
    }
  }, [])

  if (!pos) return null
  return (
    <div
      aria-hidden
      style={{ position: 'fixed', left: pos.x, top: pos.y, transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 9999 }}
      className={`transition-all duration-200 ease-out ${active ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}
    >
      <div
        style={{
          width: 72, height: 72, borderRadius: 9999,
          backdropFilter: 'blur(7px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(7px) saturate(1.4)',
          background: 'radial-gradient(circle at 35% 28%, rgba(255,255,255,0.28), rgba(255,255,255,0.06) 58%, transparent 72%)',
          boxShadow: 'inset 0 1px 8px rgba(255,255,255,0.35), inset 0 -2px 8px rgba(0,0,0,0.18), 0 6px 18px rgba(0,0,0,0.28)',
          border: '1px solid rgba(255,255,255,0.22)',
        }}
      />
    </div>
  )
}
