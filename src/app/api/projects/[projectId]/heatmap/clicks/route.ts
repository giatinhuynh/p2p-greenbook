import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

// Validation schema for a single click
const clickSchema = z.object({
  x: z.number(),
  y: z.number(),
  pageUrl: z.string(),
  viewportWidth: z.number(),
  viewportHeight: z.number(),
  elementClicked: z.string().optional(),
  sessionId: z.string().optional(),
  relativeX: z.number().optional(),
  relativeY: z.number().optional(),
  timestamp: z.string().optional(),
  scrollY: z.number().optional(),
  isFixedElement: z.boolean().optional(),
  fixedAncestor: z.object({
    tag: z.string(),
    position: z.string(),
    rect: z.object({
      top: z.number(),
      left: z.number(),
      width: z.number(),
      height: z.number()
    })
  }).optional()
})

// Validation schema for batch requests
const batchClickSchema = z.array(clickSchema).max(50, 'Too many clicks per request')

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://newing-brochure-847158.vercel.app'
];

// Helper function for direct DB checks
async function debugProjectAccess(userId: string, projectId: string) {
  console.log('\n=== Starting Debug Checks ===');
  
  // 1. Check if user exists
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true }
  });
  console.log('1. User check:', { exists: !!user, user });

  // 2. Check if project exists
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true, clientId: true }
  });
  console.log('2. Project check:', { exists: !!project, project });

  if (!project) return null;

  // 3. Check client users
  const clientUsers = await db.clientUser.findMany({
    where: {
      clientId: project.clientId,
      userId: userId
    },
    select: {
      id: true,
      role: true,
      isPending: true,
      client: {
        select: {
          id: true,
          companyName: true
        }
      }
    }
  });
  console.log('3. Client users check:', { 
    hasAccess: clientUsers.length > 0,
    clientUsers
  });

  // 4. Check full project access path
  const fullAccessCheck = await db.project.findFirst({
    where: {
      id: projectId,
      client: {
        clientUsers: {
          some: {
            userId: userId,
            isPending: false
          }
        }
      }
    },
    include: {
      client: {
        include: {
          clientUsers: {
            where: { userId: userId },
            select: { role: true, isPending: true }
          }
        }
      }
    }
  });
  console.log('4. Full access check:', {
    hasAccess: !!fullAccessCheck,
    accessDetails: fullAccessCheck
  });

  console.log('=== Debug Checks Complete ===\n');
  return { user, project, clientUsers, fullAccessCheck };
}

export async function POST(
  req: Request,
  { params }: { params: { projectId: string } }
) {
  try {
    const data = await req.json()
    console.log(`Received data for project ${params.projectId}:`, { 
      clickCount: Array.isArray(data) ? data.length : 1,
      sampleClick: Array.isArray(data) ? data[0] : data 
    })

    // Handle both single click and batch requests
    const clicksData = Array.isArray(data) ? data : [data]

    // Validate and limit request size
    const validatedData = batchClickSchema.parse(clicksData)

    // Prepare clicks with project ID and user agent
    const clicks = validatedData.map(click => ({
      ...click,
      projectId: params.projectId,
      userAgent: headers().get('user-agent') || undefined,
      timestamp: new Date(),
      scrollY: click.scrollY || 0,
      // Extract fixed ancestor data
      fixedAncestorTag: click.fixedAncestor?.tag,
      fixedAncestorPosition: click.fixedAncestor?.position,
      fixedAncestorRect: click.fixedAncestor?.rect ? JSON.stringify(click.fixedAncestor.rect) : undefined
    }))

    // Batch insert all clicks
    const result = await db.heatmapClick.createMany({
      data: clicks,
    })

    console.log(`Successfully stored ${result.count} clicks for project ${params.projectId}`)

    revalidatePath(`/client/[clientId]/projects/${params.projectId}/insights/heatmap`)
    
    return NextResponse.json({ 
      success: true, 
      stored: result.count 
    })
  } catch (error) {
    console.error('Error storing click data:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid click data format', 
          details: error.errors,
          message: error.errors.map(e => e.message).join(', ')
        },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to store click data' },
      { status: 500 }
    )
  }
}

