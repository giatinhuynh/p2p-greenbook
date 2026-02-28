'use server'

import { clerkClient, currentUser } from '@clerk/nextjs/server'
import { db } from './db'
import { AuthorizationError, ValidationError } from './errors'
import type { 
  Role, 
  ProjectStatus,
  User,
  Client,
  Project,
  ClientUser,
  PrismaClient 
} from '@prisma/client'
import { Resend } from 'resend'
import { cache } from 'react'
import { userRepository } from './repositories/user-repository'
import { ProjectCreateInput, ProjectWithDetails } from './types'
import { cacheService } from './cache-service'
import { revalidatePath } from 'next/cache'

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY is not defined')
}

const resend = new Resend(process.env.RESEND_API_KEY)

// Create a cached auth service
const getAuthenticatedUser = cache(async () => {
  try {
    return await currentUser();
  } catch (error) {
    console.error('Error fetching authenticated user:', error);
    return null;
  }
});

// Create a helper to handle auth checks
async function withAuth<T>(
  operation: (user: User) => Promise<T>,
  options: { 
    allowNull?: boolean,
    roles?: Role[]
  } = {}
): Promise<T | null> {
  const user = await getAuthenticatedUser();
  
  if (!user && !options.allowNull) {
    throw new AuthorizationError('Authentication required');
  }
  
  // Cast to our internal User type since we know the structure
  const internalUser = {
    id: user?.id || '',
    name: user?.firstName || '',
    email: user?.emailAddresses[0]?.emailAddress || '',
    role: 'USER' as Role,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  return operation(internalUser);
}

// Client Operations
export const createClient = async (client: Partial<Client>) => {
  return withAuth(async (user) => {
    if (!client.companyName || !client.companyEmail) {
      throw new ValidationError('Missing required fields');
    }

    const newClient = await db.client.create({
      data: {
        companyName: client.companyName,
        companyEmail: client.companyEmail,
        companyLogo: client.companyLogo ?? null,
        companyPhone: client.companyPhone ?? null,
        address: client.address,
        city: client.city,
        state: client.state,
        country: client.country,
        createdById: user.id,
        clientUsers: {
          create: {
            userId: user.id,
            role: 'ADMIN'
          }
        }
      },
      include: {
        clientUsers: true
      }
    });

    return newClient;
  });
};

export const updateClient = async (clientId: string, client: Partial<Client>) => {
  const user = await currentUser()
  if (!user) return null

  const hasAccess = await verifyClientAccess(clientId, user.id, ['ADMIN'])
  if (!hasAccess) throw new AuthorizationError('Unauthorized')

  const response = await db.client.update({
    where: { id: clientId },
    data: client
  })

  // Invalidate cache and revalidate paths
  await invalidateClientCache(clientId)
  revalidatePath(`/client/${clientId}`)
  revalidatePath(`/client/${clientId}/team`)
  revalidatePath(`/client/${clientId}/projects`)
  revalidatePath(`/client/${clientId}/settings`)

  return response
}

export const deleteClient = async (clientId: string) => {
  const user = await currentUser()
  if (!user) return null

  const hasAccess = await verifyClientAccess(clientId, user.id, ['ADMIN'])
  if (!hasAccess) throw new AuthorizationError('Unauthorized')

  const response = await db.client.delete({
    where: { id: clientId }
  })

  // Invalidate cache and revalidate paths
  await invalidateClientCache(clientId)
  revalidatePath('/clients')
  revalidatePath(`/client/${clientId}`)

  return response
}

export const getClient = async (clientId: string) => {
  return withAuth(async (user) => {
    const retries = 3
    const backoff = 1000 // 1 second

    for (let i = 0; i < retries; i++) {
      try {
    const client = await db.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        companyName: true,
        companyEmail: true,
        companyLogo: true,
        address: true,
        createdAt: true,
        updatedAt: true,
        projects: {
          select: {
            id: true,
            name: true,
            status: true,
            createdAt: true
          }
        },
        clientUsers: {
          where: {
            isPending: false
          },
          select: {
            id: true,
            role: true,
            isPending: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                createdAt: true
              }
            }
          }
        }
      }
    });

    if (!client) {
      console.error('Client not found:', clientId);
      return null;
    }

    const hasAccess = await verifyClientAccess(clientId, user.id, ['ADMIN', 'USER', 'GUEST']);
    if (!hasAccess) {
      console.error('Access denied for user:', user.id);
      return null;
    }

    return client;
      } catch (error: any) {
        if (i === retries - 1) throw error;
        console.warn(`Attempt ${i + 1} failed, retrying in ${backoff}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoff));
      }
    }
  });
};

export const getClientProjects = async (
  clientId: string,
  page = 1,
  limit = 10
) => {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return null

    const hasAccess = await verifyClientAccess(clientId, user.id, ['ADMIN', 'USER', 'GUEST'])
    if (!hasAccess) throw new AuthorizationError('Unauthorized')

    const skip = (page - 1) * limit

    // Use Promise.all for parallel queries
    const [projects, total] = await Promise.all([
      db.project.findMany({
        where: { clientId },
        select: {
          id: true,
          name: true,
          description: true,
          status: true,
          deploymentUrl: true,
          createdAt: true,
          updatedAt: true,
          client: {
            select: {
              id: true,
              companyName: true
            }
          }
        },
        orderBy: {
          updatedAt: 'desc'
        },
        skip,
        take: limit
      }),
      db.project.count({
        where: { clientId }
      })
    ])

    return {
      projects,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        page,
        limit
      }
    }
  } catch (error) {
    console.error('Error fetching client projects:', error)
    return null
  }
}

// Project Operations
export const createProject = async (project: ProjectCreateInput) => {
  const user = await currentUser()
  if (!user) return null

  if (!project.name || !project.clientId) {
    throw new ValidationError('Missing required fields')
  }

  const hasAccess = await verifyClientAccess(project.clientId, user.id, ['ADMIN', 'USER'])
  if (!hasAccess) throw new AuthorizationError('Unauthorized')

  const response = await db.project.create({
    data: {
      name: project.name,
      description: project.description,
      clientId: project.clientId,
      status: 'NOT_DEPLOYED',
      repositoryUrl: project.repositoryUrl
    },
    include: {
      client: true
    }
  })

  // Invalidate cache and revalidate paths
  await invalidateProjectCache(response.id, response.clientId)
  
  return response
}

async function invalidateProjectCache(projectId: string, clientId: string) {
  console.log('Optimizing cache invalidation for:', { projectId, clientId })
  
  // Batch all cache invalidations together with dynamic tags
  const cachePatterns = [
    `project:${projectId}`,
    `client:${clientId}:projects`,
    `client:${clientId}:project:${projectId}`,
    // Add dynamic tags for better granularity
    `project:${projectId}:status`,
    `project:${projectId}:details`,
    `client:${clientId}:all`
  ]
  
  // Use Promise.all for parallel cache invalidation
  await Promise.all(
    cachePatterns.map(pattern => cacheService.invalidatePattern(pattern))
  )

  // Define critical paths that need immediate revalidation
  const criticalPaths = [
    `/client/${clientId}/projects/${projectId}`,
    `/client/${clientId}/projects`,
    `/client/${clientId}`,
    `/client/${clientId}/projects/${projectId}/deploy`,
    `/client/${clientId}/projects/${projectId}/settings`
  ]

  // Force immediate revalidation with no caching
  await Promise.all(
    criticalPaths.map(path => {
      console.log('Force revalidating path:', path)
      return Promise.all([
        revalidatePath(path, 'layout'),
        revalidatePath(path, 'page')
      ])
    })
  )

  // Force revalidation of dynamic segments with no caching
  revalidatePath('/client/[clientId]/projects/[projectId]', 'page')
  revalidatePath('/client/[clientId]/projects', 'page')
}

export const updateProject = async (projectId: string, data: Partial<Project>) => {
  console.log('Optimized project update starting:', { projectId, data })
  
  return withAuth(async (user) => {
    try {
      // Get current project state with no cache
      const currentProject = await db.project.findUnique({
        where: { id: projectId },
        select: { 
          clientId: true,
          status: true
        }
      })

      if (!currentProject) {
        throw new Error('Project not found')
      }

      // Verify access
      const hasAccess = await verifyClientAccess(currentProject.clientId, user.id, ['ADMIN', 'USER'])
      if (!hasAccess) {
        throw new AuthorizationError('Unauthorized')
      }

      // Start cache invalidation immediately
      await invalidateProjectCache(projectId, currentProject.clientId)

      // Update the project with immediate cache invalidation
      const project = await db.project.update({
        where: { 
          id: projectId,
        },
        data: {
          name: data.name,
          description: data.description,
          repositoryUrl: data.repositoryUrl,
          deploymentUrl: data.deploymentUrl,
          status: data.status || currentProject.status,
        },
        include: {
          client: {
            include: {
              clientUsers: {
                include: {
                  user: true
                }
              }
            }
          }
        }
      })

      // Force immediate revalidation of all affected paths
      revalidatePath(`/client/${currentProject.clientId}/projects/${projectId}`, 'page')
      revalidatePath(`/client/${currentProject.clientId}/projects`, 'page')
      revalidatePath(`/client/${currentProject.clientId}`, 'page')
      
      return project
    } catch (error) {
      console.error('Project update error:', error)
      throw error
    }
  })
}

export const updateProjectStatus = async (projectId: string, status: ProjectStatus) => {
  const user = await currentUser()
  if (!user) return null

  const currentProject = await db.project.findUnique({
    where: { id: projectId },
    select: { clientId: true }
  })
  if (!currentProject) throw new Error('Project not found')

  const hasAccess = await verifyClientAccess(currentProject.clientId, user.id, ['ADMIN'])
  if (!hasAccess) throw new AuthorizationError('Unauthorized: Only admins can update project status')

  const response = await db.project.update({
    where: { id: projectId },
    data: { status },
    include: {
      client: true
    }
  })

  // Invalidate cache and revalidate paths
  await invalidateProjectCache(projectId, currentProject.clientId)

  return response
}

export const deleteProject = async (projectId: string) => {
  const user = await currentUser()
  if (!user) return null

  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { client: true }
  })
  if (!project) throw new Error('Project not found')

  const hasAccess = await verifyClientAccess(project.clientId, user.id, ['ADMIN'])
  if (!hasAccess) throw new AuthorizationError('Unauthorized')

  const response = await db.project.delete({
    where: { id: projectId }
  })

  // Invalidate cache and revalidate paths
  await invalidateProjectCache(projectId, project.clientId)

  return response
}

export const getProject = async (projectId: string): Promise<ProjectWithDetails | GuestProject | null> => {
  const user = await currentUser()
  if (!user) return null

  // Add console log for debugging
  console.log('Fetching project details:', { projectId })

  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      client: {
        include: {
          clientUsers: {
            include: {
              user: true
            }
          }
        }
      }
    }
  })

  if (!project) return null

  const hasAccess = await verifyClientAccess(project.clientId, user.id, ['ADMIN', 'USER', 'GUEST'])
  if (!hasAccess) throw new AuthorizationError('Unauthorized')

  // Get user role for this client
  const clientUser = await db.clientUser.findFirst({
    where: {
      clientId: project.clientId,
      userId: user.id
    },
    select: {
      role: true
    }
  })

  // If guest user, modify the response
  if (clientUser?.role === 'GUEST') {
    return {
      ...project,
      status: mapProjectStatusForGuest(project.status as ProjectStatus),
      // Remove sensitive fields for guest users
      repositoryUrl: null,
      builderSpaceId: null
    }
  }

  return project
}

export const getProjects = async (filters?: {
  clientId?: string
  status?: ProjectStatus
  search?: string
}) => {
  const user = await currentUser()
  if (!user) return null

  const userDetails = await userRepository.getUserDetails()
  if (!userDetails) return null

  // For USER role, get all projects based on filters
  if (userDetails.role === 'USER') {
    const projects = await db.project.findMany({
      where: {
        AND: [
          filters?.clientId ? { clientId: filters.clientId } : {},
          filters?.status ? { status: filters.status } : {},
          filters?.search ? {
            OR: [
              { name: { contains: filters.search, mode: 'insensitive' } },
              { description: { contains: filters.search, mode: 'insensitive' } }
            ]
          } : {}
        ]
      },
      include: {
        client: true
      }
    })
    return { projects }
  }

  // For GUEST role, get only accessible projects with modified status
  const clientIds = userDetails.clientUsers.map((cu: { client: { id: string } }) => cu.client.id)
  const [projects] = await Promise.all([
    db.project.findMany({
      where: {
        AND: [
          { clientId: { in: clientIds } },
          filters?.status ? { status: filters.status } : {},
          filters?.clientId ? { clientId: filters.clientId } : {},
          filters?.search ? {
            OR: [
              { name: { contains: filters.search, mode: 'insensitive' } },
              { description: { contains: filters.search, mode: 'insensitive' } }
            ]
          } : {}
        ]
      },
      include: {
        client: true
      }
    })
  ])

  // Modify response for guest users
  if (userDetails.role === 'GUEST') {
    return {
      projects: projects.map(project => ({
        ...project,
        status: mapProjectStatusForGuest(project.status as ProjectStatus),
        // Remove sensitive fields
        repositoryUrl: null,
        builderSpaceId: null
      }))
    }
  }

  return { projects }
}

// Access Control
export const addUserToClient = async (clientId: string, userEmail: string) => {
  try {
    console.log('Starting addUserToClient process for:', userEmail)
    const user = await currentUser()
    if (!user) {
      console.log('No authenticated user found')
      throw new AuthorizationError('Not authenticated')
    }

    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured')
    }

    // Check if the current user has permission to invite
    const hasAccess = await verifyClientAccess(clientId, user.id, ['ADMIN', 'USER'])
    if (!hasAccess) {
      console.log('User lacks permission:', user.id)
      throw new AuthorizationError('Unauthorized')
    }

    // Get client details for the email
    const client = await db.client.findUnique({
      where: { id: clientId },
      select: { 
        companyName: true,
        id: true
      }
    })
    if (!client) {
      console.log('Client not found:', clientId)
      throw new Error('Client not found')
    }

    console.log('Found client:', client.companyName)

    // Find the target user
    const targetUser = await db.user.findUnique({
      where: { email: userEmail },
      include: {
        clientUsers: {
          include: {
            client: {
              select: {
                companyName: true
              }
            }
          }
        }
      }
    })

    if (targetUser) {
      // Check if user belongs to any other client
      const otherClients = targetUser.clientUsers.filter(cu => cu.clientId !== clientId && !cu.isPending)
      
      if (otherClients.length > 0) {
        const clientNames = otherClients.map(cu => cu.client.companyName).join(', ')
        throw new Error(`This user already exists and belongs to another client(s): ${clientNames}`)
      }

      // Check if they're already in this client
      const existingRelationship = targetUser.clientUsers.find(cu => cu.clientId === clientId)
      if (existingRelationship && !existingRelationship.isPending) {
        throw new Error('User is already a member of this client')
      }
    }

    // Create a temporary invitation record
    const invitation = await db.pendingInvitation.create({
      data: {
        email: userEmail,
        clientId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      }
    })

    // Send invitation email
    try {
      console.log('Attempting to send email with Resend')
      console.log('From:', 'Greenbook <onboarding@resend.dev>')
      console.log('To:', userEmail)
      console.log('RESEND_API_KEY exists:', !!process.env.RESEND_API_KEY)
      
      const emailResponse = await resend.emails.send({
        from: 'Greenbook <onboarding@resend.dev>',
        to: ['creative@projectpluto.studio'], // Send to actual recipient
        replyTo: userEmail,
        subject: `You've been invited to ${client.companyName} on Greenbook`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">You've been invited!</h2>
            <p>You've been invited to join ${client.companyName} as a guest on Greenbook.</p>
            <p>Click the button below to create your account:</p>
            <a href="${process.env.NEXT_PUBLIC_URL}/accept-invite?token=${invitation.id}&email=${userEmail}" 
               style="display: inline-block; padding: 12px 24px; background-color: #0070f3; 
                      color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">
              Accept Invitation
            </a>
            <p style="color: #666; margin-top: 20px;">
              This invitation will expire in 7 days. If you did not expect this invitation, please ignore this email.
            </p>
          </div>
        `
      })

      console.log('Email sent successfully:', emailResponse)

      // After successful invitation
      await invalidateClientCache(clientId)
      revalidatePath(`/client/${clientId}/team`)
      revalidatePath(`/client/${clientId}`)

      return invitation
    } catch (error) {
      console.error('Error sending email:', error)
      // Clean up the invitation if email fails
      await db.pendingInvitation.delete({
        where: { id: invitation.id }
      })
      throw new Error(`Failed to send invitation email: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  } catch (error) {
    console.error('Error in addUserToClient:', error)
    throw error
  }
}

