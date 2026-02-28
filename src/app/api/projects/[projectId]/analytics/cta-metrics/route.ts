import { NextRequest } from 'next/server';
import { gaClient } from '@/lib/google-analytics/ga-client';
import { db } from '@/lib/db';
import { auth } from '@clerk/nextjs/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    console.log('\n=== CTA Metrics API Request ===');
    console.log('Project ID:', params.projectId);

    // Verify authentication
    const session = await auth();
    if (!session?.userId) {
      console.log('Unauthorized: No user ID');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
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
      console.log('Unauthorized: User not found');
      return new Response(JSON.stringify({ error: 'Unauthorized user' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check project access for guest users
    if (user.role === 'GUEST') {
      // Get the project to verify it belongs to the client the guest has access to
      const project = await db.project.findUnique({
        where: { id: params.projectId },
        select: { clientId: true }
      })
      
      if (!project) {
        console.log('Project not found:', params.projectId);
        return new Response(JSON.stringify({ error: 'Project not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Check if user has access to this client
      const hasAccess = user.clientUsers.some(cu => cu.client.id === project.clientId)
      if (!hasAccess) {
        console.log('Unauthorized: Guest user has no access to project client');
        return new Response(JSON.stringify({ error: 'Unauthorized access to this project' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    const searchParams = request.nextUrl.searchParams;
    const startDate = new Date(searchParams.get('startDate') || '');
    const endDate = new Date(searchParams.get('endDate') || '');
    const url = searchParams.get('url');

    console.log('Request parameters:', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      url
    });

    // Validate dates
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      console.log('Invalid date parameters provided');
      return new Response(JSON.stringify({ error: 'Invalid date parameters' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get project's analytics config
    const config = await db.analyticsConfig.findUnique({
      where: { projectId: params.projectId }
    });

    if (!config?.gaEnabled || !config?.gaPropertyId) {
      console.log('Google Analytics not enabled or property ID missing');
      return new Response(JSON.stringify({ error: 'Google Analytics not enabled for this project' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('Using GA Property ID:', config.gaPropertyId);

    // Get register button metrics
    console.log('Fetching register button metrics...');
    console.log('Note: GA4 API does not allow filtering by custom event parameters directly. To filter by source_path, set up a custom dimension in GA4.');
    
    const ctaData = await gaClient.getRegisterButtonMetrics(
      config.gaPropertyId,
      startDate,
      endDate,
      url
    );

    console.log('CTA Data response:', JSON.stringify(ctaData, null, 2));

    const totalClicks = ctaData?.rows?.[0]?.metricValues?.[0]?.value 
      ? parseInt(ctaData.rows[0].metricValues[0].value) 
      : 0;

    console.log('Total clicks:', totalClicks);

    const response = {
      cta: {
        totalClicks,
        note: 'This represents all register button clicks across all pages, as GA4 API does not allow filtering by source_path directly.'
      }
    };

    console.log('Sending response:', response);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching CTA metrics:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch CTA metrics',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}