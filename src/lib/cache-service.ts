import { LRUCache } from 'lru-cache'
import type Redis from 'ioredis'

// Create Redis client outside of the class
let redisClient: Redis | null = null
let redisConnectionAttempted = false
let redisConnectionFailed = false

// Initialize Redis only on server side
if (typeof window === 'undefined') {
  import('ioredis').then(({ default: Redis }) => {
    // Only initialize if REDIS_URL is set and Redis is enabled
    if (process.env.REDIS_URL && process.env.REDIS_ENABLED === 'true') {
      redisConnectionAttempted = true
      try {
        redisClient = new Redis(process.env.REDIS_URL, {
          maxRetriesPerRequest: 1,
          retryStrategy: (times) => {
            // Stop retrying after 3 attempts
            if (times > 3) {
              redisConnectionFailed = true
              return null // Stop retrying
            }
            const delay = Math.min(times * 1000, 3000)
            return delay
          },
          reconnectOnError: (err) => {
            // Only reconnect on certain errors, not DNS/connection errors
            const errorMessage = err.message.toLowerCase()
            if (errorMessage.includes('enotfound') || 
                errorMessage.includes('econnrefused') ||
                errorMessage.includes('timeout')) {
              redisConnectionFailed = true
              return false // Don't reconnect
            }
            return true
          },
          lazyConnect: true,
          enableReadyCheck: false,
          keepAlive: 1000,
          connectionName: 'cache-service',
          tls: process.env.REDIS_URL?.includes('rediss://') ? {
            rejectUnauthorized: false
          } : undefined,
          // Add connection timeout
          connectTimeout: 5000,
          // Don't throw errors on connection failures
          showFriendlyErrorStack: false
        })

        // Suppress error logging after initial connection failure
        redisClient.on('error', (error) => {
          // Only log the first error, then suppress subsequent errors
          if (!redisConnectionFailed) {
            console.warn('Redis connection error (will use local cache fallback):', error.message)
            redisConnectionFailed = true
          }
        })

        redisClient.on('connect', () => {
          console.log('Redis connected successfully')
          redisConnectionFailed = false
        })

        // Attempt to connect, but don't block if it fails
        redisClient.connect().catch(() => {
          // Silently handle connection failures - we'll use local cache
          redisConnectionFailed = true
        })
      } catch (error) {
        // Silently handle initialization errors
        redisConnectionFailed = true
        redisClient = null
      }
    }
  }).catch(() => {
    // Silently handle import errors - Redis is optional
    redisClient = null
  })
}

interface CacheConfig {
  enabled: boolean
  localFallback: boolean
  maxRetries: number
  retryDelay: number
  cacheTTL: number
  serialization: {
    enabled: boolean
    threshold: number // in bytes
  }
}

interface CacheMetrics {
  hits: number
  misses: number
  errors: number
  serializationRatio: number
  avgResponseTime: number
  responseTimes: number[]
}

