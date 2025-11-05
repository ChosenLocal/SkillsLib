import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from './lib/auth';

/**
 * 🛡️ PRODUCTION SAFETY CHECK
 * Prevent deploying to production with authentication disabled
 */
if (process.env.NODE_ENV === 'production' && process.env.DISABLE_AUTH === 'true') {
  console.error('🚨 CRITICAL SECURITY ERROR: Cannot run in production with DISABLE_AUTH=true');
  console.error('   This would bypass all authentication and authorization.');
  console.error('   Please set DISABLE_AUTH=false in your production environment.');
  throw new Error('DISABLE_AUTH must be false in production');
}

// Temporary flag to disable auth for testing (development only)
const DISABLE_AUTH = process.env.DISABLE_AUTH === 'true';
const MOCK_TENANT_ID = process.env.MOCK_TENANT_ID || 'test-tenant-123';

if (DISABLE_AUTH) {
  console.warn('⚠️  WARNING: Authentication is DISABLED in web app');
  console.warn('📝 Using mock tenant:', MOCK_TENANT_ID);
}

export async function middleware(request: NextRequest) {
  // Bypass auth if DISABLE_AUTH flag is set
  if (DISABLE_AUTH) {
    const response = NextResponse.next();
    response.headers.set('x-tenant-id', MOCK_TENANT_ID);
    return response;
  }

  const session = await auth();

  // Public routes that don't require authentication
  const publicRoutes = [
    '/',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/verify-email',
    '/api/auth',
    '/api/trpc', // tRPC routes need to be accessible for public procedures
  ];
  const isPublicRoute = publicRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );

  // Redirect to home if accessing protected route without auth
  if (!isPublicRoute && !session?.user) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Redirect to dashboard if accessing auth pages while authenticated
  const authPages = ['/', '/register', '/forgot-password', '/reset-password'];
  if (authPages.includes(request.nextUrl.pathname) && session?.user) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Set tenant context header for authenticated requests
  const response = NextResponse.next();
  if (session?.user?.tenantId) {
    response.headers.set('x-tenant-id', session.user.tenantId);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
