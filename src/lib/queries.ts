'use server'

import { db } from './db'
import { cache } from 'react'
import { cacheService } from './cache-service'
import { revalidatePath } from 'next/cache'
import { ClientCreateSchema, ProjectCreateSchema, UserWithClientDetails, ProjectWithDetails, ClientWithProjects } from './types'
import { ProjectAutomationService } from '@/services/project-automation'
import { Prisma, Project } from '@prisma/client'
import { authService } from '@/services/auth-service'

// Cache keys with namespacing
const CACHE_KEYS = {
  CLIENT_LIST: 'clients:list',
  CLIENT_DETAILS: 'client:details',
  PROJECT_LIST: 'projects:list',
  PROJECT_DETAILS: 'project:details',
  USER_DETAILS: 'user:details',
  CLIENT_PROJECTS: 'client:projects',
  CLIENT_USERS: 'client:users'
}

// Optimized select objects for consistent querying
const clientSelect = {
  id: true,
  companyName: true,
  companyEmail: true,
  companyLogo: true,
  companyPhone: true,
  address: true,
  city: true,
  state: true,
  country: true,
  createdAt: true,
  updatedAt: true,
  createdById: true
} as const

const projectSelect = {
  id: true,
  name: true,
  description: true,
  status: true,
  deploymentUrl: true,
  previewUrl: true,
  createdAt: true,
  updatedAt: true,
  clientId: true
} as const

const select = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
  updatedAt: true,
  clientUsers: {
    select: {
      id: true,
      clientId: true,
      isPending: true,
      role: true,
      createdAt: true,
      updatedAt: true,
      client: true
    }
  }
}

