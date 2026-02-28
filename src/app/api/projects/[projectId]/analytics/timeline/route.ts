import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { GoogleAnalyticsClient } from '@/lib/google-analytics/ga-client';

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

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const url = searchParams.get('url');

    if (!startDate || !endDate || !url) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Get analytics config
    const config = await db.analyticsConfig.findUnique({
      where: { projectId: params.projectId }
    });

    if (!config?.gaEnabled || !config?.gaPropertyId) {
      return NextResponse.json(
        { error: 'Google Analytics not configured' },
        { status: 400 }
      );
    }

    // Create GA client
    const gaClient = new GoogleAnalyticsClient();

    // Get timeline data
    const data = await gaClient.getTimelineData(
      config.gaPropertyId,
      new Date(startDate),
      new Date(endDate),
      url
    );

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching timeline data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch timeline data' },
      { status: 500 }
    );
  }
} 