export const removeUserFromClient = async (clientId: string, userId: string) => {
  const user = await currentUser()
  if (!user) return null

  const hasAccess = await verifyClientAccess(clientId, user.id, ['ADMIN'])
  if (!hasAccess) throw new AuthorizationError('Unauthorized')

  try {
    // First, check if this is the user's only client
    const userClients = await db.clientUser.count({
      where: {
        userId: userId,
        isPending: false
      }
    })

    // Remove from database
    const response = await db.clientUser.delete({
      where: {
        clientId_userId: {
          clientId,
          userId
        }
      }
    })

    // If this was their only client and they are a GUEST user, remove them from Clerk and database
    if (userClients === 1) {
      const dbUser = await db.user.findUnique({
        where: { id: userId },
        select: { role: true }
      })

      if (dbUser?.role === 'GUEST') {
        // Remove from database
        await db.user.delete({
          where: { id: userId }
        })

        // Remove from Clerk
        const clerk = await clerkClient()
        await clerk.users.deleteUser(userId)
      }
    }

    // After successful removal
    await invalidateClientCache(clientId)
    revalidatePath(`/client/${clientId}/team`)
    revalidatePath(`/client/${clientId}`)

    return response
  } catch (error) {
    console.error('Error removing user:', error)
    throw error
  }
}