// Auth queries
export const getAuthUserDetails = cache(async () => {
  try {
    const user = await authService.getCurrentUser()
    if (!user) return null

    // Try cache first
    const cached = await cacheService.get<UserWithClientDetails>(CACHE_KEYS.USER_DETAILS, { userId: user.id })
    if (cached) return cached

    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      include: {
        clientUsers: {
          include: {
            client: {
              include: {
                projects: true,
                clientUsers: {
                  include: {
                    user: true
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!dbUser) {
      console.warn('User found in auth but not in database:', user.id)
      return null
    }

    // For ADMIN and USER roles, get all clients
    let allClientUsers = dbUser.clientUsers
    if (dbUser.role === 'ADMIN' || dbUser.role === 'USER') {
      const allClients = await db.client.findMany({
        include: {
          projects: true,
          clientUsers: {
            include: {
              user: true
            }
          }
        }
      })
      
      // Create virtual clientUser entries for all clients with required fields
      allClientUsers = allClients.map(client => ({
        id: `virtual_${dbUser.id}_${client.id}`,
        clientId: client.id,
        userId: dbUser.id,
        role: dbUser.role,
        isPending: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        client: client,
        user: dbUser
      }))
    }

    // Merge auth user data with db user data
    const mergedUser = {
      ...dbUser,
      clientUsers: allClientUsers,
      name: user.username || dbUser.name || user.id,
      role: dbUser.role,
      image: user.imageUrl
    }

    // Cache the result
    await cacheService.set(CACHE_KEYS.USER_DETAILS, mergedUser, undefined, { userId: user.id })
    return mergedUser
  } catch (error) {
    console.error('Error fetching auth user details:', error)
    return null
  }
})

// Optimized client queries
export const getClients = cache(async () => {
  try {
    // Try cache first with short TTL for frequently accessed data
    const cached = await cacheService.get(CACHE_KEYS.CLIENT_LIST)
    if (cached) return cached

    // Batch fetch clients with minimal fields
    const clients = await db.client.findMany({
      select: {
        ...clientSelect,
        _count: {
          select: {
            projects: true,
            clientUsers: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    })

    // Cache the result with a short TTL for frequently updated data
    await cacheService.set(CACHE_KEYS.CLIENT_LIST, clients, 300) // 5 minutes TTL
    return clients
  } catch (error) {
    console.error('Error fetching clients:', error)
    return []
  }
})

export const getClientById = cache(async (clientId: string) => {
  try {
    // Try cache first
    const cached = await cacheService.get<ClientWithProjects>(CACHE_KEYS.CLIENT_DETAILS, { clientId })
    if (cached) return cached

    // Parallel fetch of client details and related data
    const [client, projects, users] = await Promise.all([
      db.client.findUnique({
        where: { id: clientId },
        select: clientSelect
      }),
      db.project.findMany({
        where: { clientId },
        select: projectSelect,
        orderBy: { updatedAt: 'desc' }
      }),
      db.clientUser.findMany({
        where: { clientId },
        select: {
          id: true,
          role: true,
          isPending: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              createdAt: true
            }
          }
        }
      })
    ])

    if (!client) return null

    // Combine the results
    const result = {
      ...client,
      projects,
      clientUsers: users
    }

    // Cache the result
    await cacheService.set(CACHE_KEYS.CLIENT_DETAILS, result, undefined, { clientId })
    return result
  } catch (error) {
    console.error('Error fetching client by ID:', error)
    return null
  }
})

export const createClient = async (data: unknown) => {
  try {
    const validatedData = ClientCreateSchema.parse(data)
    
    const clientData: Prisma.ClientCreateInput = {
      companyName: validatedData.companyName,
      companyEmail: validatedData.companyEmail,
      companyPhone: validatedData.companyPhone || undefined,
      companyLogo: validatedData.companyLogo || undefined,
      address: validatedData.address || undefined,
      city: validatedData.city || undefined,
      state: validatedData.state || undefined,
      country: validatedData.country || undefined,
      createdBy: {
        connect: {
          id: validatedData.createdById
        }
      }
    }
    
    const client = await db.client.create({
      data: clientData,
      include: {
        createdBy: true,
        clientUsers: true
      }
    })

    // Invalidate cache
    await cacheService.invalidatePattern('clients:*')
    revalidatePath('/clients')
    
    return client
  } catch (error) {
    console.error('Error creating client:', error)
    throw error
  }
}

// Project queries
export const getProjects = cache(async () => {
  try {
    // Try cache first
    const cached = await cacheService.get(CACHE_KEYS.PROJECT_LIST)
    if (cached) return cached

    const projects = await db.project.findMany({
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
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Cache the result
    await cacheService.set(CACHE_KEYS.PROJECT_LIST, projects)
    return projects
  } catch (error) {
    console.error('Error fetching projects:', error)
    return []
  }
})

export const getProjectById = cache(async (projectId: string) => {
  try {
    // Try cache first
    const cached = await cacheService.get(CACHE_KEYS.PROJECT_DETAILS, { projectId })
    if (cached) return cached

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

    // Cache the result
    await cacheService.set(CACHE_KEYS.PROJECT_DETAILS, project, undefined, { projectId })
    return project
  } catch (error) {
    console.error('Error fetching project:', error)
    return null
  }
})

export const createProject = async (data: unknown) => {
  try {
    const validatedData = ProjectCreateSchema.parse(data)
    
    // Create project in database only
    const project = await db.project.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
        clientId: validatedData.clientId,
        repositoryUrl: validatedData.repositoryUrl
      }
    })

    // More aggressive cache invalidation to ensure new project is visible
    await cacheService.invalidatePattern('projects:*')
    await cacheService.invalidatePattern(`clients:*`)
    await cacheService.invalidatePattern(`${CACHE_KEYS.CLIENT_PROJECTS}:${validatedData.clientId}:*`)
    await cacheService.invalidatePattern(CACHE_KEYS.USER_DETAILS)
    
    // Revalidate paths
    revalidatePath('/projects')
    revalidatePath(`/client/${validatedData.clientId}/projects`)
    revalidatePath(`/client/${validatedData.clientId}`)
    
    return project
  } catch (error) {
    console.error('Error creating project:', error)
    throw error
  }
}

// Cache invalidation
export const invalidateClientCache = async (clientId: string) => {
  await cacheService.invalidatePattern(`clients:*`)
  await cacheService.invalidatePattern(`clients:*:${clientId}`)
  revalidatePath('/clients')
  revalidatePath(`/clients/${clientId}`)
}

export const invalidateProjectCache = async (projectId: string, clientId: string) => {
  await cacheService.invalidatePattern(`projects:*`)
  await cacheService.invalidatePattern(`projects:*:${projectId}`)
  await cacheService.invalidatePattern(`clients:*:${clientId}`)
  revalidatePath('/projects')
  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/clients/${clientId}`)
}

interface ProjectsResponse {
  projects: ProjectWithDetails[]
  pagination: {
    total: number
    pages: number
    page: number
    limit: number
  }
}

// Optimized project queries with batching
export const getClientProjects = cache(async (
  clientId: string,
  page = 1,
  limit = 10,
  bypassCache = false
): Promise<ProjectsResponse | null> => {
  try {
    const cacheKey = `${CACHE_KEYS.CLIENT_PROJECTS}:${clientId}:${page}:${limit}`
    const user = await getAuthUserDetails()
    if (!user) return null

    // Try cache first, but bypass for admins or if explicitly requested
    const shouldUseCache = !bypassCache && user.role !== 'ADMIN'
    const cached = shouldUseCache ? await cacheService.get<ProjectsResponse>(cacheKey) : null
    if (cached) return cached

    const skip = (page - 1) * limit

    // For ADMIN and USER roles, show all projects
    // For GUEST role, only show projects they have access to
    const isGuest = user.role === 'GUEST'
    const hasAccess = user.clientUsers.some(cu => cu.client.id === clientId)
    
    if (isGuest && !hasAccess) {
      return {
        projects: [],
        pagination: { total: 0, pages: 0, page, limit }
      }
    }

    // Parallel queries for better performance
    const [projects, total] = await Promise.all([
      db.project.findMany({
        where: { clientId },
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
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit
      }),
      db.project.count({
        where: { clientId }
      })
    ])

    const response: ProjectsResponse = {
      projects,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        page,
        limit
      }
    }

    // Cache with shorter TTL for paginated data
    await cacheService.set(cacheKey, response, 180) // 3 minutes TTL
    return response
  } catch (error) {
    console.error('Error fetching client projects:', error)
    return null
  }
})

export const deleteProject = async (projectId: string) => {
  try {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { client: true }
  })

    if (!project) {
      throw new Error('Project not found')
    }

    // Delete the project
    await db.project.delete({
    where: { id: projectId }
  })

    // Invalidate caches
    await invalidateProjectCache(projectId, project.clientId)
    
    return { success: true }
  } catch (error) {
    console.error('Error deleting project:', error)
    throw error
  }
}

// Client queries
export const getClient = cache(async (clientId: string) => {
  try {
    const user = await getAuthUserDetails()
    if (!user) return null

    // ADMIN and USER roles can access all clients
    // GUEST role needs explicit access
    const isGuest = user.role === 'GUEST'
    if (isGuest) {
      const hasAccess = user.clientUsers.some(cu => cu.client.id === clientId)
      if (!hasAccess) return null
    }

    // Try cache first
    const cached = await cacheService.get(CACHE_KEYS.CLIENT_DETAILS, { clientId })
    if (cached) return cached

    const client = await db.client.findUnique({
      where: { id: clientId },
      include: {
        projects: {
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
        },
        clientUsers: {
          include: {
            user: true
          }
        },
        pendingInvitations: {
          where: {
            expiresAt: {
              gt: new Date()
            }
          },
          select: {
            id: true,
            email: true,
            createdAt: true
          }
        }
      }
    })

    if (!client) return null

    // Cache the result
    await cacheService.set(CACHE_KEYS.CLIENT_DETAILS, client, undefined, { clientId })
    return client
  } catch (error) {
    console.error('Error fetching client:', error)
    return null
  }
})

// Project queries
export const getProject = cache(async (projectId: string) => {
  try {
    // Try cache first
    const cached = await cacheService.get(CACHE_KEYS.PROJECT_DETAILS, { projectId })
    if (cached) return cached

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

    // Cache the result
    await cacheService.set(CACHE_KEYS.PROJECT_DETAILS, project, undefined, { projectId })
    return project
  } catch (error) {
    console.error('Error fetching project:', error)
    return null
  }
})

// Uncached version of getProject for immediate data
export const getProjectDirect = async (projectId: string) => {
  try {
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
    return project
  } catch (error) {
    console.error('Error fetching project:', error)
    return null
  }
}

// User queries
export const initUser = async (values: { id: string; name: string; email: string; role: 'ADMIN' | 'USER' | 'GUEST' }) => {
  try {
    // First check if user exists by ID
    const userById = await db.user.findUnique({
      where: { id: values.id }
    })

    if (userById) {
      return userById
    }

    // Then check if user exists by email
    const userByEmail = await db.user.findUnique({
      where: { email: values.email }
    })

    if (userByEmail) {
      // If user exists with this email but different ID, update their ID
      return await db.user.update({
        where: { email: values.email },
        data: {
          id: values.id,
          name: values.name,
          role: values.role
        }
      })
    }

    // Create new user if neither exists
    const newUser = await db.user.create({
      data: {
        id: values.id,
        name: values.name,
        email: values.email,
        role: values.role
      }
    })

    return newUser
  } catch (error) {
    console.error('Error initializing user:', error)
    throw error
  }
}

// Client queries
export const deleteClient = async (clientId: string) => {
  try {
    const client = await db.client.delete({
      where: { id: clientId }
    })

    // Invalidate caches
    await invalidateClientCache(clientId)
    
    return { success: true }
  } catch (error) {
    console.error('Error deleting client:', error)
    throw error
  }
}

export const getAllClients = cache(async () => {
  try {
    const user = await getAuthUserDetails()
    if (!user) return []

    // Try cache first
    const cached = await cacheService.get<ClientWithProjects[]>(CACHE_KEYS.CLIENT_LIST)
    if (cached) return cached

    // For ADMIN and USER roles, get all clients
    // For GUEST role, only get their assigned clients
    const isGuest = user.role === 'GUEST'
    
    const clients = await db.client.findMany({
      where: isGuest ? {
        clientUsers: {
          some: {
            userId: user.id
          }
        }
      } : undefined,
      include: {
        projects: {
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
        },
        clientUsers: {
          include: {
            user: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Cache the result
    await cacheService.set(CACHE_KEYS.CLIENT_LIST, clients)
    return clients as ClientWithProjects[]
  } catch (error) {
    console.error('Error fetching all clients:', error)
    return [] as ClientWithProjects[]
  }
})

export const updateProject = async (projectId: string, data: Partial<Project>) => {
  try {
    const project = await db.project.update({
      where: { id: projectId },
      data,
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
    
    // Invalidate cache
    await invalidateProjectCache(projectId, project.clientId)
    return project
  } catch (error) {
    console.error('Error updating project:', error)
    throw error
  }
}
