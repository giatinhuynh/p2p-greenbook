import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { analyticsService } from '@/lib/google-analytics/analytics-service'

export const dateRangeSchema = z.object({
  startDate: z.string().transform(str => {
    const date = new Date(str)
    // Ensure date is not in the future
    if (date > new Date()) {
      throw new Error('Start date cannot be in the future')
    }
    return date
  }),
  endDate: z.string().transform(str => {
    const date = new Date(str)
    // Ensure date is not in the future
    if (date > new Date()) {
      throw new Error('End date cannot be in the future')
    }
    return date
  })
})

export async function createAnalyticsHandler(
  projectId: string,
  schema: z.ZodSchema,
  handler: (data: any, config: any) => Promise<any>
) {
  try {
    const session = await auth()
    if (!session?.userId) {
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401 }
      )
    }

    const config = await db.analyticsConfig.findUnique({
      where: { projectId }
    })

    if (!config?.posthogEnabled || !config?.posthogProjectId) {
      return new NextResponse(
        JSON.stringify({ error: 'Analytics not configured for this project' }),
        { status: 400 }
      )
    }

    // Add debug logging
    console.log('Analytics request:', {
      projectId,
      posthogProjectId: config.posthogProjectId,
      config
    })

    const result = await handler(schema, config)

    // Add debug logging
    console.log('Analytics response:', {
      result
    })

    return new NextResponse(
      JSON.stringify(result),
      { 
        status: 200,
        headers: {
          'Cache-Control': 'private, max-age=300'
        }
      }
    )
  } catch (error) {
    console.error('Analytics handler error:', error)
    return new NextResponse(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500 }
    )
  }
} 