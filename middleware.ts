import { NextRequest, NextResponse } from 'next/server'

const MAINTENANCE = true

export function middleware(req: NextRequest) {
  if (!MAINTENANCE) return NextResponse.next()

  const { pathname } = req.nextUrl

  // Allow the maintenance page itself and all API routes (keeps data accessible internally)
  if (pathname.startsWith('/manutencao') || pathname.startsWith('/api/') || pathname.startsWith('/_next/')) {
    return NextResponse.next()
  }

  return NextResponse.redirect(new URL('/manutencao', req.url))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon-|manifest|sw\\.js).*)'],
}
