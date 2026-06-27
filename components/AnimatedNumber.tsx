'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  value: number
  className?: string
  /** animation duration in ms */
  duration?: number
}

/**
 * Counts up (or down) to `value` whenever it changes, with a subtle pop.
 * On first mount it shows the value immediately (no count-up from 0).
 */
export function AnimatedNumber({ value, className = '', duration = 600 }: Props) {
  const [display, setDisplay] = useState(value)
  const prevRef = useRef(value)
  const [pop, setPop] = useState(false)
  const rafRef = useRef<number | null>(null)
  const mountedRef = useRef(false)

  useEffect(() => {
    // Skip animation on first render
    if (!mountedRef.current) {
      mountedRef.current = true
      prevRef.current = value
      setDisplay(value)
      return
    }
    const from = prevRef.current
    const to = value
    if (from === to) return

    prevRef.current = to
    setPop(true)
    const popTimer = setTimeout(() => setPop(false), 500)

    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(from + (to - from) * eased))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      clearTimeout(popTimer)
    }
  }, [value, duration])

  return (
    <span className={`inline-block ${pop ? 'animate-number-pop' : ''} ${className}`}>
      {display}
    </span>
  )
}
