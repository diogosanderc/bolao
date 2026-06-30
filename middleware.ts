import { NextRequest, NextResponse } from 'next/server'

const MAINTENANCE = false
const PREVIEW_SECRET = 'bolao2026preview'

export function middleware(req: NextRequest) {
  if (!MAINTENANCE) return NextResponse.next()

  const { pathname } = req.nextUrl

  // Always allow: maintenance page, API routes, Next.js internals
  if (
    pathname.startsWith('/manutencao') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/')
  ) {
    return NextResponse.next()
  }

  // Allow if preview cookie is set
  const previewCookie = req.cookies.get('bolao_preview')?.value
  if (previewCookie === PREVIEW_SECRET) {
    return NextResponse.next()
  }

  // Set cookie and redirect to home when ?preview=secret is in the URL
  const previewParam = req.nextUrl.searchParams.get('preview')
  if (previewParam === PREVIEW_SECRET) {
    const url = req.nextUrl.clone()
    url.searchParams.delete('preview')
    const res = NextResponse.redirect(url)
    res.cookies.set('bolao_preview', PREVIEW_SECRET, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 8, // 8 horas
      path: '/',
    })
    return res
  }

  return NextResponse.redirect(new URL('/manutencao', req.url))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon-|manifest|sw\\.js).*)'],
}