class CacheService {
  private localCache: LRUCache<string, any>
  private config: CacheConfig
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    errors: 0,
    serializationRatio: 0,
    avgResponseTime: 0,
    responseTimes: []
  }
  private prefetchQueue: Set<string> = new Set()
  private readonly MAX_RESPONSE_TIMES = 1000

  constructor() {
    this.config = {
      enabled: process.env.REDIS_ENABLED === 'true',
      localFallback: true,
      maxRetries: parseInt(process.env.REDIS_MAX_RETRIES || '3', 10),
      retryDelay: parseInt(process.env.REDIS_RETRY_DELAY || '1000', 10),
      cacheTTL: parseInt(process.env.REDIS_CACHE_TTL || '300', 10),
      serialization: {
        enabled: true,
        threshold: 1024 // 1KB
      }
    }

    // Initialize local LRU cache
    this.localCache = new LRUCache({
      max: 500,
      ttl: 1000 * 60 * 5, // 5 minutes
    })
  }

  private serialize(data: string): string {
    return Buffer.from(data).toString('base64')
  }

  private deserialize(data: string): string {
    return Buffer.from(data, 'base64').toString()
  }

  private shouldSerialize(data: string): boolean {
    return this.config.serialization.enabled && 
           data.length > this.config.serialization.threshold
  }

  private recordResponseTime(startTime: number) {
    const duration = Date.now() - startTime
    this.metrics.responseTimes.push(duration)
    if (this.metrics.responseTimes.length > this.MAX_RESPONSE_TIMES) {
      this.metrics.responseTimes.shift()
    }
    this.metrics.avgResponseTime = this.metrics.responseTimes.reduce((a, b) => a + b, 0) / 
                                 this.metrics.responseTimes.length
  }

  async get<T>(key: string, params?: Record<string, unknown>): Promise<T | null> {
    const startTime = Date.now()
    const finalKey = this.generateKey(key, params)

    try {
      // Check local cache first
      const localValue = this.localCache.get(finalKey)
      if (localValue) {
        this.metrics.hits++
        this.recordResponseTime(startTime)
        return localValue as T
      }

      // If Redis is not available, disabled, or connection failed, return null
      if (!redisClient || typeof window !== 'undefined' || redisConnectionFailed) {
        this.metrics.misses++
        return null
      }

      const redisValue = await redisClient.get(finalKey).catch(() => {
        // If Redis operation fails, mark as failed and return null
        redisConnectionFailed = true
        return null
      })
      
      if (!redisValue || typeof redisValue !== 'string') {
        this.metrics.misses++
        this.recordResponseTime(startTime)
        return null
      }

      // Handle serialized data
      let parsed
      if (redisValue.startsWith('serialized:')) {
        const serialized = redisValue.slice(11)
        const deserialized = this.deserialize(serialized)
        parsed = JSON.parse(deserialized)
      } else {
        parsed = JSON.parse(redisValue)
      }

      // Update local cache
      this.localCache.set(finalKey, parsed)
      
      this.metrics.hits++
      this.recordResponseTime(startTime)
      return parsed as T
    } catch (error) {
      console.error('Cache get error:', error)
      this.metrics.errors++
      this.recordResponseTime(startTime)
      return null
    }
  }

  async set(key: string, value: any, ttl?: number, params?: Record<string, unknown>): Promise<void> {
    const startTime = Date.now()
    const finalKey = this.generateKey(key, params)

    try {
      // Update local cache
      this.localCache.set(finalKey, value)

      // If Redis is not available, disabled, or connection failed, return
      if (!redisClient || typeof window !== 'undefined' || redisConnectionFailed) {
        return
      }

      const serialized = JSON.stringify(value)
      let finalValue = serialized

      // Apply serialization if needed
      if (this.shouldSerialize(serialized)) {
        const encoded = this.serialize(serialized)
        finalValue = 'serialized:' + encoded
        
        // Update serialization ratio metric
        const ratio = encoded.length / serialized.length
        this.metrics.serializationRatio = (this.metrics.serializationRatio + ratio) / 2
      }

      await redisClient.set(
        finalKey,
        finalValue,
        'EX',
        ttl || this.config.cacheTTL
      ).catch(() => {
        // If Redis operation fails, mark as failed but don't throw
        redisConnectionFailed = true
      })
    } catch (error) {
      console.error('Cache set error:', error)
      this.metrics.errors++
    } finally {
      this.recordResponseTime(startTime)
    }
  }

  async delete(key: string, params?: Record<string, unknown>): Promise<void> {
    const finalKey = this.generateKey(key, params)
    
    // Remove from local cache
    this.localCache.delete(finalKey)

    // If Redis is not available, disabled, or connection failed, return
    if (!redisClient || typeof window !== 'undefined' || redisConnectionFailed) {
      return
    }

    try {
      await redisClient.del(finalKey).catch(() => {
        redisConnectionFailed = true
      })
    } catch (error) {
      // Silently handle delete errors
      redisConnectionFailed = true
      this.metrics.errors++
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    // Clear matching keys from local cache
    for (const key of this.localCache.keys()) {
      if (key.includes(pattern.replace('*', ''))) {
        this.localCache.delete(key)
      }
    }

    // If Redis is not available, disabled, or connection failed, return
    if (!redisClient || typeof window !== 'undefined' || redisConnectionFailed) {
      return
    }

    try {
      const keys = await redisClient.keys(pattern).catch(() => {
        redisConnectionFailed = true
        return []
      })
      if (keys.length > 0) {
        await redisClient.del(...keys).catch(() => {
          redisConnectionFailed = true
        })
      }
    } catch (error) {
      // Silently handle invalidation errors
      redisConnectionFailed = true
      this.metrics.errors++
    }
  }

  async prefetch(key: string, fetchFn: () => Promise<any>, ttl?: number, params?: Record<string, unknown>): Promise<void> {
    const finalKey = this.generateKey(key, params)
    
    // Avoid duplicate prefetch requests
    if (this.prefetchQueue.has(finalKey)) {
      return
    }

    this.prefetchQueue.add(finalKey)
    
    try {
      const value = await fetchFn()
      await this.set(key, value, ttl, params)
    } catch (error) {
      console.error('Prefetch error:', error)
      this.metrics.errors++
    } finally {
      this.prefetchQueue.delete(finalKey)
    }
  }

  generateKey(key: string, params?: Record<string, unknown>): string {
    if (!params) return key
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, k) => ({ ...acc, [k]: params[k] }), {})
    return `${key}:${JSON.stringify(sortedParams)}`
  }

  async isHealthy(): Promise<boolean> {
    // If Redis is disabled or we're in browser, consider it healthy (using local cache)
    if (!this.config.enabled || typeof window !== 'undefined') return true
    if (!redisClient || redisConnectionFailed) return false

    try {
      await redisClient.ping()
      return true
    } catch {
      redisConnectionFailed = true
      return false
    }
  }

  getMetrics(): CacheMetrics {
    return {
      ...this.metrics,
      responseTimes: this.metrics.responseTimes.slice(-10) // Only return last 10 response times
    }
  }
}

export const cacheService = new CacheService() 