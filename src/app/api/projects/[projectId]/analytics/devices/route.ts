import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { AnalyticsConfig } from '@/lib/google-analytics/types/analytics-config'
import { analyticsService } from '@/lib/google-analytics/analytics-service'

const deviceQuerySchema = z.object({
  startDate: z.string().transform(str => new Date(str)),
  endDate: z.string().transform(str => new Date(str)),
  url: z.string().optional().nullable()
})

export async function GET(
  req: Request,
  { params }: { params: { projectId: string } }
) {
  try {
    const session = await auth();
    const userId = session?.userId;

    if (!userId) {
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401 }
      )
    }

    // Get project's analytics config
    const config = await db.analyticsConfig.findUnique({
      where: { projectId: params.projectId }
    }) as unknown as AnalyticsConfig;

    if (!config) {
      return new NextResponse(
        JSON.stringify({ error: 'Analytics not configured for this project' }),
        { status: 400 }
      )
    }

    // Parse and validate query parameters
    const { searchParams } = new URL(req.url)
    const queryResult = deviceQuerySchema.safeParse({
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      url: searchParams.get('url')
    })

    if (!queryResult.success) {
      return new NextResponse(
        JSON.stringify({ error: 'Invalid query parameters', details: queryResult.error }),
        { status: 400 }
      )
    }

    const { startDate, endDate, url } = queryResult.data

    try {
      // Use the unified analytics service
      const metrics = await analyticsService.getMetrics(
        config,
        startDate,
        endDate,
        url || null
      );

      // Format the response
      const response = {
        devices: metrics.deviceData.map(device => ({
          type: device.type,
          percentage: device.percentage,
          visits: device.visits || 0
        })),
        total: metrics.totalSessions || 0
      };

      return new NextResponse(
        JSON.stringify(response),
        { 
          status: 200,
          headers: {
            'Cache-Control': 'private, max-age=300' // Cache for 5 minutes
          }
        }
      );
    } catch (error) {
      console.error('Error fetching device data:', error);
      return new NextResponse(
        JSON.stringify({ 
          error: 'Failed to fetch device data', 
          details: error instanceof Error ? error.message : 'Unknown error' 
        }),
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in devices route:', error)
    return new NextResponse(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    )
  }
} 