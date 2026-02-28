import { PrismaClient } from '@prisma/client'

declare global {
  var prisma: PrismaClient | undefined
}

// Metrics tracking
interface QueryMetrics {
  totalQueries: number
  slowQueries: number
  errors: number
  queryDurations: number[]
  lastUpdated: Date
}

const metrics: QueryMetrics = {
  totalQueries: 0,
  slowQueries: 0,
  errors: 0,
  queryDurations: [],
  lastUpdated: new Date()
}

const MAX_DURATION_HISTORY = 100 // Keep last 100 query durations
const SLOW_QUERY_THRESHOLD = 500 // Lower threshold to 500ms

export function getDatabaseMetrics() {
  const totalDuration = metrics.queryDurations.reduce((sum, duration) => sum + duration, 0)
  const avgQueryDuration = metrics.queryDurations.length > 0 
    ? totalDuration / metrics.queryDurations.length 
    : 0

  // Calculate 95th percentile
  const sortedDurations = [...metrics.queryDurations].sort((a, b) => a - b)
  const p95Index = Math.floor(sortedDurations.length * 0.95)
  const p95QueryDuration = sortedDurations[p95Index] || 0

  return {
    totalQueries: metrics.totalQueries,
    slowQueries: metrics.slowQueries,
    slowQueryPercentage: metrics.totalQueries > 0 
      ? (metrics.slowQueries / metrics.totalQueries) * 100 
      : 0,
    errors: metrics.errors,
    avgQueryDuration,
    p95QueryDuration,
    recentQueryDurations: metrics.queryDurations.slice(-10), // Last 10 durations
    lastUpdated: metrics.lastUpdated
  }
}

const prismaClientSingleton = () => {
  const client = new PrismaClient({
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'stdout' },
      { level: 'warn', emit: 'stdout' }
    ],
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  })

  // Set up query logging
  client.$on('query', (e: any) => {
    const duration = e.duration
    metrics.totalQueries++
    metrics.queryDurations.push(duration)
    
    if (metrics.queryDurations.length > MAX_DURATION_HISTORY) {
      metrics.queryDurations.shift()
    }

    if (duration > SLOW_QUERY_THRESHOLD) {
      metrics.slowQueries++
      console.warn(`Slow query detected (${duration}ms):`, {
        model: e.model,
        operation: e.operation,
        duration,
        query: e.query
      })
    }

    // Log all queries in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`Query (${duration}ms):`, {
        model: e.model,
        operation: e.operation,
        query: e.query
      })
    }
  })

  return client.$extends({
    query: {
      async $allOperations({ operation, model, args, query }) {
        const start = Date.now()
        
        try {
          const result = await query(args)
          const duration = Date.now() - start
          
          metrics.lastUpdated = new Date()
          return result
        } catch (error: any) {
          // Update error metrics
          metrics.errors++
          metrics.lastUpdated = new Date()
          
          // Handle connection errors with retry
          if (error.message.includes('Connection pool timeout')) {
            console.warn(`Retrying ${model}.${operation} due to connection timeout`)
            await new Promise(resolve => setTimeout(resolve, 1000))
            return query(args)
          }
          throw error
        }
      }
    }
  }) as unknown as PrismaClient
}

export const db = globalThis.prisma ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = db
}

// Handle cleanup
process.on('beforeExit', async () => {
  await db.$disconnect()
})

process.on('SIGINT', async () => {
  await db.$disconnect()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await db.$disconnect()
  process.exit(0)
})