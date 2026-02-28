import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auth } from '@clerk/nextjs/server'
import { gaClient } from '@/lib/google-analytics/ga-client'

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    // Verify authentication
    const session = await auth()
    if (!session?.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Get the user role and check project access
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { 
        role: true,
        clientUsers: {
          select: {
            client: {
              select: {
                id: true
              }
            }
          }
        }
      }
    })
    
    // If not found, unauthorized
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized user' },
        { status: 401 }
      )
    }
    
    // Check project access for guest users
    if (user.role === 'GUEST') {
      // Get the project to verify it belongs to the client the guest has access to
      const project = await db.project.findUnique({
        where: { id: params.projectId },
        select: { clientId: true }
      })
      
      if (!project) {
        return NextResponse.json(
          { error: 'Project not found' },
          { status: 404 }
        )
      }
      
      // Check if user has access to this client
      const hasAccess = user.clientUsers.some(cu => cu.client.id === project.clientId)
      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Unauthorized access to this project' },
          { status: 403 }
        )
      }
    }

    // Get query parameters
    const url = request.nextUrl.searchParams.get('url')
    const startDate = request.nextUrl.searchParams.get('startDate')
    const endDate = request.nextUrl.searchParams.get('endDate')

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required date parameters' },
        { status: 400 }
      )
    }

    // Get project's analytics config
    const config = await db.analyticsConfig.findUnique({
      where: { projectId: params.projectId }
    })

    if (!config?.gaEnabled || !config?.gaPropertyId) {
      return NextResponse.json(
        { error: 'Google Analytics not configured for this project' },
        { status: 400 }
      )
    }

    // Get metrics from Google Analytics
    const metrics = await gaClient.getMetrics(
      config.gaPropertyId,
      url || null,
      new Date(startDate),
      new Date(endDate)
    )

    return NextResponse.json(metrics, {
      headers: {
        'Cache-Control': 'private, max-age=300' // Cache for 5 minutes
      }
    })
  } catch (error) {
    console.error('Error in analytics route:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
} 