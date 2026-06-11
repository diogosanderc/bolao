import { NextRequest, NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  const session = req.cookies.get('session')?.value
  const { pathname } = req.nextUrl

  // Protege /palpite
  if (pathname.startsWith('/palpite') && !session) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Redireciona logado que tenta acessar login/cadastro
  if ((pathname === '/login' || pathname === '/cadastro') && session) {
    return NextResponse.redirect(new URL('/palpite', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/palpite/:path*', '/login', '/cadastro'],
}
