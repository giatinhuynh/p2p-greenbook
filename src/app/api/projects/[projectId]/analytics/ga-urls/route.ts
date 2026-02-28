import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { gaClient } from '@/lib/google-analytics/ga-client';
import { z } from 'zod';
import { GoogleAnalyticsClient } from '@/lib/google-analytics/ga-client';

const urlsQuerySchema = z.object({
  startDate: z.string().transform(str => new Date(str)),
  endDate: z.string().transform(str => new Date(str)),
  sortBy: z.enum(['screenPageViews', 'totalUsers', 'averageSessionDuration', 'bounceRate']).optional().default('screenPageViews'),
  fetchAllUrls: z.string().optional().transform(str => str === 'true')
});

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    console.log('\n=== Google Analytics URLs API Request ===');
    console.log('Project ID:', params.projectId);
    
    // Skip authentication for analytics endpoints

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

    // Check if Google Analytics is enabled
    if (!config.gaEnabled || !config.gaPropertyId) {
      console.log('Google Analytics not enabled for project:', params.projectId);
      return NextResponse.json(
        { error: 'Google Analytics not enabled for this project' },
        { status: 400 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    console.log('Query parameters:', Object.fromEntries(searchParams.entries()));
    
    // Default to last 30 days if no dates provided
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const queryResult = urlsQuerySchema.safeParse({
      startDate: searchParams.get('startDate') || startDate.toISOString(),
      endDate: searchParams.get('endDate') || endDate.toISOString(),
      sortBy: searchParams.get('sortBy') || 'screenPageViews',
      fetchAllUrls: searchParams.get('fetchAllUrls') || 'true'
    });

    if (!queryResult.success) {
      console.error('Invalid query parameters:', queryResult.error);
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryResult.error },
        { status: 400 }
      );
    }

    const { startDate: parsedStartDate, endDate: parsedEndDate, sortBy, fetchAllUrls } = queryResult.data;

    // Validate dates to ensure they're not in the future
    const now = new Date();
    let validStartDate = new Date(parsedStartDate);
    let validEndDate = new Date(parsedEndDate);
    
    // Check if start date is in the future
    if (validStartDate > now) {
      console.error(`Start date ${validStartDate.toISOString()} is in the future! Using 30 days ago instead.`);
      validStartDate = new Date(now);
      validStartDate.setDate(now.getDate() - 30);
      validStartDate.setHours(0, 0, 0, 0);
    }
    
    // Check if end date is in the future
    if (validEndDate > now) {
      console.error(`End date ${validEndDate.toISOString()} is in the future! Using current date instead.`);
      validEndDate = new Date(now);
    }

    console.log('Fetching URLs with params:', {
      startDate: validStartDate.toISOString(),
      endDate: validEndDate.toISOString(),
      propertyId: config.gaPropertyId,
      sortBy: sortBy,
      fetchAllUrls: fetchAllUrls
    });

    // Create a Google Analytics client
    const gaClient = new GoogleAnalyticsClient();
    
    // Clear all caches for this property ID to ensure fresh data
    gaClient.clearCache(`ga-data-${config.gaPropertyId}`);
    
    // Fetch URLs from Google Analytics
    const urls = await gaClient.getPageUrls(
      config.gaPropertyId,
      validStartDate,
      validEndDate,
      100, // limit
      sortBy as any,
      true // fetchAllUrls = true - always fetch all URLs
    );

    console.log(`Fetched ${urls.length} URLs from Google Analytics`);

    // Get project's deployment URL to normalize URLs
    const project = await db.project.findUnique({
      where: { id: params.projectId },
      select: { deploymentUrl: true }
    });

    if (!project?.deploymentUrl) {
      console.log('Project deployment URL not configured');
      return NextResponse.json({ urls });
    }

    // Normalize URLs with the project's deployment URL
    const deploymentUrl = project.deploymentUrl;
    const normalizedUrls = urls.map(page => {
      try {
        // If the URL is just a path, prepend the deployment URL
        const fullUrl = page.url.startsWith('http') 
          ? page.url 
          : `${deploymentUrl.replace(/\/$/, '')}${page.url.startsWith('/') ? page.url : `/${page.url}`}`;
        
        return {
          ...page,
          url: fullUrl
        };
      } catch (error) {
        console.error('Error normalizing URL:', page.url, error);
        return page;
      }
    });

    // Filter out localhost URLs
    const productionUrls = normalizedUrls.filter(page => {
      return !(page.url.includes('localhost') || page.url.includes('127.0.0.1'));
    });

    console.log(`Normalized ${normalizedUrls.length} URLs, filtered out ${normalizedUrls.length - productionUrls.length} localhost URLs`);
    
    // Additional deduplication to ensure consistent results in API
    // This step focuses specifically on merging localhost and production URLs
    const dedupedUrlsMap = new Map<string, any>();
    
    productionUrls.forEach(page => {
      try {
        // Extract path for deduplication
        let pathForDedup = '';
        try {
          const url = new URL(page.url);
          pathForDedup = url.pathname + url.search;
        } catch (e) {
          pathForDedup = page.path;
        }
        
        // Normalize the path
        const normalizedPath = pathForDedup.toLowerCase().replace(/\/+$/, '');
        
        if (dedupedUrlsMap.has(normalizedPath)) {
          // If we already have this URL, merge or decide which to keep
          const existingPage = dedupedUrlsMap.get(normalizedPath);
          
          // Calculate total metrics
          const totalPageViews = (existingPage.pageViews || 0) + (page.pageViews || 0);
          const totalUniqueVisitors = (existingPage.uniqueVisitors || 0) + (page.uniqueVisitors || 0);
          
          // Prefer entries with descriptive titles
          const currentHasGenericTitle = !page.title || page.title === 'Newing' || page.title === 'Page';
          const existingHasGenericTitle = !existingPage.title || existingPage.title === 'Newing' || existingPage.title === 'Page';
          
          if (existingHasGenericTitle && !currentHasGenericTitle) {
            // Current page has better title
            dedupedUrlsMap.set(normalizedPath, {
              ...page,
              pageViews: totalPageViews,
              uniqueVisitors: totalUniqueVisitors
            });
          } else if (!existingHasGenericTitle) {
            // Keep existing good title but update metrics
            dedupedUrlsMap.set(normalizedPath, {
              ...existingPage,
              pageViews: totalPageViews,
              uniqueVisitors: totalUniqueVisitors
            });
          }
        } else {
          // First time seeing this path
          dedupedUrlsMap.set(normalizedPath, page);
        }
      } catch (e) {
        console.error('Error processing page during deduplication:', page.url, e);
        dedupedUrlsMap.set(page.url, page);
      }
    });
    
    const finalUrls = Array.from(dedupedUrlsMap.values());
    console.log(`Deduplicated from ${normalizedUrls.length} to ${finalUrls.length} URLs`);

    return NextResponse.json(
      { urls: finalUrls },
      {
        headers: {
          'Cache-Control': 'private, max-age=300' // Cache for 5 minutes
        }
      }
    );
  } catch (error) {
    console.error('Error fetching GA URLs:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch URLs from Google Analytics', 
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
} 