import { NextResponse } from 'next/server'
import { cacheService } from '@/lib/cache-service'
import { checkConnection } from '@/lib/db/connection-manager'
import { getDatabaseMetrics } from '@/lib/db'

export async function GET() {
  try {
    // Check Redis health
    const isRedisHealthy = await cacheService.isHealthy()
    
    // Check database connection
    const isDatabaseHealthy = await checkConnection()

    // Get metrics
    const dbMetrics = getDatabaseMetrics()
    const cacheMetrics = cacheService.getMetrics()

    // Test Redis operations
    const testKey = 'health-check-test'
    await cacheService.set(testKey, { timestamp: Date.now() })
    const testValue = await cacheService.get(testKey)
    await cacheService.delete(testKey)

    return NextResponse.json({
      status: 'healthy',
      redis: {
        status: isRedisHealthy ? 'connected' : 'disconnected',
        operations: testValue ? 'working' : 'failed',
        metrics: {
          hits: cacheMetrics.hits,
          misses: cacheMetrics.misses,
          hitRatio: cacheMetrics.hits / (cacheMetrics.hits + cacheMetrics.misses) || 0,
          errors: cacheMetrics.errors,
          compressionRatio: cacheMetrics.compressionRatio,
          avgResponseTime: Math.round(cacheMetrics.avgResponseTime),
          recentResponseTimes: cacheMetrics.responseTimes
        }
      },
      database: {
        status: isDatabaseHealthy ? 'connected' : 'disconnected',
        metrics: {
          totalQueries: dbMetrics.totalQueries,
          slowQueries: dbMetrics.slowQueries,
          slowQueryPercentage: dbMetrics.slowQueryPercentage,
          errors: dbMetrics.errors,
          p95QueryDuration: dbMetrics.p95QueryDuration,
          avgQueryDuration: dbMetrics.avgQueryDuration,
          recentQueryDurations: dbMetrics.recentQueryDurations
        }
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Health check failed:', error)
    return NextResponse.json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
} 