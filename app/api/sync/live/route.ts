import { NextResponse } from 'next/server'
import { runLiveSync } from '@/lib/liveSync'

// Manual trigger (fallback — background poller handles real-time sync autonomously)
export async function POST() {
  const result = await runLiveSync()
  return NextResponse.json(result)
}
