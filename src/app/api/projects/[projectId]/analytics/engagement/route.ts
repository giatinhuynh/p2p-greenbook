import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { AnalyticsConfig } from '@/lib/google-analytics/types/analytics-config'
import { gaClient } from '@/lib/google-analytics/ga-client'

const engagementQuerySchema = z.object({
  startDate: z.string().transform(str => new Date(str)),
  endDate: z.string().transform(str => new Date(str)),
  url: z.string().optional().nullable()
})

export async function GET(
  req: Request,
  { params }: { params: { projectId: string } }
) {
  try {
    console.log('\n=== Analytics Engagement API Request ===');
    console.log('Project ID:', params.projectId);
    
    const session = await auth();
    const userId = session?.userId;

    if (!userId) {
      console.log('Unauthorized: No user ID');
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401 }
      )
    }

    // Get project's analytics config
    console.log('Fetching analytics config for project:', params.projectId);
    const config = await db.analyticsConfig.findUnique({
      where: { projectId: params.projectId }
    }) as unknown as AnalyticsConfig;

    if (!config) {
      console.log('Analytics not configured for project:', params.projectId);
      return new NextResponse(
        JSON.stringify({ error: 'Analytics not configured for this project' }),
        { status: 400 }
      )
    }

    // Log the analytics configuration
    console.log('Analytics configuration:', {
      projectId: params.projectId,
      gaEnabled: config.gaEnabled,
      gaPropertyId: config.gaPropertyId
    });

    // Parse and validate query parameters
    const { searchParams } = new URL(req.url)
    console.log('Query parameters:', Object.fromEntries(searchParams.entries()));
    
    const queryResult = engagementQuerySchema.safeParse({
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      url: searchParams.get('url')
    })

    if (!queryResult.success) {
      console.error('Invalid query parameters:', queryResult.error);
      return new NextResponse(
        JSON.stringify({ error: 'Invalid query parameters', details: queryResult.error }),
        { status: 400 }
      )
    }

    const { startDate, endDate, url } = queryResult.data
    console.log('Validated query parameters:', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      url: url || 'all'
    });

    try {
      // Check if Google Analytics is enabled
      if (!config.gaEnabled || !config.gaPropertyId) {
        return new NextResponse(
          JSON.stringify({ error: 'Google Analytics is not configured for this project' }),
          { status: 400 }
        );
      }

      console.log('Using Google Analytics for engagement metrics');
      
      // Get engagement metrics from GA4
      const engagementMetrics = await gaClient.getEngagementMetrics(
        config.gaPropertyId,
        url || null,
        startDate,
        endDate
      );
      
      console.log('GA4 engagement metrics received');
      
      return new NextResponse(
        JSON.stringify(engagementMetrics),
        { 
          status: 200,
          headers: {
            'Cache-Control': 'private, max-age=300' // Cache for 5 minutes
          }
        }
      );
    } catch (error) {
      console.error('Error fetching engagement metrics:', error);
      return new NextResponse(
        JSON.stringify({ 
          error: 'Failed to fetch engagement metrics', 
          details: error instanceof Error ? error.message : 'Unknown error' 
        }),
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in engagement route:', error)
    return new NextResponse(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    )
  }
} 