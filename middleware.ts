import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const SESSION_COOKIE_NAME = 'sky_session';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public paths that do not require authentication
  if (
    pathname === '/login' ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/admin/sync-users') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/logo')
  ) {
    // If logged-in user visits /login, redirect to /assets
    if (pathname === '/login') {
      const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
      if (sessionCookie && sessionCookie.includes('.')) {
        return NextResponse.redirect(new URL('/assets', request.url));
      }
    }
    return NextResponse.next();
  }

  // Check for session cookie
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionCookie || !sessionCookie.includes('.')) {
    // API routes return 401 instead of redirecting
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized: Please log in' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Check for privileged access on /rent and /api/rent (only privileged users can view/use Rent)
  if (pathname.startsWith('/rent') || pathname.startsWith('/api/rent')) {
    try {
      const [data] = sessionCookie.split('.');
      const b64 = data.replace(/-/g, '+').replace(/_/g, '/');
      const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
      const session = JSON.parse(atob(b64 + pad));
      if (!session.canEdit) {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json({ error: 'Forbidden: Privileged access required' }, { status: 403 });
        }
        return NextResponse.redirect(new URL('/assets', request.url));
      }
    } catch {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized: Invalid session' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/assets', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
