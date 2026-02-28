import { analyticsService } from '@/lib/google-analytics/analytics-service'
import { AnalyticsMetrics } from '@/lib/google-analytics/types/analytics'
import { AnalyticsConfig } from '@/lib/google-analytics/types/analytics-config'
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { z } from 'zod'

const metricsQuerySchema = z.object({
  startDate: z.string().transform(str => new Date(str)),
  endDate: z.string().transform(str => new Date(str)),
  url: z.string().optional().nullable(),
  properties: z.string().optional().transform(str => {
    if (!str) return undefined;
    try {
      return JSON.parse(str);
    } catch (e) {
      return undefined;
    }
  })
});

export async function GET(
  req: Request,
  { params }: { params: { projectId: string } }
) {
  console.log('\n=== Analytics Metrics API Request ===');
  console.log('Project ID:', params.projectId);
  
  try {
    // Verify authentication
    const session = await auth();
    if (!session?.userId) {
      console.log('Unauthorized: No user ID');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    console.log('User ID:', session.userId);

    // Get project's analytics config
    console.log('Fetching analytics config for project:', params.projectId);
    const config = await db.analyticsConfig.findUnique({
      where: { projectId: params.projectId }
    }) as unknown as AnalyticsConfig;

    if (!config) {
      console.log('Analytics not configured for project:', params.projectId);
      return NextResponse.json(
        { error: 'Analytics not configured for this project' },
        { status: 400 }
      );
    }

    // Log the analytics configuration
    console.log('Analytics configuration:', {
      projectId: params.projectId,
      gaEnabled: config.gaEnabled,
      gaPropertyId: config.gaPropertyId
    });

    if (config.gaEnabled && !config.gaPropertyId) {
      console.warn('Google Analytics is enabled but no property ID is set');
    }

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    console.log('Query parameters:', Object.fromEntries(searchParams.entries()));
    
    const queryResult = metricsQuerySchema.safeParse({
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      url: searchParams.get('url'),
      properties: searchParams.get('properties')
    });

    if (!queryResult.success) {
      console.error('Invalid query parameters:', queryResult.error);
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryResult.error },
        { status: 400 }
      );
    }

    const { startDate, endDate, url, properties } = queryResult.data;

    console.log('Fetching metrics with params:', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      url,
      properties,
      projectId: params.projectId,
      gaPropertyId: config.gaPropertyId
    });

    try {
      // Use the unified analytics service
      console.log('Calling analytics service getMetrics...');
      const metrics = await analyticsService.getMetrics(
        config,
        startDate,
        endDate,
        url || null,
        properties
      );

      console.log('Raw metrics from analytics service:', JSON.stringify(metrics, null, 2));

      // Format the response with explicit defaults for all fields
      const response = {
        pageViews: metrics.pageViews ?? 0,
        uniqueVisitors: metrics.uniqueVisitors ?? 0,
        totalSessions: metrics.totalSessions ?? 0,
        totalClicks: metrics.totalSessions ?? 0, // Using sessions as a proxy for clicks if not available
        bounceRate: metrics.bounceRate ?? 0,
        averageTimeOnSite: metrics.averageTimeOnPage ?? 0,
        pagesPerSession: metrics.pagesPerSession ?? 0,
        newUsers: metrics.newUsers ?? 0,
        activeUsers: metrics.activeUsers ?? 0,
        timelineData: Array.isArray(metrics.timelineData) ? metrics.timelineData : []
      };

      console.log('Metrics API response:', JSON.stringify(response, null, 2));

      return NextResponse.json(response, {
        headers: {
          'Cache-Control': 'private, max-age=300' // Cache for 5 minutes
        }
      });
    } catch (error) {
      console.error('Error fetching analytics metrics:', error);
      return NextResponse.json(
        { 
          error: 'Failed to fetch analytics metrics', 
          details: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in metrics route:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch metrics', 
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
} 