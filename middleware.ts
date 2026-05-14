import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

/**
 * Route-based role requirements using level-based hierarchy
 * 100 = OWNER, 50 = ADMIN, 10 = VIEWER
 */
const PROTECTED_ROUTES: Array<{
  pattern: RegExp
  requiredLevel?: number
}> = [
  // Admin-only routes (level 50+)
  { pattern: /^\/dashboard\/admin\/.*/, requiredLevel: 50 },
  { pattern: /^\/dashboard\/teams\/.*/, requiredLevel: 50 },
  { pattern: /^\/dashboard\/credentials\/.*/, requiredLevel: 50 },
  { pattern: /^\/dashboard\/settings\/.*/, requiredLevel: 10 },
  
  // Viewer can access files and links (level 10+)
  { pattern: /^\/dashboard\/files\/.*/, requiredLevel: 10 },
  { pattern: /^\/dashboard\/links\/.*/, requiredLevel: 10 },
  { pattern: /^\/dashboard\/?$/, requiredLevel: 10 },
]

// Public routes that bypass authentication
const PUBLIC_ROUTES = [
  /^\/share\/[a-zA-Z0-9-]+$/,
  /^\/api\/health$/,
  /^\/api\/auth\/.*$/,
]

const isProduction = process.env.NODE_ENV === 'production'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Check public routes first
  if (PUBLIC_ROUTES.some((route) => route.test(pathname))) {
    return NextResponse.next()
  }

  // Get authentication token
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })

  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register')

  // Redirect unauthenticated users to login
  if (!token && !isAuthPage) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    loginUrl.searchParams.set('error', 'unauthorized')
    return NextResponse.redirect(loginUrl)
  }

  // Redirect authenticated users away from auth pages
  if (token && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Check role-based access for protected routes
  if (token) {
    // Treat null roleLevel (stale JWT) as level 0 — no access to protected routes.
    // Page-level requireUser() will redirect to login if the session is fully expired.
    const effectiveLevel = token.roleLevel != null ? (token.roleLevel as number) : 0;

    // Check protected route requirements
    for (const route of PROTECTED_ROUTES) {
      if (route.pattern.test(pathname)) {
        if (route.requiredLevel && effectiveLevel < route.requiredLevel) {
          // Return 403 for API routes in production, redirect for pages
          if (isProduction && pathname.startsWith("/api/")) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
          }

          // For UI routes, redirect to dashboard
          if (pathname !== "/dashboard") {
            return NextResponse.redirect(new URL("/dashboard", request.url));
          }
        }
        break;
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/files/:path*',
    '/teams/:path*',
    '/settings/:path*',
    '/login',
    '/register',
  ],
}
