import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { AnalyticsConfig } from '@/lib/google-analytics/types/analytics-config'
import { gaClient } from '@/lib/google-analytics/ga-client'
import { TrafficSource, TrafficSourceDetail } from '@/lib/google-analytics/types/analytics'
import type { TrafficSource as GA_TrafficSource } from '@/lib/google-analytics/ga-client'

interface TrafficTypeStats {
  visits: number;
  percentage: number;
  sources: TrafficSourceDetail[];
}

interface TrafficOverview {
  direct: TrafficTypeStats;
  referral: TrafficTypeStats;
  search: TrafficTypeStats;
  social: TrafficTypeStats;
}

const trafficQuerySchema = z.object({
  startDate: z.string().transform(str => new Date(str)),
  endDate: z.string().transform(str => new Date(str)),
  type: z.enum(['overview', 'referrals', 'search', 'social']).optional(),
  url: z.string().optional().nullable()
})

export async function GET(
  req: Request,
  { params }: { params: { projectId: string } }
) {
  try {
    console.log('\n[Traffic API] Request received:', {
      projectId: params.projectId,
      url: req.url
    });

    const session = await auth();
    const userId = session?.userId;

    if (!userId) {
      console.log('[Traffic API] Unauthorized request');
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401 }
      )
    }

    // Get project's analytics config
    const config = await db.analyticsConfig.findUnique({
      where: { projectId: params.projectId }
    }) as unknown as AnalyticsConfig;

    console.log('\n[Traffic API] Project config:', {
      projectId: params.projectId,
      hasConfig: !!config,
      gaEnabled: config?.gaEnabled,
      hasGaPropertyId: !!config?.gaPropertyId
    });

    if (!config) {
      console.log('[Traffic API] Analytics not configured');
      return new NextResponse(
        JSON.stringify({ error: 'Analytics not configured for this project' }),
        { status: 400 }
      )
    }

    // Parse and validate query parameters
    const { searchParams } = new URL(req.url)
    console.log('\n[Traffic API] Raw query parameters:', {
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      type: searchParams.get('type'),
      url: searchParams.get('url')
    });

    const queryResult = trafficQuerySchema.safeParse({
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      type: searchParams.get('type'),
      url: searchParams.get('url')
    })

    if (!queryResult.success) {
      console.error('[Traffic API] Query validation error:', queryResult.error);
      return new NextResponse(
        JSON.stringify({ error: 'Invalid query parameters', details: queryResult.error }),
        { status: 400 }
      )
    }

    const { startDate, endDate, type, url } = queryResult.data
    console.log('\n[Traffic API] Validated query parameters:', { startDate, endDate, type, url });

    try {
      // Check if Google Analytics is enabled
      if (!config.gaEnabled || !config.gaPropertyId) {
        return new NextResponse(
          JSON.stringify({ error: 'Google Analytics is not configured for this project' }),
          { status: 400 }
        );
      }
      
      console.log('\n[Traffic API] Fetching traffic data from Google Analytics');
      
      // Get metrics from Google Analytics
      const metrics = await gaClient.getMetrics(
        config.gaPropertyId,
        url || null,
        startDate,
        endDate
      );

      const response = {
        sources: metrics.trafficSources.map(source => ({
          source: source.source,
          medium: source.medium,
          sessions: source.sessions,
          percentage: source.percentage
        })),
        total: metrics.totalSessions || 0
      };

      console.log('\n[Traffic API] Response:', JSON.stringify(response, null, 2));

      return new NextResponse(
        JSON.stringify(response),
        { 
          status: 200,
          headers: {
            'Cache-Control': 'private, max-age=300'
          }
        }
      );
    } catch (error) {
      console.error('[Traffic API] Error fetching traffic data:', error);
      return new NextResponse(
        JSON.stringify({ 
          error: 'Failed to fetch traffic data', 
          details: error instanceof Error ? error.message : 'Unknown error' 
        }),
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[Traffic API] Error:', error)
    return new NextResponse(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    )
  }
} 