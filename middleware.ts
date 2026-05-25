import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Define route access mappings based on roles
const routeRoles: Record<string, string[]> = {
  '/ceo': ['CEO'],
  '/manager': ['Manager', 'CEO'],
  '/reception': ['Receptionist', 'Manager', 'CEO'],
  '/kitchen': ['Kitchen', 'Manager', 'CEO'],
  '/delivery': ['Dispatcher', 'Manager', 'CEO'],
  '/rider': ['Rider']
};

export default function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Check if the current path is protected
  const protectedRoute = Object.keys(routeRoles).find(route => path.startsWith(route));

  if (protectedRoute) {
    // Check for dummy session cookie
    const dummySessionCookie = request.cookies.get('rms_dummy_session');

    if (!dummySessionCookie) {
      // No session found -> redirect to login
      return NextResponse.redirect(new URL('/login', request.url));
    }

    try {
      // Decode and parse the session data
      const sessionData = JSON.parse(decodeURIComponent(dummySessionCookie.value));
      const userRole = sessionData.role;

      // Verify if the user's role is allowed on this route
      const allowedRoles = routeRoles[protectedRoute];
      if (!allowedRoles.includes(userRole)) {
        // Unauthorized role -> redirect to login or a 403 page
        // For simplicity, redirecting to login which will handle it
        return NextResponse.redirect(new URL('/login', request.url));
      }
    } catch (error) {
      // Invalid cookie format -> redirect to login
      const response = NextResponse.redirect(new URL('/login', request.url));
      // Clear the invalid cookie
      response.cookies.delete('rms_dummy_session');
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  // Add all protected route prefixes here
  matcher: [
    '/ceo', '/ceo/:path*', 
    '/manager', '/manager/:path*', 
    '/reception', '/reception/:path*', 
    '/kitchen', '/kitchen/:path*', 
    '/delivery', '/delivery/:path*', 
    '/rider', '/rider/:path*'
  ]
};
