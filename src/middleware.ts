import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { cacheService } from './lib/cache-service'
import type { NextRequest } from "next/server"

// Define public routes that should be accessible without authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/api/uploadthing',
  '/site',
  '/user/sign-in(.*)',
  '/user/sign-up(.*)',
  '/accept-invite(.*)',
  '/api/invites/accept(.*)',
  '/api/invites/(.*)',
  '/verify-email(.*)',
  '/api/user/role(.*)',
  '/api/user/(.*)/client',
  '/api/validate-email',
  '/api/health',
  '/api/projects/(.*)/heatmap/clicks', // Add heatmap endpoint as public for debugging
  '/standalone/heatmap', // Add standalone heatmap page as public
  '/api/projects/(.*)/analytics-config', // Make analytics config public
  '/api/projects/(.*)/analytics/(.*)', // Make all analytics endpoints public
  '/client/(.*)/projects/(.*)/insights(.*)', // Make insights pages public
  '/client/(.*)/projects/(.*)/insights' // Make insights pages public
])

// Define admin-only routes
const isAdminRoute = createRouteMatcher([
  '/admin/(.*)',
  '/api/admin/(.*)'
])

// Define guest-restricted routes
const isGuestAllowedRoute = createRouteMatcher([
  '/client/:clientId', // Base client route
  '/client/:clientId/projects', // Client's projects list
  '/client/:clientId/projects/:projectId', // Specific project route
  '/client/:clientId/projects/:projectId/(.*)', // Specific project route with params
  '/client/:clientId/projects/:projectId/insights', // Project insights page
  '/client/:clientId/projects/:projectId/insights/(.*)', // Project insights subpages
  '/api/clients/:clientId', // Client API routes
  '/api/projects/:projectId', // Project API routes
  '/api/projects/:projectId/(.*)', // Project API routes
  '/api/projects/:projectId/analytics/(.*)', // Analytics API routes for projects
  '/api/projects/:projectId/analytics-config', // Analytics config endpoint
  '/api/health',
  '/api/user/role',
  '/api/validate-email'
])

const CACHE_TTL = 60 // 1 minute cache for role and client data

async function getUserRole(userId: string | null, baseUrl: string): Promise<string | null> {
  if (!userId) return null
  
  try {
    // Try cache first
    const cachedRole = await cacheService.get<string>('user:role', { userId })
    if (cachedRole) {
      console.log('Using cached role for user:', { userId, role: cachedRole })
      return cachedRole
    }

    // DIRECT DB ACCESS: Instead of making API calls that might fail
    try {
      console.log('Attempting direct DB access for role check')
      // Import the db client directly
      const { db } = await import('./lib/db')
      
      // Query the database directly
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { role: true }
      })
      
      if (user) {
        console.log('Direct DB role check successful:', { userId, role: user.role })
        // Cache the role
        await cacheService.set('user:role', user.role, CACHE_TTL, { userId })
        return user.role
      } else {
        console.log('User not found in direct DB check:', userId)
      }
    } catch (dbError) {
      console.error('Direct DB access failed:', dbError)
    }
    
    // If direct DB access fails, try the API routes as fallback
    try {
      // Try the new endpoint first
      const apiUrl = `${baseUrl}/api/user/role-check`
      const response = await fetch(apiUrl, {
        headers: {
          'x-middleware-preflight': 'true'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log('Role API Response from new endpoint:', { data, userId })
        
        if (data.role) {
          // Cache the role
          await cacheService.set('user:role', data.role, CACHE_TTL, { userId })
          return data.role
        }
      }
    } catch (error) {
      console.log('Error with new role endpoint:', error)
    }
    
    // Fall back to original endpoint
    try {
      const apiUrl = `${baseUrl}/api/user/role?userId=${userId}`
      const response = await fetch(apiUrl)
      if (response.ok) {
        const data = await response.json()
        console.log('Role API Response from original endpoint:', { data, userId })
        
        // Cache the role
        await cacheService.set('user:role', data.role, CACHE_TTL, { userId })
        return data.role
      } else {
        console.log('Failed to fetch role from API:', {
          status: response.status,
          statusText: response.statusText,
          userId
        })
      }
    } catch (apiError) {
      console.error('API fallback failed:', apiError)
    }
    
    // If all methods fail, return a default role to prevent blocking users
    console.log('All role check methods failed, using default role for:', userId)
    return 'USER' // Default fallback role
  } catch (error) {
    console.error('Error in getUserRole:', error)
    // Return a default role to prevent blocking users
    return 'USER' // Default fallback role
  }
}

async function getUserClientId(userId: string, baseUrl: string): Promise<string | null> {
  try {
    // Try cache first
    const cachedClientId = await cacheService.get<string>('user:client', { userId })
    if (cachedClientId) {
      console.log('Using cached client ID for user:', { userId, clientId: cachedClientId })
      return cachedClientId
    }

    const response = await fetch(`${baseUrl}/api/user/${userId}/client`)
    if (!response.ok) return null
    const data = await response.json()

    // Cache the client ID
    await cacheService.set('user:client', data.clientId, CACHE_TTL, { userId })
    return data.clientId
  } catch (error) {
    console.error('Error fetching user client:', error)
    return null
  }
}

const ALLOWED_ORIGINS = [
  'https://newing-brochure-847158.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
  'https://green-book-sigma.vercel.app'
]

// Function to check if a request is for the heatmap endpoint
function isHeatmapRequest(pathname: string): boolean {
  return pathname.includes('/api/projects/') && pathname.includes('/heatmap/clicks')
}