// Helper Functions
async function verifyClientAccess(
  clientId: string, 
  userId: string, 
  allowedRoles: Role[]
): Promise<boolean> {
  const userData = await db.user.findUnique({
    where: { id: userId },
    include: {
      clientUsers: {
        where: { clientId }
      }
    }
  })

  // If user is ADMIN, grant access to everything
  if (userData?.role === 'ADMIN') {
    return true
  }

  // If user is USER, grant access to everything
  if (userData?.role === 'USER') {
    return true
  }

  // For GUEST users, check specific client access
    const clientUser = await db.clientUser.findFirst({
      where: {
        clientId,
        userId,
      role: {
        in: allowedRoles
      }
      }
    })
    return !!clientUser
}

export const getAllClients = async (user: User) => {
  // For ADMIN role, get all clients with full access
  if (user.role === 'ADMIN') {
    const allClients = await db.client.findMany({
      include: {
        clientUsers: {
          where: {
            isPending: false
          }
        },
        projects: true
      }
    })
    return allClients.map((client: Client) => ({
      ...client,
      role: 'ADMIN' as Role // Admins have ADMIN role for all clients
    }))
  }

  // If user is GUEST, return only their accessible clients
  if (user.role === 'GUEST') {
    const guestClients = await db.clientUser.findMany({
      where: {
        userId: user.id,
        isPending: false
      },
      include: {
        client: {
          include: {
            clientUsers: {
              where: {
                isPending: false
              }
            },
            projects: true
          }
        }
      }
    })
    return guestClients.map((cu: { client: Client; role: Role }) => ({
      ...cu.client,
      role: cu.role
    }))
  }

  // For USER role, get all clients from the system
  const allClients = await db.client.findMany({
    include: {
      clientUsers: {
        where: {
          isPending: false
        }
      },
      projects: true
    }
  })

  // For USER role, mark them as having USER access to all clients
  return allClients.map((client: Client) => ({
    ...client,
    role: 'USER' as Role
  }))
}

