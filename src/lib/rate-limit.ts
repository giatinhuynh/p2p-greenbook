import { LRUCache } from 'lru-cache'

interface RateLimitConfig {
  interval: number
  limit: number
  uniqueTokenPerInterval?: number
}

interface RateLimitInfo {
  remaining: number
  reset: number
  total: number
}

const DEFAULT_CONFIGS = {
  DEFAULT: {
    interval: 60000, // 1 minute
    limit: 60,
    uniqueTokenPerInterval: 500
  },
  API: {
    interval: 60000,
    limit: 120,
    uniqueTokenPerInterval: 1000
  },
  AUTH: {
    interval: 300000, // 5 minutes
    limit: 20,
    uniqueTokenPerInterval: 200
  }
}

export class RateLimiter {
  private tokenCache: LRUCache<string, number[]>
  private config: RateLimitConfig

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIGS.DEFAULT,
      ...config
    }

    this.tokenCache = new LRUCache({
      max: this.config.uniqueTokenPerInterval || 500,
      ttl: this.config.interval
    })
  }

  public async check(
    req: Request,
    identifier: string
  ): Promise<RateLimitInfo> {
    const key = this.generateKey(req, identifier)
    const now = Date.now()
    
    const tokenCount = this.tokenCache.get(key) || [0, now]
    const [count, firstRequest] = tokenCount
    
    // Calculate time until reset
    const timeUntilReset = Math.max(0, this.config.interval - (now - firstRequest))
    
    if (count === 0) {
      this.tokenCache.set(key, [1, now])
    } else {
      tokenCount[0] = count + 1
      this.tokenCache.set(key, tokenCount)
    }

    const remaining = Math.max(0, this.config.limit - (count + 1))
    
    if (count >= this.config.limit) {
      throw new Error(JSON.stringify({
        error: 'Rate limit exceeded',
        remaining: 0,
        reset: Math.ceil(timeUntilReset / 1000), // seconds
        total: this.config.limit
      }))
    }

    return {
      remaining,
      reset: Math.ceil(timeUntilReset / 1000),
      total: this.config.limit
    }
  }

  private generateKey(req: Request, identifier: string): string {
    const ip = req.headers.get('x-forwarded-for') || 
               req.headers.get('x-real-ip') || 
               'unknown'
    
    return `${identifier}:${ip}`
  }
}

// Create instances for different rate limit configurations
export const rateLimiters = {
  default: new RateLimiter(DEFAULT_CONFIGS.DEFAULT),
  api: new RateLimiter(DEFAULT_CONFIGS.API),
  auth: new RateLimiter(DEFAULT_CONFIGS.AUTH)
}

// Helper function to apply rate limiting with proper error handling
export async function applyRateLimit(
  req: Request,
  identifier: string,
  type: keyof typeof rateLimiters = 'default'
): Promise<RateLimitInfo> {
  try {
    const limiter = rateLimiters[type]
    return await limiter.check(req, identifier)
  } catch (error) {
    if (error instanceof Error) {
      try {
        const rateLimitInfo = JSON.parse(error.message)
        throw new Error('Rate limit exceeded', { cause: rateLimitInfo })
      } catch {
        throw error
      }
    }
    throw error
  }
} 