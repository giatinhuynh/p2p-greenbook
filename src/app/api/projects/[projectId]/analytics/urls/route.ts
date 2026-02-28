import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { gaClient } from '@/lib/google-analytics/ga-client'
import { z } from 'zod'

const CACHE_TTL = 300 // 5 minutes
const STALE_TTL = 3600 // 1 hour

const urlsQuerySchema = z.object({
  startDate: z.string()
    .nullable()
    .default(() => {
      const date = new Date();
      date.setDate(date.getDate() - 30);
      return date.toISOString();
    })
    .transform(str => new Date(str || new Date().toISOString())),
  endDate: z.string()
    .nullable()
    .default(() => new Date().toISOString())
    .transform(str => new Date(str || new Date().toISOString())),
  sortBy: z.enum(['screenPageViews', 'totalUsers', 'averageSessionDuration', 'bounceRate'])
    .nullable()
    .default('screenPageViews')
    .transform(val => val || 'screenPageViews'),
  fetchAllUrls: z.string()
    .nullable()
    .default('true')
    .transform(val => val !== 'false') // Default to true unless explicitly set to 'false'
})

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    console.log('\n=== URLs API Request ===')
    console.log('Project ID:', params.projectId)
    
    // Verify authentication
    const session = await auth()
    if (!session?.userId) {
      console.log('Unauthorized: No user ID')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    console.log('User ID:', session.userId)

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
      console.log('Unauthorized: User not found')
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
        console.log('Project not found:', params.projectId)
        return NextResponse.json(
          { error: 'Project not found' },
          { status: 404 }
        )
      }
      
      // Check if user has access to this client
      const hasAccess = user.clientUsers.some(cu => cu.client.id === project.clientId)
      if (!hasAccess) {
        console.log('Unauthorized: Guest user has no access to project client')
        return NextResponse.json(
          { error: 'Unauthorized access to this project' },
          { status: 403 }
        )
      }
    }

    // Parse query parameters with better error handling
    const { searchParams } = new URL(request.url)
    const queryParams = {
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      sortBy: searchParams.get('sortBy'),
      fetchAllUrls: searchParams.get('fetchAllUrls')
    }

    console.log('Received query parameters:', queryParams)

    let parsedParams
    try {
      parsedParams = urlsQuerySchema.parse(queryParams)
    } catch (error) {
      console.error('Query parameter validation failed:', error)
      // Use default values
      parsedParams = urlsQuerySchema.parse({})
    }

    const { startDate, endDate, sortBy, fetchAllUrls } = parsedParams

    // Get project's analytics config
    console.log('Fetching analytics config for project:', params.projectId)
    const config = await db.analyticsConfig.findUnique({
      where: { projectId: params.projectId }
    })

    if (!config) {
      console.log('Analytics not configured for project:', params.projectId)
      return NextResponse.json(
        { error: 'Analytics not configured for this project' },
        { status: 400 }
      )
    }

    // Check if Google Analytics is enabled
    if (!config.gaEnabled || !config.gaPropertyId) {
      console.log('Google Analytics not enabled for project:', params.projectId)
      return NextResponse.json(
        { error: 'Google Analytics not enabled for this project' },
        { status: 400 }
      )
    }

    console.log('Fetching URLs with params:', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      propertyId: config.gaPropertyId,
      sortBy,
      fetchAllUrls
    })

    // Fetch URLs from Google Analytics
    const urls = await gaClient.getPageUrls(
      config.gaPropertyId,
      startDate,
      endDate,
      100, // limit
      sortBy,
      fetchAllUrls
    )

    console.log(`Fetched ${urls.length} URLs from Google Analytics`)

    // Pre-filter to remove known problematic URL patterns
    const preFilteredUrls = urls.filter(pageData => {
      const url = pageData.url;
      
      // Skip URLs with multiple question marks (e.g., ?section=service?page=2)
      if (url.includes('?section=') && url.includes('?page=')) {
        console.log(`[URLs] Pre-filter: Skipping URL with multiple question marks: ${url}`);
        return false;
      }
      
      // Skip URLs with duplicate page parameters (e.g., page=2&page=2)
      if ((url.match(/[?&]page=/g) || []).length > 1) {
        console.log(`[URLs] Pre-filter: Skipping URL with duplicate page parameters: ${url}`);
        return false;
      }
      
      // Skip specific problematic URL patterns
      const problematicPatterns = [
        'section=service?page=',
        'section=Service?page=',
        '?page=2?page=',
        '&page=2&page='
      ];
      
      for (const pattern of problematicPatterns) {
        if (url.includes(pattern)) {
          console.log(`[URLs] Pre-filter: Skipping URL with problematic pattern '${pattern}': ${url}`);
          return false;
        }
      }
      
      return true;
    });
    
    console.log(`Pre-filtered from ${urls.length} to ${preFilteredUrls.length} URLs`);

    // Get project's deployment URL to normalize URLs
    const project = await db.project.findUnique({
      where: { id: params.projectId },
      select: { deploymentUrl: true }
    })

    if (!project?.deploymentUrl) {
      console.log('Project deployment URL not configured')
      return NextResponse.json({ urls: preFilteredUrls })
    }

    // Process URL to normalize URLs with the project's deployment URL
    const deploymentUrl = project.deploymentUrl;
    const normalizedUrls = preFilteredUrls.map(pageData => {
      try {
        // If the URL is just a path, prepend the deployment URL
        const fullUrl: string = pageData.url.startsWith('http') 
          ? pageData.url 
          : `${deploymentUrl.replace(/\/$/, '')}${pageData.url.startsWith('/') ? pageData.url : `/${pageData.url}`}`;

        // Validate URL format
        const urlObj: URL = new URL(fullUrl);
        
        // Extract the base URL and query string
        const baseUrl = urlObj.origin + urlObj.pathname;
        const queryString = urlObj.search;

        // Function to validate and clean query parameters
        const validateAndCleanQuery = (queryStr: string): string | null => {
          // Check for multiple question marks
          if ((queryStr.match(/\?/g) || []).length > 1) {
            console.log(`[URLs] Invalid: Multiple question marks in URL: ${fullUrl}`);
            return null;
          }

          const searchParams = new URLSearchParams(queryStr.startsWith('?') ? queryStr.substring(1) : queryStr);
          
          // Check for duplicate parameters
          const pageParams = searchParams.getAll('page');
          if (pageParams.length > 1) {
            console.log(`[URLs] Invalid: Duplicate page parameters in URL: ${fullUrl}`);
            return null;
          }

          // Get section and page parameters
          const sectionParam = searchParams.get('section');
          const pageParam = searchParams.get('page');

          // Build clean query string
          const cleanParams = new URLSearchParams();
          if (sectionParam) {
            cleanParams.set('section', sectionParam.toLowerCase());
          }
          if (pageParam) {
            cleanParams.set('page', pageParam);
          }

          return cleanParams.toString();
        };

        // Process and validate query string
        if (queryString) {
          const cleanQuery = validateAndCleanQuery(queryString);
          if (cleanQuery === null) {
            return null;
          }

          // Return cleaned URL
          return {
            ...pageData,
            url: `${baseUrl}${cleanQuery ? `?${cleanQuery}` : ''}`
          };
        }

        // Return URL without query parameters
        return {
          ...pageData,
          url: baseUrl
        };
      } catch (error) {
        console.error('Error normalizing URL:', pageData.url, error);
        return null;
      }
    }).filter(Boolean); // Remove null entries

    // Additional filtering to remove any remaining malformed URLs
    const filteredUrls = normalizedUrls.filter(pageData => {
      if (!pageData) return false;
      
      try {
        const url = new URL(pageData.url);
        const query = url.search;
        
        // Final validation check
        if (query) {
          // Reject URLs with multiple question marks
          if ((query.match(/\?/g) || []).length > 1) return false;
          
          // Reject URLs with duplicate parameters
          const params = new URLSearchParams(query);
          if (params.getAll('page').length > 1) return false;
          
          // Reject URLs with malformed section/page combinations
          if (query.includes('?section=') && query.includes('?page=')) return false;
        }
        
        return true;
      } catch {
        return false;
      }
    });

    // Deduplicate URLs based on normalized path
    const uniqueUrlsMap = new Map<string, any>();
    
    filteredUrls.forEach(pageData => {
      if (!pageData) return; // Skip null entries
      
      try {
        // For SPA, use the section as the key for deduplication
        const section = new URLSearchParams(pageData.url.split('?')[1]).get('section') || ''
        const key = section.toLowerCase()
        
        // If this section is already in our map, only replace it if the new page has more complete data
        if (uniqueUrlsMap.has(key)) {
          const existingPage = uniqueUrlsMap.get(key)
          const existingHasMetrics = existingPage.pageViews !== undefined && 
                                    existingPage.uniqueVisitors !== undefined
          const newHasMetrics = pageData.pageViews !== undefined && 
                               pageData.uniqueVisitors !== undefined
          
          // Replace only if new page has metrics and existing doesn't, or new page has more views
          if ((newHasMetrics && !existingHasMetrics) || 
              (newHasMetrics && existingHasMetrics && 
               (pageData.pageViews > existingPage.pageViews))) {
            uniqueUrlsMap.set(key, pageData)
          }
        } else {
          // This is a new section, add it to our map
          uniqueUrlsMap.set(key, pageData)
        }
      } catch (e) {
        // If there's any error in processing, just use the original page
        console.error('Error processing page:', pageData, e)
        uniqueUrlsMap.set(pageData.url, pageData)
      }
    })
    
    const dedupedUrls = Array.from(uniqueUrlsMap.values())
    console.log(`Deduplicated from ${normalizedUrls.length} to ${dedupedUrls.length} URLs`)

    return NextResponse.json(
      { urls: dedupedUrls },
      {
        headers: { 
          'Cache-Control': `private, max-age=${CACHE_TTL}, stale-while-revalidate=${STALE_TTL}`
        }
      }
    )
  } catch (error) {
    console.error('Failed to fetch URLs:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch URLs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 