// Helper function to map project status for guest view
function mapProjectStatusForGuest(status: ProjectStatus): GuestProjectStatus {
  return status === 'DEPLOYED' ? 'Active' : 'Inactive'
}

type GuestProjectStatus = 'Active' | 'Inactive'
type GuestProject = Omit<Project, 'status' | 'repositoryUrl'> & {
  status: GuestProjectStatus
  repositoryUrl: null
} 

export const initUser = async (data: { id: string; name: string; email: string; role?: "ADMIN" | "USER" | "GUEST" }) => {
  return withAuth(async (user) => {
    try {
      // Verify the user is updating their own profile
      if (user.id !== data.id) {
        throw new Error('Unauthorized: Cannot update another user\'s profile')
      }

      // Update user in database
      const updatedUser = await db.user.update({
        where: { id: data.id },
        data: {
          name: data.name,
          email: data.email,
          role: data.role || 'USER'
        }
      })

      // Invalidate user cache
      await userRepository.invalidateUserCache(data.id)

      return updatedUser
    } catch (error) {
      console.error('Error updating user:', error)
      throw error
    }
  })
} 

export const updateUser = async (data: { id: string; name: string; email: string; role?: "ADMIN" | "USER" | "GUEST" }) => {
  try {
    const user = await currentUser()
    if (!user || user.id !== data.id) {
      throw new Error('Unauthorized: Cannot update another user\'s profile')
    }

    // Update user in database
    const updatedUser = await db.user.update({
      where: { id: data.id },
      data: {
        name: data.name,
        email: data.email,
        role: data.role
      }
    })

    // Invalidate user cache
    await userRepository.invalidateUserCache(data.id)
    
    // Revalidate the settings page
    revalidatePath(`/user/${data.id}/settings`)

    return updatedUser
  } catch (error) {
    console.error('Error updating user:', error)
    throw error
  }
}

// Helper function to invalidate client cache
async function invalidateClientCache(clientId: string) {
  await cacheService.invalidatePattern(`clients:*`)
  await cacheService.invalidatePattern(`clients:${clientId}:*`)
  revalidatePath('/clients')
  revalidatePath(`/client/${clientId}`)
  revalidatePath(`/client/${clientId}/team`)
  revalidatePath(`/client/${clientId}/projects`)
  revalidatePath(`/client/${clientId}/settings`)
}

// Helper function to invalidate user cache
async function invalidateUserCache(userId: string) {
  await cacheService.invalidatePattern(`users:*`)
  await cacheService.invalidatePattern(`users:${userId}:*`)
  revalidatePath('/users')
  revalidatePath(`/user/${userId}`)
  revalidatePath(`/user/${userId}/settings`)
} 