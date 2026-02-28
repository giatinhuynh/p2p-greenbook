import { currentUser, clerkClient, auth } from '@clerk/nextjs/server'

interface CacheEntry {
  user: Awaited<ReturnType<typeof currentUser>> | null
  timestamp: number
  metadata?: any
}

class AuthService {
  private static instance: AuthService
  private cache: {
    [key: string]: CacheEntry
  } = {}
  
  private readonly CACHE_DURATION = 15000 // 15 seconds
  private readonly MAX_CACHE_SIZE = 1000 // Maximum number of cached users
  private readonly CLEANUP_THRESHOLD = 0.8 // Clean up when cache is 80% full

  private constructor() {
    // Set up periodic cache cleanup
    setInterval(() => this.cleanupCache(), this.CACHE_DURATION * 2)
  }
  
  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService()
    }
    return AuthService.instance
  }

  private cleanupCache() {
    const now = Date.now()
    const cacheSize = Object.keys(this.cache).length

    // Only cleanup if cache is above threshold
    if (cacheSize > this.MAX_CACHE_SIZE * this.CLEANUP_THRESHOLD) {
      Object.entries(this.cache).forEach(([key, entry]) => {
        if (now - entry.timestamp > this.CACHE_DURATION) {
          delete this.cache[key]
        }
      })
    }
  }

  public async getCurrentUser() {
    try {
      // Get auth session first
      const session = await auth()
      if (!session || !session.userId) return null

      const cacheKey = session.userId
      const now = Date.now()

      // Check cache
      if (
        this.cache[cacheKey] && 
        (now - this.cache[cacheKey].timestamp < this.CACHE_DURATION)
      ) {
        return this.cache[cacheKey].user
      }

      // Fetch new data
      const user = await currentUser()
      
      // Update cache with user data
      this.cache[cacheKey] = {
        user,
        timestamp: now
      }

      // Cleanup cache if needed
      if (Object.keys(this.cache).length > this.MAX_CACHE_SIZE) {
        this.cleanupCache()
      }
      
      return user
    } catch (error) {
      console.error('Error getting current user:', error)
      return null
    }
  }

  public async getUserMetadata(userId: string) {
    try {
      const cacheKey = userId
      const now = Date.now()

      // Check cache first
      if (
        this.cache[cacheKey]?.metadata && 
        (now - this.cache[cacheKey].timestamp < this.CACHE_DURATION)
      ) {
        return this.cache[cacheKey].metadata
      }

      // Fetch metadata
      const client = await clerkClient()
      const metadata = await client.users.getUser(userId)
      
      // Update cache
      if (this.cache[cacheKey]) {
        this.cache[cacheKey].metadata = metadata
        this.cache[cacheKey].timestamp = now
      } else {
        this.cache[cacheKey] = {
          user: null,
          metadata,
          timestamp: now
        }
      }

      return metadata
    } catch (error) {
      console.error('Error getting user metadata:', error)
      return null
    }
  }
}

export const authService = AuthService.getInstance()