export async function GET(
  req: Request,
  { params }: { params: { projectId: string } }
) {
  try {
    console.log('\n=== Starting Heatmap Data Request ===');
    console.log('Request URL:', req.url);
    console.log('Project ID:', params.projectId);
    
    // 1. Get and validate parameters
    const { searchParams } = new URL(req.url);
    const pageUrl = searchParams.get('pageUrl');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const exactMatch = searchParams.get('exactMatch') === 'true';
    
    console.log('Request parameters:', { 
      pageUrl, 
      projectId: params.projectId,
      startDate,
      endDate,
      exactMatch
    });

    if (!pageUrl) {
      console.log('Validation failed: Missing pageUrl');
      return new NextResponse(
        JSON.stringify({ error: 'Page URL is required' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 2. Parse the requested URL to handle SPA routes
    let whereClause: any = {
      projectId: params.projectId,
    };
    
    try {
      const decodedUrl = decodeURIComponent(pageUrl);
      
      if (exactMatch) {
        // Use exact URL matching when exactMatch is true
        whereClause.pageUrl = decodedUrl;
        console.log('Using exact URL matching:', decodedUrl);
      } else {
        // Use base URL matching when exactMatch is false (default behavior)
        const url = new URL(decodedUrl);
        const baseUrl = `${url.origin}${url.pathname}`;
        
        whereClause.pageUrl = {
          startsWith: baseUrl
        };
        
        console.log('Using flexible URL matching for SPA:', {
          requestedUrl: decodedUrl,
          baseUrlForMatching: baseUrl
        });
      }
    } catch (error) {
      // Fallback to exact matching if URL parsing fails
      console.warn('URL parsing failed, using exact match:', error);
      whereClause.pageUrl = decodeURIComponent(pageUrl);
    }

    if (startDate && endDate) {
      whereClause.timestamp = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    // 3. Get click data
    console.log('Fetching click data with filter:', whereClause);
    const clicks = await db.heatmapClick.findMany({
      where: whereClause,
      select: {
        x: true,
        y: true,
        viewportWidth: true,
        viewportHeight: true,
        timestamp: true,
        elementClicked: true,
        scrollY: true,
        sessionId: true,
        isFixedElement: true,
        fixedAncestorTag: true,
        fixedAncestorPosition: true,
        fixedAncestorRect: true,
        pageUrl: true // Include the actual pageUrl for client-side filtering
      },
      orderBy: {
        timestamp: 'desc'
      }
    });

    // Transform the data to reconstruct fixedAncestor object
    const transformedClicks = clicks.map(click => ({
      ...click,
      fixedAncestor: click.fixedAncestorTag ? {
        tag: click.fixedAncestorTag,
        position: click.fixedAncestorPosition!, 
        rect: JSON.parse(click.fixedAncestorRect as string)
      } : undefined
    }));

    // 4. Get statistics
    console.log('Fetching statistics');
    const stats = await db.heatmapClick.groupBy({
      by: ['elementClicked'],
      where: whereClause,
      _count: true,
      having: {
        elementClicked: {
          not: null
        }
      }
    });

    // Log the actual data being returned
    console.log('Data to be returned:', {
      clicks: transformedClicks,
      stats,
      total: clicks.length,
      whereClause
    });

    return new NextResponse(
      JSON.stringify({
        clicks: transformedClicks,
        stats,
        total: clicks.length
      }),
      { 
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    console.error('Error in heatmap data request:', error);
    return new NextResponse(
      JSON.stringify({
        error: 'Failed to fetch heatmap data',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
}

// Handle OPTIONS request for CORS
export async function OPTIONS(req: Request) {
  const origin = headers().get('origin');
  
  // Return response with CORS headers
  const responseHeaders = new Headers({
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400', // 24 hours
  });

  // Set CORS headers if origin is allowed
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    responseHeaders.set('Access-Control-Allow-Origin', origin);
  }

  return new NextResponse(null, {
    status: 204,
    headers: responseHeaders,
  });
} 