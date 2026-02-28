import { NextResponse } from 'next/server'
import { cacheService } from '@/lib/cache-service'

export async function POST(request: Request) {
  try {
    const { patterns } = await request.json()

    if (!Array.isArray(patterns)) {
      return NextResponse.json(
        { message: 'Invalid patterns array' },
        { status: 400 }
      )
    }

    // Invalidate each pattern
    await Promise.all(
      patterns.map(pattern => cacheService.invalidatePattern(pattern))
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Cache invalidation error:', error)
    return NextResponse.json(
      { message: 'Failed to invalidate cache' },
      { status: 500 }
    )
  }
} 