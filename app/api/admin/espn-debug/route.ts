import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const adminKey = req.headers.get('x-admin-key') ?? req.nextUrl.searchParams.get('key') ?? ''
  if (adminKey !== (process.env.ADMIN_KEY ?? 'admin123')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const res = await fetch(
    'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard',
    { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bolao/1.0)' }, cache: 'no-store' }
  )
  if (!res.ok) return NextResponse.json({ error: `ESPN ${res.status}` })
  const data = await res.json()

  const events = (data.events ?? []).map((event: any) => {
    const competition = event.competitions?.[0]
    const competitors = (competition?.competitors ?? []).map((c: any) => ({
      id: c.team?.id,
      abbr: c.team?.abbreviation,
      name: c.team?.displayName,
      score: c.score,
      homeAway: c.homeAway,
    }))
    const details = (competition?.details ?? []).map((d: any) => ({
      type: d.type?.text,
      clock: d.clock?.displayValue,
      team: d.team?.id,
      athletes: (d.athletesInvolved ?? []).map((a: any) => a.displayName),
    }))
    return {
      name: event.name,
      status: competition?.status?.type?.name,
      clock: competition?.status?.displayClock,
      competitors,
      details,
    }
  })

  return NextResponse.json({ events })
}
