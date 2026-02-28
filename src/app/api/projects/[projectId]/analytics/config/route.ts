import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

const configSchema = z.object({
  gaEnabled: z.boolean().default(true),
  gaPropertyId: z.string().nullish()
})

function validateConfig(data: z.infer<typeof configSchema>) {
  if (data.gaEnabled && !data.gaPropertyId) {
    throw new Error("Google Analytics Property ID is required when Google Analytics is enabled");
  }
  return data;
}

export async function GET(
  req: Request,
  { params }: { params: { projectId: string } }
) {
  console.log('\n=== Analytics Config GET Request ===');
  console.log('Project ID:', params.projectId);
  
  try {
    const { userId } = await auth()
    console.log('User ID:', userId);
    
    if (!userId) {
      console.log('Unauthorized: No user ID');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Get the user role and check project access
    const user = await db.user.findUnique({
      where: { id: userId },
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
        console.log('Project not found:', params.projectId);
        return NextResponse.json(
          { error: 'Project not found' },
          { status: 404 }
        )
      }
      
      // Check if user has access to this client
      const hasAccess = user.clientUsers.some(cu => cu.client.id === project.clientId)
      if (!hasAccess) {
        console.log('Unauthorized: Guest user has no access to project client');
        return NextResponse.json(
          { error: 'Unauthorized access to this project' },
          { status: 403 }
        )
      }
      
      console.log('Guest user has access to client, allowing analytics config access');
    }

    // Fetch the analytics config
    const project = await db.project.findUnique({
      where: { id: params.projectId },
      include: {
        analyticsConfig: true
      }
    });

    if (!project) {
      console.log('Project not found');
      return new NextResponse(
        JSON.stringify({ 
          error: 'Project not found',
          code: 'PROJECT_NOT_FOUND'
        }),
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Access granted - User role:', user.role);
    return new NextResponse(
      JSON.stringify(project.analyticsConfig || {}),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error in analytics config GET:', error);
    return new NextResponse(
      JSON.stringify({ 
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        detail: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: { projectId: string } }
) {
  console.log('\n=== Analytics Config POST Request ===');
  console.log('Project ID:', params.projectId);

  try {
    const { userId } = await auth()
    console.log('User ID:', userId);
    
    if (!userId) {
      console.log('Unauthorized: No user ID');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Get the user role
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });
    
    console.log('User role check:', {
      userId,
      role: user?.role
    });
    
    // Guest users cannot modify analytics settings
    if (user?.role === 'GUEST') {
      console.log('Access denied - GUEST users cannot modify analytics settings');
      return NextResponse.json(
        { error: 'Insufficient permissions', detail: 'You do not have permission to modify analytics settings' },
        { status: 403 }
      )
    }
    
    // Check user permissions
    if (user?.role !== 'ADMIN' && user?.role !== 'USER') {
      // For other roles, check client user access
      const projectWithAccess = await db.project.findFirst({
        where: {
          id: params.projectId,
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
                where: {
                  userId: userId,
                  isPending: false
                },
                select: {
                  role: true
                }
              }
            }
          }
        }
      });

      if (!projectWithAccess) {
        console.log('Access denied - No client access');
        return new NextResponse(
          JSON.stringify({ 
            error: 'Insufficient permissions',
            code: 'ACCESS_DENIED',
            detail: 'You do not have access to this project.'
          }),
          { 
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      const userAccess = projectWithAccess.client.clientUsers[0];
      if (!userAccess || !['ADMIN', 'USER'].includes(userAccess.role)) {
        console.log('Access denied - Invalid client role:', userAccess?.role);
        return new NextResponse(
          JSON.stringify({ 
            error: 'Insufficient permissions',
            code: 'INSUFFICIENT_PERMISSIONS',
            detail: 'You do not have sufficient permissions to modify analytics settings.'
          }),
          { 
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
    }
    
    // Parse request body
    const rawBody = await req.text();
    console.log('Raw request body:', rawBody);
    
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch (e) {
      console.error('Failed to parse request body:', e);
      return new NextResponse(
        JSON.stringify({
          error: 'Invalid JSON in request body',
          code: 'INVALID_JSON'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    console.log('Parsed request body:', body);

    // Validate the data
    let validatedData;
    try {
      console.log('Validating request data...');
      validatedData = configSchema.parse(body);
      console.log('Validated data:', validatedData);
      
      validateConfig(validatedData);
      console.log('Additional validation passed');
    } catch (error) {
      console.error('Validation error:', error);
      return new NextResponse(
        JSON.stringify({ 
          error: error instanceof Error ? error.message : 'Invalid configuration data',
          code: 'VALIDATION_ERROR',
          details: error instanceof Error ? error.stack : undefined
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Update or create analytics config
    try {
      console.log('Updating analytics config...');
      const config = await db.analyticsConfig.upsert({
        where: {
          projectId: params.projectId
        },
        update: {
          gaEnabled: validatedData.gaEnabled,
          gaPropertyId: validatedData.gaPropertyId
        },
        create: {
          projectId: params.projectId,
          gaEnabled: validatedData.gaEnabled,
          gaPropertyId: validatedData.gaPropertyId
        }
      });
      
      console.log('Config updated successfully:', config);
      
      // Revalidate the path to ensure fresh data
      revalidatePath(`/client/[clientId]/projects/${params.projectId}/settings`);
      revalidatePath(`/api/projects/${params.projectId}/analytics/config`);

      return new NextResponse(
        JSON.stringify(config),
        { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    } catch (error) {
      console.error('Database error:', error);
      return new NextResponse(
        JSON.stringify({ 
          error: 'Failed to update analytics configuration',
          code: 'DATABASE_ERROR',
          details: error instanceof Error ? error.message : undefined
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  } catch (error) {
    console.error('Server error:', error);
    return new NextResponse(
      JSON.stringify({ 
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        details: error instanceof Error ? error.message : undefined
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
} 