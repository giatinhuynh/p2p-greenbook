import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { userRepository } from '@/lib/repositories/user-repository'

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const body = await req.json()
    const { name, email, role } = body

    if (!name || !email) {
      return new NextResponse(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Check if user already exists
    const existingUser = await db.user.findFirst({
      where: { id: session.userId }
    })

    if (existingUser) {
      return new NextResponse(
        JSON.stringify({ error: 'User already exists' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Create new user
    const user = await db.user.create({
      data: {
        id: session.userId,
        name,
        email,
        role: role || 'USER'
      }
    })

    // Invalidate cache and revalidate paths
    await userRepository.invalidateUserCache(session.userId)
    revalidatePath(`/user/${session.userId}`)
    revalidatePath(`/user/${session.userId}/settings`)

    return NextResponse.json(user)
  } catch (error) {
    console.error('User initialization error:', error)
    if (error instanceof Error) {
      return new NextResponse(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
    return new NextResponse(
      JSON.stringify({ error: 'Internal Server Error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
} 