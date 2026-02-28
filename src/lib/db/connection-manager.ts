import { db } from '../db'
import { PrismaClient } from '@prisma/client'

interface ConnectionMetrics {
  totalConnections: number
  activeConnections: number
  idleConnections: number
  waitingConnections: number
  maxConnections: number
  connectionErrors: number
  lastError?: Error
  lastErrorTime?: Date
}

class ConnectionManager {
  private static instance: ConnectionManager
  private metrics: ConnectionMetrics = {
    totalConnections: 0,
    activeConnections: 0,
    idleConnections: 0,
    waitingConnections: 0,
    maxConnections: parseInt(process.env.POSTGRES_POOL_SIZE || '10', 10),
    connectionErrors: 0
  }
  private healthCheckInterval: NodeJS.Timeout | null = null
  private readonly HEALTH_CHECK_INTERVAL = 30000 // 30 seconds

  private constructor() {
    this.startHealthCheck()
    this.setupEventListeners()
  }

  public static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager()
    }
    return ConnectionManager.instance
  }

  private startHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
    }

    this.healthCheckInterval = setInterval(async () => {
      await this.checkConnection()
    }, this.HEALTH_CHECK_INTERVAL)
  }

  private setupEventListeners() {
    process.on('SIGINT', async () => {
      await this.cleanup()
      process.exit(0)
    })

    process.on('SIGTERM', async () => {
      await this.cleanup()
      process.exit(0)
    })

    process.on('uncaughtException', async (error) => {
      console.error('Uncaught exception:', error)
      this.metrics.connectionErrors++
      this.metrics.lastError = error
      this.metrics.lastErrorTime = new Date()
      await this.cleanup()
    })
  }

  public async checkConnection(): Promise<boolean> {
    try {
      // Try a simple query to check connection
      await db.$queryRaw`SELECT 1`
      
      // Update metrics
      const client = db as any
      if (client._engine?.pool) {
        const pool = client._engine.pool
        this.metrics.totalConnections = pool.totalCount
        this.metrics.activeConnections = pool.activeConnections
        this.metrics.idleConnections = pool.idleConnections
        this.metrics.waitingConnections = pool.waitingConnections
      }
      
      return true
    } catch (error) {
      console.error('Database connection check failed:', error)
      this.metrics.connectionErrors++
      this.metrics.lastError = error as Error
      this.metrics.lastErrorTime = new Date()
      return false
    }
  }

  public async cleanup(): Promise<void> {
    try {
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval)
        this.healthCheckInterval = null
      }

      await db.$disconnect()
      console.log('Database connections cleaned up')
    } catch (error) {
      console.error('Error during cleanup:', error)
      this.metrics.connectionErrors++
      this.metrics.lastError = error as Error
      this.metrics.lastErrorTime = new Date()
    }
  }

  public getMetrics(): ConnectionMetrics {
    return { ...this.metrics }
  }

  public async resetMetrics(): Promise<void> {
    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingConnections: 0,
      maxConnections: parseInt(process.env.POSTGRES_POOL_SIZE || '10', 10),
      connectionErrors: 0
    }
  }
}

export const connectionManager = ConnectionManager.getInstance()
export const checkConnection = () => connectionManager.checkConnection()
export const getConnectionMetrics = () => connectionManager.getMetrics() 