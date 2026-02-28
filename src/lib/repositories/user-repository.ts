import { db } from '../db'
import { authService } from '@/services/auth-service'
import { cache } from 'react'
import { Prisma, Role, User, Client, ProjectStatus } from '@prisma/client'
import { cacheService } from '../cache-service'

// Cache keys
const CACHE_KEYS = {
  USER_DETAILS: 'user:details',
  USER_BY_ROLE: 'users:by-role',
  USER_BY_CLIENT: 'users:by-client',
  ADMIN_CLIENTS: 'admin:all-clients'
}

// Cache TTLs
const CACHE_TTLS = {
  USER_DETAILS: 300, // 5 minutes
  USER_BY_ROLE: 300,
  USER_BY_CLIENT: 300,
  ADMIN_CLIENTS: 600 // 10 minutes
}

// Define select object for consistent querying
const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
  clientUsers: {
    where: {
      isPending: false
    },
    select: {
      id: true,
      role: true,
      client: {
        select: {
          id: true,
          companyName: true,
          companyLogo: true,
          projects: {
            select: {
              id: true,
              name: true,
              status: true
            }
          }
        }
      }
    }
  }
} satisfies Prisma.UserSelect

type UserWithClientDetails = Prisma.UserGetPayload<{
  select: typeof userSelect
}>

type ClientWithProjects = Pick<Client, 'id' | 'companyName' | 'companyLogo'> & {
  projects: Array<{
    id: string
    name: string
    status: ProjectStatus
  }>
}

type AdminClientUser = {
  client: ClientWithProjects
  id: string
  role: Role
}

export class UserRepository {
  private static instance: UserRepository
  
  private constructor() {}
  
  public static getInstance(): UserRepository {
    if (!UserRepository.instance) {
      UserRepository.instance = new UserRepository()
    }
    return UserRepository.instance
  }

  public getUserDetails = cache(async () => {
    try {
      const user = await authService.getCurrentUser()
      if (!user) return null

      // Try cache first
      const cached = await cacheService.get<UserWithClientDetails>(
        CACHE_KEYS.USER_DETAILS,
        { userId: user.id }
      )
      if (cached) {
        console.log('Using cached user details:', user.id)
        return cached
      }

      console.log('Fetching user details from database:', user.id)
      // Get fresh data from database with optimized select
      const dbUser = await db.user.findUnique({
        where: { id: user.id },
        select: userSelect
      })

      if (!dbUser) {
        console.warn('User found in auth but not in database:', user.id)
        return null
      }

      // For admin users, ensure they have access to all clients
      if (dbUser.role === 'ADMIN') {
        // Try cache for admin clients
        const cachedClients = await cacheService.get<ClientWithProjects[]>(CACHE_KEYS.ADMIN_CLIENTS)
        const allClients = cachedClients || await db.client.findMany({
          select: {
            id: true,
            companyName: true,
            companyLogo: true,
            projects: {
              select: {
                id: true,
                name: true,
                status: true
              }
            }
          }
        }) as ClientWithProjects[]

        if (!cachedClients) {
          await cacheService.set(CACHE_KEYS.ADMIN_CLIENTS, allClients, CACHE_TTLS.ADMIN_CLIENTS)
        }

        const existingClientIds = new Set(dbUser.clientUsers.map(cu => cu.client.id))
        const missingClients = allClients.filter(c => !existingClientIds.has(c.id))

        if (missingClients.length > 0) {
          const adminClientUsers: AdminClientUser[] = missingClients.map(client => ({
            client,
            id: `admin-${client.id}`,
            role: 'ADMIN'
          }))

          dbUser.clientUsers = [...dbUser.clientUsers, ...adminClientUsers] as typeof dbUser.clientUsers
        }
      }

      // Cache the result
      await cacheService.set(
        CACHE_KEYS.USER_DETAILS,
        dbUser,
        CACHE_TTLS.USER_DETAILS,
        { userId: user.id }
      )
      return dbUser
    } catch (error) {
      console.error('Error in getUserDetails:', error)
      return null
    }
  })

  public async getUsersByRole(role: Role) {
    try {
      // Try cache first
      const cached = await cacheService.get<UserWithClientDetails[]>(
        CACHE_KEYS.USER_BY_ROLE,
        { role }
      )
      if (cached) return cached

      const users = await db.user.findMany({
        where: { role },
        select: userSelect,
        orderBy: { createdAt: 'desc' }
      })

      // Cache the result
      await cacheService.set(
        CACHE_KEYS.USER_BY_ROLE,
        users,
        CACHE_TTLS.USER_BY_ROLE,
        { role }
      )
      return users
    } catch (error) {
      console.error('Error in getUsersByRole:', error)
      return []
    }
  }

  public async getUsersByClient(clientId: string) {
    try {
      // Try cache first
      const cached = await cacheService.get<Array<{ user: UserWithClientDetails }>>(
        CACHE_KEYS.USER_BY_CLIENT,
        { clientId }
      )
      if (cached) return cached

      const users = await db.clientUser.findMany({
        where: { 
          clientId,
          isPending: false
        },
        select: {
          user: {
            select: userSelect
          }
        },
        orderBy: { createdAt: 'desc' }
      })

      // Cache the result
      await cacheService.set(
        CACHE_KEYS.USER_BY_CLIENT,
        users,
        CACHE_TTLS.USER_BY_CLIENT,
        { clientId }
      )
      return users
    } catch (error) {
      console.error('Error in getUsersByClient:', error)
      return []
    }
  }

  // Cache invalidation methods
  public async invalidateUserCache(userId: string) {
    await cacheService.delete(CACHE_KEYS.USER_DETAILS, { userId })
  }

  public async invalidateRoleCache(role: Role) {
    await cacheService.delete(CACHE_KEYS.USER_BY_ROLE, { role })
  }

  public async invalidateClientCache(clientId: string) {
    await cacheService.delete(CACHE_KEYS.USER_BY_CLIENT, { clientId })
    await cacheService.delete(CACHE_KEYS.ADMIN_CLIENTS)
  }
}

export const userRepository = UserRepository.getInstance()