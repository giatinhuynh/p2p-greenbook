import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { userRepository } from '@/lib/repositories/user-repository'

export async function PATCH(
  req: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await auth()
    if (!session?.userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Verify user is updating their own profile
    if (session.userId !== params.userId) {
      return new NextResponse('Cannot update another user\'s profile', { status: 403 })
    }

    const body = await req.json()
    const { userId } = params
    
    if (!body || !userId) {
      return new NextResponse('Invalid request: Missing required fields', { status: 400 })
    }

    // Find user by Clerk ID
    const existingUser = await db.user.findFirst({
      where: { id: userId }
    })

    if (!existingUser) {
      return new NextResponse('User not found', { status: 404 })
    }

    // Update user in database
    const user = await db.user.update({
      where: { id: userId },
      data: {
        name: body.name,
        email: body.email,
        role: body.role || existingUser.role // Keep existing role if not provided
      }
    })

    // Invalidate cache and revalidate paths
    await userRepository.invalidateUserCache(userId)
    revalidatePath(`/user/${userId}/settings`)
    revalidatePath(`/user/${userId}`)

    return NextResponse.json(user)
  } catch (error) {
    console.error('User update error:', error)
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