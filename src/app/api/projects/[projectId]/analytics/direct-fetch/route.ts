import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { gaClient } from '@/lib/google-analytics/ga-client';
import { z } from 'zod';

const directFetchSchema = z.object({
  startDate: z.string().transform(str => new Date(str)),
  endDate: z.string().transform(str => new Date(str)),
  provider: z.enum(['ga']).optional(),
  url: z.string().optional().nullable()
});

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    console.log('\n=== Direct Fetch API Request ===');
    console.log('Project ID:', params.projectId);
    
    // Skip authentication check for analytics endpoints
    
    // Get project's analytics config
    console.log('Fetching analytics config for project:', params.projectId);
    const config = await db.analyticsConfig.findUnique({
      where: { projectId: params.projectId }
    });

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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    console.log('Query parameters:', Object.fromEntries(searchParams.entries()));
    
    const queryResult = directFetchSchema.safeParse({
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      provider: searchParams.get('provider'),
      url: searchParams.get('url')
    });

    if (!queryResult.success) {
      console.error('Invalid query parameters:', queryResult.error);
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryResult.error },
        { status: 400 }
      );
    }

    const { startDate, endDate } = queryResult.data;
    let { url } = queryResult.data;

    // Decode URL if it exists
    if (url) {
      try {
        // First check if it's already decoded
        const decodedOnce = decodeURIComponent(url);
        // If it contains encoded characters, decode again
        if (decodedOnce.includes('%')) {
          url = decodeURIComponent(decodedOnce);
        } else {
          url = decodedOnce;
        }
        console.log('Decoded URL:', url);
      } catch (error) {
        console.error('Error decoding URL:', error);
        // Continue with the original URL if decoding fails
      }
    }

    console.log('Fetching metrics with params:', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      url,
      projectId: params.projectId,
      gaPropertyId: config.gaPropertyId
    });

    // Check if Google Analytics is configured
    if (!config.gaEnabled || !config.gaPropertyId) {
      return NextResponse.json(
        { error: 'Google Analytics is not configured for this project' },
        { status: 400 }
      );
    }

    try {
      console.log('Using Google Analytics for direct fetch');
      
      const metrics = await gaClient.getMetrics(
        config.gaPropertyId,
        url ?? null,
        startDate,
        endDate
      );

      // Map GA4 metrics to our response format
      const formattedMetrics = {
        ...metrics,
        // Ensure new metrics are included in response
        newUsers: metrics.newUsers || 0,
        activeUsers: metrics.activeUsers || 0
      };

      console.log('GA metrics:', JSON.stringify(formattedMetrics, null, 2));

      return NextResponse.json(formattedMetrics, {
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
    console.error('Error in direct fetch route:', error);
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