// Handle CORS for heatmap requests
function handleCORS(request: NextRequest) {
  const origin = request.headers.get('origin')
  
  // For development, allow requests without origin
  if (!origin || ALLOWED_ORIGINS.includes(origin)) {
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      const response = new NextResponse(null, { status: 204 })
      if (origin) {
        response.headers.set('Access-Control-Allow-Origin', origin)
      } else {
        response.headers.set('Access-Control-Allow-Origin', '*')
      }
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      response.headers.set('Access-Control-Max-Age', '86400')
      return response
    }

    // For actual requests, proceed with the request but add CORS headers
    const response = NextResponse.next()
    if (origin) {
      response.headers.set('Access-Control-Allow-Origin', origin)
    } else {
      response.headers.set('Access-Control-Allow-Origin', '*')
    }
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    
    return response
  }

  return new NextResponse(null, { status: 403 })
}

export default clerkMiddleware((auth, req) => {
  const { pathname } = req.nextUrl
  const url = req.nextUrl

  console.log('\n=== Middleware Processing ===')
  console.log('Request path:', pathname)
  console.log('Request method:', req.method)
  console.log('Request headers:', Object.fromEntries(req.headers.entries()))

  // Handle root and site routes first
  if (pathname === '/' || pathname === '/site') {
    console.log('Root/site route - rewriting to /site')
    return NextResponse.rewrite(new URL('/site', req.url))
  }

  // Handle CORS and bypass auth for heatmap requests
  if (isHeatmapRequest(pathname)) {
    console.log('Heatmap request detected - handling CORS and bypassing auth')
    return handleCORS(req)
  }

  // For all other requests, proceed with Clerk's authentication
  return auth().then(async (authData) => {
    console.log('Auth data:', {
      userId: authData.userId,
      sessionId: authData.sessionId,
      hasSession: !!authData.sessionId
    })

    const searchParams = url.searchParams.toString()
    const pathWithSearchParams = `${url.pathname}${searchParams ? `?${searchParams}` : ''}`
    const baseUrl = `${url.protocol}//${url.host}`

    // Check if this is a public route
    if (isPublicRoute(req)) {
      return NextResponse.next()
    }

    // For protected routes, ensure user is authenticated
    const { userId } = authData
    if (!userId) {
      return NextResponse.redirect(new URL('/user/sign-in', req.url))
    }

    // Rest of the middleware logic...
    console.log('Middleware - Processing request:', {
      pathname: url.pathname,
      searchParams: searchParams,
      fullUrl: req.url
    })

    const actor = (authData as any).actor
    const privateMetadata = actor?.privateMetadata || {}
    const publicMetadata = actor?.publicMetadata || {}
    
    const dbRole = await getUserRole(userId, baseUrl)
    const role = dbRole || privateMetadata.role || publicMetadata.role || '[DEFAULT_ROLE_FALLBACK]'
    
    console.log('Middleware - User Info:', {
      userId,
      sessionId: authData.sessionId,
      hasSession: !!authData.sessionId,
      role,
      dbRole,
      metadataRole: privateMetadata.role || publicMetadata.role,
      isAuthenticated: true,
      email: actor?.emailAddresses?.[0]?.emailAddress
    })

    // Check admin route access
    if (isAdminRoute(req)) {
      if (role !== 'ADMIN') {
        console.log('Non-admin user attempting to access admin route:', url.pathname)
        return NextResponse.redirect(new URL('/user/sign-in', req.url))
      }
    }

    // Handle role-based redirects after sign-in
    if (url.pathname === '/user/sign-in' || url.pathname === '/sign-in') {
      if (role === 'GUEST') {
        const clientId = await getUserClientId(userId, baseUrl)
        if (clientId) {
          return NextResponse.redirect(new URL(`/client/${clientId}`, req.url))
        }
      }
      return NextResponse.redirect(new URL(`/user/${userId}`, req.url))
    }

    // Handle role-based access for guests
    if (role === 'GUEST') {
      const clientId = await getUserClientId(userId, baseUrl)
      
      const isAllowedRoute = isGuestAllowedRoute(req)
      const isPublic = isPublicRoute(req)
      
      if (!isAllowedRoute && !isPublic) {
        const isClientSideNavigation = req.headers.get('rsc') !== null || 
                                     req.headers.get('next-router-state-tree') !== null ||
                                     searchParams.includes('_rsc')
        
        if (!isClientSideNavigation) {
          console.log('Guest user attempting to access unauthorized route:', url.pathname)
          return NextResponse.redirect(new URL(`/client/${clientId}`, req.url))
        }
      }

      if (isAllowedRoute && !isPublic) {
        const urlClientId = url.pathname.split('/')[2]
        if (urlClientId && urlClientId !== clientId) {
          console.log('Guest attempting to access unauthorized client:', urlClientId)
          return NextResponse.redirect(new URL(`/client/${clientId}`, req.url))
        }
      }
    }

    // Handle sign-in/sign-up redirects
    if (url.pathname === '/sign-in' || url.pathname === '/sign-up') {
      const redirectPath = url.pathname === '/sign-in' ? '/user/sign-in' : '/user/sign-up'
      const redirectUrl = `${redirectPath}${searchParams ? `?${searchParams}` : ''}`
      return NextResponse.redirect(new URL(redirectUrl, req.url))
    }

    // Skip email verification for invited users
    if (url.pathname.startsWith('/accept-invite') || url.pathname.startsWith('/api/invites')) {
      if (url.pathname.includes('verify-email')) {
        return NextResponse.redirect(new URL('/accept-invite', req.url))
      }
      return NextResponse.next()
    }

    return NextResponse.next()
  })
})

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)']
}