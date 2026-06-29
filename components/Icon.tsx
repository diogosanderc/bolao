import React from 'react'

// Flat thin-line icon set (stroke 1.5). Use: <Icon name="trophy" size={16} />
export type IconName =
  | 'trophy' | 'target' | 'bars' | 'table' | 'check' | 'x' | 'star' | 'star-outline'
  | 'bell' | 'bell-off' | 'alert' | 'flame' | 'swords' | 'crown' | 'eye' | 'clock'
  | 'calendar' | 'download' | 'arrow-right' | 'arrow-left' | 'arrow-up' | 'arrow-down'
  | 'chevron-up' | 'chevron-down' | 'flag' | 'medal' | 'zap' | 'ball' | 'refresh'
  | 'sparkles' | 'pointer' | 'swap-h' | 'users' | 'key' | 'mail' | 'lock' | 'bulb'
  | 'money' | 'clipboard' | 'info' | 'ban' | 'cloud-rain' | 'rocket'

const P: Record<IconName, React.ReactNode> = {
  trophy: <><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" /></>,
  bars: <><path d="M3 21h18" /><rect x="5" y="11" width="3.5" height="7" rx="0.6" /><rect x="10.25" y="6" width="3.5" height="12" rx="0.6" /><rect x="15.5" y="13" width="3.5" height="5" rx="0.6" /></>,
  table: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M3 14.5h18M9 4v16" /></>,
  check: <path d="M5 12.5 10 17.5 19.5 7" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  star: <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17l-5.2 2.6 1-5.8L3.5 9.7l5.9-.9L12 3.5Z" fill="currentColor" />,
  'star-outline': <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17l-5.2 2.6 1-5.8L3.5 9.7l5.9-.9L12 3.5Z" />,
  bell: <><path d="M18 8a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" /><path d="M9 18a3 3 0 0 0 6 0" /></>,
  'bell-off': <><path d="M8.7 3A6 6 0 0 1 18 8c0 3 .5 4.5 1.5 6M6 8c0-.7.1-1.4.3-2M5 8c0 5-2 6-2 6h13M9 18a3 3 0 0 0 6 0" /><path d="M3 3l18 18" /></>,
  alert: <><path d="M12 3 1.8 20.5h20.4L12 3Z" /><path d="M12 9v5M12 17.5v.01" /></>,
  flame: <path d="M12 3c1 3-2 4-2 7a2 2 0 0 0 4 0c0-1-.5-1.8-.5-1.8C16 10 17 12 17 14a5 5 0 0 1-10 0c0-3.5 3-5 5-11Z" />,
  swords: <><path d="M14.5 3.5 21 3l-.5 6.5M3 21l6.5-.5M14.5 3.5 4 14l-1 4 4-1L17.5 6.5M9.5 9.5 14 14" /></>,
  crown: <path d="M4 18h16M3 7l4 4 5-6 5 6 4-4-2 11H5L3 7Z" />,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
  calendar: <><rect x="3" y="4.5" width="18" height="16.5" rx="2" /><path d="M3 9h18M8 2.5v4M16 2.5v4" /></>,
  download: <path d="M12 3v12m0 0 4.5-4.5M12 15l-4.5-4.5M4 19.5h16" />,
  'arrow-right': <path d="M5 12h14M13 6l6 6-6 6" />,
  'arrow-left': <path d="M19 12H5M11 6l-6 6 6 6" />,
  'arrow-up': <path d="M12 19V5M6 11l6-6 6 6" />,
  'arrow-down': <path d="M12 5v14M6 13l6 6 6-6" />,
  'chevron-up': <path d="M6 15l6-6 6 6" />,
  'chevron-down': <path d="M6 9l6 6 6-6" />,
  flag: <><path d="M5 21V4M5 4h12l-2 4 2 4H5" /></>,
  medal: <><circle cx="12" cy="15" r="5.5" /><path d="M8.5 9.5 6 3h4l2 4M15.5 9.5 18 3h-4l-2 4" /></>,
  zap: <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />,
  ball: <><circle cx="12" cy="12" r="9" /><path d="M12 7.5l3.5 2.6-1.3 4.2h-4.4L8.5 10.1 12 7.5Z" /></>,
  refresh: <><path d="M23 4v6h-6" /><path d="M20.5 15a9 9 0 1 1-2.1-9.4L23 10" /></>,
  sparkles: <path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3ZM18 14l.7 2.3L21 17l-2.3.7L18 20l-.7-2.3L15 17l2.3-.7L18 14Z" />,
  pointer: <path d="M9 11V4.5a1.5 1.5 0 0 1 3 0V11m0-1.5a1.5 1.5 0 0 1 3 0V12m0-1a1.5 1.5 0 0 1 3 0v4a5 5 0 0 1-5 5h-2.2a4 4 0 0 1-3.1-1.5L4 17s-1-1.3 0-2.2 2.2 0 2.2 0L8 16V7.5a1.5 1.5 0 0 1 3 0" />,
  'swap-h': <path d="M7 8h13M7 8l3.5-3.5M7 8l3.5 3.5M17 16H4m13 0-3.5-3.5M17 16l-3.5 3.5" />,
  users: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 5.2a3.2 3.2 0 0 1 0 5.6M17.5 14.5a5.5 5.5 0 0 1 3 5.5" /></>,
  key: <><circle cx="7.5" cy="15.5" r="4" /><path d="M10.5 12.5 20 3M16 7l3 3M14 9l2 2" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3.5 6.5 12 12.5l8.5-6" /></>,
  lock: <><rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /></>,
  bulb: <><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.5 10.8c.6.5 1 1.2 1 2v.2h5v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z" /></>,
  money: <><rect x="2.5" y="6" width="19" height="12" rx="2" /><circle cx="12" cy="12" r="2.6" /><path d="M6 9.5v.01M18 14.5v.01" /></>,
  clipboard: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4.5V3.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" /><path d="M8.5 11h7M8.5 15h5" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8v.01" /></>,
  ban: <><circle cx="12" cy="12" r="9" /><path d="M5.6 5.6 18.4 18.4" /></>,
  'cloud-rain': <><path d="M7 16a4 4 0 0 1-.5-8 5.5 5.5 0 0 1 10.6 1.4A3.5 3.5 0 0 1 17 16Z" /><path d="M8 19l-1 2M12 19l-1 2M16 19l-1 2" /></>,
  rocket: <path d="M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2m-3-3a16 16 0 0 1 9-12c3 0 4 1 4 4a16 16 0 0 1-12 9l-1-1Zm6-4a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0Z" />,
}

export function Icon({ name, size = 16, className, strokeWidth = 1.5 }: { name: IconName; size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden
    >
      {P[name]}
    </svg>
  )
}
